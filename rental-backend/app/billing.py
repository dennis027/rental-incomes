"""
What a tenant owes, worked out in one place.

An invoice's total includes the balance brought forward from earlier invoices,
so adding invoice balances together counts old debt more than once. Everything
here works from `new_charges` (the total without the brought-forward part)
against what has been paid.
"""
from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.db.models import Max
from django.utils import timezone

from .models import MoveOut, Payment, Receipt, SystemParameter

ZERO = Decimal("0.00")
CENT = Decimal("0.01")
DEFAULT_GRACE_DAYS = 5


# How many months of rent each invoice of a contract covers. The contract's
# rent amount is the rent for one month.
FREQUENCY_MONTHS = {"monthly": 1, "quarterly": 3, "yearly": 12}


def rent_due(contract, year, month):
    """
    Rent to put on the invoice for this month. Quarterly and yearly contracts
    are charged the whole period in the month it starts, counted from the
    contract's start month, and no rent in the months between.
    """
    months = FREQUENCY_MONTHS.get(contract.payment_frequency, 1)
    elapsed = (year - contract.start_date.year) * 12 + (month - contract.start_date.month)
    if elapsed % months != 0:
        return ZERO
    return money(contract.rent_amount * months)


def money(value):
    return Decimal(value or 0).quantize(CENT)


def contract_invoices(contract):
    return list(Receipt.objects.filter(contract=contract).order_by("issue_date", "id"))


def outstanding(invoices):
    """Unpaid amount across a contract's invoices."""
    return money(sum((invoice.balance - invoice.previous_balance for invoice in invoices), ZERO))


def deposit_held(invoices):
    return money(sum(
        (invoice.rental_deposit + invoice.water_deposit + invoice.electricity_deposit for invoice in invoices), ZERO
    ))


def oldest_unpaid(invoices):
    """The earliest invoice not yet covered, taking payments against the oldest charges first."""
    paid = sum((invoice.amount_paid for invoice in invoices), ZERO)
    for invoice in invoices:
        paid -= invoice.new_charges
        if paid < 0:
            return invoice
    return None


def invoice_to_pay(invoices):
    """
    Where a new payment for this contract goes: its latest invoice. Each invoice
    brings the unpaid balance of the earlier ones forward, so the latest one
    stands for the whole account.
    """
    return invoices[-1] if invoices else None


def accounts(invoices):
    """
    For a set of invoices, each contract's latest invoice and what the contract
    still owes: {contract_id: {"latest_id", "latest_number", "outstanding"}}.
    One query, so list endpoints can describe every invoice without one per row.
    """
    contract_ids = {invoice.contract_id for invoice in invoices}
    result = {}
    rows = Receipt.objects.filter(contract_id__in=contract_ids).order_by("issue_date", "id")
    for row in rows:
        account = result.setdefault(row.contract_id, {"outstanding": ZERO})
        account["latest_id"] = row.id
        account["latest_number"] = row.receipt_number
        account["outstanding"] += row.balance - row.previous_balance
    settled = settlements(result.keys())
    for contract_id, account in result.items():
        account["outstanding"] = owed_after_settlement(money(account["outstanding"]), settled.get(contract_id))
    return result


def settlements(contract_ids):
    """Move-out settlements by contract: (deposit held, deductions)."""
    return {
        contract_id: (deposit, deductions)
        for contract_id, deposit, deductions in MoveOut.objects.filter(contract_id__in=contract_ids)
        .values_list("contract_id", "deposit_held", "deductions")
    }


def owed_after_settlement(owed, settlement):
    """
    What a tenant owes once a move-out settlement is taken into account: the
    deposit covers the unpaid invoices and deductions first. Payments made after
    moving out keep reducing it, which a figure frozen at move-out would not.
    """
    if settlement is None:
        return owed
    deposit, deductions = settlement
    return money(max(owed + deductions - deposit, ZERO))


def grace_days_for(property_id, cache=None):
    if cache is not None and property_id in cache:
        return cache[property_id]
    days = (
        SystemParameter.objects.filter(property_id=property_id)
        .values_list("grace_period_days", flat=True)
        .first()
    )
    days = DEFAULT_GRACE_DAYS if days is None else days
    if cache is not None:
        cache[property_id] = days
    return days


def late_penalty(contract, system_params, as_of):
    """
    Penalty to add to an invoice issued on `as_of`: the property's rate applied to
    what is still unpaid, once the oldest unpaid invoice is past its grace period.
    """
    rate = getattr(system_params, "late_payment_penalty_rate", None) or ZERO
    if rate <= 0:
        return ZERO
    invoices = contract_invoices(contract)
    owed = outstanding(invoices)
    oldest = oldest_unpaid(invoices)
    if owed <= 0 or oldest is None:
        return ZERO
    due = timezone.localtime(oldest.issue_date).date() + timedelta(days=system_params.grace_period_days)
    if as_of <= due:
        return ZERO
    return money(owed * rate / Decimal("100"))


def arrears(property_id=None, today=None):
    """One row per contract that owes money, most overdue first."""
    today = today or timezone.localdate()
    invoices = Receipt.objects.select_related(
        "contract__customer", "contract__unit__property"
    ).order_by("issue_date", "id")
    if property_id:
        invoices = invoices.filter(contract__unit__property_id=property_id)

    by_contract = defaultdict(list)
    for invoice in invoices:
        by_contract[invoice.contract_id].append(invoice)

    # For tenants who moved out, the deposit has been applied to what they owed
    settled = settlements(by_contract.keys())

    last_paid = dict(
        Payment.objects.filter(type=Payment.INCOME, receipt__contract_id__in=by_contract.keys())
        .values_list("receipt__contract_id")
        .annotate(last=Max("payment_date"))
    )

    grace_cache = {}
    rows = []
    for contract_id, contract_invoices_ in by_contract.items():
        owed = owed_after_settlement(outstanding(contract_invoices_), settled.get(contract_id))
        if owed <= 0:
            continue

        contract = contract_invoices_[0].contract
        unit = contract.unit
        customer = contract.customer
        oldest = oldest_unpaid(contract_invoices_) or contract_invoices_[0]
        due = timezone.localtime(oldest.issue_date).date() + timedelta(
            days=grace_days_for(unit.property_id, grace_cache)
        )
        target = invoice_to_pay(contract_invoices_)
        rows.append({
            "contract_id": contract.id,
            "contract_number": contract.contract_number,
            "is_active": contract.is_active,
            "customer_id": customer.id,
            "customer_name": f"{customer.first_name} {customer.last_name}",
            "customer_phone": customer.phone_number,
            "unit": unit.unit_number,
            "property_id": unit.property_id,
            "property": unit.property.name,
            "outstanding": owed,
            "owing_since": timezone.localtime(oldest.issue_date).date(),
            "due_date": due,
            "days_overdue": max((today - due).days, 0),
            "last_payment_date": last_paid.get(contract_id),
            "invoice_id": target.id,
            "invoice_number": target.receipt_number,
        })

    rows.sort(key=lambda row: (-row["days_overdue"], -row["outstanding"]))
    return rows


def statement(customer, contract_id=None, start=None, end=None):
    """Every invoice and payment of a tenant in date order, with a running balance."""
    invoices = Receipt.objects.filter(contract__customer=customer).select_related("contract__unit")
    payments = Payment.objects.filter(
        type=Payment.INCOME, receipt__contract__customer=customer
    ).select_related("receipt__contract__unit")
    if contract_id:
        invoices = invoices.filter(contract_id=contract_id)
        payments = payments.filter(receipt__contract_id=contract_id)

    entries = []
    for invoice in invoices:
        issued = timezone.localtime(invoice.issue_date).date()
        entries.append({
            "date": issued,
            "type": "invoice",
            "id": invoice.id,
            "number": invoice.receipt_number,
            "description": f"Invoice for {issued.strftime('%B %Y')} - Unit {invoice.contract.unit.unit_number}",
            "charge": money(invoice.new_charges),
            "payment": ZERO,
        })
    for payment in payments:
        detail = payment.get_method_display()
        if payment.reference:
            detail += f" {payment.reference}"
        entries.append({
            "date": payment.payment_date,
            "type": "payment",
            "id": payment.id,
            "number": f"RCT-{payment.id:06d}",
            "description": f"Payment received - {detail}",
            "charge": ZERO,
            "payment": money(payment.amount),
        })
    # Same day: the invoice comes before the payment made against it
    entries.sort(key=lambda entry: (entry["date"], entry["type"] != "invoice", entry["id"]))

    opening = ZERO
    balance = ZERO
    shown = []
    for entry in entries:
        balance += entry["charge"] - entry["payment"]
        if start and entry["date"] < start:
            opening = balance
            continue
        if end and entry["date"] > end:
            break
        entry["balance"] = balance
        shown.append(entry)

    return {
        "opening_balance": opening,
        "entries": shown,
        "total_charged": money(sum((entry["charge"] for entry in shown), ZERO)),
        "total_paid": money(sum((entry["payment"] for entry in shown), ZERO)),
        "closing_balance": shown[-1]["balance"] if shown else opening,
    }
