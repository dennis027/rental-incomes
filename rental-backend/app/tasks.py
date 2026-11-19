"""Background jobs, run by the Celery worker (or inline when REDIS_URL is unset)."""
import logging
import smtplib

from celery import shared_task
from django.core.mail import EmailMultiAlternatives
from django.core.management import call_command

logger = logging.getLogger(__name__)


@shared_task(
    autoretry_for=(smtplib.SMTPException, OSError),
    retry_backoff=True,
    retry_backoff_max=600,
    max_retries=5,
)
def send_email(subject, body, to, html_body=None, reply_to=None):
    """Send an email without making the request wait on the SMTP server."""
    message = EmailMultiAlternatives(subject=subject, body=body, from_email=None, to=to, reply_to=reply_to)
    if html_body:
        message.attach_alternative(html_body, "text/html")
    message.send(fail_silently=False)
    logger.info("Email %r sent to %s", subject, ", ".join(to))


@shared_task
def recalculate_unit_balances():
    """Nightly safety net: rebuild every unit's stored balance from its invoices and payments."""
    call_command("recalculate_balances")


@shared_task
def flush_expired_tokens():
    """Drop expired refresh tokens so the blacklist tables stay small."""
    call_command("flushexpiredtokens")


@shared_task
def send_rent_reminders():
    """Every morning: SMS tenants whose rent is due soon or overdue."""
    from .sms import send_daily_reminders
    sent = send_daily_reminders()
    logger.info("Sent %d rent reminders", sent)


@shared_task
def send_manual_reminders(account_id, contract_ids):
    """SMS the tenants an owner picked in Arrears, outside the web request."""
    from .models import Account
    from .sms import send_manual_reminders as send
    from .tenancy import reset_current_account, set_current_account
    account = Account.objects.filter(pk=account_id).first()
    if account is None:
        return
    token = set_current_account(account.id)
    try:
        sent, failed, skipped = send(account, contract_ids)
    finally:
        reset_current_account(token)
    logger.info("Manual reminders for account %s: %d sent, %d failed, %d skipped as recent",
                account_id, sent, failed, skipped)
