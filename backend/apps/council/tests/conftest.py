"""Fixtures shared by the council tests."""

import pytest

from apps.accounts.models import Role


@pytest.fixture
def council(api_client, make_user):
    """An API client logged in as an SC Member."""
    api_client.force_authenticate(
        user=make_user("council@example.com", roles=(Role.Name.SC_MEMBER,))
    )
    return api_client
