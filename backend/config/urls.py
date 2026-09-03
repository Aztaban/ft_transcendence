import redis
from django.db import connection
from django.http import JsonResponse
from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

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

    heartbeat = redis.from_url(REDIS_URL).get("celery_heartbeat")
    celery_status = "ok" if heartbeat else "no heartbeat yet"

    status = "ok" if db_status == "ok" and redis_status == "ok" else "error"
    return JsonResponse(
        {"status": status, "db": db_status, "redis": redis_status, "celery": celery_status}
    )


urlpatterns = [
    path("health/", health, name="health"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]
