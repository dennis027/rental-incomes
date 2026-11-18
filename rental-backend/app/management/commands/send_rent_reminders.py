from django.core.management.base import BaseCommand

from app.sms import send_daily_reminders


class Command(BaseCommand):
    help = "SMS tenants whose rent is due soon or overdue (for hosts without Celery beat, e.g. a Render cron job)."

    def handle(self, *args, **options):
        sent = send_daily_reminders()
        self.stdout.write(f"Sent {sent} rent reminders")
