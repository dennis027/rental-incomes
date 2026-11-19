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
            with open(os.path.join(media, "customer_ids", "stray.png"), "wb") as handle:
                handle.write(b"not anyone's photo")
            Customer.objects.create(first_name="A", last_name="B", phone_number="0700000001", id_number="9",
                                    account=self.user.account, id_photo_front="customer_ids/id.png")
            self.assertEqual(APIClient().get("/media/customer_ids/id.png").status_code, 401)
            client = APIClient(); client.force_authenticate(self.user)
            response = client.get("/media/customer_ids/id.png")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(b"".join(response.streaming_content), b"png-bytes")
            self.assertEqual(client.get("/media/../projects/settings.py").status_code, 404)
            self.assertEqual(client.get("/media/customer_ids/missing.png").status_code, 404)
            # A file that is no tenant's photo is not served, even though it exists
            self.assertEqual(client.get("/media/customer_ids/stray.png").status_code, 404)


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
        # Queued for the worker (run inline in tests); the outcome lands in the SMS log
        with self.provider("InvalidPhoneNumber"):
            response = self.client.post("/api/reminders/send/", {"contract_ids": [self.contract.id]}, format="json")
        self.assertEqual(response.status_code, 202, response.data)
        self.assertEqual(response.data["queued"], 1)
        # A failed text is not "recent", so trying again sends it
        with self.provider():
            response = self.client.post("/api/reminders/send/", {"contract_ids": [self.contract.id]}, format="json")
        self.assertEqual(response.data["queued"], 1)
        log = self.client.get("/api/reminders/").data
        self.assertTrue(log["configured"])
        self.assertEqual([m["sent"] for m in log["messages"]], [True, False])
        # Sending again straight away (a retry, a double click) does not text them twice
        with self.provider() as post:
            response = self.client.post("/api/reminders/send/", {"contract_ids": [self.contract.id]}, format="json")
        self.assertEqual(response.data, {"queued": 0, "skipped_recent": 1})
        post.assert_not_called()

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


@override_settings(MPESA_CALLBACK_TOKEN="secret-token", SECURE_SSL_REDIRECT=False, MPESA_SHORTCODE="174379",
                   MPESA_CONSUMER_KEY="key", MPESA_CONSUMER_SECRET="secret", MPESA_PASSKEY="passkey",
                   MPESA_CALLBACK_BASE_URL="https://api.example.com")
class ReviewFixTests(TestCase):
    """Account isolation, roles and M-Pesa fixes from the code review."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        AccountIsolationTests.setUp(self)  # landlord A (first account, self.client) and landlord B (self.other_client)

    member = AccountIsolationTests.member

    # 1. ID photos
    def test_id_photos_are_served_only_to_their_own_account(self):
        import os, tempfile
        with tempfile.TemporaryDirectory() as media, self.settings(MEDIA_ROOT=media):
            from django.core.files.uploadedfile import SimpleUploadedFile
            self.customer.id_photo_front = SimpleUploadedFile("front.png", b"png-bytes")
            self.customer.save()
            name = self.customer.id_photo_front.name
            # ID numbers repeat across accounts, so the folder names the account
            self.assertTrue(name.startswith(f"customer_ids/{self.user.account_id}/1/"), name)
            self.assertEqual(self.client.get(f"/media/{name}").status_code, 200)
            self.assertEqual(self.other_client.get(f"/media/{name}").status_code, 404)

    # 2. Paybill callback token
    def test_only_owners_and_managers_see_the_paybill_callback_urls(self):
        owner = self.client.get("/api/account/").json()
        self.assertIn(self.user.account.mpesa_callback_token, owner["paybill_confirmation_url"])
        self.assertIn("/api/paybill/", self.member("manager").get("/api/account/").json()["paybill_validation_url"])
        for role in ("accountant", "caretaker"):
            data = self.member(role).get("/api/account/").json()
            self.assertIsNone(data["paybill_confirmation_url"], role)
            self.assertIsNone(data["paybill_validation_url"], role)
            self.assertNotIn(self.user.account.mpesa_callback_token, str(data), role)

    def test_passkey_is_write_only(self):
        response = self.client.patch("/api/account/", {"mpesa_shortcode": "600100", "mpesa_passkey": "pk-secret"},
                                     format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["mpesa_shortcode"], "600100")
        self.assertTrue(response.data["mpesa_passkey_set"])
        self.assertNotIn("pk-secret", str(response.data))
        self.assertEqual(self.client.patch("/api/account/", {"mpesa_shortcode": "12ab"}, format="json").status_code, 400)
        # Nor can an accountant change where money goes
        self.assertEqual(self.member("accountant").patch("/api/account/", {"mpesa_shortcode": "999999"},
                                                         format="json").status_code, 403)

    # 3. Each account is paid into its own shortcode
    def landlord_b_invoice(self):
        prop = Property.objects.create(name="Hillside", address="Thika Road", account=self.other.account)
        unit = Unit.objects.create(property=prop, unit_number="C1", rent_amount=8000)
        tenant = Customer.objects.create(first_name="Otieno", last_name="Achieng", phone_number="0722000111",
                                         id_number="1", account=self.other.account)
        response = self.other_client.post("/api/contracts/", {
            "customer": tenant.id, "unit": unit.id, "start_date": "2026-01-01",
            "rent_amount": "8000", "deposit_amount": "8000",
            "end_date": (timezone.localdate() + timedelta(days=200)).isoformat(),
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        return Receipt.objects.get(contract_id=response.data["id"])

    def test_stk_push_uses_the_accounts_own_shortcode(self):
        invoice = self.landlord_b_invoice()
        get, post = StkPushTests.daraja(self)
        # Landlord B has not added a paybill: the server's belongs to the first account
        self.assertFalse(self.other_client.get("/api/mpesa/stk/").json()["configured"])
        with get, post as sent:
            response = self.other_client.post("/api/mpesa/stk/", {"receipt": invoice.id}, format="json")
        self.assertEqual(response.status_code, 400)
        sent.assert_not_called()

        self.other.account.mpesa_shortcode, self.other.account.mpesa_passkey = "600200", "b-passkey"
        self.other.account.save()
        get, post = StkPushTests.daraja(self)
        with get, post as sent:
            response = self.other_client.post("/api/mpesa/stk/", {"receipt": invoice.id}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        payload = sent.call_args.kwargs["json"]
        self.assertEqual(payload["BusinessShortCode"], "600200")
        self.assertEqual(payload["PartyB"], "600200")

        # The first account still uses the server's settings, as before accounts existed
        from .models import MpesaStkRequest
        MpesaStkRequest.all_objects.all().delete()  # the mock reuses one CheckoutRequestID
        get, post = StkPushTests.daraja(self)
        with get, post as sent:
            response = self.client.post("/api/mpesa/stk/", {"receipt": self.first_invoice.id}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(sent.call_args.kwargs["json"]["BusinessShortCode"], "174379")

    def test_sms_pay_line_names_the_accounts_own_paybill(self):
        from .sms import reminder_text
        row = {"customer_name": "Otieno Achieng", "unit": "C1", "property": "Hillside", "outstanding": Decimal("8000"),
               "due_date": timezone.localdate(), "days_overdue": 0}
        self.assertNotIn("paybill", reminder_text(row, "due", self.other.account))
        self.assertIn("paybill 174379", reminder_text(row, "due", self.user.account))
        self.other.account.mpesa_shortcode = "600200"
        self.assertIn("paybill 600200", reminder_text(row, "due", self.other.account))

    # 4. Caretakers see no money
    def test_caretaker_cannot_open_money_pages_under_tenants_and_contracts(self):
        caretaker = self.member("caretaker")
        for url in (f"/api/customers/{self.customer.id}/statement/", f"/api/customers/{self.customer.id}/detail/",
                    f"/api/contracts/{self.contract.id}/move-out/", "/api/contracts/ending-soon/",
                    "/api/contracts/expiring/"):
            self.assertEqual(caretaker.get(url).status_code, 403, url)
        for url in ("/api/customers/", f"/api/customers/{self.customer.id}/", "/api/contracts/", "/api/units/"):
            self.assertEqual(caretaker.get(url).status_code, 200, url)
        self.assertEqual(self.client.get(f"/api/customers/{self.customer.id}/statement/").status_code, 200)

    def test_caretaker_reads_are_an_allow_list(self):
        caretaker = self.member("caretaker")
        for url in ("/api/units/performance/", "/api/properties/comparison/", "/api/contracts/search/",
                    "/api/tenants/directory/", f"/api/units/{self.unit.id}/detail/",
                    f"/api/tenants/{self.customer.id}/payment-history/", "/api/units/utilization/"):
            self.assertEqual(caretaker.get(url).status_code, 403, url)
        # What the caretaker pages load
        for url in ("/api/properties/", f"/api/properties/{self.property.id}/", "/api/units/",
                    f"/api/units/{self.unit.id}/", "/api/contracts/", f"/api/contracts/{self.contract.id}/",
                    f"/api/properties/{self.property.id}/system-parameters/", "/api/maintenance-requests/",
                    "/api/expenses/", "/api/account/", "/api/me/"):
            self.assertEqual(caretaker.get(url).status_code, 200, url)

    # 5. Rows made outside a request
    def test_rows_made_outside_a_request_get_an_account_or_are_refused(self):
        with self.assertRaises(ValueError):
            Property.objects.create(name="Orphan", address="Nowhere")
        # A tenant placed in a unit takes the unit's account
        unit = Unit.objects.create(property=self.property, unit_number="B13", rent_amount=9000)
        tenant = Customer.objects.create(first_name="Njeri", last_name="M", phone_number="0733000000",
                                         id_number="77", unit=unit)
        self.assertEqual(tenant.account_id, self.user.account_id)

    def test_admin_adds_rows_to_the_admin_users_account(self):
        admin_user = get_user_model().objects.create_superuser("ops", "ops@example.com", "pw")
        admin_user.account = self.user.account
        admin_user.save()
        client = APIClient()
        client.force_login(admin_user)
        response = client.post("/admin/app/property/add/", {"name": "From admin", "address": "Westlands", "is_active": "on"})
        self.assertEqual(response.status_code, 302, response.content[:500])
        self.assertEqual(Property.all_objects.get(name="From admin").account_id, self.user.account_id)

    def test_admin_asks_an_accountless_superuser_to_pick_an_account(self):
        ops = get_user_model().objects.create_superuser("ops", "ops@example.com", "pw")
        self.assertIsNone(ops.account_id)  # several accounts exist
        client = APIClient()
        client.force_login(ops)
        response = client.post("/admin/app/property/add/", {"name": "From admin", "address": "Westlands"})
        self.assertEqual(response.status_code, 200)  # the form again, with an error; not a 500
        self.assertIn("account", response.context["adminform"].form.errors)
        self.assertFalse(Property.all_objects.filter(name="From admin").exists())

    def test_users_made_without_an_account_get_their_own(self):
        user = get_user_model()(username="walkin", email="walkin@example.com")
        user.set_password("pw")
        user.save()
        self.assertIsNotNone(user.account_id)
        self.assertNotIn(user.account_id, (self.user.account_id, self.other.account_id))
        self.assertEqual(user.role, "owner")

    # 6. createsuperuser
    def test_superuser_is_not_slipped_into_a_landlords_account(self):
        from .models import Account
        Account.objects.exclude(pk=self.user.account_id).delete()
        ops = get_user_model().objects.create_superuser("ops", "ops@example.com", "pw")
        self.assertIsNone(ops.account_id)
        self.assertNotIn("ops", [m["username"] for m in self.client.get("/api/team/").json()])

    def test_superuser_with_several_accounts_is_left_for_the_admin_to_place(self):
        from .models import Account
        before = Account.objects.count()
        ops = get_user_model().objects.create_superuser("ops", "ops@example.com", "pw")
        self.assertIsNone(ops.account_id)
        self.assertEqual(Account.objects.count(), before)

    def test_first_superuser_on_an_empty_server_starts_an_account(self):
        from .models import Account
        get_user_model().objects.all().delete()
        Account.objects.all().delete()
        ops = get_user_model().objects.create_superuser("ops", "ops@example.com", "pw")
        self.assertIsNotNone(ops.account_id)
        self.assertEqual(ops.role, "owner")

    # 7. MRI band on the landlord's total rent
    def test_mri_regime_is_decided_on_all_properties_together(self):
        from unittest import mock
        second = Property.objects.create(name="Second", address="Kilimani", account=self.user.account)
        unit = Unit.objects.create(property=second, unit_number="D1", rent_amount=10000)
        tenant = Customer.objects.create(first_name="Mwangi", last_name="K", phone_number="0744000000",
                                         id_number="2", account=self.user.account)
        response = self.client.post("/api/contracts/", {
            "customer": tenant.id, "unit": unit.id, "start_date": "2026-01-01", "rent_amount": "10000",
            "deposit_amount": "10000", "end_date": (timezone.localdate() + timedelta(days=200)).isoformat(),
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        for invoice, ref in ((self.first_invoice, "T1"), (Receipt.objects.get(contract_id=response.data["id"]), "T2")):
            self.client.post("/api/payments/", {"receipt": invoice.id, "amount": "8000", "method": "mpesa",
                                                "reference": ref}, format="json")
        month = f"{timezone.localdate():%Y-%m}"
        # Each property alone (4,000 of rent) is under the band; together (8,000) they are in it
        with mock.patch("app.tax_views.MRI_MIN_YEARLY", Decimal("5000")):
            one = self.client.get(f"/api/reports/rental-income-tax/?month={month}&property_id={self.property.id}").json()
        self.assertEqual(one["totals"]["rent"], 4000)
        self.assertEqual(one["twelve_month_rent"], 8000)
        self.assertEqual(one["regime"], "mri")

    # 8. Removed members can come back
    def test_removed_member_can_be_added_again(self):
        body = {"username": "kamau", "email": "kamau@example.com", "role": "caretaker"}
        member_id = self.client.post("/api/team/", body, format="json").data["id"]
        self.assertEqual(self.client.delete(f"/api/team/{member_id}/").status_code, 204)
        response = self.client.post("/api/team/", {**body, "role": "accountant"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["id"], member_id)
        self.assertEqual(response.data["role"], "accountant")
        self.assertTrue(response.data["is_active"])
        # Sign-ins from before the removal stay dead
        from rest_framework_simplejwt.tokens import RefreshToken
        member = get_user_model().objects.get(pk=member_id)
        self.client.delete(f"/api/team/{member_id}/")
        old_refresh = str(RefreshToken.for_user(member))
        self.client.post("/api/team/", {**body, "role": "caretaker"}, format="json")
        self.assertEqual(APIClient().post("/api/token/refresh/", {"refresh": old_refresh}, format="json").status_code, 401)
        # Another account's users are still taken
        response = self.other_client.post("/api/team/", {**body, "username": "kamau2"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("email", response.data)

    # 9. STK amounts
    def test_stk_amount_rounds_up_and_is_capped_at_the_balance(self):
        self.client.post("/api/payments/", {"receipt": self.first_invoice.id, "amount": "0.50", "method": "cash"},
                         format="json")
        get, post = StkPushTests.daraja(self)
        with get, post as sent:
            response = self.client.post("/api/mpesa/stk/", {"receipt": self.first_invoice.id}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(sent.call_args.kwargs["json"]["Amount"], 20000)  # 19,999.50 owed, rounded up
        get, post = StkPushTests.daraja(self)
        with get, post as sent:
            response = self.client.post("/api/mpesa/stk/", {"receipt": self.first_invoice.id, "amount": "25000"},
                                        format="json")
        self.assertEqual(response.status_code, 400)
        sent.assert_not_called()

    # 10. Payments carry their account
    def test_payments_carry_their_account(self):
        response = self.client.post("/api/payments/", {"receipt": self.first_invoice.id, "amount": "100",
                                                       "method": "cash", "account": self.other.account_id},
                                    format="json")
        self.assertEqual(response.status_code, 201, response.data)
        payment = Payment.all_objects.get(pk=response.data["id"])
        self.assertEqual(payment.account_id, self.user.account_id)
        self.assertEqual(self.other_client.get("/api/payments/").json(), [])
        self.assertNotIn("account", response.data)

    def test_migration_backfills_payment_accounts(self):
        import importlib
        from django.apps import apps
        self.client.post("/api/payments/", {"receipt": self.first_invoice.id, "amount": "100", "method": "cash"},
                         format="json")
        Payment.all_objects.update(account=None)
        migration = importlib.import_module("app.migrations.0008_mpesa_per_account_and_payment_account")
        migration.payments_to_accounts(apps, None)
        self.assertEqual(set(Payment.all_objects.values_list("account_id", flat=True)), {self.user.account_id})


@override_settings(MPESA_CALLBACK_TOKEN="secret-token", SECURE_SSL_REDIRECT=False, MPESA_SHORTCODE="174379",
                   MPESA_CONSUMER_KEY="key", MPESA_CONSUMER_SECRET="secret", MPESA_PASSKEY="passkey",
                   MPESA_CALLBACK_BASE_URL="https://api.example.com")
class SecondReviewFixTests(TestCase):
    """Fixes from the second code review."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        AccountIsolationTests.setUp(self)

    member = AccountIsolationTests.member

    def stk(self, client, **body):
        get, post = StkPushTests.daraja(self)
        with get, post as sent:
            response = client.post("/api/mpesa/stk/", {"receipt": self.first_invoice.id, **body}, format="json")
        return response, sent

    # 1. Removed members stay removed
    def test_removed_member_cannot_reactivate_themselves(self):
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.encoding import force_bytes
        from django.utils.http import urlsafe_base64_encode
        body = {"username": "bob", "email": "bob@example.com", "role": "caretaker"}
        member_id = self.client.post("/api/team/", body, format="json").data["id"]
        bob = get_user_model().objects.get(pk=member_id)
        bob.set_password("old-password"); bob.save()
        bob.refresh_from_db()
        uid, token = urlsafe_base64_encode(force_bytes(bob.pk)), default_token_generator.make_token(bob)
        self.client.delete(f"/api/team/{member_id}/")

        resend = APIClient().post("/api/resend-activation-limited/", {"email": "bob@example.com"}, format="json")
        self.assertEqual(resend.status_code, 400)
        self.assertEqual(APIClient().get(f"/api/activate/{uid}/{token}/").status_code, 400)
        bob.refresh_from_db()
        self.assertFalse(bob.is_active)
        self.assertFalse(bob.check_password("old-password"))
        # Being added again is the way back
        self.assertEqual(self.client.post("/api/team/", body, format="json").status_code, 201)
        bob.refresh_from_db()
        self.assertTrue(bob.is_active)
        self.assertIsNone(bob.removed_at)

    # 2. Only owners choose the paybill
    def test_managers_cannot_change_the_paybill(self):
        manager = self.member("manager")
        response = manager.patch("/api/account/", {"mpesa_shortcode": "600999", "mpesa_passkey": "x"}, format="json")
        self.assertEqual(response.status_code, 403)
        self.user.account.refresh_from_db()
        self.assertEqual(self.user.account.mpesa_shortcode, "")
        # Other settings are still theirs to change
        self.assertEqual(manager.patch("/api/account/", {"sms_days_before_due": 2}, format="json").status_code, 200)

    # 3. Till vs paybill
    def test_server_till_sends_buy_goods_and_says_till(self):
        from .sms import reminder_text
        row = {"customer_name": "Wanjiru Kamau", "unit": "B12", "property": "Sunrise", "outstanding": Decimal("1"),
               "due_date": timezone.localdate(), "days_overdue": 0}
        with self.settings(MPESA_TRANSACTION_TYPE="CustomerBuyGoodsOnline"):
            response, sent = self.stk(self.client)
            self.assertEqual(response.status_code, 201, response.data)
            self.assertEqual(sent.call_args.kwargs["json"]["TransactionType"], "CustomerBuyGoodsOnline")
            self.assertIn("Buy Goods till 174379.", reminder_text(row, "due", self.user.account))
            # An account's own shortcode is a paybill
            account = self.user.account
            account.mpesa_shortcode, account.mpesa_passkey = "600100", "pk"
            self.assertFalse(account.mpesa_is_till())
            self.assertIn("paybill 600100, account B12", reminder_text(row, "due", account))

    # 4. The server's M-Pesa settings have one, stored owner
    def test_deleting_the_owner_of_the_server_paybill_hands_it_to_nobody(self):
        from .models import Account
        self.assertTrue(self.user.account.uses_server_mpesa)
        self.assertFalse(self.other.account.uses_server_mpesa)
        self.user.account.delete()
        other = Account.objects.get(pk=self.other.account_id)
        self.assertEqual(other.mpesa_credentials(), ("", ""))
        self.assertEqual(APIClient().post("/api/paybill/secret-token/confirmation/", {
            "TransID": "X1", "TransAmount": "100", "BillRefNumber": "C1"}, format="json").status_code, 404)

    def test_mpesa_credentials_need_no_queries(self):
        account = self.user.account
        with self.assertNumQueries(0):
            account.mpesa_credentials()
            account.mpesa_is_till()

    # 5. Admin files tenants under their unit's account
    def test_admin_customer_takes_the_units_account(self):
        prop_b = Property.objects.create(name="Hillside", address="Thika Road", account=self.other.account)
        unit_b = Unit.objects.create(property=prop_b, unit_number="C1", rent_amount=8000)
        admin_user = get_user_model().objects.create_superuser("ops", "ops@example.com", "pw", account=self.user.account)
        client = APIClient()
        client.force_login(admin_user)
        fields = {"first_name": "Njeri", "last_name": "W", "phone_number": "0755000000", "id_number": "55",
                  "unit": unit_b.id, "is_active": "on"}
        # Picking the admin's own account for account B's unit is refused
        response = client.post("/admin/app/customer/add/", {**fields, "account": self.user.account_id})
        self.assertEqual(response.status_code, 200)
        self.assertIn("account", response.context["adminform"].form.errors)
        # Left blank, it goes to the unit's account, not the admin's
        response = client.post("/admin/app/customer/add/", fields)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(Customer.all_objects.get(id_number="55").account_id, self.other.account_id)

    # 6. Shortcode and passkey go together
    def test_shortcode_and_passkey_are_saved_as_a_pair(self):
        account_url = "/api/account/"
        # The first account cannot drop its server passkey by typing only a shortcode
        self.assertEqual(self.client.patch(account_url, {"mpesa_shortcode": "600100"}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(account_url, {"mpesa_shortcode": "600100", "mpesa_passkey": "pk1"},
                                           format="json").status_code, 200)
        # Same paybill, passkey left blank: kept
        self.assertEqual(self.client.patch(account_url, {"mpesa_shortcode": "600100", "mpesa_passkey": ""},
                                           format="json").status_code, 200)
        self.user.account.refresh_from_db()
        self.assertEqual(self.user.account.mpesa_passkey, "pk1")
        # A new paybill needs its own passkey
        self.assertEqual(self.client.patch(account_url, {"mpesa_shortcode": "600200"}, format="json").status_code, 400)
        # Clearing the paybill clears its passkey and returns to the server's settings
        self.assertEqual(self.client.patch(account_url, {"mpesa_shortcode": ""}, format="json").status_code, 200)
        self.user.account.refresh_from_db()
        self.assertEqual(self.user.account.mpesa_passkey, "")
        self.assertEqual(self.user.account.mpesa_credentials(), ("174379", "passkey"))

    # 7. Amounts that are not numbers
    def test_stk_rejects_amounts_that_are_not_whole_shillings(self):
        for raw in ("Infinity", "NaN", "abc", "500.10"):
            response, sent = self.stk(self.client, amount=raw)
            self.assertEqual(response.status_code, 400, raw)
            sent.assert_not_called()
        response, sent = self.stk(self.client, amount="500")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(sent.call_args.kwargs["json"]["Amount"], 500)

    # 10. Payment edits keep their account without looking it up again
    def test_editing_a_payment_does_not_look_up_its_account_again(self):
        response = self.client.post("/api/payments/", {"receipt": self.first_invoice.id, "amount": "100",
                                                       "method": "cash"}, format="json")
        payment = Payment.all_objects.get(pk=response.data["id"])
        from unittest import mock
        with mock.patch.object(Payment, "account_from_related", side_effect=AssertionError("looked up")):
            payment.notes = "edited"
            payment.save(update_fields=["notes"])
        self.assertEqual(Payment.all_objects.get(pk=payment.pk).account_id, self.user.account_id)


    def test_migration_marks_the_server_paybill_owner_and_removed_members(self):
        import importlib
        from django.apps import apps
        from .models import Account
        migration = importlib.import_module("app.migrations.0009_server_mpesa_owner_and_removed_members")
        Account.objects.update(uses_server_mpesa=False)
        removed = get_user_model().objects.create_user(username="gone", email="gone@example.com", password="pw",
                                                       account=self.user.account, role="caretaker", is_active=False)
        pending = get_user_model().objects.create_user(username="pending", email="pending@example.com", password="pw",
                                                       is_active=False)  # a sign-up awaiting activation
        migration.mark_server_mpesa_owner(apps, None)
        migration.mark_removed_members(apps, None)
        self.assertEqual(list(Account.objects.filter(uses_server_mpesa=True).values_list("id", flat=True)),
                         [self.user.account_id])
        removed.refresh_from_db(); pending.refresh_from_db()
        self.assertIsNotNone(removed.removed_at)
        self.assertTrue(removed.has_usable_password())  # left alone; removal on the team page clears it
        self.assertIsNone(pending.removed_at)


@override_settings(MPESA_CALLBACK_TOKEN="secret-token", SECURE_SSL_REDIRECT=False)
class ThirdReviewFixTests(TestCase):
    """Fixes from the third code review."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        AccountIsolationTests.setUp(self)

    member = AccountIsolationTests.member

    # 1. Caretakers get no unit money
    def test_caretakers_get_no_unit_balances(self):
        caretaker = self.member("caretaker")
        for unit in (caretaker.get("/api/units/").json()[0], caretaker.get(f"/api/units/{self.unit.id}/").json()):
            for name in ("balance", "total_billed", "total_paid"):
                self.assertNotIn(name, unit)
            self.assertEqual(unit["unit_number"], "B12")
        self.assertIsNone(caretaker.get(f"/api/properties/{self.property.id}/units/").json()["units"][0]["financial"])
        self.assertIn("balance", self.client.get("/api/units/").json()[0])
        self.assertIsNotNone(self.client.get(f"/api/properties/{self.property.id}/units/").json()["units"][0]["financial"])

    # 2. Payment references are unique per account
    def test_payment_references_are_unique_within_an_account(self):
        b_invoice = ReviewFixTests.landlord_b_invoice(self)
        pay = lambda client, invoice: client.post("/api/payments/", {
            "receipt": invoice.id, "amount": "100", "method": "mpesa", "reference": "QWE123XYZ"}, format="json")
        self.assertEqual(pay(self.client, self.first_invoice).status_code, 201)
        response = pay(self.other_client, b_invoice)
        self.assertEqual(response.status_code, 201, response.data)
        response = pay(self.client, self.first_invoice)
        self.assertEqual(response.status_code, 400)
        self.assertIn("reference", response.data)

    # 3. Payments linked to nothing
    def test_migration_gives_unlinked_payments_the_first_account(self):
        import importlib
        from django.apps import apps
        loose = Payment.all_objects.create(amount=50, type=Payment.INCOME, account=self.user.account)
        Payment.all_objects.filter(pk=loose.pk).update(account=None)
        migration = importlib.import_module("app.migrations.0010_payment_reference_per_account_and_repairs")
        migration.unlinked_payments_to_first_account(apps, None)
        loose.refresh_from_db()
        self.assertEqual(loose.account_id, self.user.account_id)

    # 4. Old sign-ups in the shared account are not "removed"
    def test_old_pending_signups_are_not_marked_removed(self):
        import importlib
        from datetime import timedelta as td
        from django.apps import apps
        old = get_user_model().objects.create_user(username="old", email="old@example.com", password="pw",
                                                   account=self.user.account, is_active=False)
        get_user_model().objects.filter(pk=old.pk).update(date_joined=self.user.account.created_at - td(days=30))
        m9 = importlib.import_module("app.migrations.0009_server_mpesa_owner_and_removed_members")
        m9.mark_removed_members(apps, None)
        old.refresh_from_db()
        self.assertIsNone(old.removed_at)
        self.assertTrue(old.check_password("pw"))
        # And marks left by the earlier version of 0009 are undone
        get_user_model().objects.filter(pk=old.pk).update(removed_at=timezone.now(), password="!")
        m10 = importlib.import_module("app.migrations.0010_payment_reference_per_account_and_repairs")
        m10.undo_wrong_removals(apps, None)
        old.refresh_from_db()
        self.assertIsNone(old.removed_at)

    # 5. Tenants without an email
    def test_several_tenants_may_leave_email_blank(self):
        for n in (1, 2):
            response = self.client.post("/api/customers/", {
                "first_name": f"T{n}", "last_name": "X", "phone_number": f"070000000{n}", "id_number": f"9{n}",
                "email": ""}, format="json")
            self.assertEqual(response.status_code, 201, response.data)

    # 6. A payment hidden by the current scope is still not new
    def test_saving_a_payment_outside_its_scope_does_not_count_it_twice(self):
        from .tenancy import reset_current_account, set_current_account
        response = self.client.post("/api/payments/", {"receipt": self.first_invoice.id, "amount": "100",
                                                       "method": "cash"}, format="json")
        payment = Payment.all_objects.get(pk=response.data["id"])
        token = set_current_account(self.other.account_id)
        try:
            payment.notes = "edited"
            payment.save()
        finally:
            reset_current_account(token)
        self.first_invoice.refresh_from_db()
        self.assertEqual(self.first_invoice.amount_paid, Decimal("100.00"))

    # 7. Bad property filter
    def test_tax_report_rejects_a_non_numeric_property(self):
        self.assertEqual(self.client.get("/api/reports/rental-income-tax/?property_id=abc").status_code, 400)

    # 8. contract_ids must be a list
    @override_settings(AT_USERNAME="sandbox", AT_API_KEY="key")
    def test_reminders_need_a_list_of_contract_ids(self):
        for ids in ("12", 12):
            response = self.client.post("/api/reminders/send/", {"contract_ids": ids}, format="json")
            self.assertEqual(response.status_code, 400, ids)

    # 9. Operators without an account can still sign out
    def test_accountless_user_can_see_themselves_and_sign_out(self):
        from rest_framework_simplejwt.tokens import RefreshToken
        ops = get_user_model().objects.create_superuser("ops", "ops@example.com", "pw")
        self.assertIsNone(ops.account_id)
        client = APIClient()
        client.force_authenticate(ops)
        me = client.get("/api/me/")
        self.assertEqual(me.status_code, 200)
        self.assertIsNone(me.json()["account"])
        response = client.post("/api/logout/", {"refresh": str(RefreshToken.for_user(ops))}, format="json")
        self.assertNotEqual(response.status_code, 403)
        self.assertEqual(client.get("/api/properties/").status_code, 403)

    # 10. One landlord's writes leave the others' cache alone
    def test_writes_clear_only_their_own_accounts_cache(self):
        self.assertEqual(self.client.get("/api/properties/")["X-Cache"], "MISS")
        self.assertEqual(self.other_client.get("/api/properties/")["X-Cache"], "MISS")
        self.other_client.post("/api/properties/", {"name": "Hillside", "address": "Thika"}, format="json")
        self.assertEqual(self.client.get("/api/properties/")["X-Cache"], "HIT")
        self.assertEqual(self.other_client.get("/api/properties/")["X-Cache"], "MISS")
        # Writes outside any account still clear everyone's
        Property.all_objects.filter(name="Hillside").delete()
        self.assertEqual(self.client.get("/api/properties/")["X-Cache"], "MISS")


@override_settings(MPESA_CALLBACK_TOKEN="secret-token", SECURE_SSL_REDIRECT=False, MPESA_SHORTCODE="174379",
                   MPESA_CONSUMER_KEY="key", MPESA_CONSUMER_SECRET="secret", MPESA_PASSKEY="passkey",
                   MPESA_CALLBACK_BASE_URL="https://api.example.com")
class FourthReviewFixTests(TestCase):
    """Fixes from the fourth code review."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        AccountIsolationTests.setUp(self)

    member = AccountIsolationTests.member

    # 2. A prompt is for what the tenant owes, on the invoice payments land on
    def test_stk_from_an_older_invoice_is_recorded_on_the_latest(self):
        from .models import MpesaStkRequest
        latest = BillingFlowTests.generate(self, BillingFlowTests.next_month(self))
        self.assertNotEqual(latest.pk, self.first_invoice.pk)
        get, post = StkPushTests.daraja(self)
        with get, post as sent:
            response = self.client.post("/api/mpesa/stk/", {"receipt": self.first_invoice.id}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(MpesaStkRequest.all_objects.get().receipt_id, latest.pk)
        owed = billing.outstanding(billing.contract_invoices(self.contract))
        self.assertEqual(sent.call_args.kwargs["json"]["Amount"], int(owed))

    def test_stk_refuses_a_tenant_who_owes_nothing(self):
        self.client.post("/api/payments/", {"receipt": self.first_invoice.id, "amount": "20000", "method": "cash"},
                         format="json")
        get, post = StkPushTests.daraja(self)
        with get, post as sent:
            response = self.client.post("/api/mpesa/stk/", {"receipt": self.first_invoice.id}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["error"], "This tenant owes nothing.")
        sent.assert_not_called()

    # 4. Owners changing each other one at a time
    def test_an_owner_demoted_meanwhile_cannot_remove_the_other(self):
        second = get_user_model().objects.create_user(username="second", email="second@example.com", password="pw",
                                                      account=self.user.account, role="owner")
        # As if the second owner's demotion of the first committed while this request waited on the lock
        get_user_model().objects.filter(pk=self.user.pk).update(role="manager")
        response = self.client.delete(f"/api/team/{second.id}/")  # self.client still holds the stale owner
        self.assertEqual(response.status_code, 403)
        second.refresh_from_db()
        self.assertTrue(second.is_active)
        self.assertEqual(get_user_model().objects.filter(account=self.user.account, role="owner",
                                                         is_active=True).count(), 1)

    # 10. Daily reminders read what was sent once, not once per tenant
    @override_settings(AT_USERNAME="sandbox", AT_API_KEY="key")
    def test_due_reminders_queries_do_not_grow_with_tenants(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        from .sms import due_reminders
        from .tenancy import reset_current_account, set_current_account

        def sms_queries():
            token = set_current_account(self.user.account_id)
            try:
                with CaptureQueriesContext(connection) as queries:
                    due_reminders(self.user.account)
            finally:
                reset_current_account(token)
            return len([q for q in queries.captured_queries if "app_smsmessage" in q["sql"]])

        one = sms_queries()
        for n in range(3):
            unit = Unit.objects.create(property=self.property, unit_number=f"E{n}", rent_amount=5000)
            tenant = Customer.objects.create(first_name=f"T{n}", last_name="X", phone_number=f"071100000{n}",
                                             id_number=f"80{n}", account=self.user.account)
            response = self.client.post("/api/contracts/", {
                "customer": tenant.id, "unit": unit.id, "start_date": "2026-01-01", "rent_amount": "5000",
                "deposit_amount": "5000", "end_date": (timezone.localdate() + timedelta(days=200)).isoformat(),
            }, format="json")
            self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(sms_queries(), one)
        self.assertLessEqual(one, 2)

