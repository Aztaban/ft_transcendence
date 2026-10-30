"""Fixtures shared by every backend test."""

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache

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
