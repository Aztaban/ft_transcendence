from django.db import connection
from django.http import JsonResponse
from django.urls import path

import redis

from config.settings import REDIS_URL


def health(request):
    db_status = "ok"
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception as exc:  # noqa: BLE001 - surfaced directly in the health response
        db_status = f"error: {exc}"

    redis_status = "ok"
    try:
        redis.from_url(REDIS_URL).ping()
    except Exception as exc:  # noqa: BLE001 - surfaced directly in the health response
        redis_status = f"error: {exc}"

    status = "ok" if db_status == "ok" and redis_status == "ok" else "error"
    return JsonResponse({"status": status, "db": db_status, "redis": redis_status})


urlpatterns = [
    path("health/", health, name="health"),
]
