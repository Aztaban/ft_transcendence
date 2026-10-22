"""CSRF-protected logout tests against the disposable MySQL test database."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from django.contrib.auth import SESSION_KEY, get_user_model
from django.contrib.sessions.models import Session
from django.db import transaction
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Role

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
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"authenticated": False, "user": None}
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
    session_response = client.get(reverse("api:session"), HTTP_HOST="localhost")
    assert session_response.status_code == status.HTTP_200_OK
    assert session_response.json() == {"authenticated": False, "user": None}
    assert client.get(reverse("api:me"), HTTP_HOST="localhost").status_code == 401


def test_logout_revoked_session_cookie_cannot_be_reused():
    user = create_user()
    client = logged_in_client(user)
    old_session_key = client.cookies["sessionid"].value

    assert post_logout(client).status_code == status.HTTP_204_NO_CONTENT

    replay = APIClient()
    replay.cookies["sessionid"] = old_session_key
    response = replay.get(reverse("api:session"), HTTP_HOST="localhost")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"authenticated": False, "user": None}
    assert replay.get(reverse("api:me"), HTTP_HOST="localhost").status_code == 401


@pytest.mark.parametrize("csrf_case", ["no_header", "malformed_header", "wrong_header"])
def test_logout_with_invalid_csrf_preserves_session(
    csrf_case, group_send, django_capture_on_commit_callbacks
):
    user = create_user()
    client = logged_in_client(user)
    original_session_key = client.cookies["sessionid"].value

    headers = {"HTTP_HOST": "localhost"}
    if csrf_case == "malformed_header":
        headers["HTTP_X_CSRFTOKEN"] = "invalid"
    elif csrf_case == "wrong_header":
        token = client.cookies["csrftoken"].value
        headers["HTTP_X_CSRFTOKEN"] = ("a" if token[0] != "a" else "b") + token[1:]

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = client.post(reverse("api:logout"), format="json", **headers)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json() == {
        "error": {
            "code": "csrf_failed",
            "message": "CSRF verification failed. Reload the page and try again.",
        }
    }
    assert callbacks == []
    group_send.assert_not_awaited()
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
    assert response.json() == {
        "error": {
            "code": "csrf_failed",
            "message": "CSRF verification failed. Reload the page and try again.",
        }
    }


@pytest.mark.parametrize("csrf_case", ["malformed_header", "wrong_header"])
def test_anonymous_logout_rejects_invalid_csrf_header(csrf_case):
    client = csrf_client()
    token = client.cookies["csrftoken"].value
    invalid_token = (
        "invalid"
        if csrf_case == "malformed_header"
        else ("a" if token[0] != "a" else "b") + token[1:]
    )

    response = client.post(
        reverse("api:logout"),
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=invalid_token,
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json() == {
        "error": {
            "code": "csrf_failed",
            "message": "CSRF verification failed. Reload the page and try again.",
        }
    }
    assert SESSION_KEY not in client.session


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


@pytest.fixture
def group_send(monkeypatch):
    send = AsyncMock()
    monkeypatch.setattr(
        "apps.accounts.views.authentication.get_channel_layer",
        lambda: SimpleNamespace(group_send=send),
    )
    return send


def test_logout_schedules_session_event_only_after_commit(
    group_send, django_capture_on_commit_callbacks
):
    client = logged_in_client(create_user())
    key = client.cookies["sessionid"].value
    with django_capture_on_commit_callbacks() as callbacks:
        assert post_logout(client).status_code == 204
        group_send.assert_not_awaited()
        assert not Session.objects.filter(session_key=key).exists()
    assert len(callbacks) == 1
    callbacks[0]()
    group_send.assert_awaited_once_with(f"session_{key}", {"type": "session.ended", "data": {}})


@pytest.mark.django_db(transaction=True)
def test_rolled_back_logout_does_not_publish_event(group_send):
    Role.objects.get_or_create(name=Role.Name.STUDENT)
    client = logged_in_client(create_user())
    key = client.cookies["sessionid"].value
    with pytest.raises(RuntimeError, match="Roll back logout"):
        with transaction.atomic():
            assert post_logout(client).status_code == 204
            assert not Session.objects.filter(session_key=key).exists()
            group_send.assert_not_awaited()
            raise RuntimeError("Roll back logout")
    assert Session.objects.filter(session_key=key).exists()
    group_send.assert_not_awaited()


def test_anonymous_logout_does_not_schedule_event(group_send, django_capture_on_commit_callbacks):
    client = csrf_client()
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        assert post_logout(client).status_code == 204
    assert callbacks == []
    group_send.assert_not_awaited()


def test_csrf_rejection_does_not_schedule_event(group_send, django_capture_on_commit_callbacks):
    client = logged_in_client(create_user())
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        assert post_logout(client, csrf=False).status_code == 403
    assert callbacks == []
    group_send.assert_not_awaited()
