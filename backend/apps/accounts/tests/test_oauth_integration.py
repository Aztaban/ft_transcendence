"""Full Django OAuth/session flow, mocking only the external provider HTTP calls.

Real browser/Nginx checks remain in docs/oauth-testing.md.
"""

import json
from urllib.parse import parse_qs, urlparse

import pytest
from django.contrib.auth import SESSION_KEY, get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.accounts.views import OAUTH_42_ME_URL, OAUTH_42_TOKEN_URL

pytestmark = pytest.mark.django_db


class ProviderResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return json.dumps(self.payload).encode()


@pytest.mark.parametrize("returning", [False, True], ids=["first_login", "returning_login"])
@override_settings(
    FT_OAUTH_CLIENT_ID="integration-client",
    FT_OAUTH_CLIENT_SECRET="integration-secret",
    FT_OAUTH_REDIRECT_URI="https://localhost/api/v1/auth/42/callback/",
)
def test_oauth_login_restores_session_and_logs_out_with_csrf(monkeypatch, returning):
    User = get_user_model()
    if returning:
        existing = User.objects.create_user(
            email="stored@example.com",
            display_name="Custom Name",
            intra_id=4242,
            intra_login="old-login",
        )
        existing.roles.add(Role.objects.get(name="tutor"))
    calls = []

    def provider(request, timeout):
        calls.append(request.full_url)
        assert request.get_header("User-agent") == "ft-transcendence/1.0"
        if request.full_url == OAUTH_42_TOKEN_URL:
            assert request.get_method() == "POST"
            assert parse_qs(request.data.decode()) == {
                "grant_type": ["authorization_code"],
                "client_id": ["integration-client"],
                "client_secret": ["integration-secret"],
                "code": ["integration-code"],
                "redirect_uri": ["https://localhost/api/v1/auth/42/callback/"],
            }
            return ProviderResponse({"access_token": "integration-token"})
        assert request.full_url == OAUTH_42_ME_URL
        assert request.get_header("Authorization") == "Bearer integration-token"
        return ProviderResponse({"id": 4242, "login": "current-login", "email": "42@example.com"})

    monkeypatch.setattr("apps.accounts.views.urlopen", provider)
    browser = APIClient(enforce_csrf_checks=True)
    redirect = browser.get(reverse("api:oauth_42_redirect"), secure=True, HTTP_HOST="localhost")
    assert redirect.status_code == 302
    state = parse_qs(urlparse(redirect["Location"]).query)["state"][0]
    callback = browser.get(
        reverse("api:oauth_42_callback"),
        {"state": state, "code": "integration-code"},
        secure=True,
        HTTP_HOST="localhost",
    )
    assert callback.status_code == 302
    assert callback["Location"] == "/"
    assert calls == [OAUTH_42_TOKEN_URL, OAUTH_42_ME_URL]
    user = User.objects.get(intra_id=4242)
    assert User.objects.count() == 1
    assert user.intra_login == "current-login"
    assert not user.has_usable_password()
    if returning:
        assert user.pk == existing.pk
        assert user.email == "stored@example.com"
        assert user.display_name == "Custom Name"
        assert list(user.roles.values_list("name", flat=True)) == ["student", "tutor"]
    else:
        assert user.email == "42@example.com"
        assert user.display_name == "current-login"
        assert list(user.roles.values_list("name", flat=True)) == ["student"]

    # A new client holding the session cookie simulates a browser reload.
    refreshed = APIClient(enforce_csrf_checks=True)
    refreshed.cookies["sessionid"] = browser.cookies["sessionid"].value
    session = refreshed.get(reverse("api:session"), secure=True, HTTP_HOST="localhost")
    assert session.status_code == 200
    assert session.json() == {
        "authenticated": True,
        "user": {
            "id": user.pk,
            "email": "stored@example.com" if returning else "42@example.com",
            "display_name": "Custom Name" if returning else "current-login",
        },
    }
    assert refreshed.session[SESSION_KEY] == str(user.pk)
    for secret in ("integration-token", "integration-code", "integration-secret"):
        assert secret not in callback["Location"]
        assert secret not in session.content.decode()
        assert secret not in str(dict(refreshed.session))

    denied = refreshed.post(reverse("api:logout"), secure=True, HTTP_HOST="localhost")
    assert denied.status_code == 403
    assert refreshed.session[SESSION_KEY] == str(user.pk)
    logout = refreshed.post(
        reverse("api:logout"),
        secure=True,
        HTTP_HOST="localhost",
        HTTP_ORIGIN="https://localhost",
        HTTP_X_CSRFTOKEN=refreshed.cookies["csrftoken"].value,
    )
    assert logout.status_code == 204
    assert logout.content == b""
    assert SESSION_KEY not in refreshed.session
    logged_out = refreshed.get(reverse("api:session"), secure=True, HTTP_HOST="localhost")
    assert logged_out.status_code == 200
    assert logged_out.json() == {"authenticated": False, "user": None}
    assert browser.get(reverse("api:me"), secure=True, HTTP_HOST="localhost").status_code == 401
