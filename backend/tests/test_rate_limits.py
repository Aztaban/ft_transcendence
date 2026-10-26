"""Rate limits."""

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework.throttling import UserRateThrottle

pytestmark = pytest.mark.django_db

THROTTLED = {"error": {"code": "throttled", "message": "Too many requests. Try again later."}}
LOGIN = {"email": "nobody@example.com", "password": "WrongPassword123!"}


def post_login(client, forwarded_for=None):
    extra = {"HTTP_X_FORWARDED_FOR": forwarded_for} if forwarded_for else {}
    return client.post(reverse("api:login"), LOGIN, format="json", **extra)


def assert_throttled(response):
    assert response.status_code == 429
    assert response.json() == THROTTLED
    assert 1 <= int(response["Retry-After"]) <= 60


def test_rates_match_the_contract():
    assert settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] == {
        "user": "1000/hour",
        "auth": "10/minute",
        "people_search": "60/minute",
        "sc_message_send": "10/hour",
    }


def test_login_allows_10_attempts_per_minute():
    client = APIClient()
    for _ in range(10):
        assert post_login(client).status_code == 401

    assert_throttled(post_login(client))


def test_register_allows_10_attempts_per_minute():
    client = APIClient()
    for _ in range(10):
        assert client.post(reverse("api:register"), {}, format="json").status_code == 400

    assert_throttled(client.post(reverse("api:register"), {}, format="json"))


def test_login_and_register_share_the_limit():
    client = APIClient()
    for _ in range(10):
        post_login(client)

    assert_throttled(client.post(reverse("api:register"), {}, format="json"))


def test_the_limit_is_per_client_ip_behind_nginx():
    client = APIClient()
    for _ in range(10):
        post_login(client, forwarded_for="203.0.113.5")

    assert_throttled(post_login(client, forwarded_for="203.0.113.5"))
    assert post_login(client, forwarded_for="203.0.113.6").status_code == 401


def test_a_forged_forwarded_for_does_not_reset_the_limit():
    # Nginx appends the real client address, so only the last entry counts.
    client = APIClient()
    for i in range(10):
        post_login(client, forwarded_for=f"198.51.100.{i}, 203.0.113.5")

    assert_throttled(post_login(client, forwarded_for="198.51.100.99, 203.0.113.5"))


def test_other_endpoints_are_limited_per_user(monkeypatch):
    monkeypatch.setattr(UserRateThrottle, "THROTTLE_RATES", {"user": "2/hour"})
    User = get_user_model()
    alice = User.objects.create_user(email="alice@example.com", display_name="Alice")
    bob = User.objects.create_user(email="bob@example.com", display_name="Bob")
    client = APIClient()

    client.force_authenticate(alice)
    assert client.get(reverse("api:me")).status_code == 200
    assert client.get(reverse("api:me")).status_code == 200
    response = client.get(reverse("api:me"))
    assert response.status_code == 429
    assert response.json() == THROTTLED

    client.force_authenticate(bob)
    assert client.get(reverse("api:me")).status_code == 200
