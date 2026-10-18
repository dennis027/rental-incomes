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
def send_email(subject, body, to, html_body=None):
    """Send an email without making the request wait on the SMTP server."""
    message = EmailMultiAlternatives(subject=subject, body=body, from_email=None, to=to)
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
