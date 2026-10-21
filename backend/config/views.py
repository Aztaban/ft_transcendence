"""Project-level views."""

import logging

import redis
from django.conf import settings
from django.db import connection
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def health(request):
    """Report whether the core services answer. Details stay in the log, not the response."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        db_status = "ok"
    except Exception as exc:  # noqa: BLE001 - any failure means "down"
        logger.warning("Health check: database unavailable", exc_info=exc)
        db_status = "error"

    client = redis.from_url(settings.REDIS_URL)
    try:
        client.ping()
        redis_status = "ok"
        celery_status = "ok" if client.get("celery_heartbeat") else "no heartbeat yet"
    except Exception as exc:  # noqa: BLE001 - any failure means "down"
        logger.warning("Health check: redis unavailable", exc_info=exc)
        redis_status = "error"
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
