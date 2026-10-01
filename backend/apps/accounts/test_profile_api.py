import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

pytestmark = pytest.mark.django_db


def test_me_requires_authentication(client):
    response = client.get(reverse("api:me"))

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {
        "error": {
            "code": "not_authenticated",
            "message": "Authentication required.",
        }
    }


def test_me_returns_only_current_users_profile_fields(client):
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
    response = client.get(reverse("api:me"))

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "id": user.id,
        "email": "alice@example.com",
        "display_name": "Alice",
        "intra_login": None,
        "language": "en",
    }
