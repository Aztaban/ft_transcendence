"""Tests for retrieving the verified 42 account from `/v2/me`."""

import json
from urllib.error import HTTPError, URLError

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.views import (
    OAUTH_42_HTTP_TIMEOUT_SECONDS,
    OAUTH_42_ME_URL,
    OAUTH_42_STATE_SESSION_KEY,
    _retrieve_42_account_information,
)

pytestmark = pytest.mark.django_db
OAUTH_SETTINGS = {
    "FT_OAUTH_CLIENT_ID": "test-client-id",
    "FT_OAUTH_CLIENT_SECRET": "test-client-secret",
    "FT_OAUTH_REDIRECT_URI": "https://localhost/api/v1/auth/42/callback/",
}


class FakeProfileResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def read(self):
        return json.dumps(self.payload).encode()


def valid_profile(**overrides):
    profile = {
        "id": 4242,
        "login": "oauth-user",
        "email": "oauth-user@student.42.fr",
        "displayname": "OAuth User",
        "wallet": 42,
    }
    profile.update(overrides)
    return profile


def client_with_state(state="known-state"):
    client = APIClient()
    session = client.session
    session[OAUTH_42_STATE_SESSION_KEY] = state
    session.save()
    return client


def test_retrieve_42_account_information_uses_bearer_token_and_validates_payload(monkeypatch):
    captured = {}

    def fake_urlopen(request, timeout):
        captured["request"] = request
        captured["timeout"] = timeout
        return FakeProfileResponse(valid_profile())

    monkeypatch.setattr("apps.accounts.views.urlopen", fake_urlopen)

    account = _retrieve_42_account_information("secret-provider-token")

    assert account == {
        "intra_id": 4242,
        "intra_login": "oauth-user",
        "email": "oauth-user@student.42.fr",
    }
    assert captured["request"].full_url == OAUTH_42_ME_URL
    assert captured["request"].get_method() == "GET"
    assert captured["request"].get_header("Authorization") == "Bearer secret-provider-token"
    assert captured["request"].get_header("Accept") == "application/json"
    assert captured["timeout"] == OAUTH_42_HTTP_TIMEOUT_SECONDS


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"id": 4242, "login": "oauth-user"},
        valid_profile(id=0),
        valid_profile(login=""),
        valid_profile(email="not-an-email"),
        [valid_profile()],
    ],
)
def test_retrieve_42_account_information_rejects_invalid_profile(monkeypatch, payload):
    monkeypatch.setattr(
        "apps.accounts.views.urlopen",
        lambda request, timeout: FakeProfileResponse(payload),
    )

    assert _retrieve_42_account_information("secret-provider-token") is None


@pytest.mark.parametrize(
    "provider_failure",
    [
        HTTPError(OAUTH_42_ME_URL, 401, "Unauthorized", hdrs=None, fp=None),
        URLError("provider unavailable"),
        TimeoutError(),
    ],
)
def test_retrieve_42_account_information_handles_provider_failure(monkeypatch, provider_failure):
    def failing_urlopen(request, timeout):
        raise provider_failure

    monkeypatch.setattr("apps.accounts.views.urlopen", failing_urlopen)

    assert _retrieve_42_account_information("secret-provider-token") is None


def test_retrieve_42_account_information_rejects_malformed_json(monkeypatch):
    class InvalidJsonResponse(FakeProfileResponse):
        def read(self):
            return b"not-json"

    monkeypatch.setattr(
        "apps.accounts.views.urlopen",
        lambda request, timeout: InvalidJsonResponse({}),
    )

    assert _retrieve_42_account_information("secret-provider-token") is None


@override_settings(**OAUTH_SETTINGS)
def test_callback_retrieves_profile_and_creates_user(monkeypatch):
    monkeypatch.setattr(
        "apps.accounts.views._exchange_42_code_for_access_token",
        lambda code: "secret-provider-token",
    )
    monkeypatch.setattr(
        "apps.accounts.views._retrieve_42_account_information",
        lambda token: {
            "intra_id": 4242,
            "intra_login": "oauth-user",
            "email": "oauth-user@student.42.fr",
        },
    )
    client = client_with_state()

    response = client.get(
        reverse("api:oauth_42_callback"),
        {"code": "secret-authorization-code", "state": "known-state"},
        HTTP_HOST="localhost",
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["authenticated"] is True
    assert "secret-provider-token" not in response.content.decode()
    assert get_user_model().objects.count() == 1


@override_settings(**OAUTH_SETTINGS)
def test_callback_returns_bad_gateway_when_profile_retrieval_fails(monkeypatch):
    monkeypatch.setattr(
        "apps.accounts.views._exchange_42_code_for_access_token",
        lambda code: "secret-provider-token",
    )
    monkeypatch.setattr(
        "apps.accounts.views._retrieve_42_account_information",
        lambda token: None,
    )
    client = client_with_state()

    response = client.get(
        reverse("api:oauth_42_callback"),
        {"code": "secret-authorization-code", "state": "known-state"},
        HTTP_HOST="localhost",
    )

    assert response.status_code == status.HTTP_502_BAD_GATEWAY
    assert response.json()["error"]["code"] == "oauth_profile_retrieval_failed"
    assert "secret-provider-token" not in response.content.decode()
