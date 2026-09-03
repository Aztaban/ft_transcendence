#!/usr/bin/env python
"""Minimal Django + Celery bootstrap.

Placeholder that exists only to prove the container wiring works
(HTTP, MySQL, Redis, Celery worker/beat). Issues #18/#19 replace this
with the real application structure.

Run:  python app.py runserver 0.0.0.0:8000
      celery -A app worker
      celery -A app beat
"""

import os
import sys

import django
from django.conf import settings

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")

if not settings.configured:
    settings.configure(
        DEBUG=os.environ.get("DJANGO_DEBUG", "1") == "1",
        SECRET_KEY=os.environ.get("DJANGO_SECRET_KEY", "insecure-dev-key"),
        ALLOWED_HOSTS=os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(","),
        ROOT_URLCONF=__name__,
        INSTALLED_APPS=["django.contrib.contenttypes", "django.contrib.auth"],
        DATABASES={
            "default": {
                "ENGINE": "django.db.backends.mysql",
                "NAME": os.environ.get("MYSQL_DATABASE", "transcendence"),
                "USER": os.environ.get("MYSQL_USER", "transcendence"),
                "PASSWORD": os.environ.get("MYSQL_PASSWORD", ""),
                "HOST": os.environ.get("MYSQL_HOST", "db"),
                "PORT": os.environ.get("MYSQL_PORT", "3306"),
            }
        },
        DEFAULT_AUTO_FIELD="django.db.models.BigAutoField",
    )
    django.setup()

import redis  # noqa: E402
from celery import Celery  # noqa: E402
from django.db import connection  # noqa: E402
from django.http import JsonResponse  # noqa: E402
from django.urls import path  # noqa: E402

app = Celery("app", broker=REDIS_URL, backend=REDIS_URL)
app.conf.broker_connection_retry_on_startup = True
app.conf.beat_schedule = {
    "heartbeat-every-10s": {"task": "heartbeat", "schedule": 10.0},
}


@app.task(name="heartbeat")
def heartbeat():
    redis.from_url(REDIS_URL).set("celery_heartbeat", "1")


def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_status = "ok"
    except Exception as exc:  # noqa: BLE001 - surfaced directly in the response
        db_status = f"error: {exc}"

    client = redis.from_url(REDIS_URL)
    try:
        client.ping()
        redis_status = "ok"
    except Exception as exc:  # noqa: BLE001 - surfaced directly in the response
        redis_status = f"error: {exc}"

    celery_status = "ok" if client.get("celery_heartbeat") else "no heartbeat yet"

    status = "ok" if db_status == "ok" and redis_status == "ok" else "error"
    return JsonResponse(
        {"status": status, "db": db_status, "redis": redis_status, "celery": celery_status}
    )


urlpatterns = [path("health/", health)]

if __name__ == "__main__":
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)
