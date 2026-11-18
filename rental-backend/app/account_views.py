"""
The signed-in user, their account and its team.

  GET   api/me/                  who is signed in, their role and account
  GET   api/account/             account name, paybill callback URLs, SMS reminder settings
  PATCH api/account/             change them (owner and manager)
  GET   api/team/                members of the account
  POST  api/team/                add a member {username, email, first_name, last_name, role} (owner)
  PATCH api/team/<id>/           change a member's role {role} (owner)
  DELETE api/team/<id>/          remove a member (owner)
"""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import sms, tasks
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
        return Response({**user_summary(user), "account": {"id": user.account_id, "name": user.account.name}})


class AccountSerializer(serializers.ModelSerializer):
    paybill_validation_url = serializers.SerializerMethodField()
    paybill_confirmation_url = serializers.SerializerMethodField()
    sms_configured = serializers.SerializerMethodField()

    class Meta:
        model = Account
        fields = (
            "id", "name",
            "sms_reminders_enabled", "sms_days_before_due", "sms_overdue_every_days",
            "paybill_validation_url", "paybill_confirmation_url", "sms_configured",
        )
        read_only_fields = ("id",)

    def _callback(self, obj, kind):
        base = getattr(settings, "MPESA_CALLBACK_BASE_URL", "") or self.context["request"].build_absolute_uri("/")
        return f"{base.rstrip('/')}/api/paybill/{obj.mpesa_callback_token}/{kind}/"

    def get_sms_configured(self, obj):
        return sms.configured()

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

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is taken.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email already has an account.")
        return value


def _owners_left(account, without):
    return User.objects.filter(account=account, role=User.OWNER, is_active=True).exclude(pk=without.pk).exists()


class TeamView(APIView):
    permission_classes = [IsAccountMember]

    def get(self, request):
        members = User.objects.filter(account_id=request.user.account_id).order_by("date_joined")
        return Response([user_summary(member) for member in members])

    def post(self, request):
        serializer = TeamMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        account = request.user.account

        with transaction.atomic():
            member = User(
                username=data["username"],
                email=data["email"],
                first_name=data.get("first_name", ""),
                last_name=data.get("last_name", ""),
                account=account,
                role=data["role"],
                is_active=True,
            )
            # They choose their own password through "Forgot password"
            member.set_unusable_password()
            member.save()

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
        member.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)
