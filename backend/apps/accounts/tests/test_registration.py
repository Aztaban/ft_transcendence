"""API tests for user registration (isolated MySQL test database)."""

import pytest
from django.contrib.auth import SESSION_KEY, get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def test_register_creates_active_user_without_logging_in():
    client = APIClient()
    response = client.post(
        reverse("api:register"),
        {
            "email": "Issue118@Example.COM",
            "display_name": "issue118user",
            "password": "TemporaryPassword123!",
        },
        format="json",
        HTTP_HOST="localhost",
    )

    assert response.status_code == status.HTTP_201_CREATED

    user = get_user_model().objects.get(email="issue118@example.com")
    assert response.json() == {
        "id": user.id,
        "email": "issue118@example.com",
        "display_name": "issue118user",
        "message": "Account created successfully.",
    }
    assert user.display_name == "issue118user"
    assert user.status == get_user_model().Status.ACTIVE
    assert user.intra_login is None
    assert "password" not in response.json()
    assert SESSION_KEY not in client.session


def test_register_endpoint_rejects_get():
    client = APIClient()
    response = client.get(reverse("api:register"), HTTP_HOST="localhost")

    assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
