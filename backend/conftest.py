"""Fixtures shared by every backend test."""

import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def _fresh_rate_limits():
    """Rate limit counters live in the cache; one test's requests must not throttle the next."""
    cache.clear()
