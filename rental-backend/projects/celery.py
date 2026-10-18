import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "projects.settings")

app = Celery("projects")
# Every CELERY_* setting in settings.py
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
