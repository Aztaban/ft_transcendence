"""Project-level views."""

import redis
from django.conf import settings
from django.db import connection
from django.http import JsonResponse


def health(request):
    """Report connectivity to the backend's core runtime services."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_status = "ok"
    except Exception as exc:  # noqa: BLE001 - health response is intentionally diagnostic
        db_status = f"error: {exc}"

    client = redis.from_url(settings.REDIS_URL)
    try:
        client.ping()
        redis_status = "ok"
        celery_status = "ok" if client.get("celery_heartbeat") else "no heartbeat yet"
    except Exception as exc:  # noqa: BLE001 - health response is intentionally diagnostic
        redis_status = f"error: {exc}"
        celery_status = "unavailable"

    status = "ok" if db_status == "ok" and redis_status == "ok" else "error"

    return JsonResponse(
        {
            "status": status,
            "db": db_status,
            "redis": redis_status,
            "celery": celery_status,
        }
    )
