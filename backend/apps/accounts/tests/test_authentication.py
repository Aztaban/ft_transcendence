"""Authentication middleware integration tests using the disposable MySQL test DB."""

import base64

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.test import APIClient
from rest_framework.views import APIView

pytestmark = pytest.mark.django_db
PASSWORD = "AuthenticationMiddleware123!"


def test_session_middleware_precedes_authentication_middleware():
    session_middleware = "django.contrib.sessions.middleware.SessionMiddleware"
    authentication_middleware = "django.contrib.auth.middleware.AuthenticationMiddleware"

    assert session_middleware in settings.MIDDLEWARE
    assert authentication_middleware in settings.MIDDLEWARE
    assert settings.MIDDLEWARE.index(session_middleware) < settings.MIDDLEWARE.index(
        authentication_middleware
    )


def test_drf_defaults_to_session_authentication_only():
    authenticators = APIView().get_authenticators()

    assert len(authenticators) == 1
    assert isinstance(authenticators[0], SessionAuthentication)


def test_authentication_middleware_restores_user_from_django_session():
    user = get_user_model().objects.create_user(
        email="middleware@example.com",
        display_name="middleware-user",
        password=PASSWORD,
    )
    client = APIClient()
    client.force_login(user)

    response = client.get(reverse("api:session"), HTTP_HOST="localhost")

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["user"]["id"] == user.pk
    assert response.wsgi_request.user == user


def test_request_without_session_remains_anonymous():
    client = APIClient()

    response = client.get(reverse("api:session"), HTTP_HOST="localhost")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.wsgi_request.user.is_anonymous


def test_basic_auth_header_is_not_accepted():
    user = get_user_model().objects.create_user(
        email="basic@example.com",
        display_name="basic-user",
        password=PASSWORD,
    )
    credentials = base64.b64encode(f"{user.email}:{PASSWORD}".encode()).decode()
    client = APIClient()

    response = client.get(
        reverse("api:session"),
        HTTP_HOST="localhost",
        HTTP_AUTHORIZATION=f"Basic {credentials}",
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.wsgi_request.user.is_anonymous
