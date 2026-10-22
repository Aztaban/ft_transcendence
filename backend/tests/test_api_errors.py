"""Unknown API paths and unsupported formats answer in the error envelope (api-plan §5.5, §5.6)."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db

NOT_FOUND = {"error": {"code": "not_found", "message": "Not found."}}


@pytest.mark.parametrize("method", ["get", "post", "patch", "delete"])
def test_unknown_api_path_is_a_json_404(method):
    response = getattr(APIClient(), method)("/api/v1/nope/", {}, format="json")

    assert response.status_code == 404
    assert response["Content-Type"].startswith("application/json")
    assert response.json() == NOT_FOUND


@pytest.mark.parametrize("path", ["/api/", "/api/v2/users/me/", "/api/v1/users/me"])
def test_every_unknown_path_under_api_is_covered(path):
    assert APIClient().get(path).json() == NOT_FOUND


def test_unknown_path_is_404_also_when_debug_is_on(settings):
    settings.DEBUG = True

    response = APIClient().get("/api/v1/nope/")

    assert response.status_code == 404
    assert response.json() == NOT_FOUND


def test_html_is_never_served_by_the_api():
    client = APIClient()
    client.force_authenticate(
        get_user_model().objects.create_user(email="html@example.com", display_name="HTML")
    )

    response = client.get("/api/v1/users/me/", HTTP_ACCEPT="text/html")

    assert response.status_code == 406
    assert response.json() == {
        "error": {
            "code": "not_acceptable",
            "message": "The requested response format is not available.",
        }
    }
