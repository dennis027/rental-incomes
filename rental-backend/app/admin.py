from django.contrib import admin
from django.forms.models import construct_instance

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
    Rows added here get their account from the row they belong to (a tenant's
    unit), or else from what was picked, or else the admin user's own account.
    A pick that contradicts the row it belongs to, or no account at all, is a
    form error rather than a crash or a row filed under the wrong landlord.
    """

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        if not issubclass(self.model, AccountOwnedMixin):
            return form
        admin_account_id = request.user.account_id

        class AccountCheckedForm(form):
            def clean(self):
                data = super().clean()
                if "account" not in self.fields:
                    return data
                # A throwaway copy with the submitted values, to ask it where it belongs
                probe = construct_instance(self, self._meta.model(), fields=self._meta.fields,
                                           exclude=self._meta.exclude)
                from_related = probe.account_from_related()
                picked = data.get("account")
                if picked is not None and from_related is not None and picked.pk != from_related:
                    self.add_error("account", "This belongs to another account: it must match the unit's account.")
                elif picked is None and from_related is None and not admin_account_id:
                    self.add_error("account", "You have no account of your own, so pick the one this belongs to.")
                return data

        return AccountCheckedForm

    def save_model(self, request, obj, form, change):
        if obj.account_id is None:
            obj.account_id = obj.account_from_related() or request.user.account_id
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
