"""
WhatsApp rent reminders through Meta's WhatsApp Cloud API.

Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID to switch it on. A business
may only start a WhatsApp conversation with a template Meta has approved, so
each reminder is one of three templates, filled in with the tenant's details.
Create them in WhatsApp Manager (category Utility, language English) with
exactly this text, or set WHATSAPP_TEMPLATE_* to the names you chose:

  rent_due_reminder (6 variables)
    Hello {{1}}, this is a reminder that your rent of {{2}} for {{3}} is due
    {{4}}. {{5}} This message is from {{6}} via KodiDesk.

  rent_overdue_reminder (6 variables)
    Hello {{1}}, your rent balance of {{2}} for {{3}} is {{4}} overdue. Please
    pay as soon as you can. {{5}} This message is from {{6}} via KodiDesk.

  rent_balance_reminder (5 variables)
    Hello {{1}}, you have a rent balance of {{2}} for {{3}}. {{4}} This message
    is from {{5}} via KodiDesk.

  tenant_message (2 variables), for a message written or edited by hand
    Message from {{1}}: {{2}} Reply to this chat if you have any questions.
"""
import re
import logging

import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

DUE, OVERDUE, BALANCE, MESSAGE = "due", "overdue", "balance", "message"

# What WhatsApp accepts in one template variable: no line breaks or tabs, no
# more than four spaces in a row, and the whole message under 1024 characters
MESSAGE_MAX = 900


class WhatsAppNotConfigured(Exception):
    pass


def configured():
    return bool(getattr(settings, "WHATSAPP_TOKEN", "") and getattr(settings, "WHATSAPP_PHONE_NUMBER_ID", ""))


def _template_name(which):
    defaults = {DUE: "rent_due_reminder", OVERDUE: "rent_overdue_reminder", BALANCE: "rent_balance_reminder",
                MESSAGE: "tenant_message"}
    return getattr(settings, f"WHATSAPP_TEMPLATE_{which.upper()}", "") or defaults[which]


def _money(value):
    return f"KES {value:,.0f}"


def _how_to_pay(row, account):
    # Template variables may not be empty, so there is always something to say
    from .sms import pay_line
    return pay_line(row, account).strip() or "Contact us for how to pay."


def reminder_template(row, kind, account, today=None):
    """
    (template name, [variables], preview text) for one arrears row: the same
    choice of wording as the SMS (due soon, overdue, or a plain balance).
    """
    from .models import SmsMessage
    today = today or timezone.localdate()
    first = row["customer_name"].split(" ")[0] or "there"
    place = f"{row['unit']}, {row['property']}"
    owed = _money(row["outstanding"])
    pay = _how_to_pay(row, account)
    if kind == SmsMessage.DUE and row["due_date"] >= today:
        when = "today" if row["due_date"] == today else f"on {row['due_date']:%d %b}"
        which, variables = DUE, [first, owed, place, when, pay, account.name]
        preview = (f"Hello {first}, this is a reminder that your rent of {owed} for {place} is due {when}. "
                   f"{pay} This message is from {account.name} via KodiDesk.")
    elif row["days_overdue"] > 0:
        days = row["days_overdue"]
        late = f"{days} day{'s' if days != 1 else ''}"
        which, variables = OVERDUE, [first, owed, place, late, pay, account.name]
        preview = (f"Hello {first}, your rent balance of {owed} for {place} is {late} overdue. "
                   f"Please pay as soon as you can. {pay} This message is from {account.name} via KodiDesk.")
    else:
        which, variables = BALANCE, [first, owed, place, pay, account.name]
        preview = (f"Hello {first}, you have a rent balance of {owed} for {place}. {pay} "
                   f"This message is from {account.name} via KodiDesk.")
    return _template_name(which), variables, preview


def as_variable(text):
    """Free text made fit for a template variable: one line, no long runs of spaces."""
    text = re.sub(r"\s*[\r\n\t]+\s*", " ", text or "")
    return re.sub(r" {2,}", " ", text).strip()[:MESSAGE_MAX]


def send_message(phone, text, account):
    """
    Send a message written in KodiDesk (edited by hand) to a tenant. WhatsApp only
    lets a business start a chat with an approved template, so the text travels
    inside tenant_message. Returns (error or None, the text as sent).
    """
    body = as_variable(text)
    if not body:
        return "Write a message first", body
    return send_template(phone, _template_name(MESSAGE), [account.name, body]), body


def friendly_error(error):
    """Meta's reasons, in words a landlord can act on."""
    if error and "132001" in error:
        return "WhatsApp has not approved the message template yet. Try again once Meta has reviewed it."
    if error and ("131026" in error or "131030" in error):
        return "This number cannot receive WhatsApp messages."
    return error


def send_template(phone, template, variables):
    """Send one template message. Returns None when Meta accepted it, otherwise why it did not."""
    from .sms import kenyan_number
    if not configured():
        raise WhatsAppNotConfigured()
    number = kenyan_number(phone)
    if number is None:
        return "Not a Kenyan mobile number"
    version = getattr(settings, "WHATSAPP_API_VERSION", "") or "v21.0"
    payload = {
        "messaging_product": "whatsapp",
        "to": number.lstrip("+"),
        "type": "template",
        "template": {
            "name": template,
            "language": {"code": getattr(settings, "WHATSAPP_TEMPLATE_LANGUAGE", "") or "en"},
            "components": [{
                "type": "body",
                "parameters": [{"type": "text", "text": str(value)} for value in variables],
            }],
        },
    }
    try:
        response = requests.post(
            f"https://graph.facebook.com/{version}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages",
            json=payload,
            headers={"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"},
            timeout=15,
        )
        data = response.json()
    except (requests.RequestException, ValueError) as error:
        logger.warning("WhatsApp to %s failed: %s", number, error)
        return "Could not reach WhatsApp"
    if response.ok and data.get("messages"):
        return None
    message = (data.get("error") or {}).get("message") or f"Refused ({response.status_code})"
    logger.warning("WhatsApp to %s refused: %s", number, message)
    return f"Not sent: {message}"[:255]
