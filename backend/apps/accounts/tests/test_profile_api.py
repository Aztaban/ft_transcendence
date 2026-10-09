"""API tests for GET /api/v1/users/me/ (isolated MySQL test database)."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

from apps.accounts.models import Role

pytestmark = pytest.mark.django_db

PROFILE_FIELDS = {
    "id",
    "email",
    "display_name",
    "avatar_url",
    "language",
    "roles",
    "intra_login",
}

LANGUAGES = ("en", "cs", "es")


def _create_user(**overrides):
    defaults = {
        "email": "user@example.com",
        "password": "secret",
        "display_name": "User",
    }
    defaults.update(overrides)
    return get_user_model().objects.create_user(**defaults)


def expected_profile(user):
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": None,
        "language": user.language,
        "roles": [{"id": Role.objects.get(name="student").id, "name": "student"}],
        "intra_login": user.intra_login,
    }


def assert_me_ok(client, user):
    """Assert GET /users/me/ returns 200 and the full profile contract body."""
    response = client.get(reverse("api:me"))
    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    assert payload == expected_profile(user)
    assert set(payload.keys()) == PROFILE_FIELDS
    return payload


def test_me_requires_authentication(client):
    response = client.get(reverse("api:me"))

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {
        "error": {
            "code": "not_authenticated",
            "message": "Authentication required.",
        }
    }


def test_me_returns_200_and_full_profile_body(client):
    user = _create_user(
        email="alice@example.com",
        display_name="Alice",
        language="cs",
        intra_login="alice42",
    )

    client.force_login(user)
    assert_me_ok(client, user)


def test_me_returns_current_user_among_many(client):
    """Create several users; spot-check first/middle/last are not confused with others."""
    users = [
        _create_user(
            email=f"user{i}@example.com",
            display_name=f"User{i}",
            language=LANGUAGES[i % len(LANGUAGES)],
            intra_login=f"login{i}" if i % 2 == 0 else None,
        )
        for i in range(8)
    ]
    # Pseudo-random sample: first, middle, last in creation order.
    sample = (users[0], users[3], users[7])

    for user in sample:
        client.force_login(user)
        payload = assert_me_ok(client, user)
        # Explicitly guard against returning another row from the same set.
        assert payload["id"] not in {other.id for other in users if other.id != user.id}


def test_me_returns_stored_language_not_serializer_default(client):
    user = _create_user(
        email="cs-user@example.com",
        display_name="Czech User",
        language="cs",
    )

    client.force_login(user)
    payload = assert_me_ok(client, user)

    assert payload["language"] == "cs"
    assert payload["language"] != "en"


def test_me_exposes_intra_login_when_linked(client):
    user = _create_user(
        email="anne@example.com",
        display_name="Anne",
        intra_login="adoe",
    )

    client.force_login(user)
    payload = assert_me_ok(client, user)

    assert payload["intra_login"] == "adoe"


@pytest.mark.parametrize("language", ["en", "cs", "es"])
def test_me_returns_configured_language(client, language):
    user = _create_user(
        email=f"user-{language}@example.com",
        display_name=f"User {language}",
        language=language,
    )

    client.force_login(user)
    payload = assert_me_ok(client, user)

    assert payload["language"] == language


@pytest.mark.parametrize("method", ["post", "put", "delete"])
def test_me_rejects_unsupported_methods(client, method):
    user = _create_user(
        email=f"methods-{method}@example.com",
        display_name="Methods",
    )
    client.force_login(user)

    response = getattr(client, method)(reverse("api:me"))

    assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
