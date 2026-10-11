import requests
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Tell Safaricom (Daraja C2B) where to send paybill/till payment notifications."

    def handle(self, *args, **options):
        required = ("MPESA_CALLBACK_TOKEN", "MPESA_SHORTCODE", "MPESA_CONSUMER_KEY",
                    "MPESA_CONSUMER_SECRET", "MPESA_CALLBACK_BASE_URL")
        missing = [name for name in required if not getattr(settings, name, "")]
        if missing:
            raise CommandError(f"Set these in the environment first: {', '.join(missing)}")

        host = "api.safaricom.co.ke" if settings.MPESA_ENV == "production" else "sandbox.safaricom.co.ke"
        token_response = requests.get(
            f"https://{host}/oauth/v1/generate?grant_type=client_credentials",
            auth=(settings.MPESA_CONSUMER_KEY, settings.MPESA_CONSUMER_SECRET),
            timeout=30,
        )
        token_response.raise_for_status()
        access_token = token_response.json()["access_token"]

        base = f"{settings.MPESA_CALLBACK_BASE_URL.rstrip('/')}/api/paybill/{settings.MPESA_CALLBACK_TOKEN}"
        response = requests.post(
            f"https://{host}/mpesa/c2b/v2/registerurl",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "ShortCode": settings.MPESA_SHORTCODE,
                "ResponseType": "Completed",
                "ConfirmationURL": f"{base}/confirmation/",
                "ValidationURL": f"{base}/validation/",
            },
            timeout=30,
        )
        self.stdout.write(response.text)
        if not response.ok:
            raise CommandError("Safaricom did not accept the registration.")
        self.stdout.write(self.style.SUCCESS("Paybill notification URLs registered."))
