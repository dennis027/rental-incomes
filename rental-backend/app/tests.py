from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from . import billing
from .models import (
    Customer, Expense, MoveOut, MpesaTransaction, Payment, Property, Receipt, RentalContract, SystemParameter, Unit,
)


@override_settings(MPESA_CALLBACK_TOKEN="secret-token", SECURE_SSL_REDIRECT=False)
class BillingFlowTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="landlord", password="pw")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

        self.property = Property.objects.create(name="Sunrise", address="Ngong Road", account=self.user.account)
        self.params = SystemParameter.objects.create(
            property=self.property, late_payment_penalty_rate=Decimal("5"), grace_period_days=5,
            has_service_charge=False, water_unit_cost=Decimal("100"), electicity_unit_cost=Decimal("20"),
        )
        self.unit = Unit.objects.create(property=self.property, unit_number="B12", rent_amount=10000)
        self.customer = Customer.objects.create(
            first_name="Wanjiru", last_name="Kamau", phone_number="0712345678", id_number="1",
            account=self.user.account,
        )
        response = self.client.post("/api/contracts/", {
            "customer": self.customer.id, "unit": self.unit.id, "start_date": "2026-01-01",
            "rent_amount": "10000", "deposit_amount": "10000",
            "end_date": (timezone.localdate() + timedelta(days=20)).isoformat(),
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.contract = RentalContract.objects.get()
        self.first_invoice = Receipt.objects.get()
        # Issued long enough ago to be past the grace period
        Receipt.objects.filter(pk=self.first_invoice.pk).update(issue_date=timezone.now() - timedelta(days=40))
        self.first_invoice.refresh_from_db()

    def pay(self, invoice, amount, reference):
        return self.client.post("/api/payments/", {
            "receipt": invoice.id, "amount": str(amount), "method": "mpesa", "reference": reference,
        }, format="json")

    def generate(self, month):
        response = self.client.post("/api/receipts/generate-monthly-receipts/", {
            "month": month, "property_id": self.property.id,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return Receipt.objects.order_by("-id").first()

    def next_month(self, offset=1):
        today = timezone.localdate()
        month = today.month - 1 + offset
        return f"{today.year + month // 12}-{month % 12 + 1:02d}"

    def test_brought_forward_balance_is_not_counted_twice(self):
        self.assertEqual(self.pay(self.first_invoice, 15000, "A1").status_code, 201)
        second = self.generate(self.next_month(1))
        # 20,000 billed (rent + deposit), 15,000 paid
        self.assertEqual(second.previous_balance, Decimal("5000.00"))
        self.assertEqual(second.late_penalty, Decimal("250.00"))
        self.assertEqual(second.total_amount, Decimal("15250.00"))

        third = self.generate(self.next_month(2))
        # 5,000 + 10,000 rent + 250 penalty still owed, not 5,000 + 15,250 + 5,000
        self.assertEqual(third.previous_balance, Decimal("15250.00"))

        self.unit.refresh_from_db()
        owed = billing.outstanding(billing.contract_invoices(self.contract))
        self.assertEqual(self.unit.balance, owed)

        rows = self.client.get(f"/api/arrears/?property_id={self.property.id}").data["rows"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["outstanding"], owed)
        self.assertEqual(rows[0]["invoice_id"], third.id)
        self.assertGreater(rows[0]["days_overdue"], 0)

        statement = self.client.get(f"/api/customers/{self.customer.id}/statement/").data
        self.assertEqual(statement["closing_balance"], owed)
        self.assertEqual([entry["type"] for entry in statement["entries"]][:2], ["invoice", "payment"])

    def test_no_penalty_when_paid_up(self):
        self.pay(self.first_invoice, 20000, "A2")
        second = self.generate(self.next_month(1))
        self.assertEqual(second.previous_balance, Decimal("0.00"))
        self.assertEqual(second.late_penalty, Decimal("0.00"))
        self.assertEqual(self.client.get("/api/arrears/").data["rows"][0]["outstanding"], Decimal("10000.00"))

    def test_contracts_ending_soon(self):
        rows = self.client.get("/api/contracts/ending-soon/?days=60").data
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["days_left"], 20)
        self.assertEqual(self.client.get("/api/contracts/ending-soon/?days=10").data, [])

    def test_move_out_settles_the_deposit(self):
        self.pay(self.first_invoice, 15000, "A3")
        preview = self.client.get(f"/api/contracts/{self.contract.id}/move-out/").data
        self.assertEqual(preview["deposit_held"], Decimal("10000.00"))
        self.assertEqual(preview["unpaid_balance"], Decimal("5000.00"))

        response = self.client.post(f"/api/contracts/{self.contract.id}/move-out/", {
            "move_out_date": "2026-10-31", "deductions": "1500", "deduction_notes": "Repaint",
            "final_water_reading": "5", "refund_method": "mpesa", "refund_reference": "REF1",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        settlement = response.data["settlement"]
        # 10,000 deposit - (5,000 + 500 water) - 1,500 deductions
        self.assertEqual(settlement["unpaid_balance"], Decimal("5500.00"))
        self.assertEqual(settlement["refund_amount"], Decimal("3000.00"))

        self.contract.refresh_from_db()
        self.unit.refresh_from_db()
        self.assertFalse(self.contract.is_active)
        self.assertEqual(self.unit.status, "vacant")
        self.assertEqual(self.unit.water_meter_reading, Decimal("5.00"))
        refund = Payment.objects.get(type="OUT")
        self.assertEqual(refund.amount, Decimal("3000.00"))
        self.assertEqual(Expense.objects.get().payment_status, "paid")
        self.assertEqual(Expense.objects.get().category, "deposit_refund")
        # Settled by the deposit, so no longer in arrears
        self.assertEqual(self.client.get("/api/arrears/").data["rows"], [])
        # Cannot be done twice, and the settlement can be fetched again
        self.assertEqual(self.client.post(f"/api/contracts/{self.contract.id}/move-out/", {}, format="json").status_code, 400)
        self.assertTrue(self.client.get(f"/api/contracts/{self.contract.id}/move-out/").data["settled"])

    def test_move_out_where_tenant_still_owes(self):
        response = self.client.post(f"/api/contracts/{self.contract.id}/move-out/", {"deductions": "2000"}, format="json")
        self.assertEqual(response.data["settlement"]["refund_amount"], Decimal("-12000.00"))
        self.assertFalse(Payment.objects.filter(type="OUT").exists())
        rows = self.client.get("/api/arrears/").data["rows"]
        self.assertEqual(rows[0]["outstanding"], Decimal("12000.00"))
        self.assertFalse(rows[0]["is_active"])
        # Paying after moving out brings the debt down
        self.pay(self.first_invoice, 5000, "M1")
        rows = self.client.get("/api/arrears/").data["rows"]
        self.assertEqual(rows[0]["outstanding"], Decimal("7000.00"))
        invoice = self.client.get(f"/api/receipts/{self.first_invoice.id}/").data
        self.assertEqual(Decimal(invoice["balance_due"]), Decimal("7000.00"))
        self.pay(self.first_invoice, 7000, "M2")
        self.assertEqual(self.client.get("/api/arrears/").data["rows"], [])

    def confirm(self, trans_id, amount, bill_ref, token="secret-token"):
        return APIClient().post(f"/api/paybill/{token}/confirmation/", {
            "TransID": trans_id, "TransAmount": str(amount), "BillRefNumber": bill_ref,
            "TransTime": "20261011101500", "MSISDN": "hashed", "FirstName": "WANJIRU",
        }, format="json")

    def test_paybill_payments(self):
        self.assertEqual(self.confirm("X0", 100, "B12", token="wrong").status_code, 404)

        number = self.first_invoice.receipt_number.replace("RCT-", "INV-")
        self.assertEqual(self.confirm("X1", 4000, number).status_code, 200)
        self.assertEqual(self.confirm("X1", 4000, number).status_code, 200)  # sent twice by Safaricom
        self.assertEqual(self.confirm("X2", 1000, " b12 ").status_code, 200)
        self.assertEqual(self.confirm("X3", 500, "254712345678").status_code, 200)
        self.assertEqual(self.confirm("X4", 700, "no idea").status_code, 200)

        self.first_invoice.refresh_from_db()
        self.assertEqual(self.first_invoice.amount_paid, Decimal("5500.00"))
        self.assertEqual(Payment.objects.count(), 3)

        data = self.client.get("/api/paybill-transactions/?status=unmatched").data
        self.assertTrue(data["configured"])
        self.assertEqual([row["trans_id"] for row in data["transactions"]], ["X4"])

        unmatched = MpesaTransaction.objects.get(trans_id="X4")
        response = self.client.post(f"/api/paybill-transactions/{unmatched.id}/match/",
                                    {"receipt": self.first_invoice.id}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.first_invoice.refresh_from_db()
        self.assertEqual(self.first_invoice.amount_paid, Decimal("6200.00"))
        self.assertEqual(self.client.post(f"/api/paybill-transactions/{unmatched.id}/match/",
                                          {"receipt": self.first_invoice.id}, format="json").status_code, 400)

    @override_settings(MPESA_CALLBACK_TOKEN="")
    def test_paybill_is_off_without_a_token(self):
        self.assertEqual(self.confirm("X9", 100, "B12", token="").status_code, 404)
        self.assertEqual(self.confirm("X9", 100, "B12", token="anything").status_code, 404)

    def test_editing_and_deleting_a_payment_keeps_the_invoice_right(self):
        payment_id = self.pay(self.first_invoice, 15000, "E1").data["id"]
        response = self.client.patch(f"/api/payments/{payment_id}/", {"amount": "12000"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.first_invoice.refresh_from_db()
        self.assertEqual(self.first_invoice.amount_paid, Decimal("12000.00"))
        self.assertEqual(self.first_invoice.status, "partial")

        # An invoice with money against it cannot be deleted
        self.assertEqual(self.client.delete(f"/api/receipts/{self.first_invoice.id}/").status_code, 400)

        self.assertEqual(self.client.delete(f"/api/payments/{payment_id}/").status_code, 204)
        self.first_invoice.refresh_from_db()
        self.unit.refresh_from_db()
        self.assertEqual(self.first_invoice.amount_paid, Decimal("0.00"))
        self.assertEqual(self.first_invoice.status, "unpaid")
        self.assertEqual(self.unit.balance, Decimal("20000.00"))

    def test_editing_an_invoice_refreshes_its_status(self):
        self.pay(self.first_invoice, 20000, "E2")
        self.first_invoice.refresh_from_db()
        self.assertEqual(self.first_invoice.status, "paid")
        response = self.client.patch(f"/api/receipts/{self.first_invoice.id}/", {"other_charges": "500"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.first_invoice.refresh_from_db()
        self.assertEqual(self.first_invoice.status, "partial")

    def test_dashboard_pending_rent_matches_arrears(self):
        self.pay(self.first_invoice, 15000, "E3")
        summary = self.client.get(f"/api/dashboard/summary/?property_id={self.property.id}").data
        self.assertEqual(Decimal(str(summary["pending_rent"])), Decimal("5000.00"))

    def test_payments_go_to_the_latest_invoice(self):
        second = self.generate(self.next_month(1))   # brings the unpaid 20,000 forward
        # Paid against the old invoice, e.g. a paybill payment quoting last month's number
        response = self.pay(self.first_invoice, 12000, "L1")
        self.assertEqual(response.data["receipt"], second.id)
        self.first_invoice.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(self.first_invoice.amount_paid, Decimal("0.00"))
        self.assertEqual(second.amount_paid, Decimal("12000.00"))

        rows = {row["id"]: row for row in self.client.get("/api/receipts/").data}
        owed = billing.outstanding(billing.contract_invoices(self.contract))
        self.assertTrue(rows[second.id]["is_latest"])
        self.assertEqual(Decimal(rows[second.id]["balance_due"]), owed)
        self.assertEqual(Decimal(rows[second.id]["balance"]), owed)
        self.assertFalse(rows[self.first_invoice.id]["is_latest"])
        self.assertEqual(rows[self.first_invoice.id]["carried_to"], second.receipt_number)
        self.assertEqual(Decimal(rows[self.first_invoice.id]["balance_due"]), Decimal("0"))
        # What every invoice still asks for adds up to what is really owed
        self.assertEqual(sum(Decimal(row["balance_due"]) for row in rows.values()), owed)
        detail = self.client.get(f"/api/receipts/{self.first_invoice.id}/").data
        self.assertEqual(detail["carried_to"], second.receipt_number)

    def test_overpayment_is_carried_as_credit(self):
        self.pay(self.first_invoice, 23000, "L2")
        second = self.generate(self.next_month(1))
        self.assertEqual(second.previous_balance, Decimal("-3000.00"))
        self.assertEqual(second.total_amount, Decimal("7000.00"))
        self.assertEqual(second.late_penalty, Decimal("0.00"))

    def test_expense_and_maintenance_types(self):
        response = self.client.post("/api/expenses/", {
            "property": self.property.id, "category": "salaries", "description": "Caretaker October", "amount": "12000",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["category_display"], "Salaries & wages")
        # Left out, it falls back to "Other"; an unknown type is refused
        other = self.client.post("/api/expenses/", {"property": self.property.id, "description": "Misc", "amount": "100"}, format="json")
        self.assertEqual(other.data["category"], "other")
        bad = self.client.post("/api/expenses/", {"property": self.property.id, "category": "nope", "description": "x", "amount": "1"}, format="json")
        self.assertEqual(bad.status_code, 400)

        request = self.client.post("/api/maintenance-requests/", {
            "unit": self.unit.id, "customer": self.customer.id, "category": "plumbing", "description": "Leaking tap",
        }, format="json")
        self.assertEqual(request.status_code, 201, request.data)
        self.assertEqual(request.data["category_display"], "Plumbing")


@override_settings(SECURE_SSL_REDIRECT=False)
class SecurityTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.user = get_user_model().objects.create_user(username="landlord", email="l@example.com", password="right-password")

    def login(self, password):
        return APIClient().post("/api/login/", {"identifier": "landlord", "password": password}, format="json")

    def test_login_locks_after_repeated_failures(self):
        for _ in range(5):
            self.assertEqual(self.login("wrong").status_code, 400)
        # Even the right password is refused while locked
        self.assertEqual(self.login("right-password").status_code, 429)

    def test_successful_login_clears_the_count(self):
        for _ in range(4):
            self.login("wrong")
        self.assertEqual(self.login("right-password").status_code, 200)
        for _ in range(4):
            self.assertEqual(self.login("wrong").status_code, 400)

    def test_reset_code_is_thrown_away_after_wrong_guesses(self):
        self.user.reset_code = "123456"
        self.user.reset_code_expiry = timezone.now() + timedelta(minutes=15)
        self.user.save()
        check = lambda code: APIClient().post("/api/password-reset/check-code/", {"email": "l@example.com", "reset_code": code}, format="json")
        for _ in range(4):
            self.assertEqual(check("000000").status_code, 400)
        self.assertEqual(check("000000").status_code, 429)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.reset_code)
        # The real code no longer works either
        self.assertNotEqual(check("123456").status_code, 200)

    def test_signup_is_closed_by_default(self):
        body = {"username": "stranger", "email": "s@example.com", "password": "Str0ng-pass-123", "password2": "Str0ng-pass-123"}
        self.assertEqual(APIClient().post("/api/register/", body, format="json").status_code, 403)
        self.assertFalse(get_user_model().objects.filter(username="stranger").exists())

    def test_uploaded_files_need_a_login(self):
        import os, tempfile
        with tempfile.TemporaryDirectory() as media, self.settings(MEDIA_ROOT=media):
            os.makedirs(os.path.join(media, "customer_ids"))
            with open(os.path.join(media, "customer_ids", "id.png"), "wb") as handle:
                handle.write(b"png-bytes")
            self.assertEqual(APIClient().get("/media/customer_ids/id.png").status_code, 401)
            client = APIClient(); client.force_authenticate(self.user)
            response = client.get("/media/customer_ids/id.png")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(b"".join(response.streaming_content), b"png-bytes")
            self.assertEqual(client.get("/media/../projects/settings.py").status_code, 404)
            self.assertEqual(client.get("/media/customer_ids/missing.png").status_code, 404)


@override_settings(SECURE_SSL_REDIRECT=False)
class RentFrequencyTests(TestCase):
    def test_quarterly_rent_is_charged_every_third_month(self):
        from datetime import date
        from types import SimpleNamespace
        contract = SimpleNamespace(payment_frequency="quarterly", rent_amount=Decimal("10000"), start_date=date(2026, 11, 15))
        due = [billing.rent_due(contract, 2026 + (10 + i) // 12, (10 + i) % 12 + 1) for i in range(7)]   # Nov 2026 .. May 2027
        self.assertEqual(due, [Decimal("30000.00"), 0, 0, Decimal("30000.00"), 0, 0, Decimal("30000.00")])
        contract.payment_frequency = "yearly"
        self.assertEqual(billing.rent_due(contract, 2027, 11), Decimal("120000.00"))
        self.assertEqual(billing.rent_due(contract, 2027, 10), 0)
        contract.payment_frequency = "monthly"
        self.assertEqual(billing.rent_due(contract, 2027, 3), Decimal("10000.00"))


@override_settings(SECURE_SSL_REDIRECT=False)
class ApiCacheTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.user = get_user_model().objects.create_user(username="landlord", password="pw")
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.property = Property.objects.create(name="Sunrise", address="Ngong Road", account=self.user.account)

    def test_repeat_reads_come_from_the_cache(self):
        first = self.client.get("/api/properties/")
        self.assertEqual(first["X-Cache"], "MISS")
        with self.assertNumQueries(0):
            second = self.client.get("/api/properties/")
        self.assertEqual(second["X-Cache"], "HIT")
        self.assertEqual(second.json(), first.json())
        # Different filters are different entries
        self.assertEqual(self.client.get("/api/dashboard/summary/", {"property_id": self.property.id})["X-Cache"], "MISS")
        self.assertEqual(self.client.get("/api/dashboard/summary/")["X-Cache"], "MISS")

    def test_writes_clear_the_cache(self):
        self.client.get("/api/properties/")
        self.client.post("/api/properties/", {"name": "Lakeview", "address": "Kisumu"}, format="json")
        response = self.client.get("/api/properties/")
        self.assertEqual(response["X-Cache"], "MISS")
        self.assertEqual({p["name"] for p in response.json()}, {"Sunrise", "Lakeview"})

        # Writes outside the API (admin, tasks, commands) count too
        Property.objects.get(name="Lakeview").delete()
        self.assertEqual([p["name"] for p in self.client.get("/api/properties/").json()], ["Sunrise"])

    def test_logins_do_not_clear_the_cache(self):
        self.client.get("/api/properties/")
        self.user.last_login = timezone.now()
        self.user.save()
        self.assertEqual(self.client.get("/api/properties/")["X-Cache"], "HIT")

    def test_cached_pages_still_need_a_login(self):
        self.client.get("/api/properties/")
        self.assertEqual(APIClient().get("/api/properties/").status_code, 401)

    def test_email_task_sends_the_message(self):
        from django.core import mail
        from . import tasks
        tasks.send_email.delay("Hello", "Plain body", ["t@example.com"], "<p>Html body</p>")
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["t@example.com"])
        self.assertEqual(mail.outbox[0].alternatives[0][0], "<p>Html body</p>")


@override_settings(SECURE_SSL_REDIRECT=False, CONTACT_NOTIFY_EMAIL="owner@example.com")
class PublicFormTests(TestCase):
    contact = {"name": "Achieng Otieno", "email": "achieng@example.com", "phone": "0711000000",
               "subject": "Pricing", "message": "How much for 40 units?"}
    demo = {"first_name": "Brian", "last_name": "Mwangi", "email": "brian@example.com", "phone": "0722000000",
            "role": "Landlord", "units": "11-50", "source": "Google"}

    def setUp(self):
        from django.core.cache import cache
        cache.clear()

    def test_contact_message_is_emailed_to_the_owner(self):
        from django.core import mail
        response = APIClient().post("/api/contact/", self.contact, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["owner@example.com"])
        self.assertEqual(mail.outbox[0].reply_to, ["achieng@example.com"])
        self.assertIn("How much for 40 units?", mail.outbox[0].body)

    def test_demo_request_is_emailed_to_the_owner(self):
        from django.core import mail
        response = APIClient().post("/api/request-demo/", self.demo, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIn("Brian Mwangi", mail.outbox[0].subject)
        self.assertIn("Units: 11-50", mail.outbox[0].body)

    def test_invalid_and_bot_submissions_send_nothing(self):
        from django.core import mail
        self.assertEqual(APIClient().post("/api/contact/", {**self.contact, "email": "nope"}, format="json").status_code, 400)
        # The hidden field is filled: the bot is told it worked
        self.assertEqual(APIClient().post("/api/contact/", {**self.contact, "website": "spam.example"}, format="json").status_code, 201)
        self.assertEqual(len(mail.outbox), 0)

    def test_one_address_cannot_flood_the_inbox(self):
        for _ in range(5):
            self.assertEqual(APIClient().post("/api/contact/", self.contact, format="json").status_code, 201)
        self.assertEqual(APIClient().post("/api/contact/", self.contact, format="json").status_code, 429)
        # Each form has its own allowance
        self.assertEqual(APIClient().post("/api/request-demo/", self.demo, format="json").status_code, 201)

    def test_a_stale_login_token_does_not_block_the_form(self):
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION="Bearer expired-or-garbage")
        self.assertEqual(client.post("/api/contact/", self.contact, format="json").status_code, 201)


@override_settings(MPESA_CALLBACK_TOKEN="secret-token", SECURE_SSL_REDIRECT=False)
class AccountIsolationTests(TestCase):
    """Two landlords on the same server never see each other's data."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        BillingFlowTests.setUp(self)  # landlord A with a property, unit, tenant, contract and invoice
        self.other = get_user_model().objects.create_user(username="other", email="other@example.com", password="pw")
        self.other_client = APIClient()
        self.other_client.force_authenticate(self.other)

    def member(self, role):
        user = get_user_model().objects.create_user(
            username=role, email=f"{role}@example.com", password="pw", account=self.user.account, role=role,
        )
        client = APIClient()
        client.force_authenticate(user)
        return client

    def test_each_signup_gets_its_own_account(self):
        self.assertIsNotNone(self.user.account_id)
        self.assertNotEqual(self.user.account_id, self.other.account_id)
        self.assertEqual(self.other.role, "owner")

    def test_lists_only_show_your_own_rows(self):
        self.client.post("/api/payments/", {
            "receipt": self.first_invoice.id, "amount": "100", "method": "cash",
        }, format="json")
        for url in ("/api/properties/", "/api/units/", "/api/customers/", "/api/contracts/",
                    "/api/receipts/", "/api/payments/"):
            response = self.other_client.get(url)
            self.assertEqual(response.status_code, 200, url)
            self.assertEqual(response.json(), [], url)
            self.assertNotEqual(self.client.get(url).json(), [], url)

    def test_cannot_open_or_change_another_accounts_rows(self):
        self.assertEqual(self.other_client.get(f"/api/properties/{self.property.id}/").status_code, 404)
        self.assertEqual(self.other_client.get(f"/api/customers/{self.customer.id}/").status_code, 404)
        self.assertEqual(self.other_client.delete(f"/api/receipts/{self.first_invoice.id}/").status_code, 404)
        # Nor attach new rows to them
        response = self.other_client.post("/api/units/", {
            "property": self.property.id, "unit_number": "X1", "rent_amount": 5000,
        }, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.other_client.post("/api/payments/", {
            "receipt": self.first_invoice.id, "amount": "100", "method": "cash",
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_new_rows_belong_to_the_creator_and_the_body_cannot_say_otherwise(self):
        response = self.other_client.post("/api/properties/", {
            "name": "Lakeview", "address": "Kisumu", "account": self.user.account_id,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Property.all_objects.get(name="Lakeview").account_id, self.other.account_id)
        self.assertEqual([p["name"] for p in self.client.get("/api/properties/").json()], ["Sunrise"])

    def test_the_same_tenant_can_rent_from_two_landlords(self):
        data = {"first_name": "Wanjiru", "last_name": "Kamau", "phone_number": "0712345678", "id_number": "1"}
        self.assertEqual(self.other_client.post("/api/customers/", data, format="json").status_code, 201)
        # but not twice from the same one
        self.assertEqual(self.client.post("/api/customers/", data, format="json").status_code, 400)

    def test_cached_pages_are_per_account(self):
        self.assertEqual(len(self.client.get("/api/properties/").json()), 1)
        self.assertEqual(self.other_client.get("/api/properties/").json(), [])

    def test_paybill_payments_go_to_the_account_of_the_callback_url(self):
        other_property = Property.all_objects.create(name="Elsewhere", address="Thika", account=self.other.account)
        other_unit = Unit.all_objects.create(property=other_property, unit_number="B12", rent_amount=1000)
        self.assertTrue(other_unit.pk)
        token = self.user.account.mpesa_callback_token
        response = self.client.post(f"/api/paybill/{token}/confirmation/", {
            "TransID": "Y1", "TransAmount": "1000", "BillRefNumber": "B12",
        }, format="json")
        self.assertEqual(response.status_code, 200)
        row = MpesaTransaction.all_objects.get(trans_id="Y1")
        self.assertEqual(row.account_id, self.user.account_id)
        self.assertEqual(row.payment.receipt.contract_id, self.contract.id)
        self.assertEqual(self.other_client.get("/api/paybill-transactions/").data["transactions"], [])

    def test_caretaker_handles_repairs_but_not_money(self):
        caretaker = self.member("caretaker")
        self.assertEqual(caretaker.get("/api/units/").status_code, 200)
        self.assertEqual(caretaker.get("/api/payments/").status_code, 403)
        self.assertEqual(caretaker.get("/api/receipts/").status_code, 403)
        self.assertEqual(caretaker.post("/api/properties/", {"name": "N", "address": "A"}, format="json").status_code, 403)
        response = caretaker.post("/api/maintenance-requests/", {
            "unit": self.unit.id, "description": "Leaking tap",
        }, format="json")
        self.assertNotEqual(response.status_code, 403)

    def test_accountant_records_money_but_not_buildings(self):
        accountant = self.member("accountant")
        self.assertEqual(accountant.get("/api/properties/").status_code, 200)
        self.assertEqual(accountant.post("/api/properties/", {"name": "N", "address": "A"}, format="json").status_code, 403)
        response = accountant.post("/api/payments/", {
            "receipt": self.first_invoice.id, "amount": "100", "method": "cash",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)

    def test_only_owners_manage_the_team(self):
        manager = self.member("manager")
        new = {"username": "kamau", "email": "kamau@example.com", "role": "caretaker"}
        self.assertEqual(manager.post("/api/team/", new, format="json").status_code, 403)
        self.assertEqual(manager.get("/api/team/").status_code, 200)

        from django.core import mail
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post("/api/team/", new, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        added = get_user_model().objects.get(username="kamau")
        self.assertEqual(added.account_id, self.user.account_id)
        self.assertFalse(added.has_usable_password())
        self.assertEqual(mail.outbox[-1].to, ["kamau@example.com"])

        # Members of another account are out of reach
        self.assertEqual(self.other_client.patch(f"/api/team/{added.id}/", {"role": "owner"}, format="json").status_code, 404)
        # The last owner stays an owner
        me = self.client.patch(f"/api/team/{self.user.id}/", {"role": "manager"}, format="json")
        self.assertEqual(me.status_code, 400)
        self.assertEqual(self.client.delete(f"/api/team/{added.id}/").status_code, 204)
        added.refresh_from_db()
        self.assertFalse(added.is_active)

    def test_me_and_account(self):
        me = self.client.get("/api/me/").json()
        self.assertEqual(me["role"], "owner")
        self.assertEqual(me["account"]["id"], self.user.account_id)
        account = self.client.get("/api/account/").json()
        self.assertIn(self.user.account.mpesa_callback_token, account["paybill_confirmation_url"])
        response = self.client.patch("/api/account/", {"name": "Kamau Homes", "sms_reminders_enabled": True}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.member("caretaker").patch("/api/account/", {"name": "x"}, format="json").status_code, 403)


@override_settings(MPESA_CALLBACK_TOKEN="secret-token", SECURE_SSL_REDIRECT=False)
class RentalIncomeTaxTests(TestCase):
    def setUp(self):
        BillingFlowTests.setUp(self)

    def test_tax_is_on_the_rent_share_of_payments_received(self):
        # The first invoice is rent 10,000 plus a 10,000 deposit, so half of each payment is rent
        self.assertEqual(self.first_invoice.new_charges, Decimal("20000.00"))
        self.client.post("/api/payments/", {
            "receipt": self.first_invoice.id, "amount": "8000", "method": "mpesa", "reference": "T1",
        }, format="json")
        today = timezone.localdate()
        data = self.client.get(f"/api/reports/rental-income-tax/?month={today:%Y-%m}").json()
        self.assertEqual(data["totals"]["collected"], 8000)
        self.assertEqual(data["totals"]["rent"], 4000)
        self.assertEqual(data["totals"]["tax"], 300)
        self.assertEqual(data["due_date"][-2:], "20")
        self.assertEqual(data["regime"], "below_threshold")
        self.assertEqual(len(data["payments"]), 1)

        # A month with nothing received is a nil return
        empty = self.client.get("/api/reports/rental-income-tax/?month=2020-01").json()
        self.assertEqual(empty["totals"]["tax"], 0)
        self.assertEqual(empty["due_date"], "2020-02-20")


@override_settings(MPESA_CALLBACK_TOKEN="secret-token", SECURE_SSL_REDIRECT=False,
                   AT_USERNAME="sandbox", AT_API_KEY="key", MPESA_SHORTCODE="174379")
class SmsReminderTests(TestCase):
    def setUp(self):
        BillingFlowTests.setUp(self)  # the first invoice is unpaid and past its grace period
        self.account = self.user.account
        self.account.sms_reminders_enabled = True
        self.account.save()

    def provider(self, status="Success"):
        from unittest import mock
        response = mock.Mock()
        response.json.return_value = {"SMSMessageData": {"Recipients": [{"status": status, "number": "+254712345678"}]}}
        response.raise_for_status.return_value = None
        return mock.patch("app.sms.requests.post", return_value=response)

    def test_phone_numbers(self):
        from .sms import kenyan_number
        self.assertEqual(kenyan_number("0712 345 678"), "+254712345678")
        self.assertEqual(kenyan_number("254112345678"), "+254112345678")
        self.assertEqual(kenyan_number("+254712345678"), "+254712345678")
        self.assertIsNone(kenyan_number("020 123 4567"))

    def test_daily_run_texts_overdue_tenants_once_per_period(self):
        from .models import SmsMessage
        from .sms import send_daily_reminders
        with self.provider() as post:
            self.assertEqual(send_daily_reminders(), 1)
            self.assertEqual(send_daily_reminders(), 0)  # not again until the repeat period passes
        sent = post.call_args.kwargs["data"]
        self.assertEqual(sent["to"], "+254712345678")
        self.assertIn("overdue", sent["message"])
        self.assertIn("paybill 174379, account B12", sent["message"])
        self.assertEqual(SmsMessage.all_objects.get().kind, "overdue")

        # Accounts that have not switched reminders on are left alone
        SmsMessage.all_objects.all().delete()
        self.account.sms_reminders_enabled = False
        self.account.save()
        with self.provider():
            self.assertEqual(send_daily_reminders(), 0)

    def test_send_now_from_the_arrears_page(self):
        with self.provider("InvalidPhoneNumber"):
            response = self.client.post("/api/reminders/send/", {"contract_ids": [self.contract.id]}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["failed"], 1)
        with self.provider():
            response = self.client.post("/api/reminders/send/", {"contract_ids": [self.contract.id]}, format="json")
        self.assertEqual(response.data["sent"], 1)
        log = self.client.get("/api/reminders/").data
        self.assertTrue(log["configured"])
        self.assertEqual([m["sent"] for m in log["messages"]], [True, False])

    @override_settings(AT_API_KEY="")
    def test_off_until_configured(self):
        response = self.client.post("/api/reminders/send/", {"contract_ids": [self.contract.id]}, format="json")
        self.assertEqual(response.status_code, 400)


@override_settings(MPESA_CALLBACK_TOKEN="secret-token", SECURE_SSL_REDIRECT=False, MPESA_SHORTCODE="174379",
                   MPESA_CONSUMER_KEY="key", MPESA_CONSUMER_SECRET="secret", MPESA_PASSKEY="passkey",
                   MPESA_CALLBACK_BASE_URL="https://api.example.com")
class StkPushTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        BillingFlowTests.setUp(self)

    def daraja(self, response_code="0"):
        from unittest import mock
        token = mock.Mock(**{"json.return_value": {"access_token": "t"}, "raise_for_status.return_value": None})
        push = mock.Mock(**{"json.return_value": {
            "ResponseCode": response_code, "MerchantRequestID": "M1", "CheckoutRequestID": "ws_CO_1",
            "errorMessage": "Invalid PhoneNumber",
        }})
        return mock.patch("app.daraja.requests.get", return_value=token), mock.patch("app.daraja.requests.post", return_value=push)

    def callback(self, code=0, receipt="QK1ABC", amount=20000, token=None):
        body = {"Body": {"stkCallback": {
            "MerchantRequestID": "M1", "CheckoutRequestID": "ws_CO_1", "ResultCode": code,
            "ResultDesc": "ok" if code == 0 else "Request cancelled by user",
            "CallbackMetadata": {"Item": [{"Name": "Amount", "Value": amount}, {"Name": "MpesaReceiptNumber", "Value": receipt}]},
        }}}
        return APIClient().post(f"/api/mpesa/stk/{token or self.user.account.mpesa_callback_token}/callback/", body, format="json")

    def test_prompt_then_payment_is_recorded_once(self):
        get, post = self.daraja()
        with get, post as sent:
            response = self.client.post("/api/mpesa/stk/", {"receipt": self.first_invoice.id}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        payload = sent.call_args.kwargs["json"]
        self.assertEqual(payload["PhoneNumber"], "254712345678")
        self.assertEqual(payload["Amount"], 20000)  # the whole balance by default
        self.assertEqual(payload["AccountReference"], "B12")
        self.assertTrue(payload["CallBackURL"].endswith(f"/api/mpesa/stk/{self.user.account.mpesa_callback_token}/callback/"))

        self.assertEqual(self.callback().status_code, 200)
        self.assertEqual(self.callback().status_code, 200)  # Safaricom retries
        status_row = self.client.get(f"/api/mpesa/stk/{response.data['id']}/").data
        self.assertEqual(status_row["status"], "paid")
        self.first_invoice.refresh_from_db()
        self.assertEqual(self.first_invoice.amount_paid, Decimal("20000.00"))
        self.assertEqual(Payment.objects.filter(reference="QK1ABC").count(), 1)

        # The paybill confirmation for the same payment does not count it again
        APIClient().post("/api/paybill/secret-token/confirmation/", {
            "TransID": "QK1ABC", "TransAmount": "20000", "BillRefNumber": "B12",
        }, format="json")
        self.assertEqual(Payment.objects.filter(reference="QK1ABC").count(), 1)

    def test_cancelled_prompt_and_refused_requests(self):
        get, post = self.daraja()
        with get, post:
            response = self.client.post("/api/mpesa/stk/", {"receipt": self.first_invoice.id, "amount": "500"}, format="json")
        self.callback(code=1032)
        self.assertEqual(self.client.get(f"/api/mpesa/stk/{response.data['id']}/").data["status"], "failed")
        self.assertEqual(Payment.objects.count(), 0)

        get, post = self.daraja(response_code="1")
        with get, post:
            refused = self.client.post("/api/mpesa/stk/", {"receipt": self.first_invoice.id, "phone": "0712345678"}, format="json")
        self.assertEqual(refused.status_code, 502)
        self.assertEqual(self.client.post("/api/mpesa/stk/", {"receipt": self.first_invoice.id, "phone": "020123"}, format="json").status_code, 400)
        self.assertEqual(self.callback(token="wrong").status_code, 404)

    @override_settings(MPESA_PASSKEY="")
    def test_off_until_configured(self):
        self.assertFalse(self.client.get("/api/mpesa/stk/").data["configured"])
        self.assertEqual(self.client.post("/api/mpesa/stk/", {"receipt": self.first_invoice.id}, format="json").status_code, 400)


@override_settings(SECURE_SSL_REDIRECT=False)
class LoginResponseTests(TestCase):
    def test_login_returns_role_and_account(self):
        user = get_user_model().objects.create_user(
            username="kamau", email="k@example.com", password="Pw-123456!", first_name="John", last_name="Kamau",
        )
        user.role = "caretaker"
        user.save()
        response = APIClient().post("/api/login/", {"identifier": "kamau", "password": "Pw-123456!"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        data = response.data["data"]["user"]
        self.assertEqual(data["role"], "caretaker")
        self.assertEqual(data["full_name"], "John Kamau")
        self.assertEqual(data["account"], user.account.name)
