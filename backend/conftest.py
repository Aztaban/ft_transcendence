"""Fixtures shared across apps. One app's fixtures live in its tests/conftest.py."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.evaluations.models import Project


@pytest.fixture
def empty_project_catalog(db):
    """Opt-in isolation for tests that define their own projects instead of migration seeds."""
    Project.objects.all().delete()


@pytest.fixture(autouse=True)
def _fresh_rate_limits():
    """Rate limit counters live in the cache; one test's requests must not throttle the next."""
    cache.clear()


@pytest.fixture
def make_user():
    """Create a user with the password "secret". `roles`, when given, replace the default role."""

    def _make(email, display_name=None, roles=(), **extra):
        user = get_user_model().objects.create_user(
            email=email,
            password="secret",
            display_name=display_name or email.split("@")[0],
            **extra,
        )
        if roles:
            user.roles.set(Role.objects.filter(name__in=roles))
        return user

    return _make


@pytest.fixture
def make_session_client():
    """A password-authenticated session for users created by ``make_user``."""

    def _client(user):
        client = APIClient(enforce_csrf_checks=True)
        assert client.login(email=user.email, password="secret")
        return client

    return _client


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def api_login():
    """Log in through the login endpoint with CSRF enforced; the client keeps its CSRF cookie."""

    def _login(user, password="secret"):
        client = APIClient(enforce_csrf_checks=True)
        client.get(reverse("api:session"), HTTP_HOST="localhost")
        response = client.post(
            reverse("api:login"),
            {"email": user.email, "password": password},
            format="json",
            HTTP_HOST="localhost",
            HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
        )
        assert response.status_code == 200
        return client

    return _login


@pytest.fixture
def seeded_roles():
    for name in Role.Name.values:
        Role.objects.get_or_create(name=name)


@pytest.fixture
def user_event_sender(monkeypatch):
    """Capture user-group delivery without depending on Redis."""
    sender = AsyncMock()
    monkeypatch.setattr(
        "apps.core.events.get_channel_layer", lambda: SimpleNamespace(group_send=sender)
    )
    return sender
