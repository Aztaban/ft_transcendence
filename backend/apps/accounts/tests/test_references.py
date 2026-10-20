"""The shared UserRef representation exposes only api-plan §8.1 fields."""

import pytest
from django.contrib.auth import get_user_model

from apps.accounts.references import UserRefSerializer


def test_user_reference_without_avatar_has_exact_public_fields():
    user = get_user_model()(
        id=42, display_name="Alice", email="private@example.com", intra_login="private-login"
    )

    assert UserRefSerializer(user).data == {"id": 42, "display_name": "Alice", "avatar_url": None}


@pytest.mark.parametrize("avatar_url", [None, "/api/v1/files/9/download/"])
def test_user_reference_preserves_nullable_relative_avatar_url(avatar_url):
    user = {
        "id": 42,
        "display_name": "Alice",
        "avatar_url": avatar_url,
        "email": "private@example.com",
        "intra_login": "private-login",
    }

    assert UserRefSerializer(user).data == {
        "id": 42,
        "display_name": "Alice",
        "avatar_url": avatar_url,
    }
