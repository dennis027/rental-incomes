"""
Fill the database with demo data so every screen and report has something to show.

    python manage.py seed_demo           # add the demo data
    python manage.py seed_demo --reset   # remove it and add it again
    python manage.py seed_demo --clear   # remove it
    python manage.py seed_demo --dry-run # try it without saving anything

Everything created here lives under properties whose name starts with "Demo – "
and tenants whose ID number starts with "DEMO-", so it can be removed again
without touching real records.
"""
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone

from app.models import (
    Customer, Expense, MaintenanceRequest, Payment, Property, Receipt,
    RentalContract, SystemParameter, Unit,
)

PROPERTY_PREFIX = "Demo – "
TENANT_PREFIX = "DEMO-"
MONTHS_OF_HISTORY = 5  # plus the current month

D = Decimal

PROPERTIES = [
    {
        "key": "sunrise",
        "name": "Sunrise Apartments",
        "address": "Ngong Road, Nairobi",
        "description": "Demo block with metered water and electricity.",
        "params": dict(
            has_water_bill=True, has_electricity_bill=True, has_service_charge=True,
            rent_deposit_months=1, require_water_deposit=True, water_deposit_amount=D("1000"),
            default_service_charge=D("500"), water_unit_cost=D("150"), electicity_unit_cost=D("25"),
            late_payment_penalty_rate=D("5"), grace_period_days=5,
        ),
        "units": [
            ("A1", "bedsitter", 8000), ("A2", "bedsitter", 8000), ("A3", "studio", 10000),
            ("A4", "one_bedroom", 15000), ("A5", "one_bedroom", 15000), ("A6", "two_bedroom", 22000),
            ("A7", "two_bedroom", 22000), ("A8", "three_bedroom", 30000), ("A9", "single", 6000),
            ("A10", "single", 6000),
        ],
        "expenses": [
            ("Caretaker salary", 18000), ("Security guard", 15000), ("Garbage collection", 4500),
        ],
    },
    {
        "key": "riverside",
        "name": "Riverside Court",
        "address": "Kileleshwa, Nairobi",
        "description": "Demo block with rent only, two months deposit.",
        "params": dict(
            has_water_bill=False, has_electricity_bill=False, has_service_charge=False,
            rent_deposit_months=2, late_payment_penalty_rate=D("2.5"), grace_period_days=7,
        ),
        "units": [
            ("R1", "one_bedroom", 18000), ("R2", "two_bedroom", 26000), ("R3", "two_bedroom", 26000),
            ("R4", "three_bedroom", 35000), ("R5", "studio", 12000), ("R6", "bedsitter", 9000),
        ],
        "expenses": [
            ("Compound cleaning", 9000), ("Lift servicing", 12000),
        ],
    },
]

TENANTS = [
    ("Jane", "Wanjiku"), ("Peter", "Otieno"), ("Mary", "Achieng"), ("John", "Kamau"),
    ("Grace", "Mutua"), ("David", "Kiptoo"), ("Faith", "Njeri"), ("Samuel", "Mwangi"),
    ("Esther", "Chebet"), ("Brian", "Odhiambo"), ("Lucy", "Wambui"), ("Kevin", "Barasa"),
    ("Ann", "Nyambura"), ("Joseph", "Kariuki"),
]

# (property key, unit, tenant index, months ago the contract started, how the tenant pays)
#   good      pays every receipt in full
#   partial   has paid half of the latest receipt
#   defaulter has not paid the last two receipts
#   ended     moved out two months ago with everything paid
CONTRACTS = [
    ("sunrise", "A1", 0, 5, "good"), ("sunrise", "A2", 1, 5, "good"),
    ("sunrise", "A3", 2, 4, "partial"), ("sunrise", "A4", 3, 4, "good"),
    ("sunrise", "A5", 4, 3, "defaulter"), ("sunrise", "A6", 5, 3, "good"),
    ("sunrise", "A7", 6, 2, "good"), ("sunrise", "A8", 7, 1, "partial"),
    ("sunrise", "A10", 11, 5, "ended"),
    ("riverside", "R1", 8, 5, "good"), ("riverside", "R2", 9, 3, "defaulter"),
    ("riverside", "R3", 10, 2, "good"),
]
# Tenants 12 and 13 are left without a unit, so "Rent out" has someone to offer.

# (property key, unit, problem, status, days ago reported, cost, amount paid)
MAINTENANCE = [
    ("sunrise", "A1", "Kitchen tap leaking", "pending", 2, 0, 0),
    ("sunrise", "A4", "Bedroom socket not working", "in_progress", 6, 3500, 0),
    ("sunrise", "A6", "Blocked bathroom drain", "resolved", 25, 6000, 6000),
    ("sunrise", "A3", "Broken window latch", "resolved", 48, 2500, 1000),
    ("sunrise", "A8", "Water heater not heating", "pending", 1, 0, 0),
    ("riverside", "R1", "Front door lock jammed", "in_progress", 4, 4000, 0),
    ("riverside", "R3", "Ceiling stain from upstairs leak", "resolved", 70, 15000, 15000),
]

METHODS = ["mpesa", "mpesa", "mpesa", "bank", "cash"]


RECEIPT_AMOUNTS = [
    "monthly_rent", "rental_deposit", "electricity_deposit", "electricity_bill", "water_deposit",
    "water_bill", "service_charge", "security_charge", "previous_balance", "other_charges",
]


def receipt_total(receipt):
    """Total billed on a receipt. Unsaved receipts hold float defaults, so convert first."""
    return sum((D(str(getattr(receipt, field))) for field in RECEIPT_AMOUNTS), D("0"))


def month_start(today, months_ago):
    """First day of the month that many months before today."""
    index = today.year * 12 + (today.month - 1) - months_ago
    return date(index // 12, index % 12 + 1, 1)


def aware(day, hour=9):
    return timezone.make_aware(datetime.combine(day, time(hour, 0)))


class Command(BaseCommand):
    help = "Create demo properties, units, tenants, contracts, receipts, payments, expenses and maintenance."

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true", help="Remove the demo data and stop.")
        parser.add_argument("--reset", action="store_true", help="Remove the demo data, then create it again.")
        parser.add_argument("--dry-run", action="store_true", help="Build everything, report the counts, then undo it.")

    def handle(self, *args, **options):
        exists = Property.objects.filter(name__startswith=PROPERTY_PREFIX).exists()

        if options["clear"] or options["reset"]:
            self.clear()
            if options["clear"]:
                return
        elif exists:
            raise CommandError("Demo data is already there. Use --reset to rebuild it or --clear to remove it.")

        with transaction.atomic():
            counts = self.seed()
            if options["dry_run"]:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS("Dry run, nothing was saved:" if options["dry_run"] else "Demo data created:"))
        for label, count in counts.items():
            self.stdout.write(f"  {label}: {count}")

    # ------------------------------------------------------------------ clear

    def clear(self):
        with transaction.atomic():
            # Units, contracts, receipts, payments, expenses and maintenance go with the property
            properties = Property.objects.filter(name__startswith=PROPERTY_PREFIX)
            property_count = properties.count()
            properties.delete()
            tenant_count, _ = Customer.objects.filter(id_number__startswith=TENANT_PREFIX).delete()
        self.stdout.write(f"Removed {property_count} demo properties and {tenant_count} demo tenants.")

    # ------------------------------------------------------------------- seed

    def seed(self):
        today = timezone.localdate()
        user = get_user_model().objects.filter(is_active=True).order_by("id").first()

        # ---- properties and their settings
        properties = {}
        for spec in PROPERTIES:
            prop = Property.objects.create(
                name=PROPERTY_PREFIX + spec["name"], address=spec["address"], description=spec["description"]
            )
            SystemParameter.objects.update_or_create(property=prop, defaults=spec["params"])
            properties[spec["key"]] = prop
        params = {spec["key"]: spec["params"] for spec in PROPERTIES}

        # ---- units
        units = Unit.objects.bulk_create([
            Unit(property=properties[spec["key"]], unit_number=number, unit_type=unit_type, rent_amount=D(rent))
            for spec in PROPERTIES for number, unit_type, rent in spec["units"]
        ])
        unit_by = {(u.property_id, u.unit_number): u for u in units}

        # ---- tenants
        tenants = Customer.objects.bulk_create([
            Customer(
                first_name=first, last_name=last,
                phone_number=f"07990001{i:02d}",
                email=f"demo.{first.lower()}.{last.lower()}@example.com",
                id_number=f"{TENANT_PREFIX}{30000000 + i}",
                is_active=True,
            )
            for i, (first, last) in enumerate(TENANTS)
        ])

        # ---- contracts
        contracts = []
        plan = []  # (contract, months ago started, payer profile, property key)
        for key, unit_number, tenant_index, started, profile in CONTRACTS:
            unit = unit_by[(properties[key].id, unit_number)]
            tenant = tenants[tenant_index]
            start = month_start(today, started) + timedelta(days=2)
            rent = unit.rent_amount
            contract = RentalContract(
                contract_number=f"CTR-{tenant.id}-{unit.id}-{start:%Y%m%d}",
                customer=tenant, unit=unit, start_date=start, rent_amount=rent,
                deposit_amount=rent * params[key].get("rent_deposit_months", 1),
                payment_frequency="monthly",
                is_active=profile != "ended",
                end_date=month_start(today, 2) if profile == "ended" else None,
            )
            contracts.append(contract)
            plan.append((contract, started, profile, key))
        # Two running contracts that end soon, for the "contracts expiring" views
        contracts[0].end_date = today + timedelta(days=12)
        contracts[9].end_date = today + timedelta(days=45)
        RentalContract.objects.bulk_create(contracts)

        # ---- receipts and the rent payments against them
        receipts, payments = [], []
        payment_dates = []          # payment date for each entry of `payments`
        meter = {}                  # unit id -> (water, electricity) readings
        reference = 0

        for contract, started, profile, key in plan:
            unit = contract.unit
            setting = params[key]
            last_month = 3 if profile == "ended" else 0   # an ended contract stops being billed
            months = list(range(started, last_month - 1, -1))
            water, power = D("120"), D("900")

            for position, months_ago in enumerate(months):
                first = position == 0
                issued = contract.start_date if first else month_start(today, months_ago)
                receipt = Receipt(
                    contract=contract, issued_by=user, monthly_rent=contract.rent_amount,
                    issue_date=aware(issued),
                    receipt_number=f"RCT-{contract.id}-{issued:%Y%m}-1",
                )
                if first:
                    receipt.rental_deposit = contract.deposit_amount
                    if setting.get("require_water_deposit"):
                        receipt.water_deposit = setting.get("water_deposit_amount", D("0"))
                if setting.get("has_service_charge"):
                    receipt.service_charge = setting.get("default_service_charge", D("0"))
                if not first and setting.get("has_water_bill"):
                    used = D(4 + (unit.id + months_ago) % 5)
                    receipt.previous_water_reading, receipt.current_water_reading = water, water + used
                    receipt.water_bill = used * setting["water_unit_cost"]
                    water += used
                if not first and setting.get("has_electricity_bill"):
                    used = D(40 + (unit.id * 7 + months_ago * 3) % 35)
                    receipt.previous_electricity_reading, receipt.current_electricity_reading = power, power + used
                    receipt.electricity_bill = used * setting["electicity_unit_cost"]
                    power += used

                total = receipt_total(receipt)
                from_end = len(months) - 1 - position   # 0 is the latest receipt
                if profile == "partial" and from_end == 0:
                    paid = (total / 2).quantize(D("1"))
                elif profile == "defaulter" and from_end <= 1:
                    paid = D("0")
                else:
                    paid = total

                receipt.amount_paid = paid
                receipt.is_paid = paid >= total
                receipt.status = "paid" if paid >= total else ("partial" if paid > 0 else "unpaid")
                receipts.append(receipt)

                if paid > 0:
                    reference += 1
                    payments.append(Payment(
                        receipt=receipt, amount=paid, type=Payment.INCOME,
                        method=METHODS[reference % len(METHODS)],
                        reference=f"DEMO-IN-{reference:04d}",
                        notes="Rent payment",
                    ))
                    payment_dates.append(min(issued + timedelta(days=2 + reference % 6), today))

            if contract.is_active:
                meter[unit.id] = (water, power)

        Receipt.objects.bulk_create(receipts)
        for payment in payments:
            payment.receipt_id = payment.receipt.id

        # ---- expenses: paid in older months, partly paid last month, unpaid this month
        expenses = []
        expense_dates = []
        for spec in PROPERTIES:
            for months_ago in range(MONTHS_OF_HISTORY, -1, -1):
                for n, (description, amount) in enumerate(spec["expenses"]):
                    amount = D(amount)
                    if months_ago >= 2:
                        paid = amount
                    elif months_ago == 1:
                        paid = (amount / 2).quantize(D("1")) if n == 0 else amount
                    else:
                        paid = D("0")
                    when = min(month_start(today, months_ago) + timedelta(days=4 + n * 6), today)
                    expenses.append(Expense(
                        property=properties[spec["key"]], recorded_by=user,
                        description=f"{description} – {when:%B}", amount=amount, amount_paid=paid,
                        balance=amount - paid,
                        payment_status="paid" if paid >= amount else ("partial" if paid > 0 else "unpaid"),
                    ))
                    expense_dates.append(when)
        Expense.objects.bulk_create(expenses)
        for expense, when in zip(expenses, expense_dates):
            if expense.amount_paid > 0:
                reference += 1
                payments.append(Payment(
                    expense=expense, amount=expense.amount_paid, type=Payment.EXPENSE,
                    method=METHODS[reference % len(METHODS)], reference=f"DEMO-OUT-{reference:04d}",
                    notes=expense.description,
                ))
                payment_dates.append(min(when + timedelta(days=1), today))

        # ---- maintenance requests
        tenant_of = {contract.unit_id: contract.customer for contract, _, profile, _ in plan if profile != "ended"}
        requests, reported = [], []
        for key, unit_number, problem, status, days_ago, cost, paid in MAINTENANCE:
            unit = unit_by[(properties[key].id, unit_number)]
            cost, paid = D(cost), D(paid)
            when = today - timedelta(days=days_ago)
            requests.append(MaintenanceRequest(
                unit=unit, customer=tenant_of.get(unit.id), description=problem, status=status,
                resolved_date=aware(when + timedelta(days=3)) if status == "resolved" else None,
                amount=cost, amount_paid=paid, balance=cost - paid,
                payment_status="paid" if cost and paid >= cost else ("partial" if paid > 0 else "unpaid"),
            ))
            reported.append(when)
        MaintenanceRequest.objects.bulk_create(requests)
        for request, when in zip(requests, reported):
            if request.amount_paid > 0:
                reference += 1
                payments.append(Payment(
                    maintenance_request=request, amount=request.amount_paid, type=Payment.EXPENSE,
                    method=METHODS[reference % len(METHODS)], reference=f"DEMO-OUT-{reference:04d}",
                    notes=f"Repair: {request.description}",
                ))
                payment_dates.append(min(when + timedelta(days=4), today))

        # bulk_create skips Payment.save(), which is what would otherwise add each
        # amount to its receipt a second time
        Payment.objects.bulk_create(payments)

        # ---- dates that Django fills in with "now" on creation
        self.backdate(Payment, "payment_date", "date", zip(payments, payment_dates))
        self.backdate(Payment, "created_at", "timestamptz", ((p, aware(d, 11)) for p, d in zip(payments, payment_dates)))
        self.backdate(Expense, "expense_date", "date", zip(expenses, expense_dates))
        self.backdate(MaintenanceRequest, "reported_date", "timestamptz", ((r, aware(d, 10)) for r, d in zip(requests, reported)))
        self.backdate(RentalContract, "created_at", "timestamptz", ((c, aware(c.start_date)) for c in contracts))

        # ---- units: who lives there, what is owed, latest meter readings
        billed = {}
        for receipt in receipts:
            if receipt.contract.is_active:
                totals = billed.setdefault(receipt.contract.unit_id, [D("0"), D("0")])
                totals[0] += receipt_total(receipt)
                totals[1] += receipt.amount_paid
        for unit in units:
            total, paid = billed.get(unit.id, (D("0"), D("0")))
            unit.status = "occupied" if unit.id in tenant_of else "vacant"
            unit.total_billed, unit.total_paid, unit.balance = total, paid, total - paid
            if unit.id in meter:
                unit.water_meter_reading, unit.electricity_meter_reading = meter[unit.id]
        Unit.objects.bulk_update(units, [
            "status", "total_billed", "total_paid", "balance", "water_meter_reading", "electricity_meter_reading",
        ])

        housed = []
        for contract, _, profile, _ in plan:
            if profile != "ended":
                contract.customer.unit = contract.unit
                contract.customer.move_in_date = contract.start_date
                housed.append(contract.customer)
        Customer.objects.bulk_update(housed, ["unit", "move_in_date"])

        return {
            "properties": len(properties), "units": len(units), "tenants": len(tenants),
            "contracts": len(contracts), "receipts": len(receipts), "payments": len(payments),
            "expenses": len(expenses), "maintenance requests": len(requests),
        }

    def backdate(self, model, column, sql_type, pairs):
        """Set a date column for many rows in one statement."""
        rows = [(obj.pk, value) for obj, value in pairs]
        if not rows:
            return
        table = connection.ops.quote_name(model._meta.db_table)
        column = connection.ops.quote_name(column)
        placeholders = ", ".join(["(%s, %s)"] * len(rows))
        values = [item for row in rows for item in row]
        with connection.cursor() as cursor:
            cursor.execute(
                f"UPDATE {table} AS t SET {column} = v.val::{sql_type} "
                f"FROM (VALUES {placeholders}) AS v(id, val) WHERE t.id = v.id::bigint",
                values,
            )
