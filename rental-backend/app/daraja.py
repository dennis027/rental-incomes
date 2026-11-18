"""
Safaricom Daraja: the "pay now" prompt on a tenant's phone (Lipa na M-Pesa Online / STK push).

Needs MPESA_SHORTCODE, MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_PASSKEY and
MPESA_CALLBACK_BASE_URL (the public address of this API). MPESA_ENV picks sandbox or production.
"""
import base64
import logging

import requests
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)

REQUIRED = ("MPESA_SHORTCODE", "MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_PASSKEY", "MPESA_CALLBACK_BASE_URL")


class DarajaError(Exception):
    pass


def stk_configured():
    return all(getattr(settings, name, "") for name in REQUIRED)


def _host():
    return "api.safaricom.co.ke" if settings.MPESA_ENV == "production" else "sandbox.safaricom.co.ke"


def access_token():
    """An OAuth token, reused until shortly before it expires (Safaricom issues them for an hour)."""
    key = f"daraja:token:{settings.MPESA_ENV}:{settings.MPESA_CONSUMER_KEY[-6:]}"
    token = cache.get(key)
    if token:
        return token
    try:
        response = requests.get(
            f"https://{_host()}/oauth/v1/generate?grant_type=client_credentials",
            auth=(settings.MPESA_CONSUMER_KEY, settings.MPESA_CONSUMER_SECRET),
            timeout=30,
        )
        response.raise_for_status()
        token = response.json()["access_token"]
    except (requests.RequestException, KeyError, ValueError) as error:
        logger.warning("Daraja token request failed: %s", error)
        raise DarajaError("Could not sign in to M-Pesa. Check the Daraja keys.")
    cache.set(key, token, timeout=50 * 60)
    return token


def stk_push(phone, amount, reference, description, callback_url):
    """
    Ask Safaricom to show a payment prompt on `phone` (2547XXXXXXXX).
    Returns (merchant_request_id, checkout_request_id); raises DarajaError when it is refused.
    """
    timestamp = timezone.localtime().strftime("%Y%m%d%H%M%S")
    password = base64.b64encode(f"{settings.MPESA_SHORTCODE}{settings.MPESA_PASSKEY}{timestamp}".encode()).decode()
    payload = {
        "BusinessShortCode": settings.MPESA_SHORTCODE,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": getattr(settings, "MPESA_TRANSACTION_TYPE", "") or "CustomerPayBillOnline",
        "Amount": int(amount),
        "PartyA": phone,
        "PartyB": settings.MPESA_SHORTCODE,
        "PhoneNumber": phone,
        "CallBackURL": callback_url,
        # Shown on the tenant's prompt and statement; Safaricom limits the lengths
        "AccountReference": reference[:12],
        "TransactionDesc": description[:13],
    }
    try:
        response = requests.post(
            f"https://{_host()}/mpesa/stkpush/v1/processrequest",
            json=payload,
            headers={"Authorization": f"Bearer {access_token()}"},
            timeout=30,
        )
        data = response.json()
    except (requests.RequestException, ValueError) as error:
        logger.warning("STK push failed: %s", error)
        raise DarajaError("Could not reach M-Pesa. Try again in a moment.")
    if str(data.get("ResponseCode")) != "0":
        raise DarajaError(data.get("errorMessage") or data.get("ResponseDescription") or "M-Pesa refused the request.")
    return data.get("MerchantRequestID", ""), data["CheckoutRequestID"]
