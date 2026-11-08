"""The shared UserRef representation exposes only api-plan §8.1 fields."""

from django.contrib.auth import get_user_model

from apps.accounts.references import UserRefSerializer


def test_user_reference_without_avatar_has_exact_public_fields():
    user = get_user_model()(
        id=42, display_name="Alice", email="private@example.com", intra_login="private-login"
    )

    assert UserRefSerializer(user).data == {"id": 42, "display_name": "Alice", "avatar_url": None}


def test_user_reference_exposes_only_its_public_fields():
    user = {
        "id": 42,
        "display_name": "Alice",
        "avatar_url": None,
        "email": "private@example.com",
        "intra_login": "private-login",
    }

    assert UserRefSerializer(user).data == {
        "id": 42,
        "display_name": "Alice",
        "avatar_url": None,
    }
