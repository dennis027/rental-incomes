"""
Monthly Rental Income (MRI) tax, for filing on KRA's eRITS portal.

Resident landlords whose residential rent is between KES 288,000 and
KES 15 million a year pay 7.5% of the gross rent received each month, with no
deductions, by the 20th of the following month (Finance Act 2023, from
1 January 2024). Outside that band the rent goes on the annual income tax
return instead.

Payments settle whole invoices (rent, water, deposits...), so the rent in each
payment is its share in proportion to the rent on the invoice it paid.
Deposits are not rent until they are kept, so they are left out.
"""
import calendar
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Payment
from .permissions import IsAccountMember

MRI_RATE = Decimal("7.5")
MRI_MIN_YEARLY = Decimal("288000")
MRI_MAX_YEARLY = Decimal("15000000")
CENT = Decimal("0.01")


def _money(value):
    return Decimal(value or 0).quantize(CENT, rounding=ROUND_HALF_UP)


def rent_share(payment):
    """The part of an incoming payment that paid rent (not utilities, deposits or charges)."""
    invoice = payment.receipt
    if invoice is None:
        return Decimal("0")
    charges = invoice.new_charges
    rent = Decimal(str(invoice.monthly_rent or 0))
    if charges <= 0 or rent <= 0:
        return Decimal("0")
    return min(payment.amount * rent / charges, payment.amount)


def _month(raw):
    """'2026-09' → (2026, 9); anything else → last month, the one being filed."""
    try:
        year, month = (int(part) for part in str(raw).split("-"))
        date(year, month, 1)
        return year, month
    except (TypeError, ValueError):
        today = date.today()
        return (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)


def _shift(year, month, months):
    index = year * 12 + (month - 1) + months
    return index // 12, index % 12 + 1


def _rent_received(start, end, property_id=None):
    payments = Payment.objects.filter(
        type=Payment.INCOME, receipt__isnull=False, payment_date__gte=start, payment_date__lte=end,
    ).select_related("receipt__contract__customer", "receipt__contract__unit__property")
    if property_id:
        payments = payments.filter(receipt__contract__unit__property_id=property_id)
    return payments


class RentalIncomeTaxView(APIView):
    """GET api/reports/rental-income-tax/?month=2026-09&property_id=3"""
    permission_classes = [IsAccountMember]

    def get(self, request):
        year, month = _month(request.query_params.get("month"))
        property_id = request.query_params.get("property_id") or None
        start = date(year, month, 1)
        end = date(year, month, calendar.monthrange(year, month)[1])
        due_year, due_month = _shift(year, month, 1)

        rows, properties = [], {}
        for payment in _rent_received(start, end, property_id).order_by("payment_date", "id"):
            contract = payment.receipt.contract
            prop = contract.unit.property
            share = rent_share(payment)
            rows.append({
                "date": payment.payment_date,
                "tenant": f"{contract.customer.first_name} {contract.customer.last_name}".strip(),
                "unit": contract.unit.unit_number,
                "property": prop.name,
                "invoice": payment.receipt.receipt_number,
                "reference": payment.reference or "",
                "amount": _money(payment.amount),
                "rent": _money(share),
            })
            entry = properties.setdefault(prop.id, {"id": prop.id, "name": prop.name, "collected": Decimal("0"), "rent": Decimal("0")})
            entry["collected"] += payment.amount
            entry["rent"] += share

        rent = sum((entry["rent"] for entry in properties.values()), Decimal("0"))
        collected = sum((entry["collected"] for entry in properties.values()), Decimal("0"))

        # Which regime applies is decided on the year's rent, so look at the
        # twelve months up to and including this one
        year_start = date(*_shift(year, month, -11), 1)
        yearly_rent = sum((rent_share(p) for p in _rent_received(year_start, end, property_id)), Decimal("0"))
        if yearly_rent < MRI_MIN_YEARLY:
            regime = "below_threshold"
        elif yearly_rent > MRI_MAX_YEARLY:
            regime = "above_threshold"
        else:
            regime = "mri"

        tax = rent * MRI_RATE / 100
        return Response({
            "month": f"{year}-{month:02d}",
            "period_start": start,
            "period_end": end,
            "due_date": date(due_year, due_month, 20),
            "rate": MRI_RATE,
            "regime": regime,
            "thresholds": {"min_yearly": MRI_MIN_YEARLY, "max_yearly": MRI_MAX_YEARLY},
            "twelve_month_rent": _money(yearly_rent),
            "totals": {"collected": _money(collected), "rent": _money(rent), "tax": _money(tax)},
            "properties": [
                {**entry, "collected": _money(entry["collected"]), "rent": _money(entry["rent"]),
                 "tax": _money(entry["rent"] * MRI_RATE / 100)}
                for entry in properties.values()
            ],
            "payments": rows,
        })
