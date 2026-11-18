import requests
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from app.models import Account


class Command(BaseCommand):
    help = ("Tell Safaricom (Daraja C2B) where to send paybill/till payment notifications. "
            "Without --account it registers the server's MPESA_SHORTCODE with MPESA_CALLBACK_TOKEN, "
            "which belong to the first account.")

    def add_arguments(self, parser):
        parser.add_argument("--account", type=int, help="Register this account's own shortcode and callback token")

    def handle(self, *args, **options):
        required = ["MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_CALLBACK_BASE_URL"]
        if options["account"] is None:
            required += ["MPESA_CALLBACK_TOKEN", "MPESA_SHORTCODE"]
        missing = [name for name in required if not getattr(settings, name, "")]
        if missing:
            raise CommandError(f"Set these in the environment first: {', '.join(missing)}")

        if options["account"] is None:
            shortcode, callback_token = settings.MPESA_SHORTCODE, settings.MPESA_CALLBACK_TOKEN
        else:
            account = Account.objects.filter(pk=options["account"]).first()
            if account is None:
                raise CommandError(f"No account with id {options['account']}.")
            shortcode, _ = account.mpesa_credentials()
            if not shortcode:
                raise CommandError(f"{account} has no M-Pesa shortcode yet; add it under Team & account.")
            callback_token = account.mpesa_callback_token

        host = "api.safaricom.co.ke" if settings.MPESA_ENV == "production" else "sandbox.safaricom.co.ke"
        token_response = requests.get(
            f"https://{host}/oauth/v1/generate?grant_type=client_credentials",
            auth=(settings.MPESA_CONSUMER_KEY, settings.MPESA_CONSUMER_SECRET),
            timeout=30,
        )
        token_response.raise_for_status()
        access_token = token_response.json()["access_token"]

        base = f"{settings.MPESA_CALLBACK_BASE_URL.rstrip('/')}/api/paybill/{callback_token}"
        response = requests.post(
            f"https://{host}/mpesa/c2b/v2/registerurl",
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "ShortCode": shortcode,
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
