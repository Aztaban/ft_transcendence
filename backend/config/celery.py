"""Celery application configuration."""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("config")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


@app.task(name="heartbeat")
def heartbeat():
    """Store a heartbeat used by the health endpoint."""
    import redis
    from django.conf import settings

    redis.from_url(settings.REDIS_URL).set("celery_heartbeat", "1")
