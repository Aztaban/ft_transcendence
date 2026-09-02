from django.test import Client


def test_health_ok(db):
    response = Client().get("/health/")
    assert response.status_code == 200
    assert response.json()["db"] == "ok"
