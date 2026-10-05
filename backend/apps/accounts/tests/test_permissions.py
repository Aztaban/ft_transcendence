"""Default API permission-policy tests."""

from types import SimpleNamespace

from django.urls import reverse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework.views import APIView


def test_drf_defaults_to_is_authenticated():
    permissions = APIView().get_permissions()

    assert len(permissions) == 1
    assert isinstance(permissions[0], IsAuthenticated)


def test_default_permission_denies_anonymous_and_allows_authenticated_user():
    permission = APIView().get_permissions()[0]
    view = APIView()
    request = APIRequestFactory().get("/private/")

    request.user = SimpleNamespace(is_authenticated=False)
    assert permission.has_permission(request, view) is False

    request.user = SimpleNamespace(is_authenticated=True)
    assert permission.has_permission(request, view) is True


def test_api_root_remains_public():
    client = APIClient()

    response = client.get(reverse("api:root"), HTTP_HOST="localhost")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ok", "version": "v1"}
    assert "csrftoken" in response.cookies


def test_api_schema_and_docs_remain_public():
    client = APIClient()

    schema_response = client.get(reverse("schema"), HTTP_HOST="localhost")
    docs_response = client.get(reverse("swagger-ui"), HTTP_HOST="localhost")

    assert schema_response.status_code == status.HTTP_200_OK
    assert docs_response.status_code == status.HTTP_200_OK
