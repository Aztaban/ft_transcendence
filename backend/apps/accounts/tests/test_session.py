"""Session status API tests against the disposable MySQL test database."""

import importlib

import pytest
from django.contrib.auth import SESSION_KEY, get_user_model
from django.contrib.sessions.models import Session
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db
PASSWORD = "SessionTestPassword123!"


def logged_in_client():
    user = get_user_model().objects.create_user(
        email="session@example.com",
        display_name="session-user",
        password=PASSWORD,
    )
    client = APIClient(enforce_csrf_checks=True)
    csrf_response = client.get(reverse("api:session"), HTTP_HOST="localhost")
    assert csrf_response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "csrftoken" in client.cookies

    login_response = client.post(
        reverse("api:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert login_response.status_code == status.HTTP_200_OK
    return user, client


def test_anonymous_session_returns_401_and_provides_csrf_cookie():
    client = APIClient(enforce_csrf_checks=True)

    response = client.get(reverse("api:session"), HTTP_HOST="localhost")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {
        "error": {
            "code": "not_authenticated",
            "message": "Authentication required.",
        }
    }
    assert "csrftoken" in client.cookies
    assert "sessionid" not in client.cookies


def test_session_persists_across_requests_and_clients_with_same_cookie():
    user, client = logged_in_client()
    assert client.session[SESSION_KEY] == str(user.pk)

    # A new client simulates a browser reload using the same session cookie.
    new_client = APIClient(enforce_csrf_checks=True)
    new_client.cookies.update(client.cookies)
    response = new_client.get(reverse("api:session"), HTTP_HOST="localhost")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "authenticated": True,
        "user": {
            "id": user.pk,
            "email": user.email,
            "display_name": user.display_name,
        },
    }
    assert "password" not in response.json()["user"]
    assert new_client.cookies["sessionid"]["httponly"] is True
    assert new_client.cookies["sessionid"]["samesite"] == "Lax"


def test_suspended_user_cannot_use_an_existing_session():
    user, client = logged_in_client()
    user.status = get_user_model().Status.SUSPENDED
    user.save(update_fields=["status"])

    response = client.get(reverse("api:session"), HTTP_HOST="localhost")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["error"]["code"] == "not_authenticated"


def test_deleted_server_side_session_is_not_authenticated():
    _, client = logged_in_client()
    session_key = client.cookies["sessionid"].value
    Session.objects.filter(session_key=session_key).delete()

    response = client.get(reverse("api:session"), HTTP_HOST="localhost")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["error"]["code"] == "not_authenticated"


def test_session_endpoint_is_get_only():
    client = APIClient()
    response = client.post(reverse("api:session"), {}, format="json", HTTP_HOST="localhost")
    assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


def test_cookie_settings_differ_between_local_http_and_production_https(monkeypatch):
    # Production settings require a secret and allowed hosts at import time.
    monkeypatch.setenv("DJANGO_SECRET_KEY", "cookie-settings-test-secret")
    monkeypatch.setenv("DJANGO_ALLOWED_HOSTS", "example.com")
    dev = importlib.import_module("config.settings.dev")
    prod = importlib.reload(importlib.import_module("config.settings.prod"))

    assert dev.SESSION_COOKIE_SECURE is False
    assert dev.CSRF_COOKIE_SECURE is False
    assert prod.SESSION_COOKIE_SECURE is True
    assert prod.CSRF_COOKIE_SECURE is True

    for configuration in (dev, prod):
        assert configuration.SESSION_COOKIE_HTTPONLY is True
        assert configuration.SESSION_COOKIE_SAMESITE == "Lax"
        assert configuration.CSRF_COOKIE_HTTPONLY is False
        assert configuration.CSRF_COOKIE_SAMESITE == "Lax"


@override_settings(SESSION_COOKIE_SECURE=True, CSRF_COOKIE_SECURE=True)
def test_session_and_csrf_cookies_use_secure_attributes_for_https():
    _, client = logged_in_client()

    assert client.cookies["sessionid"]["secure"] is True
    assert client.cookies["sessionid"]["httponly"] is True
    assert client.cookies["sessionid"]["samesite"] == "Lax"
    assert client.cookies["csrftoken"]["secure"] is True
    assert not client.cookies["csrftoken"]["httponly"]
    assert client.cookies["csrftoken"]["samesite"] == "Lax"
