from django.core.management.base import BaseCommand

from app.models import Unit


class Command(BaseCommand):
    help = "Recalculate the stored balance of every unit from its invoices and payments."

    def handle(self, *args, **options):
        changed = 0
        for unit in Unit.objects.all():
            before = unit.balance
            unit.recalculate_balance()
            if unit.balance != before:
                changed += 1
                self.stdout.write(f"{unit}: {before} -> {unit.balance}")
        self.stdout.write(self.style.SUCCESS(f"Done. {changed} unit balance(s) corrected."))
