from django.contrib import admin

from .models import AccountOwnedMixin
from .models import (
    CustomUser,
    Property,
    Unit,
    Customer,
    RentalContract,
    Receipt,
    Payment,
    Expense,
    MaintenanceRequest,
    SystemParameter,
    MoveOut,
    MpesaTransaction,
)


class AccountOwnedAdmin(admin.ModelAdmin):
    """
    Rows added here without an account go to the admin user's own, rather than
    to nobody. An admin user with no account of their own (a superuser on a
    server with several accounts) must pick one, as a form error, not a crash.
    """

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        field = form.base_fields.get("account")
        if field is not None and not request.user.account_id and issubclass(self.model, AccountOwnedMixin):
            field.required = True
            field.help_text = "You have no account of your own, so pick the one this belongs to."
        return form

    def save_model(self, request, obj, form, change):
        if obj.account_id is None and request.user.account_id:
            obj.account_id = request.user.account_id
        super().save_model(request, obj, form, change)


admin.site.register(CustomUser)
admin.site.register(Property, AccountOwnedAdmin)
admin.site.register(Unit)
admin.site.register(Customer, AccountOwnedAdmin)
admin.site.register(RentalContract)
admin.site.register(Receipt)
admin.site.register(Payment, AccountOwnedAdmin)
admin.site.register(Expense)
admin.site.register(MaintenanceRequest)
admin.site.register(SystemParameter)
admin.site.register(MoveOut)
admin.site.register(MpesaTransaction)
