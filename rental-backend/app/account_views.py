"""
The signed-in user, their account and its team.

  GET   api/me/                  who is signed in, their role and account
  GET   api/account/             account name, SMS reminder and M-Pesa settings; the secret
                                 paybill callback URLs only for owners and managers
  PATCH api/account/             change them (owner and manager)
  GET   api/team/                members of the account
  POST  api/team/                add a member {username, email, first_name, last_name, role} (owner);
                                 someone removed earlier is brought back with the new role
  PATCH api/team/<id>/           change a member's role {role} (owner)
  DELETE api/team/<id>/          remove a member (owner)
"""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from . import daraja, sms, tasks
from .models import Account
from .permissions import IsAccountMember

User = get_user_model()


def user_summary(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "role_label": user.get_role_display(),
        "is_active": user.is_active,
    }


class MeView(APIView):
    permission_classes = [IsAccountMember]

    def get(self, request):
        user = request.user
        account = {"id": user.account_id, "name": user.account.name} if user.account_id else None
        return Response({**user_summary(user), "account": account})


# Who may see the paybill callback URLs. The token in them is the only thing
# that authenticates Safaricom's payment reports, so it is a secret.
CALLBACK_ROLES = {User.OWNER, User.MANAGER}


class AccountSerializer(serializers.ModelSerializer):
    paybill_validation_url = serializers.SerializerMethodField()
    paybill_confirmation_url = serializers.SerializerMethodField()
    sms_configured = serializers.SerializerMethodField()
    # Write-only: never sent back, only whether one is saved
    mpesa_passkey = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=128)
    mpesa_passkey_set = serializers.SerializerMethodField()
    stk_configured = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = (
            "id", "name",
            "sms_reminders_enabled", "sms_days_before_due", "sms_overdue_every_days",
            "paybill_validation_url", "paybill_confirmation_url", "sms_configured",
            "mpesa_shortcode", "mpesa_passkey", "mpesa_passkey_set", "stk_configured",
        )
        read_only_fields = ("id",)

    def _callback(self, obj, kind):
        if self.context["request"].user.role not in CALLBACK_ROLES:
            return None
        base = getattr(settings, "MPESA_CALLBACK_BASE_URL", "") or self.context["request"].build_absolute_uri("/")
        return f"{base.rstrip('/')}/api/paybill/{obj.mpesa_callback_token}/{kind}/"

    def get_sms_configured(self, obj):
        return sms.configured()

    def get_mpesa_passkey_set(self, obj):
        return bool(obj.mpesa_passkey)

    def get_stk_configured(self, obj):
        return daraja.stk_configured(obj)

    def validate_mpesa_shortcode(self, value):
        value = value.strip()
        if value and not (value.isdigit() and 5 <= len(value) <= 7):
            raise serializers.ValidationError("Enter the 5 to 7 digit paybill number.")
        return value

    def validate(self, data):
        touched = {"mpesa_shortcode", "mpesa_passkey"} & set(data)
        if not touched:
            return data
        # Where tenants' rent is paid is the owner's decision alone
        if self.context["request"].user.role != User.OWNER:
            raise PermissionDenied("Only an owner can change the M-Pesa paybill.")
        account = self.instance
        shortcode = data.get("mpesa_shortcode", account.mpesa_shortcode)
        passkey = data.get("mpesa_passkey", "")
        if not shortcode:
            # Clearing the paybill clears its passkey with it
            data["mpesa_shortcode"], data["mpesa_passkey"] = "", ""
            return data
        # A passkey belongs to one shortcode: a new paybill needs its own, and
        # no paybill may be saved without one
        if shortcode != account.mpesa_shortcode or not account.mpesa_passkey:
            if not passkey:
                raise serializers.ValidationError({"mpesa_passkey": ["Enter the passkey for this paybill."]})
        if not passkey:
            data.pop("mpesa_passkey", None)  # same paybill, keep the saved passkey
        return data

    def get_paybill_validation_url(self, obj):
        return self._callback(obj, "validation")

    def get_paybill_confirmation_url(self, obj):
        return self._callback(obj, "confirmation")

    def validate_sms_days_before_due(self, value):
        if value > 15:
            raise serializers.ValidationError("Choose 15 days or fewer.")
        return value

    def validate_sms_overdue_every_days(self, value):
        if not 1 <= value <= 30:
            raise serializers.ValidationError("Choose between 1 and 30 days.")
        return value


class AccountView(APIView):
    permission_classes = [IsAccountMember]

    def get(self, request):
        return Response(AccountSerializer(request.user.account, context={"request": request}).data)

    def patch(self, request):
        serializer = AccountSerializer(request.user.account, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class TeamMemberSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=User.ROLES)

    def _taken(self, field, value):
        """
        Another user with this username or email blocks it, unless it is someone
        removed from this same account: then adding them again brings them back.
        """
        others = User.objects.filter(**{f"{field}__iexact": value})
        returning = self.context.get("returning")
        if returning is not None:
            others = others.exclude(pk=returning.pk)
        return others.exists()

    def validate(self, data):
        matches = list(User.objects.filter(
            Q(username__iexact=data["username"]) | Q(email__iexact=data["email"]),
            account_id=self.context["account"].id, is_active=False,
        )[:2])
        # Two different removed members match: leave it to the checks below
        returning = matches[0] if len(matches) == 1 else None
        self.context["returning"] = returning
        errors = {}
        if self._taken("username", data["username"]):
            errors["username"] = ["This username is taken."]
        if self._taken("email", data["email"]):
            errors["email"] = ["This email already has an account."]
        if errors:
            raise serializers.ValidationError(errors)
        data["returning"] = returning
        return data


def end_sessions(user):
    """Blacklist every refresh token the user holds, so no earlier sign-in can be renewed."""
    for token in OutstandingToken.objects.filter(user=user).exclude(blacklistedtoken__isnull=False):
        BlacklistedToken.objects.get_or_create(token=token)


def _owners_left(account, without):
    return User.objects.filter(account=account, role=User.OWNER, is_active=True).exclude(pk=without.pk).exists()


class TeamView(APIView):
    permission_classes = [IsAccountMember]

    def get(self, request):
        members = User.objects.filter(account_id=request.user.account_id).order_by("date_joined")
        return Response([user_summary(member) for member in members])

    def post(self, request):
        account = request.user.account
        serializer = TeamMemberSerializer(data=request.data, context={"account": account})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            # Someone removed earlier keeps their history (the invoices and
            # payments they recorded) and comes back with the new role
            member = data["returning"] or User(account=account)
            member.username = data["username"]
            member.email = data["email"]
            member.first_name = data.get("first_name", "")
            member.last_name = data.get("last_name", "")
            member.role = data["role"]
            member.is_active = True
            member.removed_at = None
            # They choose their own password through "Forgot password"
            member.set_unusable_password()
            member.save()
            if data["returning"] is not None:
                # Sign-ins from before they were removed must not come back to life
                end_sessions(member)

            login_url = getattr(settings, "FRONTEND_URL", "")
            where = f" at {login_url.rstrip('/')}/login" if login_url else ""
            message = (
                f"Hi {member.first_name or member.username},\n\n"
                f"{request.user.get_full_name() or request.user.username} added you to {account.name} on KodiDesk "
                f"as {member.get_role_display().lower()}.\n\n"
                f"To sign in for the first time, open the KodiDesk sign-in page{where}, choose \"Forgot password\" "
                f"and enter this email address. You will get a code to set your password.\n"
            )
            transaction.on_commit(lambda: tasks.send_email.delay(
                f"You have been added to {account.name} on KodiDesk", message, [member.email]
            ))
        return Response(user_summary(member), status=status.HTTP_201_CREATED)


class TeamMemberView(APIView):
    permission_classes = [IsAccountMember]

    def _member(self, request, pk):
        return get_object_or_404(User, pk=pk, account_id=request.user.account_id)

    def patch(self, request, pk):
        member = self._member(request, pk)
        role = request.data.get("role")
        if role not in dict(User.ROLES):
            return Response({"role": ["Choose a valid role."]}, status=status.HTTP_400_BAD_REQUEST)
        if member.role == User.OWNER and role != User.OWNER and not _owners_left(member.account, member):
            return Response({"error": "The account needs at least one owner."}, status=status.HTTP_400_BAD_REQUEST)
        member.role = role
        member.save(update_fields=["role"])
        return Response(user_summary(member))

    def delete(self, request, pk):
        member = self._member(request, pk)
        if member.pk == request.user.pk:
            return Response({"error": "You cannot remove yourself."}, status=status.HTTP_400_BAD_REQUEST)
        if member.role == User.OWNER and not _owners_left(member.account, member):
            return Response({"error": "The account needs at least one owner."}, status=status.HTTP_400_BAD_REQUEST)
        # Kept, not deleted, so the invoices and payments they recorded still name them
        member.is_active = False
        member.removed_at = timezone.now()
        # Also voids any activation link or password they were sent
        member.set_unusable_password()
        member.save(update_fields=["is_active", "removed_at", "password"])
        end_sessions(member)
        return Response(status=status.HTTP_204_NO_CONTENT)
