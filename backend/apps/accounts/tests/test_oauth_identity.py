"""Tests for persisting verified 42 identity data on local users."""

import pytest
from django.contrib.auth import get_user_model

from apps.accounts.serializers import OAuth42IdentitySerializer

pytestmark = pytest.mark.django_db


def create_user(email="local@example.com", display_name="Local User"):
    return get_user_model().objects.create_user(
        email=email,
        password="local-password",
        display_name=display_name,
    )


def test_oauth_identity_serializer_stores_verified_identifiers():
    user = create_user()
    serializer = OAuth42IdentitySerializer(
        user,
        data={
            "intra_id": 4242,
            "intra_login": "oauth-user",
        },
    )

    assert serializer.is_valid(), serializer.errors
    saved_user = serializer.save()
    saved_user.refresh_from_db()

    assert saved_user.intra_id == 4242
    assert saved_user.intra_login == "oauth-user"
    assert saved_user.email == "local@example.com"
    assert saved_user.display_name == "Local User"


def test_oauth_identity_serializer_rejects_non_positive_intra_id():
    user = create_user()
    serializer = OAuth42IdentitySerializer(
        user,
        data={
            "intra_id": 0,
            "intra_login": "oauth-user",
        },
    )

    assert serializer.is_valid() is False
    assert "intra_id" in serializer.errors


def test_oauth_identity_serializer_rejects_blank_intra_login():
    user = create_user()
    serializer = OAuth42IdentitySerializer(
        user,
        data={
            "intra_id": 4242,
            "intra_login": "",
        },
    )

    assert serializer.is_valid() is False
    assert "intra_login" in serializer.errors


def test_oauth_identity_serializer_rejects_duplicate_intra_id():
    first_user = create_user("first@example.com", "First")
    first_user.intra_id = 4242
    first_user.intra_login = "first42"
    first_user.save(update_fields=["intra_id", "intra_login"])
    second_user = create_user("second@example.com", "Second")

    serializer = OAuth42IdentitySerializer(
        second_user,
        data={
            "intra_id": 4242,
            "intra_login": "second42",
        },
    )

    assert serializer.is_valid() is False
    assert "intra_id" in serializer.errors


def test_oauth_identity_serializer_rejects_duplicate_intra_login():
    first_user = create_user("first@example.com", "First")
    first_user.intra_id = 4242
    first_user.intra_login = "shared42"
    first_user.save(update_fields=["intra_id", "intra_login"])
    second_user = create_user("second@example.com", "Second")

    serializer = OAuth42IdentitySerializer(
        second_user,
        data={
            "intra_id": 4343,
            "intra_login": "shared42",
        },
    )

    assert serializer.is_valid() is False
    assert "intra_login" in serializer.errors
