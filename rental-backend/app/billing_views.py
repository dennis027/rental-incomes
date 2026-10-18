"""Tenant statements, arrears, move-out settlements, contracts ending soon, and paybill payments."""
import hmac
import logging
import re
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import IntegrityError, transaction
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import billing
from .caching import cached_get
from .models import (
    Customer, Expense, MoveOut, MpesaTransaction, Payment, Receipt, RentalContract, SystemParameter, Unit,
)

logger = logging.getLogger(__name__)


def _date(raw, default=None):
    if not raw:
        return default
    try:
        return datetime.strptime(str(raw)[:10], "%Y-%m-%d").date()
    except ValueError:
        return default


def _decimal(raw, default=None):
    if raw in (None, ""):
        return default
    try:
        return Decimal(str(raw))
    except (InvalidOperation, ValueError):
        return default


def _property_card(prop):
    return {"id": prop.id, "name": prop.name, "address": prop.address}


def _tenant_card(customer):
    return {
        "id": customer.id,
        "name": f"{customer.first_name} {customer.last_name}",
        "phone": customer.phone_number,
    }


# ---------------------------------------------------------------------------
# Tenant statement
# ---------------------------------------------------------------------------

class CustomerStatementView(APIView):
    """GET api/customers/<id>/statement/?contract_id=&start_date=&end_date="""
    permission_classes = [IsAuthenticated]

    @cached_get
    def get(self, request, customer_id):
        customer = get_object_or_404(Customer, pk=customer_id)
        contracts = list(
            RentalContract.objects.filter(customer=customer)
            .select_related("unit__property")
            .order_by("-is_active", "-start_date")
        )
        contract_id = request.query_params.get("contract_id") or None
        start = _date(request.query_params.get("start_date"))
        end = _date(request.query_params.get("end_date"))

        data = billing.statement(customer, contract_id=contract_id, start=start, end=end)
        # The statement is headed with the property of the contract shown (or the tenant's latest one)
        shown = next((c for c in contracts if str(c.id) == str(contract_id)), contracts[0] if contracts else None)
        data.update({
            "tenant": _tenant_card(customer),
            "property": _property_card(shown.unit.property) if shown else None,
            "unit": shown.unit.unit_number if shown else None,
            "start_date": start,
            "end_date": end,
            "generated_on": timezone.localdate(),
            "contracts": [
                {
                    "id": contract.id,
                    "contract_number": contract.contract_number,
                    "unit": contract.unit.unit_number,
                    "property": contract.unit.property.name,
                    "is_active": contract.is_active,
                }
                for contract in contracts
            ],
        })
        return Response(data)


# ---------------------------------------------------------------------------
# Arrears
# ---------------------------------------------------------------------------

class ArrearsView(APIView):
    """GET api/arrears/?property_id="""
    permission_classes = [IsAuthenticated]

    @cached_get
    def get(self, request):
        property_id = request.query_params.get("property_id") or None
        if property_id and not str(property_id).isdigit():
            return Response({"property_id": "Must be a number."}, status=status.HTTP_400_BAD_REQUEST)
        rows = billing.arrears(property_id=property_id)
        return Response({
            "summary": {
                "tenants": len(rows),
                "total_outstanding": sum((row["outstanding"] for row in rows), billing.ZERO),
                "overdue_tenants": len([row for row in rows if row["days_overdue"] > 0]),
                "total_overdue": sum((row["outstanding"] for row in rows if row["days_overdue"] > 0), billing.ZERO),
            },
            "rows": rows,
        })


# ---------------------------------------------------------------------------
# Contracts ending soon
# ---------------------------------------------------------------------------

class ContractsEndingSoonView(APIView):
    """
    GET api/contracts/ending-soon/?property_id=&days=60
    Active contracts whose end date is within `days`, including ones already past it.
    """
    permission_classes = [IsAuthenticated]

    @cached_get
    def get(self, request):
        try:
            days = int(request.query_params.get("days") or 60)
        except ValueError:
            days = 60
        today = timezone.localdate()
        contracts = RentalContract.objects.filter(
            is_active=True, end_date__isnull=False, end_date__lte=today + timedelta(days=days)
        ).select_related("customer", "unit__property").order_by("end_date")
        property_id = request.query_params.get("property_id")
        if property_id and str(property_id).isdigit():
            contracts = contracts.filter(unit__property_id=property_id)

        return Response([
            {
                "id": contract.id,
                "contract_number": contract.contract_number,
                "customer_id": contract.customer_id,
                "customer_name": f"{contract.customer.first_name} {contract.customer.last_name}",
                "customer_phone": contract.customer.phone_number,
                "unit": contract.unit.unit_number,
                "property": contract.unit.property.name,
                "rent_amount": contract.rent_amount,
                "end_date": contract.end_date,
                "days_left": (contract.end_date - today).days,
            }
            for contract in contracts
        ])


# ---------------------------------------------------------------------------
# Move-out and deposit refund
# ---------------------------------------------------------------------------

def _settlement(contract, move_out):
    unit = contract.unit
    return {
        "contract_id": contract.id,
        "contract_number": contract.contract_number,
        "property": _property_card(unit.property),
        "tenant": _tenant_card(contract.customer),
        "unit": unit.unit_number,
        "start_date": contract.start_date,
        "move_out_date": move_out.move_out_date,
        "deposit_held": move_out.deposit_held,
        "unpaid_balance": move_out.unpaid_balance,
        "deductions": move_out.deductions,
        "deduction_notes": move_out.deduction_notes,
        "refund_amount": move_out.refund_amount,
        "refund_recorded": move_out.refund_payment_id is not None,
    }


class ContractMoveOutView(APIView):
    """
    GET  api/contracts/<id>/move-out/  figures to review before the tenant leaves (or the saved settlement)
    POST api/contracts/<id>/move-out/  end the contract and settle the deposit
    """
    permission_classes = [IsAuthenticated]

    @cached_get
    def get(self, request, pk):
        contract = get_object_or_404(
            RentalContract.objects.select_related("customer", "unit__property"), pk=pk
        )
        move_out = MoveOut.objects.filter(contract=contract).first()
        if move_out:
            return Response({"settled": True, "settlement": _settlement(contract, move_out)})

        unit = contract.unit
        params = SystemParameter.objects.filter(property=unit.property).first()
        invoices = billing.contract_invoices(contract)
        return Response({
            "settled": False,
            "is_active": contract.is_active,
            "contract_id": contract.id,
            "contract_number": contract.contract_number,
            "tenant": _tenant_card(contract.customer),
            "unit": unit.unit_number,
            "property": _property_card(unit.property),
            "deposit_held": billing.deposit_held(invoices),
            "unpaid_balance": billing.outstanding(invoices),
            "meters": {
                "has_water_bill": bool(params and params.has_water_bill),
                "has_electricity_bill": bool(params and params.has_electricity_bill),
                "water_reading": unit.water_meter_reading,
                "electricity_reading": unit.electricity_meter_reading,
                "water_unit_cost": params.water_unit_cost if params else billing.ZERO,
                "electricity_unit_cost": params.electicity_unit_cost if params else billing.ZERO,
            },
        })

    @transaction.atomic
    def post(self, request, pk):
        contract = get_object_or_404(
            RentalContract.objects.select_for_update().select_related("customer", "unit__property"), pk=pk
        )
        if not contract.is_active:
            return Response({"error": "This contract has already ended."}, status=status.HTTP_400_BAD_REQUEST)

        data = request.data
        move_out_date = _date(data.get("move_out_date"), timezone.localdate())
        deductions = _decimal(data.get("deductions"), billing.ZERO)
        if deductions is None or deductions < 0:
            return Response({"error": "Deductions must be zero or more."}, status=status.HTTP_400_BAD_REQUEST)

        unit = contract.unit
        params = SystemParameter.objects.filter(property=unit.property).first()

        # Bill the water and electricity used since the last invoice
        water_reading = _decimal(data.get("final_water_reading"))
        electricity_reading = _decimal(data.get("final_electricity_reading"))
        water_bill = electricity_bill = billing.ZERO
        if params and params.has_water_bill and water_reading is not None:
            if water_reading < unit.water_meter_reading:
                return Response({"error": "The final water reading is below the last reading."},
                                status=status.HTTP_400_BAD_REQUEST)
            water_bill = billing.money((water_reading - unit.water_meter_reading) * params.water_unit_cost)
        else:
            water_reading = unit.water_meter_reading
        if params and params.has_electricity_bill and electricity_reading is not None:
            if electricity_reading < unit.electricity_meter_reading:
                return Response({"error": "The final electricity reading is below the last reading."},
                                status=status.HTTP_400_BAD_REQUEST)
            electricity_bill = billing.money(
                (electricity_reading - unit.electricity_meter_reading) * params.electicity_unit_cost
            )
        else:
            electricity_reading = unit.electricity_meter_reading

        if water_bill > 0 or electricity_bill > 0:
            Receipt.objects.create(
                contract=contract,
                issued_by=request.user,
                # Like every invoice, the final one brings the unpaid balance forward
                previous_balance=billing.outstanding(billing.contract_invoices(contract)),
                water_bill=water_bill,
                electricity_bill=electricity_bill,
                previous_water_reading=unit.water_meter_reading,
                current_water_reading=water_reading,
                previous_electricity_reading=unit.electricity_meter_reading,
                current_electricity_reading=electricity_reading,
            )
            unit.water_meter_reading = water_reading
            unit.electricity_meter_reading = electricity_reading
            unit.save(update_fields=["water_meter_reading", "electricity_meter_reading"])

        invoices = billing.contract_invoices(contract)
        deposit = billing.deposit_held(invoices)
        unpaid = billing.outstanding(invoices)
        refund = billing.money(deposit - unpaid - deductions)

        refund_payment = None
        if refund > 0 and data.get("record_refund", True):
            tenant_name = f"{contract.customer.first_name} {contract.customer.last_name}"
            expense = Expense.objects.create(
                property=unit.property,
                category=Expense.Category.DEPOSIT_REFUND,
                description=f"Deposit refund - Unit {unit.unit_number} - {tenant_name}",
                amount=refund,
                recorded_by=request.user,
            )
            try:
                # Savepoint: a rejected reference must not poison the outer transaction
                with transaction.atomic():
                    refund_payment = Payment.objects.create(
                        expense=expense,
                        amount=refund,
                        type=Payment.EXPENSE,
                        method=data.get("refund_method") or "cash",
                        reference=(data.get("refund_reference") or "").strip() or None,
                        notes=f"Deposit refund - Unit {unit.unit_number} - {tenant_name}",
                    )
            except IntegrityError:
                transaction.set_rollback(True)
                return Response({"error": "That refund reference has already been used on another payment."},
                                status=status.HTTP_400_BAD_REQUEST)

        move_out = MoveOut.objects.create(
            contract=contract,
            move_out_date=move_out_date,
            deposit_held=deposit,
            unpaid_balance=unpaid,
            deductions=deductions,
            deduction_notes=(data.get("deduction_notes") or "").strip(),
            refund_amount=refund,
            refund_payment=refund_payment,
            recorded_by=request.user,
        )

        contract.is_active = False
        contract.end_date = move_out_date
        contract.save()

        unit.status = "vacant"
        unit.balance = 0
        unit.save(update_fields=["status", "balance"])
        Customer.objects.filter(pk=contract.customer_id, unit=unit).update(unit=None)

        return Response({"settled": True, "settlement": _settlement(contract, move_out)},
                        status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# M-Pesa paybill / till payments (Daraja C2B)
# ---------------------------------------------------------------------------

def _check_callback_token(token):
    """The callback URLs are public, so they carry a secret that only Safaricom is given."""
    expected = getattr(settings, "MPESA_CALLBACK_TOKEN", "")
    if not expected or not hmac.compare_digest(str(token), str(expected)):
        raise Http404()


def _digits(value):
    return re.sub(r"\D", "", value or "")


def find_invoice_for_reference(bill_ref, msisdn=""):
    """
    Work out which invoice a paybill payment is for, from the account number the
    tenant typed: an invoice number, their unit number, or their phone number.
    Returns None when it is not clear, so that nothing is credited to the wrong tenant.
    """
    ref = (bill_ref or "").strip()
    if ref:
        number = re.sub(r"^INV-", "RCT-", ref.upper())
        invoice = Receipt.objects.filter(receipt_number__iexact=number).first()
        if invoice:
            return invoice

    contracts = RentalContract.objects.filter(is_active=True)
    contract = None
    if ref:
        by_unit = list(contracts.filter(unit__unit_number__iexact=ref)[:2])
        if len(by_unit) == 1:
            contract = by_unit[0]
    if contract is None:
        for phone in (_digits(ref), _digits(msisdn)):
            # Compare the last nine digits so 0712…, 254712… and +254712… all match
            if len(phone) >= 9:
                by_phone = list(contracts.filter(customer__phone_number__endswith=phone[-9:])[:2])
                if len(by_phone) == 1:
                    contract = by_phone[0]
                    break
    if contract is None:
        return None
    return billing.invoice_to_pay(billing.contract_invoices(contract))


def apply_mpesa_transaction(transaction_row, invoice):
    """Record the payment for a paybill transaction, or link the one already entered by hand."""
    existing = Payment.objects.filter(reference=transaction_row.trans_id).first()
    if existing is None:
        existing = Payment.objects.create(
            receipt=invoice,
            amount=transaction_row.amount,
            method="mpesa",
            type=Payment.INCOME,
            reference=transaction_row.trans_id,
            notes=f"M-Pesa paybill payment{' from ' + transaction_row.payer_name if transaction_row.payer_name else ''}",
        )
    transaction_row.payment = existing
    transaction_row.save(update_fields=["payment"])
    return existing


class MpesaValidationView(APIView):
    """Safaricom asks before completing a payment; every payment is accepted."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, token):
        _check_callback_token(token)
        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})


class MpesaConfirmationView(APIView):
    """Safaricom reports a completed payment. Safe to receive the same payment twice."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, token):
        _check_callback_token(token)
        data = request.data
        trans_id = str(data.get("TransID") or "").strip()
        amount = _decimal(data.get("TransAmount"))
        if not trans_id or amount is None or amount <= 0:
            return Response({"ResultCode": 1, "ResultDesc": "Missing TransID or TransAmount"},
                            status=status.HTTP_400_BAD_REQUEST)

        trans_time = None
        try:
            trans_time = timezone.make_aware(datetime.strptime(str(data.get("TransTime")), "%Y%m%d%H%M%S"))
        except (TypeError, ValueError):
            pass

        name = " ".join(filter(None, (data.get("FirstName"), data.get("MiddleName"), data.get("LastName"))))
        with transaction.atomic():
            row, created = MpesaTransaction.objects.get_or_create(
                trans_id=trans_id,
                defaults={
                    "trans_time": trans_time,
                    "amount": amount,
                    "bill_ref": str(data.get("BillRefNumber") or "").strip()[:100],
                    "msisdn": str(data.get("MSISDN") or "")[:100],
                    "payer_name": name[:150],
                    "raw": dict(data),
                },
            )
            if created:
                invoice = find_invoice_for_reference(row.bill_ref, row.msisdn)
                if invoice:
                    apply_mpesa_transaction(row, invoice)
                else:
                    logger.warning("M-Pesa payment %s (%s) could not be matched to an invoice", trans_id, row.bill_ref)
        return Response({"ResultCode": 0, "ResultDesc": "Success"})


def _mpesa_row(row):
    payment = row.payment
    return {
        "id": row.id,
        "trans_id": row.trans_id,
        "trans_time": row.trans_time or row.created_at,
        "amount": row.amount,
        "bill_ref": row.bill_ref,
        "payer_name": row.payer_name,
        "matched": payment is not None,
        "payment_id": payment.id if payment else None,
        "invoice_number": payment.receipt.receipt_number if payment and payment.receipt_id else None,
    }


class MpesaTransactionListView(APIView):
    """GET api/paybill-transactions/?status=unmatched"""
    permission_classes = [IsAuthenticated]

    @cached_get
    def get(self, request):
        rows = MpesaTransaction.objects.select_related("payment__receipt")
        if request.query_params.get("status") == "unmatched":
            rows = rows.filter(payment__isnull=True)
        return Response({
            "configured": bool(getattr(settings, "MPESA_CALLBACK_TOKEN", "")),
            "transactions": [_mpesa_row(row) for row in rows[:200]],
        })


class MpesaTransactionMatchView(APIView):
    """POST api/paybill-transactions/<id>/match/ {receipt: <invoice id>}"""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        row = get_object_or_404(MpesaTransaction.objects.select_for_update(), pk=pk)
        if row.payment_id:
            return Response({"error": "This payment has already been matched."}, status=status.HTTP_400_BAD_REQUEST)
        invoice = get_object_or_404(Receipt, pk=request.data.get("receipt"))
        apply_mpesa_transaction(row, invoice)
        row = MpesaTransaction.objects.select_related("payment__receipt").get(pk=row.pk)
        return Response(_mpesa_row(row))
