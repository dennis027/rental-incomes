"""
SMS rent reminders through Africa's Talking.

Set AT_USERNAME and AT_API_KEY (and AT_SENDER_ID once Africa's Talking has
approved one) to switch it on. Use the username "sandbox" with a sandbox key
to try it without sending real texts.
"""
import logging
import re
from datetime import timedelta

import requests
from django.conf import settings
from django.utils import timezone

from . import billing
from .models import Account, SmsMessage
from .tenancy import reset_current_account, set_current_account

logger = logging.getLogger(__name__)


class SmsNotConfigured(Exception):
    pass


def configured():
    return bool(getattr(settings, "AT_USERNAME", "") and getattr(settings, "AT_API_KEY", ""))


def kenyan_number(phone):
    """0712 345 678, 254712345678 and +254712345678 all become +254712345678; None if it is not a mobile number."""
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("0") and len(digits) == 10:
        digits = "254" + digits[1:]
    elif len(digits) == 9 and digits[0] in "17":
        digits = "254" + digits
    if len(digits) == 12 and digits.startswith("254") and digits[3] in "17":
        return "+" + digits
    return None


def send_sms(phone, message):
    """Send one text. Returns None when it was accepted, otherwise why it was not."""
    if not configured():
        raise SmsNotConfigured()
    number = kenyan_number(phone)
    if number is None:
        return "Not a Kenyan mobile number"
    host = "api.sandbox.africastalking.com" if settings.AT_USERNAME == "sandbox" else "api.africastalking.com"
    data = {"username": settings.AT_USERNAME, "to": number, "message": message}
    if getattr(settings, "AT_SENDER_ID", ""):
        data["from"] = settings.AT_SENDER_ID
    try:
        response = requests.post(
            f"https://{host}/version1/messaging",
            data=data,
            headers={"apiKey": settings.AT_API_KEY, "Accept": "application/json"},
            timeout=15,
        )
        response.raise_for_status()
        recipients = response.json().get("SMSMessageData", {}).get("Recipients", [])
    except (requests.RequestException, ValueError) as error:
        logger.warning("SMS to %s failed: %s", number, error)
        return "Could not reach the SMS provider"
    if not recipients or recipients[0].get("status") != "Success":
        status = recipients[0].get("status") if recipients else "Rejected"
        return f"Not sent: {status}"[:255]
    return None


def _money(value):
    return f"KES {value:,.0f}"


def _pay_line(row):
    shortcode = getattr(settings, "MPESA_SHORTCODE", "")
    return f" Pay via M-Pesa paybill {shortcode}, account {row['unit']}." if shortcode else ""


def reminder_text(row, kind, account_name, today=None):
    today = today or timezone.localdate()
    first = row["customer_name"].split(" ")[0]
    place = f"{row['unit']}, {row['property']}"
    if kind == SmsMessage.DUE and row["due_date"] >= today:
        when = "today" if row["due_date"] == today else f"on {row['due_date']:%d %b}"
        text = f"Hi {first}, your rent of {_money(row['outstanding'])} for {place} is due {when}."
    elif row["days_overdue"] > 0:
        days = row["days_overdue"]
        text = (f"Hi {first}, your rent balance of {_money(row['outstanding'])} for {place} "
                f"is {days} day{'s' if days != 1 else ''} overdue. Please pay as soon as you can.")
    else:
        text = f"Hi {first}, you have a rent balance of {_money(row['outstanding'])} for {place}."
    return f"{text}{_pay_line(row)} - {account_name}"


def send_reminder(row, kind, account):
    """Text one arrears row and keep a record of it."""
    message = reminder_text(row, kind, account.name)
    error = send_sms(row["customer_phone"], message)
    SmsMessage.objects.create(
        account=account, contract_id=row["contract_id"], invoice_number=row["invoice_number"],
        phone=row["customer_phone"], message=message, kind=kind, sent=error is None, error=error or "",
    )
    return error


def due_reminders(account, today=None):
    """The arrears rows that should get an automatic text today, with the kind of text."""
    today = today or timezone.localdate()
    picked = []
    for row in billing.arrears(today=today):
        if not row["is_active"]:
            continue
        days_to_due = (row["due_date"] - today).days
        if 0 <= days_to_due <= account.sms_days_before_due:
            # Once per invoice
            already = SmsMessage.objects.filter(
                contract_id=row["contract_id"], invoice_number=row["invoice_number"], kind=SmsMessage.DUE, sent=True,
            ).exists()
            if not already:
                picked.append((row, SmsMessage.DUE))
        elif row["days_overdue"] > 0:
            since = timezone.now() - timedelta(days=account.sms_overdue_every_days)
            recent = SmsMessage.objects.filter(
                contract_id=row["contract_id"], kind__in=[SmsMessage.OVERDUE, SmsMessage.MANUAL],
                sent=True, created_at__gte=since,
            ).exists()
            if not recent:
                picked.append((row, SmsMessage.OVERDUE))
    return picked


def send_daily_reminders(today=None):
    """Run once a day: texts every tenant who is due soon or overdue, in every account that switched it on."""
    if not configured():
        logger.info("SMS reminders skipped: Africa's Talking is not configured")
        return 0
    sent = 0
    for account in Account.objects.filter(sms_reminders_enabled=True):
        token = set_current_account(account.id)
        try:
            for row, kind in due_reminders(account, today):
                if send_reminder(row, kind, account) is None:
                    sent += 1
        finally:
            reset_current_account(token)
    return sent
