"""API tests for session-based email/password login (disposable MySQL DB)."""

import pytest
from django.contrib.auth import SESSION_KEY, get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db
PASSWORD = "TestLoginPassword123!"


def create_user(*, status_value=None):
    extra = {"status": status_value} if status_value else {}
    return get_user_model().objects.create_user(
        email="login@example.com",
        display_name="test-login",
        password=PASSWORD,
        **extra,
    )


def csrf_client():
    client = APIClient(enforce_csrf_checks=True)
    response = client.get(reverse("api:root"), HTTP_HOST="localhost")
    assert response.status_code == status.HTTP_200_OK
    assert "csrftoken" in client.cookies
    return client


def post_login(client, *, email="login@example.com", password=PASSWORD, csrf=True):
    kwargs = {"HTTP_HOST": "localhost"}
    if csrf:
        kwargs["HTTP_X_CSRFTOKEN"] = client.cookies["csrftoken"].value
    return client.post(
        reverse("api:login"),
        {"email": email, "password": password},
        format="json",
        **kwargs,
    )


def test_login_creates_persistent_django_session():
    user = create_user()
    client = csrf_client()

    response = post_login(client, email="LOGIN@EXAMPLE.COM")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "message": "Logged in successfully.",
    }
    assert client.session[SESSION_KEY] == str(user.pk)
    assert client.cookies["sessionid"]["httponly"] is True
    assert client.get(reverse("api:root"), HTTP_HOST="localhost").wsgi_request.user == user
    assert "password" not in response.json()


def test_login_rejects_post_without_csrf_even_for_anonymous_user():
    create_user()
    client = APIClient(enforce_csrf_checks=True)

    response = post_login(client, csrf=False)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert SESSION_KEY not in client.session


@pytest.mark.parametrize(
    "email,password",
    [
        ("unknown@example.com", PASSWORD),
        ("login@example.com", "WrongPassword123!"),
    ],
)
def test_login_rejects_invalid_credentials_without_creating_session(email, password):
    create_user()
    client = csrf_client()

    response = post_login(client, email=email, password=password)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {
        "error": {"code": "invalid_credentials", "message": "Invalid email or password."}
    }
    assert SESSION_KEY not in client.session


def test_login_rejects_suspended_user():
    create_user(status_value=get_user_model().Status.SUSPENDED)
    client = csrf_client()

    response = post_login(client)

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["error"]["code"] == "invalid_credentials"
    assert SESSION_KEY not in client.session


@pytest.mark.parametrize("missing", ["email", "password"])
def test_login_requires_email_and_password(missing):
    create_user()
    client = csrf_client()
    payload = {"email": "login@example.com", "password": PASSWORD}
    payload.pop(missing)

    response = client.post(
        reverse("api:login"),
        payload,
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "validation_error"
    assert missing in response.json()["error"]["fields"]
    assert SESSION_KEY not in client.session


def test_login_rejects_get():
    client = APIClient()
    response = client.get(reverse("api:login"), HTTP_HOST="localhost")
    assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
