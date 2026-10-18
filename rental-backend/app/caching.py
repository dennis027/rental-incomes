"""
Shared cache for the API's GET endpoints.

Every cached response is stored under a global version number. Saving or
deleting any business record (from the API, the admin, a Celery task or a
management command) bumps that number, so a write is never followed by stale
pages; the old entries are simply never read again and expire on their own.

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

VERSION_KEY = "api:version"


def _version():
    version = cache.get(VERSION_KEY)
    if version is None:
        # Seeded from the clock, so a version lost to eviction or a Redis
        # restart can never come back to a number that old entries still use
        cache.add(VERSION_KEY, time.time_ns(), timeout=None)
        version = cache.get(VERSION_KEY)
    return version


def invalidate():
    try:
        cache.incr(VERSION_KEY)
    except ValueError:  # no version stored yet
        cache.set(VERSION_KEY, time.time_ns(), timeout=None)


def invalidate_on_write(**kwargs):
    """Signal receiver for post_save / post_delete / m2m_changed."""
    invalidate()
    # Again once the transaction commits: a read that ran in between could
    # otherwise have cached the data as it was before the write
    transaction.on_commit(invalidate)


def _key(request, version):
    url = f"{request.get_host()}{request.get_full_path()}"
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
