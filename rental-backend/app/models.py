from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models, IntegrityError, DatabaseError
import uuid
from decimal import Decimal
from django.utils import timezone
from django.conf import settings
import secrets

from .tenancy import current_account_id, scoped_manager


def _new_callback_token():
    return secrets.token_urlsafe(24)


class Account(models.Model):
    """A landlord or agency. Its members see only its properties, tenants and money."""
    name = models.CharField(max_length=150)
    # Part of the M-Pesa callback URLs; tells which account a paybill payment belongs to
    mpesa_callback_token = models.CharField(max_length=64, unique=True, default=_new_callback_token)
    # Automatic SMS rent reminders
    sms_reminders_enabled = models.BooleanField(default=False)
    sms_days_before_due = models.PositiveSmallIntegerField(default=3)
    sms_overdue_every_days = models.PositiveSmallIntegerField(default=7)
    # The account's own paybill for "pay now" prompts and SMS pay lines. Saved
    # as a pair: a passkey only works with the shortcode it was issued for.
    mpesa_shortcode = models.CharField(max_length=20, blank=True, default="")
    mpesa_passkey = models.CharField(max_length=128, blank=True, default="")
    # The one account that the server-wide MPESA_SHORTCODE / MPESA_PASSKEY /
    # MPESA_CALLBACK_TOKEN belong to; they date from before there were several
    # accounts. Stored, not worked out from ids, so deleting that account never
    # hands the operator's paybill to another landlord.
    uses_server_mpesa = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["uses_server_mpesa"], condition=models.Q(uses_server_mpesa=True),
                                    name="one_account_uses_server_mpesa"),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        # The first account on a new server is the one the server's settings were made for
        if self._state.adding and not Account.objects.exists():
            self.uses_server_mpesa = True
        super().save(*args, **kwargs)

    def mpesa_credentials(self):
        """(shortcode, passkey) this account is paid into; blanks when it has none. No queries."""
        if self.mpesa_shortcode:
            return self.mpesa_shortcode, self.mpesa_passkey
        if self.uses_server_mpesa:
            return getattr(settings, "MPESA_SHORTCODE", ""), getattr(settings, "MPESA_PASSKEY", "")
        return "", ""

    def mpesa_is_till(self):
        """
        Whether tenants pay a Buy Goods till rather than a paybill. An account's
        own shortcode is always a paybill; only the server's may be a till
        (MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline).
        """
        if self.mpesa_shortcode or not self.uses_server_mpesa:
            return False
        return getattr(settings, "MPESA_TRANSACTION_TYPE", "") == "CustomerBuyGoodsOnline"


class CustomUserManager(UserManager):
    def create_superuser(self, username, email=None, password=None, **extra_fields):
        # A platform operator is not made a member of a landlord's account
        # behind their back: with accounts already on the server they get none
        # (Django admin still works) until one is picked for them in the admin.
        # On a new, empty server they start the first account.
        if extra_fields.get("account") is None and extra_fields.get("account_id") is None:
            if not Account.objects.exists():
                extra_fields["account"] = Account.objects.create(name=username or "My properties")
            extra_fields.setdefault("role", CustomUser.OWNER)
        return super().create_superuser(username, email, password, **extra_fields)


class CustomUser(AbstractUser):
    OWNER = "owner"
    MANAGER = "manager"
    ACCOUNTANT = "accountant"
    CARETAKER = "caretaker"
    ROLES = [
        (OWNER, "Owner"),
        (MANAGER, "Property manager"),
        (ACCOUNTANT, "Accountant"),
        (CARETAKER, "Caretaker"),
    ]

    email = models.EmailField(unique=True, null=True, blank=True)
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    reset_code = models.CharField(max_length=6, blank=True, null=True)
    reset_code_expiry = models.DateTimeField(blank=True, null=True)
    account = models.ForeignKey(Account, on_delete=models.CASCADE, null=True, blank=True, related_name="members")
    role = models.CharField(max_length=20, choices=ROLES, default=OWNER)
    # Set when an owner removes them from the team. Unlike a sign-up waiting
    # for its activation email, a removed member cannot switch themselves back on.
    removed_at = models.DateTimeField(null=True, blank=True)

    objects = CustomUserManager()

    def save(self, *args, **kwargs):
        # Someone new (signing up, or added in the admin or a shell) gets an
        # account of their own; team members are created with their owner's.
        # Superusers are the exception: create_superuser places them, and one
        # left without an account is picked an account in the admin, rather
        # than being handed an empty one.
        if self._state.adding and self.account_id is None and not self.is_superuser:
            self.account = Account.objects.create(name=self.get_full_name() or self.username or "My properties")
            self.role = self.OWNER
        super().save(*args, **kwargs)

    def __str__(self):
        return self.username


class AccountOwnedMixin(models.Model):
    """
    Every row belongs to an account. During a request it is the signed-in
    user's; elsewhere (admin, Celery, shell) it comes from the row it hangs off,
    or must be set by hand. A row saved without one would be invisible to every
    account, so that is refused instead.
    """
    class Meta:
        abstract = True

    def account_from_related(self):
        """The account of the row this one belongs to, if any; models override it."""
        return None

    def save(self, *args, **kwargs):
        if self.account_id is None:
            self.account_id = current_account_id() or self.account_from_related()
        if self.account_id is None:
            raise ValueError(
                f"{type(self).__name__} needs an account: set .account when creating it outside an API request."
            )
        super().save(*args, **kwargs)
    

class Property(AccountOwnedMixin):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, null=True, blank=True, related_name="properties")
    name = models.CharField(max_length=255) 
    address = models.TextField() 
    description = models.TextField(blank=True, null=True) 
    created_at = models.DateTimeField(auto_now_add=True)  
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    objects = scoped_manager("account_id")
    all_objects = models.Manager()

    def __str__(self):
        return self.name


class Unit(models.Model):
    objects = scoped_manager("property__account_id")
    all_objects = models.Manager()

    class UnitType(models.TextChoices):
        SINGLE = "single", "Single"
        BEDSITTER = "bedsitter", "Bedsitter"
        STUDIO = "studio", "Studio"
        ONE_BEDROOM = "one_bedroom", "One Bedroom"
        TWO_BEDROOM = "two_bedroom", "Two Bedroom"
        THREE_BEDROOM = "three_bedroom", "Three Bedroom"
        FOUR_BEDROOM = "four_bedroom", "Four Bedroom"
        FIVE_BEDROOM = "five_bedroom", "Five Bedroom"

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name="units")
    unit_number = models.CharField(max_length=100)
    unit_type = models.CharField(max_length=20, choices=UnitType.choices, default=UnitType.SINGLE)
    rent_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=[("vacant", "Vacant"), ("occupied", "Occupied")],
        default="vacant"
    )
    water_meter_reading = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    electricity_meter_reading = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    # 🧾 Balance tracking fields
    total_billed = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["property", "unit_number"], name="unique_unit_number_per_property")
        ]

    def __str__(self):
        return f"{self.property.name} - {self.unit_number} ({self.get_unit_type_display()})"

    def recalculate_balance(self):
        """Recalculate total billed, total paid, and balance for this unit."""
        from django.db.models import Sum

        receipts = Receipt.objects.filter(contract__unit=self, contract__is_active=True)

        if not receipts.exists():
            # No receipts at all
            self.total_billed = 0
            self.total_paid = 0
            self.balance = 0
            self.save(update_fields=["total_billed", "total_paid", "balance"])
            return

        # ✅ Calculate total billed by summing all financial components individually.
        # previous_balance is left out: it repeats what earlier invoices already
        # charged, so counting it again would double the debt every month.
        total_billed = (
            receipts.aggregate(
                total=(
                    Sum("monthly_rent")
                    + Sum("rental_deposit")
                    + Sum("electricity_deposit")
                    + Sum("electricity_bill")
                    + Sum("water_deposit")
                    + Sum("water_bill")
                    + Sum("service_charge")
                    + Sum("security_charge")
                    + Sum("late_penalty")
                    + Sum("other_charges")
                )
            )["total"]
            or 0
        )

        # ✅ Calculate total paid
        total_paid = receipts.aggregate(total=Sum("amount_paid"))["total"] or 0

        # ✅ Update the unit
        self.total_billed = total_billed
        self.total_paid = total_paid
        self.balance = total_billed - total_paid
        self.save(update_fields=["total_billed", "total_paid", "balance"])


# Customer ID upload path
def customer_id_upload_path(instance, filename):
    # ID numbers are unique only within an account, so the account keeps two
    # landlords' tenants out of each other's folders
    return f"customer_ids/{instance.account_id or 'none'}/{instance.id_number}/{filename}"


class Customer(AccountOwnedMixin):
    account = models.ForeignKey(Account, on_delete=models.CASCADE, null=True, blank=True, related_name="customers")
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    # Unique within an account: the same person may rent from two landlords
    phone_number = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    id_number = models.CharField(max_length=50)
    id_photo_front = models.ImageField(upload_to=customer_id_upload_path, null=True, blank=True)
    id_photo_back = models.ImageField(upload_to=customer_id_upload_path, null=True, blank=True)
    
    unit = models.OneToOneField(Unit, on_delete=models.SET_NULL, null=True, blank=True, related_name="tenant")
    
    move_in_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = scoped_manager("account_id")
    all_objects = models.Manager()

    def account_from_related(self):
        return self.unit.property.account_id if self.unit_id else None

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["account", "phone_number"], name="unique_customer_phone_per_account"),
            models.UniqueConstraint(fields=["account", "email"], name="unique_customer_email_per_account"),
            models.UniqueConstraint(fields=["account", "id_number"], name="unique_customer_id_per_account"),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.phone_number})"


class RentalContract(models.Model):
    objects = scoped_manager("unit__property__account_id")
    all_objects = models.Manager()

    contract_number = models.CharField(max_length=50, unique=True, blank=True, null=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="contracts")
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="contracts")
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    rent_amount = models.DecimalField(max_digits=10, decimal_places=2)
    deposit_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_frequency = models.CharField(
        max_length=20,
        choices=[("monthly", "Monthly"), ("quarterly", "Quarterly"), ("yearly", "Yearly")],
        default="monthly"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.contract_number:
            base_number = f"CTR-{self.customer.id}-{self.unit.id}-{int(self.start_date.strftime('%Y%m%d'))}"
            contract_number = base_number

            counter = 1
            while RentalContract.all_objects.filter(contract_number=contract_number).exists():
                contract_number = f"{base_number}-{counter}"
                counter += 1

            self.contract_number = contract_number

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.contract_number} → {self.customer} ({self.unit})"


class Receipt(models.Model):
    objects = scoped_manager("contract__unit__property__account_id")
    all_objects = models.Manager()

    STATUS_CHOICES = [
        ('unpaid', 'Unpaid'),
        ('partial', 'Partially Paid'),
        ('paid', 'Fully Paid'),
    ]

    contract = models.ForeignKey(
        "RentalContract",
        on_delete=models.CASCADE,
        related_name="receipts"
    )
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="issued_receipts"
    )

    # Core financial fields
    monthly_rent = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    rental_deposit = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    electricity_deposit = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    electricity_bill = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    water_deposit = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    water_bill = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    service_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    security_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    previous_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    other_charges = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    # Charged when earlier invoices were still unpaid after the grace period
    late_penalty = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    # Meter readings
    previous_water_reading = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    current_water_reading = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    previous_electricity_reading = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    current_electricity_reading = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    # Auto-generated fields
    receipt_number = models.CharField(max_length=50, unique=True, editable=False)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='unpaid')
    is_paid = models.BooleanField(default=False)
    issue_date = models.DateTimeField(default=timezone.now)

    def save(self, *args, **kwargs):
        # If issue_date is not set, default to now
        if not self.issue_date:
            self.issue_date = timezone.now()

        # Generate a unique receipt number based on issue_date (month + year)
        if not self.receipt_number:
            issue_year = self.issue_date.year
            issue_month = self.issue_date.month
            formatted_month = f"{issue_month:02d}"

            count = (
                Receipt.objects.filter(
                    contract=self.contract,
                    issue_date__year=issue_year,
                    issue_date__month=issue_month
                ).count() + 1
            )

            # Skip numbers already taken (an invoice was deleted or re-dated)
            prefix = f"RCT-{self.contract.id}-{issue_year}{formatted_month}-"
            while Receipt.all_objects.filter(receipt_number=f"{prefix}{count}").exists():
                count += 1
            self.receipt_number = f"{prefix}{count}"

        # Safety net for unique constraint
        try:
            super().save(*args, **kwargs)
        except IntegrityError:
            count = Receipt.objects.filter(contract=self.contract).count() + 1
            issue_year = self.issue_date.year
            issue_month = self.issue_date.month
            formatted_month = f"{issue_month:02d}"
            self.receipt_number = f"RCT-{self.contract.id}-{issue_year}{formatted_month}-{count}"
            super().save(*args, **kwargs)

        # 🔥 Recalculate unit balance after saving receipt
        self.contract.unit.recalculate_balance()

    def update_status(self):
        """Automatically update payment status and is_paid based on totals."""
        total = self.total_amount

        if self.amount_paid == 0:
            self.status = "unpaid"
            self.is_paid = False
        elif self.amount_paid < total:
            self.status = "partial"
            self.is_paid = False
        else:
            self.status = "paid"
            self.is_paid = True

        self.save(update_fields=["status", "is_paid"])

    @property
    def total_amount(self):
        # A freshly created invoice still holds its float defaults; Decimal and float do not add
        return sum(Decimal(str(value or 0)) for value in [
            self.monthly_rent,
            self.rental_deposit,
            self.electricity_deposit,
            self.electricity_bill,
            self.water_deposit,
            self.water_bill,
            self.service_charge,
            self.security_charge,
            self.previous_balance,
            self.other_charges,
            self.late_penalty,
        ])

    @property
    def new_charges(self):
        """What this invoice adds to the tenant's debt: the total without the balance brought forward."""
        return self.total_amount - self.previous_balance

    def __str__(self):
        return f"Receipt {self.receipt_number} - Contract {self.contract.contract_number}"
    

    @property
    def balance(self):
        """Balance remaining for this single receipt."""
        return self.total_amount - Decimal(str(self.amount_paid or 0))

class Payment(models.Model):
    objects = scoped_manager("account_id")
    all_objects = models.Manager()

    # Copied from what it pays, so scoping a query is one indexed column
    account = models.ForeignKey(Account, on_delete=models.CASCADE, null=True, blank=True, related_name="payments")

    INCOME = "IN"
    EXPENSE = "OUT"
    
    PAYMENT_TYPES = [
        (INCOME, "Incoming"),
        (EXPENSE, "Outgoing"),
    ]

    receipt = models.ForeignKey("Receipt", on_delete=models.CASCADE, related_name="payments", null=True, blank=True)
    expense = models.ForeignKey("Expense", on_delete=models.CASCADE, related_name="payments", null=True, blank=True)
    maintenance_request = models.ForeignKey("MaintenanceRequest", on_delete=models.CASCADE, related_name="payments", null=True, blank=True)

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateField(auto_now_add=True)
    method = models.CharField(
        max_length=20,
        choices=[
            ("cash", "Cash"),
            ("mpesa", "M-Pesa"),
            ("bank", "Bank Transfer"),
        ],
        default="cash"
    )
    type = models.CharField(max_length=3, choices=PAYMENT_TYPES, default=INCOME)
    # Unique within an account (see Meta): one landlord's reference says nothing about another's
    reference = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["account", "reference"], name="unique_payment_reference_per_account"),
        ]

    @property
    def property_id(self):
        if self.type == self.EXPENSE:
            if self.expense:
                return self.expense.property.id
            if self.maintenance_request:
                return self.maintenance_request.unit.property.id
        return None

    def _apply(self, amount):
        """Add `amount` (negative to take it back) to whatever this payment is for."""
        if not amount:
            return
        if self.type == self.INCOME:
            if self.receipt:
                self.receipt.amount_paid += amount
                self.receipt.save(update_fields=["amount_paid"])
                self.receipt.update_status()
                self.receipt.contract.unit.recalculate_balance()
        elif self.type == self.EXPENSE:
            if self.expense:
                self.expense.amount_paid += amount
                self.expense.save(update_fields=["amount_paid", "balance", "payment_status"])
            if self.maintenance_request:
                self.maintenance_request.amount_paid += amount
                self.maintenance_request.save(update_fields=["amount_paid", "balance", "payment_status"])

    def account_from_related(self):
        """The account of the invoice, expense or repair this pays (one query)."""
        for model, pk, path in (
            (Receipt, self.receipt_id, "contract__unit__property__account_id"),
            (Expense, self.expense_id, "property__account_id"),
            (MaintenanceRequest, self.maintenance_request_id, "unit__property__account_id"),
        ):
            if pk:
                return model.all_objects.filter(pk=pk).values_list(path, flat=True).first()
        return None

    def save(self, *args, **kwargs):
        # Editing a payment only moves the difference; it must not be counted a second time
        # Unscoped: a payment hidden by the current scope is still not new
        previous = None if self._state.adding else Payment.all_objects.filter(pk=self.pk).first()
        if previous is None and self.type == self.INCOME and self.receipt_id:
            # Rent is paid on the tenant's latest invoice: it already includes
            # whatever was unpaid on the earlier ones
            latest = Receipt.all_objects.filter(contract_id=self.receipt.contract_id).order_by("issue_date", "id").last()
            if latest is not None and latest.pk != self.receipt_id:
                self.receipt = latest
        links = ("receipt_id", "expense_id", "maintenance_request_id")
        relinked = previous is None or any(getattr(previous, name) != getattr(self, name) for name in links)
        if relinked or self.account_id is None:
            # Only when what it pays is new or changed: an ordinary edit keeps its account
            account_id = self.account_from_related() or self.account_id or current_account_id()
            if account_id != self.account_id and kwargs.get("update_fields") is not None:
                kwargs["update_fields"] = {*kwargs["update_fields"], "account"}
            self.account_id = account_id
        if self.account_id is None:
            raise ValueError("Payment needs an account: link it to an invoice, expense or repair, or set .account.")
        super().save(*args, **kwargs)
        if previous is None:
            self._apply(self.amount)
        else:
            previous._apply(-previous.amount)
            # The same invoice may have just been changed through `previous`
            for name in ("receipt", "expense", "maintenance_request"):
                target = getattr(self, name)
                if target is not None:
                    target.refresh_from_db()
            self._apply(self.amount)

    def delete(self, *args, **kwargs):
        # Take the money back off the invoice or expense it was recorded against
        self._apply(-self.amount)
        return super().delete(*args, **kwargs)


class Expense(models.Model):
    objects = scoped_manager("property__account_id")
    all_objects = models.Manager()

    class Category(models.TextChoices):
        CLEANING = "cleaning", "Cleaning"
        SALARIES = "salaries", "Salaries & wages"
        REPAIRS = "repairs", "Repairs & maintenance"
        UTILITIES = "utilities", "Water & electricity"
        SECURITY = "security", "Security"
        GARBAGE = "garbage", "Garbage collection"
        RATES_TAXES = "rates_taxes", "Rates & taxes"
        INSURANCE = "insurance", "Insurance"
        MANAGEMENT = "management", "Management & agent fees"
        SUPPLIES = "supplies", "Supplies"
        DEPOSIT_REFUND = "deposit_refund", "Deposit refund"
        OTHER = "other", "Other"

    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name="expenses")
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    description = models.TextField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    expense_date = models.DateField(auto_now_add=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)     # NEW
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0)         # NEW
    payment_status = models.CharField(                                               # NEW
        max_length=20,
        choices=[("unpaid", "Unpaid"), ("partial", "Partially Paid"), ("paid", "Fully Paid")],
        default="unpaid"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Auto compute balance & payment status
        self.balance = self.amount - self.amount_paid

        if self.amount_paid == 0:
            self.payment_status = "unpaid"
        elif self.amount_paid < self.amount:
            self.payment_status = "partial"
        else:
            self.payment_status = "paid"

        super().save(*args, **kwargs)


class MaintenanceRequest(models.Model):
    objects = scoped_manager("unit__property__account_id")
    all_objects = models.Manager()

    class Category(models.TextChoices):
        PLUMBING = "plumbing", "Plumbing"
        ELECTRICAL = "electrical", "Electrical"
        CARPENTRY = "carpentry", "Doors, locks & carpentry"
        PAINTING = "painting", "Painting"
        APPLIANCE = "appliance", "Appliances"
        STRUCTURAL = "structural", "Roof, walls & floors"
        PEST_CONTROL = "pest_control", "Pest control"
        CLEANING = "cleaning", "Cleaning"
        OTHER = "other", "Other"

    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name="maintenance_requests")
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name="requests")
    description = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=[("pending", "Pending"), ("in_progress", "In Progress"), ("resolved", "Resolved")],
        default="pending"
    )
    reported_date = models.DateTimeField(auto_now_add=True)
    resolved_date = models.DateTimeField(null=True, blank=True)

    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)           # NEW
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)     # NEW
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=0)         # NEW
    payment_status = models.CharField(
        max_length=20,
        choices=[("unpaid", "Unpaid"), ("partial", "Partially Paid"), ("paid", "Fully Paid")],
        default="unpaid"
    )

    def save(self, *args, **kwargs):
        self.balance = self.amount - self.amount_paid

        if self.amount_paid == 0:
            self.payment_status = "unpaid"
        elif self.amount_paid < self.amount:
            self.payment_status = "partial"
        else:
            self.payment_status = "paid"

        super().save(*args, **kwargs)




class SystemParameter(models.Model):
    objects = scoped_manager("property__account_id")
    all_objects = models.Manager()

    property = models.OneToOneField(
        Property,
        on_delete=models.CASCADE,
        related_name="system_parameters"
    )

    # Bill inclusions
    has_water_bill = models.BooleanField(default=True)
    has_electricity_bill = models.BooleanField(default=True)
    has_service_charge = models.BooleanField(default=True)
    has_security_charge = models.BooleanField(default=False)
    has_other_charges = models.BooleanField(default=False)

    # Deposit configuration
    rent_deposit_months = models.PositiveIntegerField(default=1)
    require_water_deposit = models.BooleanField(default=False)
    require_electricity_deposit = models.BooleanField(default=False)

    # Optional settings
    allow_partial_payments = models.BooleanField(default=True)
    auto_generate_receipts = models.BooleanField(default=False)
    late_payment_penalty_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=0.00,
        help_text="Percentage penalty for late rent (e.g., 2.5 means 2.5%)"
    )
    grace_period_days = models.PositiveIntegerField(default=5)

    # Default fees (optional)
    default_service_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    default_security_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    default_other_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    electicity_unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    water_unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    water_deposit_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    electricity_deposit_amount  = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"System Params for {self.property.name}"


class MoveOut(models.Model):
    """The settlement made when a tenant leaves: deposit held, what is taken off it, and what goes back."""
    objects = scoped_manager("contract__unit__property__account_id")
    all_objects = models.Manager()

    contract = models.OneToOneField(RentalContract, on_delete=models.CASCADE, related_name="move_out")
    move_out_date = models.DateField()
    deposit_held = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    unpaid_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deduction_notes = models.TextField(blank=True, default="")
    # Positive: refunded to the tenant. Negative: the tenant still owes this much.
    refund_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    refund_payment = models.ForeignKey(Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Move-out {self.contract.contract_number} ({self.move_out_date})"


class MpesaTransaction(models.Model):
    """A paybill/till payment reported by Safaricom. Matched ones are linked to the payment they created."""
    objects = scoped_manager("account_id")
    all_objects = models.Manager()

    account = models.ForeignKey(Account, on_delete=models.CASCADE, null=True, blank=True, related_name="mpesa_transactions")
    trans_id = models.CharField(max_length=30, unique=True)
    trans_time = models.DateTimeField(null=True, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    bill_ref = models.CharField(max_length=100, blank=True, default="")
    msisdn = models.CharField(max_length=100, blank=True, default="")
    payer_name = models.CharField(max_length=150, blank=True, default="")
    payment = models.OneToOneField(Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name="mpesa_transaction")
    raw = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.trans_id} {self.amount} ({'matched' if self.payment_id else 'unmatched'})"


class SmsMessage(AccountOwnedMixin):
    """A text sent to a tenant. Also stops the daily reminders from repeating themselves."""
    DUE = "due"
    OVERDUE = "overdue"
    MANUAL = "manual"
    KINDS = [(DUE, "Rent due soon"), (OVERDUE, "Rent overdue"), (MANUAL, "Sent by hand")]

    account = models.ForeignKey(Account, on_delete=models.CASCADE, null=True, blank=True, related_name="sms_messages")
    contract = models.ForeignKey(RentalContract, on_delete=models.SET_NULL, null=True, blank=True, related_name="sms_messages")
    invoice_number = models.CharField(max_length=50, blank=True, default="")
    phone = models.CharField(max_length=20)
    message = models.TextField()
    kind = models.CharField(max_length=10, choices=KINDS)
    sent = models.BooleanField(default=False)
    error = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = scoped_manager("account_id")
    all_objects = models.Manager()

    def account_from_related(self):
        return self.contract.unit.property.account_id if self.contract_id else None

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_kind_display()} to {self.phone}"


class MpesaStkRequest(AccountOwnedMixin):
    """A "pay now" prompt sent to a tenant's phone (Daraja STK push) and what came of it."""
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    STATUSES = [(PENDING, "Waiting for the tenant"), (PAID, "Paid"), (FAILED, "Not paid")]

    account = models.ForeignKey(Account, on_delete=models.CASCADE, null=True, blank=True, related_name="stk_requests")
    receipt = models.ForeignKey(Receipt, on_delete=models.CASCADE, related_name="stk_requests")
    phone = models.CharField(max_length=20)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    merchant_request_id = models.CharField(max_length=100, blank=True, default="")
    checkout_request_id = models.CharField(max_length=100, unique=True)
    status = models.CharField(max_length=10, choices=STATUSES, default=PENDING)
    result_desc = models.CharField(max_length=255, blank=True, default="")
    mpesa_receipt = models.CharField(max_length=30, blank=True, default="")
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = scoped_manager("account_id")
    all_objects = models.Manager()

    def account_from_related(self):
        return self.receipt.contract.unit.property.account_id if self.receipt_id else None

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"STK {self.amount} to {self.phone} ({self.status})"
