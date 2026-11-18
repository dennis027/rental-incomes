"""
Before accounts existed every user saw every property. To keep that working,
everything already in the database goes into one account and every existing
user becomes an owner of it. New sign-ups get an account of their own.
"""
import secrets

from django.db import migrations


def forwards(apps, schema_editor):
    Account = apps.get_model("app", "Account")
    User = apps.get_model("app", "CustomUser")
    Property = apps.get_model("app", "Property")
    Customer = apps.get_model("app", "Customer")
    MpesaTransaction = apps.get_model("app", "MpesaTransaction")

    has_data = (
        User.objects.exists() or Property.objects.exists()
        or Customer.objects.exists() or MpesaTransaction.objects.exists()
    )
    if not has_data:
        return

    account = Account.objects.create(name="My properties", mpesa_callback_token=secrets.token_urlsafe(24))
    User.objects.filter(account__isnull=True).update(account=account, role="owner")
    Property.objects.filter(account__isnull=True).update(account=account)
    Customer.objects.filter(account__isnull=True).update(account=account)
    MpesaTransaction.objects.filter(account__isnull=True).update(account=account)


class Migration(migrations.Migration):

    dependencies = [
        ("app", "0004_accounts_and_roles"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
