"""
Keeps every landlord's data apart.

Each user belongs to one Account. While an API request runs, the account of
the signed-in user is held in a context variable, and the default manager of
every business model filters on it. Views keep writing `Unit.objects...` and
only ever see their own account's rows.

Outside API requests (admin, Celery tasks, management commands) nothing is
filtered. Inside an API request that has no signed-in user the managers
return nothing, so a view that forgets a permission check fails closed.
`Model.all_objects` is the unfiltered manager, for the few places that must
look across accounts (number generators, M-Pesa callbacks).
"""
from contextvars import ContextVar

from django.db import models

# None: not in an API request (no filtering). NO_ACCOUNT: an API request
# without a signed-in member (nothing is visible). Otherwise an Account id.
NO_ACCOUNT = object()
_current = ContextVar("current_account", default=None)


def current_account_id():
    value = _current.get()
    return None if value is None or value is NO_ACCOUNT else value


def set_current_account(account_id):
    """Scope the rest of this request (or block) to one account; returns a token for reset()."""
    return _current.set(account_id if account_id is not None else NO_ACCOUNT)


def reset_current_account(token):
    _current.reset(token)


class AccountScopedQuerySet(models.QuerySet):
    """
    Rows of the current account only. `.all()` applies the filter again, so a
    queryset built at import time (a DRF view's class-level `queryset`, which
    DRF copies with .all() on every request) is scoped to the request too.
    """
    lookup = None

    def scoped(self):
        value = _current.get()
        if value is None:
            return self
        if value is NO_ACCOUNT:
            return self.none()
        lookups = self.lookup if isinstance(self.lookup, (list, tuple)) else (self.lookup,)
        condition = models.Q()
        for lookup in lookups:
            condition |= models.Q(**{lookup: value})
        return self.filter(condition)

    def all(self):
        return super().all().scoped()


class AccountScopedManager(models.Manager):
    """Default manager of the business models; see scoped_manager()."""

    def deconstruct(self):
        # Managers are not used in migrations; keep makemigrations quiet
        return (False, "django.db.models.Manager", None, [], {})

    def get_queryset(self):
        return super().get_queryset().scoped()


def scoped_manager(lookup):
    """
    A manager filtered on `lookup` (one path to Account.id, or several to OR
    together). The lookup lives on the classes because Django builds related
    managers (property.units) by subclassing the manager without arguments.
    """
    queryset_class = type("AccountScopedQuerySet", (AccountScopedQuerySet,), {"lookup": lookup})
    manager_class = type("AccountScopedManager", (AccountScopedManager,), {"_queryset_class": queryset_class})
    return manager_class()


class AccountMiddleware:
    """
    API requests (and uploaded files, served by an API view) start with nothing
    visible until a member signs in. Every request, scoped or not, puts the
    context back afterwards: a worker thread serves many requests, and an
    account left set by one must never filter the next one.
    """
    SCOPED = ("/api/", "/media/")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = _current.set(NO_ACCOUNT if request.path.startswith(self.SCOPED) else None)
        try:
            return self.get_response(request)
        finally:
            _current.reset(token)
