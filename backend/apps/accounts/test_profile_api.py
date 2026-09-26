import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

pytestmark = pytest.mark.django_db


def test_profile_requires_login(client):
    response = client.get(reverse("profile"))

    assert response.status_code == 403


def test_profile_returns_only_current_users_public_fields(client):
    user_model = get_user_model()
    user = user_model.objects.create_user(
        email="alice@example.com",
        password="secret",
        display_name="Alice",
    )
    user_model.objects.create_user(
        email="bob@example.com",
        password="secret",
        display_name="Bob",
    )

    client.force_login(user)
    response = client.get(reverse("profile"))

    assert response.status_code == 200
    assert response.json() == {
        "id": user.id,
        "email": "alice@example.com",
        "display_name": "Alice",
        "intra_login": None,
        "language": "en",
    }
