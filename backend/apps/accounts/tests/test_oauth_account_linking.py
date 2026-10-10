"""Tests for resolving verified 42 identities to local users during OAuth login."""

from urllib.parse import parse_qs, urlparse

import pytest
from django.contrib.auth import SESSION_KEY, get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.views import (
    OAUTH_42_ERROR_PATH,
    OAUTH_42_STATE_SESSION_KEY,
    OAUTH_42_SUCCESS_PATH,
)

pytestmark = pytest.mark.django_db
OAUTH_SETTINGS = {
    "FT_OAUTH_CLIENT_ID": "test-client-id",
    "FT_OAUTH_CLIENT_SECRET": "test-client-secret",
    "FT_OAUTH_REDIRECT_URI": "https://localhost/api/v1/auth/42/callback/",
}


def account_information(**overrides):
    account = {
        "intra_id": 4242,
        "intra_login": "oauth-user",
        "email": "oauth-user@student.42.fr",
    }
    account.update(overrides)
    return account


def client_with_state(client=None, state="known-state"):
    client = client or APIClient()
    session = client.session
    session[OAUTH_42_STATE_SESSION_KEY] = state
    session.save()
    return client


def mock_verified_42_identity(monkeypatch, account=None):
    monkeypatch.setattr(
        "apps.accounts.views._exchange_42_code_for_access_token",
        lambda code: "secret-provider-token",
    )
    monkeypatch.setattr(
        "apps.accounts.views._retrieve_42_account_information",
        lambda token: account or account_information(),
    )


def callback(client, state="known-state"):
    return client.get(
        reverse("api:oauth_42_callback"),
        {"code": "secret-authorization-code", "state": state},
        HTTP_HOST="localhost",
    )


def assert_frontend_redirect(response, path, error_code=None):
    assert response.status_code == status.HTTP_302_FOUND
    location = urlparse(response["Location"])
    assert location.path == path
    query = parse_qs(location.query)
    if error_code is None:
        assert query == {}
    else:
        assert query == {"oauth": [error_code]}


@override_settings(**OAUTH_SETTINGS)
def test_first_oauth_login_creates_local_user_with_unusable_password(monkeypatch):
    mock_verified_42_identity(monkeypatch)
    client = client_with_state()

    response = callback(client)

    assert_frontend_redirect(response, OAUTH_42_SUCCESS_PATH)
    user = get_user_model().objects.get()
    assert user.email == "oauth-user@student.42.fr"
    assert user.display_name == "oauth-user"
    assert user.intra_id == 4242
    assert user.intra_login == "oauth-user"
    assert user.has_usable_password() is False
    assert user.is_active is True
    assert list(user.roles.values_list("name", flat=True)) == ["student"]
    assert client.session[SESSION_KEY] == str(user.pk)


@override_settings(**OAUTH_SETTINGS)
def test_repeat_oauth_login_reuses_user_by_intra_id(monkeypatch):
    user = get_user_model().objects.create_user(
        email="stored@example.com",
        password=None,
        display_name="Custom Display Name",
        intra_id=4242,
        intra_login="old-login",
    )
    mock_verified_42_identity(
        monkeypatch,
        account_information(
            intra_login="current-login",
            email="changed@student.42.fr",
        ),
    )
    client = client_with_state()

    response = callback(client)

    assert_frontend_redirect(response, OAUTH_42_SUCCESS_PATH)
    assert get_user_model().objects.count() == 1
    user.refresh_from_db()
    assert user.email == "stored@example.com"
    assert user.display_name == "Custom Display Name"
    assert user.intra_login == "current-login"
    assert client.session[SESSION_KEY] == str(user.pk)


@override_settings(**OAUTH_SETTINGS)
def test_oauth_login_rejects_existing_unlinked_email(monkeypatch):
    existing = get_user_model().objects.create_user(
        email="oauth-user@student.42.fr",
        password="local-password",
        display_name="Existing User",
    )
    mock_verified_42_identity(monkeypatch)
    client = client_with_state()

    response = callback(client)

    assert_frontend_redirect(response, OAUTH_42_ERROR_PATH, "oauth_account_exists")
    existing.refresh_from_db()
    assert existing.intra_id is None
    assert existing.intra_login is None
    assert SESSION_KEY not in client.session
    assert get_user_model().objects.count() == 1


@override_settings(**OAUTH_SETTINGS)
def test_authenticated_password_user_is_not_linked_by_oauth_login(monkeypatch):
    local_user = get_user_model().objects.create_user(
        email="local@example.com",
        password="local-password",
        display_name="Local Display Name",
    )
    client = APIClient()
    client.force_login(local_user)
    client = client_with_state(client)
    mock_verified_42_identity(monkeypatch)

    response = callback(client)

    assert_frontend_redirect(response, OAUTH_42_SUCCESS_PATH)
    local_user.refresh_from_db()
    assert local_user.intra_id is None
    assert local_user.intra_login is None
    oauth_user = get_user_model().objects.get(intra_id=4242)
    assert oauth_user.pk != local_user.pk
    assert client.session[SESSION_KEY] == str(oauth_user.pk)


@override_settings(**OAUTH_SETTINGS)
def test_authenticated_user_with_same_email_is_not_auto_linked(monkeypatch):
    local_user = get_user_model().objects.create_user(
        email="oauth-user@student.42.fr",
        password="local-password",
        display_name="Existing User",
    )
    client = APIClient()
    client.force_login(local_user)
    client = client_with_state(client)
    mock_verified_42_identity(monkeypatch)

    response = callback(client)

    assert_frontend_redirect(response, OAUTH_42_ERROR_PATH, "oauth_account_exists")
    local_user.refresh_from_db()
    assert local_user.intra_id is None
    assert local_user.intra_login is None
    assert client.session[SESSION_KEY] == str(local_user.pk)
    assert get_user_model().objects.count() == 1


@override_settings(**OAUTH_SETTINGS)
def test_suspended_oauth_user_cannot_login(monkeypatch):
    user_model = get_user_model()
    user_model.objects.create_user(
        email="oauth-user@student.42.fr",
        password=None,
        display_name="OAuth User",
        intra_id=4242,
        intra_login="oauth-user",
        status=user_model.Status.SUSPENDED,
    )
    mock_verified_42_identity(monkeypatch)
    client = client_with_state()

    response = callback(client)

    assert_frontend_redirect(response, OAUTH_42_ERROR_PATH, "oauth_account_suspended")
    assert SESSION_KEY not in client.session
