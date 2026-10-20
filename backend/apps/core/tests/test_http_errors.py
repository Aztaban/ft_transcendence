"""HTTP negotiation and parsing errors use api-plan §5.5–§5.6 envelopes."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from apps.evaluations.models import EvaluationRequest

pytestmark = pytest.mark.django_db


@pytest.fixture
def authenticated_client():
    get_user_model().objects.create_user(
        email="http-errors@example.com",
        display_name="HTTP errors",
        password="HttpErrorPassword123!",
    )
    client = APIClient(enforce_csrf_checks=True)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    response = client.post(
        reverse("api:login"),
        {"email": "http-errors@example.com", "password": "HttpErrorPassword123!"},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    return client


def test_unsupported_accept_returns_not_acceptable(authenticated_client):
    response = authenticated_client.get(
        reverse("api:project-list"), HTTP_HOST="localhost", HTTP_ACCEPT="application/xml"
    )

    assert response.status_code == 406
    assert response.json() == {
        "error": {
            "code": "not_acceptable",
            "message": "The requested response format is not available.",
        }
    }


@pytest.mark.parametrize("content_type", ["text/plain", "application/xml"])
def test_unsupported_content_type_returns_415(authenticated_client, content_type):
    response = authenticated_client.post(
        reverse("api:evaluation-request-list"),
        data="{}",
        content_type=content_type,
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=authenticated_client.cookies["csrftoken"].value,
    )

    assert response.status_code == 415
    assert response.json() == {
        "error": {"code": "unsupported_media_type", "message": "Unsupported media type."}
    }
    assert EvaluationRequest.objects.count() == 0


def test_malformed_json_returns_validation_error(authenticated_client):
    response = authenticated_client.post(
        reverse("api:evaluation-request-list"),
        data="{",
        content_type="application/json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=authenticated_client.cookies["csrftoken"].value,
    )

    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {
                "non_field_errors": [
                    "JSON parse error - Expecting property name enclosed in double quotes: "
                    "line 1 column 2 (char 1)"
                ]
            },
        }
    }
    assert EvaluationRequest.objects.count() == 0
