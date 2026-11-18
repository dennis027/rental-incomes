"""
Shared cache for the API's GET endpoints.

Every cached response is stored under two version numbers: a global one and
one for its account. A write made for one account (an API request, an M-Pesa
callback, a reminder run: anything that has scoped itself to the account)
bumps only that account's number, so other landlords keep their cache. A write
made outside any account (the admin, a management command, the shell) bumps
the global one and so clears everyone's. Either way a write is never followed
by stale pages; old entries are simply never read again and expire on their own.

Querysets changed with .update() or bulk_create() send no signals; call
invalidate() after them.
"""
import functools
import hashlib
import time

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from rest_framework.request import Request
from rest_framework.response import Response

from .tenancy import current_account_id

VERSION_KEY = "api:version"


def _version_key(account_id=None):
    return VERSION_KEY if account_id is None else f"{VERSION_KEY}:{account_id}"


def _read(key):
    version = cache.get(key)
    if version is None:
        # Seeded from the clock, so a version lost to eviction or a Redis
        # restart can never come back to a number that old entries still use
        cache.add(key, time.time_ns(), timeout=None)
        version = cache.get(key)
    return version


def _version():
    """The global and the current account's version, together; None if the cache is unavailable."""
    shared = _read(_version_key())
    own = _read(_version_key(current_account_id()))
    if shared is None or own is None:
        return None
    return f"{shared}.{own}"


def invalidate(account_id=None):
    """Clear one account's cached pages, or everyone's when no account is given."""
    key = _version_key(account_id)
    try:
        cache.incr(key)
    except ValueError:  # no version stored yet
        cache.set(key, time.time_ns(), timeout=None)


def invalidate_on_write(**kwargs):
    """Signal receiver for post_save / post_delete / m2m_changed."""
    account_id = current_account_id()
    invalidate(account_id)
    # Again once the transaction commits: a read that ran in between could
    # otherwise have cached the data as it was before the write
    transaction.on_commit(lambda: invalidate(account_id))


def _key(request, version):
    # Per account: two landlords asking for the same URL get different data.
    # Per role too: a caretaker is sent the same pages without the money in them,
    # and an owner must never be served that copy (nor the caretaker the full one).
    role = getattr(request.user, "role", "")
    url = f"{current_account_id()}:{role}:{request.get_host()}{request.get_full_path()}"
    return f"api:{version}:{hashlib.sha256(url.encode()).hexdigest()}"


def cached_get(handler):
    """
    Cache a DRF GET handler's 200 responses. Works on view methods and on
    @api_view functions; put it under @api_view/@permission_classes so the
    login and permission checks still run on every request.
    """
    @functools.wraps(handler)
    def wrapper(*args, **kwargs):
        request = next(arg for arg in args if isinstance(arg, Request))
        if settings.API_CACHE_SECONDS <= 0:
            return handler(*args, **kwargs)

        version = _version()
        key = _key(request, version) if version is not None else None
        data = cache.get(key) if key else None
        if data is not None:
            response = Response(data)
            response["X-Cache"] = "HIT"
            return response

        response = handler(*args, **kwargs)
        if key and isinstance(response, Response) and response.status_code == 200:
            cache.set(key, response.data, timeout=settings.API_CACHE_SECONDS)
            response["X-Cache"] = "MISS"
        return response

    return wrapper


class CachedGetMixin:
    """For generic views whose get() comes from DRF. List it first in the bases."""

    @cached_get
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)
