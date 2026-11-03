"""POST /api/v1/sc-messages/: send an anonymous message (api-plan §10.6, §5.9)."""

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.fields import DateTimeField
from rest_framework.test import APIClient

from apps.council.models import SCMessage

pytestmark = pytest.mark.django_db

PASSWORD = "secret"
SEND = "api:sc-message-list"
INVALID = "Please correct the highlighted fields."


@pytest.fixture
def api_client():
    return APIClient()


def iso(dt):
    return DateTimeField().to_representation(dt)


def send(client, body):
    return client.post(reverse(SEND), {"body": body}, format="json")


def test_send_returns_only_the_id_and_time_and_stores_the_sender(api_client, make_user):
    anna = make_user("anna@example.com")
    api_client.force_authenticate(user=anna)

    response = send(api_client, "  The fridge is broken again.  ")

    message = SCMessage.objects.get()
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json() == {"id": message.id, "created_at": iso(message.created_at)}
    assert message.sender_id == anna.id
    assert message.body == "The fridge is broken again."
    assert message.read_at is None


def test_send_needs_a_session(api_client):
    response = send(api_client, "The fridge is broken again.")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }
    assert SCMessage.objects.count() == 0


@pytest.mark.parametrize(
    ("data", "field_error"),
    [
        ({}, "This field is required."),
        ({"body": ""}, "This field may not be blank."),
        ({"body": "   "}, "This field may not be blank."),
        ({"body": "x" * 5001}, "Ensure this field has no more than 5000 characters."),
    ],
    ids=["missing", "empty", "only-spaces", "too-long"],
)
def test_send_rejects_an_invalid_body(api_client, make_user, data, field_error):
    api_client.force_authenticate(user=make_user("anna@example.com"))

    response = api_client.post(reverse(SEND), data, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": INVALID,
            "fields": {"body": [field_error]},
        }
    }
    assert SCMessage.objects.count() == 0


def test_send_accepts_the_longest_allowed_body(api_client, make_user):
    api_client.force_authenticate(user=make_user("anna@example.com"))

    response = send(api_client, "x" * 5000)

    assert response.status_code == status.HTTP_201_CREATED


def test_send_is_limited_to_ten_per_hour_per_user(api_client, make_user):
    anna = make_user("anna@example.com")
    api_client.force_authenticate(user=anna)

    for number in range(10):
        assert send(api_client, f"Message {number}").status_code == status.HTTP_201_CREATED
    eleventh = send(api_client, "One too many")

    assert eleventh.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert eleventh.json() == {
        "error": {"code": "throttled", "message": "Too many requests. Try again later."}
    }
    assert "Retry-After" in eleventh.headers
    assert SCMessage.objects.count() == 10

    # The limit is per user: someone else can still send.
    api_client.force_authenticate(user=make_user("ben@example.com"))
    assert send(api_client, "My first message").status_code == status.HTTP_201_CREATED


def test_send_through_session_needs_csrf(make_user):
    anna = make_user("anna@example.com")
    browser = APIClient(enforce_csrf_checks=True)
    browser.get(reverse("api:session"), HTTP_HOST="localhost")
    login = browser.post(
        reverse("api:login"),
        {"email": anna.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
    )
    assert login.status_code == status.HTTP_200_OK

    without = browser.post(reverse(SEND), {"body": "Hello"}, format="json", HTTP_HOST="localhost")
    with_token = browser.post(
        reverse(SEND),
        {"body": "Hello"},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
    )

    assert without.status_code == status.HTTP_403_FORBIDDEN
    assert without.json()["error"]["code"] == "csrf_failed"
    assert with_token.status_code == status.HTTP_201_CREATED
    assert SCMessage.objects.get().sender_id == anna.id
