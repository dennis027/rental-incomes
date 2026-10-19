"""
Forms on the public website: "Contact us" and "Request a demo".

Nothing is stored; each submission is emailed to CONTACT_NOTIFY_EMAIL with the
sender as Reply-To, so answering is just replying to the email.
"""
import logging

from django.conf import settings
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import security, tasks

logger = logging.getLogger(__name__)


class ContactSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True)
    subject = serializers.CharField(max_length=150, required=False, allow_blank=True)
    message = serializers.CharField(max_length=5000)
    # Hidden field people never see; bots that fill every input fill it in
    website = serializers.CharField(required=False, allow_blank=True)


class DemoRequestSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=60)
    last_name = serializers.CharField(max_length=60)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=30)
    role = serializers.CharField(max_length=60)
    units = serializers.CharField(max_length=30)
    source = serializers.CharField(max_length=100, required=False, allow_blank=True)
    website = serializers.CharField(required=False, allow_blank=True)


class PublicFormView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []  # a stale token in the browser must not block the form
    serializer_class = None
    form_name = ""
    success_message = ""

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        if not serializer.is_valid():
            return Response({"success": False, "details": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        if data.get("website"):
            # Looks fine to the bot, reaches nobody
            return Response({"success": True, "message": self.success_message}, status=status.HTTP_201_CREATED)
        if security.public_form_limited(request, self.form_name):
            return Response({
                "success": False,
                "message": "Too many messages from this address. Please try again in an hour.",
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)
        if not settings.CONTACT_NOTIFY_EMAIL:
            logger.error("%s form submitted but CONTACT_NOTIFY_EMAIL is not set", self.form_name)
            return self.unavailable()

        subject, body = self.email(data)
        try:
            tasks.send_email.delay(subject, body, [settings.CONTACT_NOTIFY_EMAIL], reply_to=[data["email"]])
        except Exception:
            # Only reachable when tasks run inline (no worker): the SMTP send itself failed
            logger.exception("Could not send %s form email", self.form_name)
            return self.unavailable()
        return Response({"success": True, "message": self.success_message}, status=status.HTTP_201_CREATED)

    def unavailable(self):
        return Response({
            "success": False,
            "message": "We couldn't send your message just now. Please try again later.",
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    def email(self, data):
        raise NotImplementedError


class ContactView(PublicFormView):
    serializer_class = ContactSerializer
    form_name = "contact"
    success_message = "Thanks for getting in touch. We'll reply by email soon."

    def email(self, data):
        subject = f"Website message: {data.get('subject') or 'General enquiry'}"
        body = (
            f"From: {data['name']} <{data['email']}>\n"
            f"Phone: {data.get('phone') or '-'}\n\n"
            f"{data['message']}\n"
        )
        return subject, body


class DemoRequestView(PublicFormView):
    serializer_class = DemoRequestSerializer
    form_name = "demo"
    success_message = "Thanks! We'll contact you within one working day to set up your demo."

    def email(self, data):
        name = f"{data['first_name']} {data['last_name']}"
        subject = f"Demo request: {name} ({data['units']} units)"
        body = (
            f"Name: {name}\n"
            f"Email: {data['email']}\n"
            f"Phone: {data['phone']}\n"
            f"Role: {data['role']}\n"
            f"Units: {data['units']}\n"
            f"Heard about us: {data.get('source') or '-'}\n"
        )
        return subject, body
