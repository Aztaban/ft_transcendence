import os

import django
from django.test import Client, override_settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
django.setup()


class DummyCursor:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query):
        assert query == "SELECT 1"


class DummyConnection:
    def cursor(self):
        return DummyCursor()


class DummyRedis:
    def ping(self):
        return True

    def get(self, key):
        assert key == "celery_heartbeat"
        return b"1"


@override_settings(ALLOWED_HOSTS=["testserver"])
def test_health_reports_db_redis_and_celery(monkeypatch):
    monkeypatch.setattr("config.views.connection", DummyConnection())
    monkeypatch.setattr("config.views.redis.from_url", lambda _url: DummyRedis())

    response = Client().get("/health/")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "db": "ok",
        "redis": "ok",
        "celery": "ok",
    }


def test_django_entrypoints_use_project_settings():
    from django.conf import settings

    assert settings.ROOT_URLCONF == "config.urls"
    assert settings.WSGI_APPLICATION == "config.wsgi.application"
    assert settings.ASGI_APPLICATION == "config.asgi.application"


def test_celery_app_is_exposed():
    from config import celery_app

    assert celery_app.main == "config"