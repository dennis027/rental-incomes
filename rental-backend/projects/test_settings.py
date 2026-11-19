"""
Settings for running the test suite in CI (and locally, if you like) without
touching a real database:

    DATABASE_URL=postgres://ci:ci@localhost/ci DJANGO_SETTINGS_MODULE=projects.test_settings \
        python manage.py test app

projects.settings needs a DATABASE_URL to import (any well-formed one will do);
the database is then swapped for a throwaway sqlite file, and there is no Redis
or Celery worker: the cache is in memory and tasks run inline.
"""
from .settings import *  # noqa: F401,F403

DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "test-db.sqlite3"}}  # noqa: F405
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CELERY_TASK_ALWAYS_EAGER = True
CELERY_BROKER_URL = ""
# The tests call the API over plain http
SECURE_SSL_REDIRECT = False
