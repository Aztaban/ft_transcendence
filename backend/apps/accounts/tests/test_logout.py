"""CSRF-protected logout tests against the disposable MySQL test database."""

import pytest
from django.contrib.auth import SESSION_KEY, get_user_model
from django.contrib.sessions.models import Session
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db
PASSWORD = "LogoutTestPassword123!"


def create_user():
    return get_user_model().objects.create_user(
        email="logout@example.com",
        display_name="logout-user",
        password=PASSWORD,
    )


def csrf_client():
    client = APIClient(enforce_csrf_checks=True)
    response = client.get(reverse("api:session"), HTTP_HOST="localhost")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "csrftoken" in client.cookies
    return client


def logged_in_client(user):
    client = csrf_client()
    response = client.post(
        reverse("api:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == status.HTTP_200_OK
    assert SESSION_KEY in client.session
    return client


def post_logout(client, *, csrf=True):
    headers = {"HTTP_HOST": "localhost"}
    if csrf:
        headers["HTTP_X_CSRFTOKEN"] = client.cookies["csrftoken"].value
    return client.post(reverse("api:logout"), format="json", **headers)


def test_logout_invalidates_authenticated_session():
    user = create_user()
    client = logged_in_client(user)
    session_key = client.cookies["sessionid"].value
    assert Session.objects.filter(session_key=session_key).exists()

    response = post_logout(client)

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert response.content == b""
    assert SESSION_KEY not in client.session
    assert not Session.objects.filter(session_key=session_key).exists()
    assert client.get(reverse("api:session"), HTTP_HOST="localhost").status_code == 401


def test_logout_revoked_session_cookie_cannot_be_reused():
    user = create_user()
    client = logged_in_client(user)
    old_session_key = client.cookies["sessionid"].value

    assert post_logout(client).status_code == status.HTTP_204_NO_CONTENT

    replay = APIClient()
    replay.cookies["sessionid"] = old_session_key
    response = replay.get(reverse("api:session"), HTTP_HOST="localhost")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["error"]["code"] == "not_authenticated"


def test_logout_without_csrf_rejected_and_session_remains_active():
    user = create_user()
    client = logged_in_client(user)
    original_session_key = client.cookies["sessionid"].value

    response = post_logout(client, csrf=False)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert client.session[SESSION_KEY] == str(user.pk)
    assert Session.objects.filter(session_key=original_session_key).exists()
    assert client.get(reverse("api:session"), HTTP_HOST="localhost").status_code == 200


def test_anonymous_logout_with_csrf_is_idempotent():
    client = csrf_client()

    first = post_logout(client)
    second = post_logout(client)

    assert first.status_code == status.HTTP_204_NO_CONTENT
    assert second.status_code == status.HTTP_204_NO_CONTENT
    assert first.content == b""
    assert second.content == b""
    assert SESSION_KEY not in client.session


def test_anonymous_logout_still_requires_csrf():
    client = APIClient(enforce_csrf_checks=True)

    response = post_logout(client, csrf=False)

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_logout_only_invalidates_current_browser_session():
    user = create_user()
    first_client = logged_in_client(user)
    second_client = logged_in_client(user)
    first_key = first_client.cookies["sessionid"].value
    second_key = second_client.cookies["sessionid"].value
    assert first_key != second_key

    assert post_logout(first_client).status_code == status.HTTP_204_NO_CONTENT

    assert not Session.objects.filter(session_key=first_key).exists()
    assert Session.objects.filter(session_key=second_key).exists()
    assert second_client.get(reverse("api:session"), HTTP_HOST="localhost").status_code == 200


def test_logout_is_post_only():
    user = create_user()
    client = logged_in_client(user)

    response = client.get(reverse("api:logout"), HTTP_HOST="localhost")

    assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
    assert client.get(reverse("api:session"), HTTP_HOST="localhost").status_code == 200
