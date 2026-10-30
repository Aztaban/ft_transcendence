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


class BrokenConnection:
    def cursor(self):
        raise RuntimeError("Access denied for user 'transcendence'@'10.0.0.7'")


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


@override_settings(ALLOWED_HOSTS=["testserver"])
def test_health_hides_failure_details(monkeypatch):
    """The endpoint is public: it says a service is down, never why."""
    monkeypatch.setattr("config.views.connection", BrokenConnection())
    monkeypatch.setattr("config.views.redis.from_url", lambda _url: DummyRedis())

    response = Client().get("/health/")

    assert response.status_code == 503
    assert response.json() == {
        "status": "error",
        "db": "error",
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


class DownRedis:
    def ping(self):
        raise ConnectionError("Connection refused")


class NoHeartbeatRedis(DummyRedis):
    def get(self, key):
        assert key == "celery_heartbeat"
        return None


@override_settings(ALLOWED_HOSTS=["testserver"])
def test_health_is_503_when_redis_is_down(monkeypatch):
    monkeypatch.setattr("config.views.connection", DummyConnection())
    monkeypatch.setattr("config.views.redis.from_url", lambda _url: DownRedis())

    response = Client().get("/health/")

    assert response.status_code == 503
    assert response.json() == {
        "status": "error",
        "db": "ok",
        "redis": "error",
        "celery": "unavailable",
    }


@override_settings(ALLOWED_HOSTS=["testserver"])
def test_health_stays_200_without_a_celery_heartbeat(monkeypatch):
    """Celery is reported, but the API works without it."""
    monkeypatch.setattr("config.views.connection", DummyConnection())
    monkeypatch.setattr("config.views.redis.from_url", lambda _url: NoHeartbeatRedis())

    response = Client().get("/health/")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "db": "ok",
        "redis": "ok",
        "celery": "no heartbeat yet",
    }


@override_settings(HEALTH_CELERY_HEARTBEAT_TTL_SECONDS=60)
def test_heartbeat_expires(monkeypatch):
    from config.celery import heartbeat

    calls = []

    class RecordingRedis:
        def set(self, *args, **kwargs):
            calls.append((args, kwargs))

    monkeypatch.setattr("redis.from_url", lambda _url: RecordingRedis())

    heartbeat()

    assert calls == [(("celery_heartbeat", "1"), {"ex": 60})]
