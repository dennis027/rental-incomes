"""
Who may call what. Every signed-in API view uses IsAccountMember: it scopes the
request to the user's account and applies the limits of their role.

  owner       everything, including the team
  manager     everything except changing the team
  accountant  sees everything; records invoices, payments and expenses
  caretaker   sees properties, units, tenants and contracts; handles repairs
"""
import re

from rest_framework.permissions import SAFE_METHODS, BasePermission

from .tenancy import set_current_account

# Open to every signed-in member, whatever their role
ANYONE = re.compile(r"^/api/(logout|me)/")
# Changing the team
TEAM = re.compile(r"^/api/team/")
# What an accountant may change
ACCOUNTANT_WRITES = re.compile(
    r"^/api/(receipts|payments|paybill-transactions|expenses|maintenance-requests|mpesa/stk|reminders)/"
)
# Everything a caretaker may open. An allow list of exact routes rather than
# prefixes: report and money endpoints keep being added under units/,
# customers/, contracts/... and must not become readable by default.
# Contracts still show their rent and deposit, which are terms of the
# tenancy; payments, balances, statements and revenue are not.
CARETAKER_READS = re.compile(
    r"^/api/("
    r"(properties|units|customers|contracts|expenses|maintenance-requests)/(\d+/)?"
    r"|properties/\d+/(units|system-parameters)/"
    r"|units/active/"
    r"|maintenance/requests/"
    r"|account/"
    r")$"
)
CARETAKER_WRITES = re.compile(r"^/api/maintenance-requests/(\d+/)?$")


def hides_money(request):
    """Whether this request's user is a caretaker, who is shown no balances or payments."""
    user = getattr(request, "user", None)
    return getattr(user, "role", None) == "caretaker"


def role_allows(role, method, path):
    if ANYONE.match(path):
        return True
    read = method in SAFE_METHODS
    if role == "owner":
        return True
    if role == "manager":
        return read or not TEAM.match(path)
    if role == "accountant":
        return read or bool(ACCOUNTANT_WRITES.match(path))
    if role == "caretaker":
        if TEAM.match(path):
            return False
        return bool(CARETAKER_WRITES.match(path)) if not read else bool(CARETAKER_READS.match(path))
    return False


class IsAccountMember(BasePermission):
    message = "Your role does not allow this."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if not user.account_id:
            # Someone not yet placed in an account (an operator made with
            # createsuperuser) may still see who they are and sign out
            set_current_account(None)
            return bool(ANYONE.match(request.path))
        # Also covers sign-ins that skip the JWT class (tests, browsable API)
        set_current_account(user.account_id)
        return role_allows(user.role, request.method, request.path)
