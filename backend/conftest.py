"""Fixtures shared by every backend test."""

import pytest
from django.core.cache import cache

from apps.evaluations.models import Project


@pytest.fixture
def empty_project_catalog(db):
    """Opt-in isolation for tests that define their own projects instead of migration seeds."""
    Project.objects.all().delete()


@pytest.fixture(autouse=True)
def _fresh_rate_limits():
    """Rate limit counters live in the cache; one test's requests must not throttle the next."""
    cache.clear()
