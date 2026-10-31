"""Fixtures shared by every backend test."""

from datetime import datetime, timezone
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
def admin_user_directory(make_user, make_session_client, monkeypatch):
    """An Admin session and a target with stable timestamps for whole-body assertions."""
    now = datetime(2026, 10, 31, 10, 0, tzinfo=timezone.utc)
    monkeypatch.setattr("django.utils.timezone.now", lambda: now)
    admin = make_user(
        "admin@example.com", display_name="Zed", roles=(Role.Name.ADMIN,), language="en"
    )
    target = make_user(
        "alice@example.com", display_name="Alice", intra_login="alice42", language="en"
    )
    client = make_session_client(admin)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    return client, admin, target


@pytest.fixture
def admin_user_bodies(admin_user_directory):
    """Literal contract examples, independent of serializers and database timestamps."""
    _, admin, target = admin_user_directory
    return {
        "target": {
            "id": target.pk,
            "email": "alice@example.com",
            "display_name": "Alice",
            "avatar_url": None,
            "language": "en",
            "intra_login": "alice42",
            "roles": [{"id": Role.objects.get(name="student").pk, "name": "student"}],
            "status": "active",
            "created_at": "2026-10-31T10:00:00Z",
            "last_login": None,
        },
        "admin": {
            "id": admin.pk,
            "email": "admin@example.com",
            "display_name": "Zed",
            "avatar_url": None,
            "language": "en",
            "intra_login": None,
            "roles": [{"id": Role.objects.get(name="admin").pk, "name": "admin"}],
            "status": "active",
            "created_at": "2026-10-31T10:00:00Z",
            "last_login": "2026-10-31T10:00:00Z",
        },
    }


@pytest.fixture
def user_event_sender(monkeypatch):
    """Capture user-group delivery without depending on Redis."""
    sender = AsyncMock()
    monkeypatch.setattr(
        "apps.core.events.get_channel_layer", lambda: SimpleNamespace(group_send=sender)
    )
    return sender
