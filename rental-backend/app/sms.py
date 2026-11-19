"""
Rent reminders to tenants: by SMS through Africa's Talking, by WhatsApp (see
whatsapp.py), or both, as each account chooses (Account.reminder_channel).

Set AT_USERNAME and AT_API_KEY (and AT_SENDER_ID once Africa's Talking has
approved one) to switch SMS on. Use the username "sandbox" with a sandbox key
to try it without sending real texts.
"""
import logging
import re
from datetime import timedelta

import requests
from django.conf import settings
from django.utils import timezone

from . import billing, whatsapp
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


def pay_line(row, account):
    # The account's own paybill, never another landlord's
    shortcode, _ = account.mpesa_credentials()
    if shortcode and account.mpesa_is_till():
        return f" Pay via M-Pesa Buy Goods till {shortcode}."
    return f" Pay via M-Pesa paybill {shortcode}, account {row['unit']}." if shortcode else ""


def reminder_text(row, kind, account, today=None):
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
    return f"{text}{pay_line(row, account)} - {account.name}"


def channels_for(account):
    """The channels this account sends reminders on that the server is set up for, SMS first."""
    chosen = {
        Account.SMS: [SmsMessage.SMS],
        Account.WHATSAPP: [SmsMessage.WHATSAPP],
        Account.BOTH: [SmsMessage.SMS, SmsMessage.WHATSAPP],
    }.get(account.reminder_channel, [SmsMessage.SMS])
    ready = {SmsMessage.SMS: configured(), SmsMessage.WHATSAPP: whatsapp.configured()}
    return [channel for channel in chosen if ready[channel]]


def send_reminder(row, kind, account):
    """
    Remind one arrears row on each of the account's channels, keeping a record
    of each. Returns None when it reached the tenant on at least one channel,
    otherwise why not (the first channel's reason).
    """
    channels = channels_for(account)
    if not channels:
        return "No reminder channel is set up"
    errors = []
    for channel in channels:
        if channel == SmsMessage.WHATSAPP:
            template, variables, message = whatsapp.reminder_template(row, kind, account)
            error = whatsapp.send_template(row["customer_phone"], template, variables)
        else:
            message = reminder_text(row, kind, account)
            error = send_sms(row["customer_phone"], message)
        SmsMessage.objects.create(
            account=account, contract_id=row["contract_id"], invoice_number=row["invoice_number"],
            phone=row["customer_phone"], message=message, kind=kind, channel=channel,
            sent=error is None, error=error or "",
        )
        errors.append(error)
    return None if None in errors else errors[0]


def due_reminders(account, today=None):
    """
    The arrears rows that should get an automatic text today, with the kind of
    text. What was already sent is read in two queries up front, not one per row.
    """
    today = today or timezone.localdate()
    rows = [row for row in billing.arrears(today=today) if row["is_active"]]
    contract_ids = {row["contract_id"] for row in rows}
    # Due-soon texts go once per invoice
    due_sent = set(SmsMessage.objects.filter(
        contract_id__in=contract_ids, kind=SmsMessage.DUE, sent=True,
    ).values_list("contract_id", "invoice_number"))
    # Overdue texts repeat every few days; a text sent by hand counts too
    since = timezone.now() - timedelta(days=account.sms_overdue_every_days)
    overdue_recent = set(SmsMessage.objects.filter(
        contract_id__in=contract_ids, kind__in=[SmsMessage.OVERDUE, SmsMessage.MANUAL],
        sent=True, created_at__gte=since,
    ).values_list("contract_id", flat=True))

    picked = []
    for row in rows:
        days_to_due = (row["due_date"] - today).days
        if 0 <= days_to_due <= account.sms_days_before_due:
            if (row["contract_id"], row["invoice_number"]) not in due_sent:
                picked.append((row, SmsMessage.DUE))
        elif row["days_overdue"] > 0:
            if row["contract_id"] not in overdue_recent:
                picked.append((row, SmsMessage.OVERDUE))
    return picked


# A reminder sent by hand is not sent again within this long: a retried or
# double-clicked request must not text the same tenant twice
MANUAL_REPEAT_WINDOW = timedelta(minutes=10)


def recently_texted(contract_ids):
    """Contracts that got a text sent by hand within MANUAL_REPEAT_WINDOW."""
    return set(SmsMessage.objects.filter(
        contract_id__in=contract_ids, kind=SmsMessage.MANUAL, sent=True,
        created_at__gte=timezone.now() - MANUAL_REPEAT_WINDOW,
    ).values_list("contract_id", flat=True))


def send_manual_reminders(account, contract_ids):
    """
    Text the chosen tenants now; run by a Celery task, so the web request does
    not wait on the provider. Safe to run twice: recent ones are skipped.
    Returns (sent, failed, skipped) counts.
    """
    wanted = set(contract_ids) - recently_texted(contract_ids)
    skipped = len(set(contract_ids)) - len(wanted)
    sent = failed = 0
    for row in billing.arrears():
        if row["contract_id"] not in wanted:
            continue
        if send_reminder(row, SmsMessage.MANUAL, account) is None:
            sent += 1
        else:
            failed += 1
    return sent, failed, skipped


def send_daily_reminders(today=None):
    """Run once a day: reminds every tenant who is due soon or overdue, in every account that switched it on."""
    if not (configured() or whatsapp.configured()):
        logger.info("Reminders skipped: neither SMS (Africa's Talking) nor WhatsApp is configured")
        return 0
    sent = 0
    for account in Account.objects.filter(sms_reminders_enabled=True):
        if not channels_for(account):
            logger.info("Reminders skipped for account %s: its channel is not set up on the server", account.pk)
            continue
        token = set_current_account(account.id)
        try:
            for row, kind in due_reminders(account, today):
                if send_reminder(row, kind, account) is None:
                    sent += 1
        finally:
            reset_current_account(token)
    return sent
