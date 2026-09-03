import app  # noqa: F401  - importing configures Django settings


def test_health_reports_db_and_redis():
    from django.test import Client

    response = Client().get("/health/")

    assert response.status_code == 200
    body = response.json()
    assert body["db"] == "ok"
    assert body["redis"] == "ok"
