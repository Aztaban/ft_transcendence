"""API tests for user registration (isolated MySQL test database)."""

import pytest
from django.contrib.auth import SESSION_KEY, get_user_model
from django.contrib.auth.hashers import identify_hasher
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def registration_payload(**overrides):
    payload = {
        "email": "student@example.com",
        "display_name": "student",
        "password": "TemporaryPassword123!",
    }
    payload.update(overrides)
    return payload


def assert_validation_error(response, field):
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["message"] == "Please correct the registration fields."
    assert field in body["error"]["fields"]


def test_register_creates_active_user_without_logging_in():
    client = APIClient(enforce_csrf_checks=True)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    response = client.post(
        reverse("api:register"),
        {
            "email": "Issue118@Example.COM",
            "display_name": "issue118user",
            "password": "TemporaryPassword123!",
        },
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
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
    assert list(user.roles.values_list("name", flat=True)) == ["student"]
    assert user.intra_login is None
    assert "password" not in response.json()
    assert SESSION_KEY not in client.session


@pytest.mark.parametrize(
    "csrf_case",
    ["no_cookie", "header_without_cookie", "no_header", "malformed_header", "wrong_header"],
)
def test_anonymous_registration_requires_valid_csrf(csrf_case):
    client = APIClient(enforce_csrf_checks=True)
    headers = {"HTTP_HOST": "localhost"}
    if csrf_case not in ("no_cookie", "header_without_cookie"):
        client.get(reverse("api:session"), HTTP_HOST="localhost")
    if csrf_case == "header_without_cookie":
        headers["HTTP_X_CSRFTOKEN"] = "a" * 32
    elif csrf_case == "malformed_header":
        headers["HTTP_X_CSRFTOKEN"] = "invalid"
    elif csrf_case == "wrong_header":
        token = client.cookies["csrftoken"].value
        headers["HTTP_X_CSRFTOKEN"] = ("a" if token[0] != "a" else "b") + token[1:]

    response = client.post(
        reverse("api:register"), registration_payload(), format="json", **headers
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json() == {
        "error": {
            "code": "csrf_failed",
            "message": "CSRF verification failed. Reload the page and try again.",
        }
    }
    assert get_user_model().objects.count() == 0
    assert SESSION_KEY not in client.session


def test_registration_with_csrf_preserves_existing_login_session():
    existing_user = get_user_model().objects.create_user(
        email="existing@example.com",
        display_name="existing-user",
        password="ExistingPassword123!",
    )
    client = APIClient(enforce_csrf_checks=True)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    login_response = client.post(
        reverse("api:login"),
        {"email": "existing@example.com", "password": "ExistingPassword123!"},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert login_response.status_code == status.HTTP_200_OK

    response = client.post(
        reverse("api:register"),
        registration_payload(),
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )

    created_user = get_user_model().objects.get(email="student@example.com")
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json() == {
        "id": created_user.pk,
        "email": "student@example.com",
        "display_name": "student",
        "message": "Account created successfully.",
    }
    assert list(created_user.roles.values_list("name", flat=True)) == ["student"]
    assert client.session[SESSION_KEY] == str(existing_user.pk)


def test_register_hashes_password_with_argon2():
    password = "SecureRegistrationPassword123!"
    client = APIClient()

    response = client.post(
        reverse("api:register"),
        registration_payload(
            email="argon2@example.com",
            display_name="argon2-user",
            password=password,
        ),
        format="json",
        HTTP_HOST="localhost",
    )

    assert response.status_code == status.HTTP_201_CREATED

    user = get_user_model().objects.get(email="argon2@example.com")
    assert user.password != password
    assert user.check_password(password) is True
    assert user.check_password("WrongPassword123!") is False
    assert identify_hasher(user.password).algorithm == "argon2"


def test_register_endpoint_rejects_get():
    client = APIClient()
    response = client.get(reverse("api:register"), HTTP_HOST="localhost")

    assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


@pytest.mark.parametrize("missing_field", ["email", "display_name", "password"])
def test_register_requires_all_registration_fields(missing_field):
    client = APIClient()
    payload = registration_payload()
    payload.pop(missing_field)

    response = client.post(
        reverse("api:register"),
        payload,
        format="json",
        HTTP_HOST="localhost",
    )

    assert_validation_error(response, missing_field)
    assert get_user_model().objects.count() == 0


def test_register_rejects_invalid_email():
    client = APIClient()

    response = client.post(
        reverse("api:register"),
        registration_payload(email="not-an-email"),
        format="json",
        HTTP_HOST="localhost",
    )

    assert_validation_error(response, "email")
    assert get_user_model().objects.count() == 0


@pytest.mark.parametrize("display_name", ["", " " * 8, "x" * 65])
def test_register_rejects_invalid_display_name(display_name):
    client = APIClient()

    response = client.post(
        reverse("api:register"),
        registration_payload(display_name=display_name),
        format="json",
        HTTP_HOST="localhost",
    )

    assert_validation_error(response, "display_name")
    assert get_user_model().objects.count() == 0


@pytest.mark.parametrize("password", ["short", "12345678"])
def test_register_rejects_passwords_that_fail_configured_validators(password):
    client = APIClient()

    response = client.post(
        reverse("api:register"),
        registration_payload(password=password),
        format="json",
        HTTP_HOST="localhost",
    )

    assert_validation_error(response, "password")
    assert get_user_model().objects.count() == 0


def test_register_rejects_existing_email_case_insensitively():
    user_model = get_user_model()
    existing_user = user_model.objects.create_user(
        email="Existing@Example.COM",
        display_name="existing-user",
        password="ExistingPassword123!",
    )
    client = APIClient()

    response = client.post(
        reverse("api:register"),
        registration_payload(
            email="existing@example.com",
            display_name="new-user",
        ),
        format="json",
        HTTP_HOST="localhost",
    )

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {
        "error": {
            "code": "email_already_exists",
            "message": "An account with this email already exists.",
        }
    }
    assert user_model.objects.count() == 1
    assert user_model.objects.get() == existing_user


def test_register_allows_duplicate_display_name():
    user_model = get_user_model()
    user_model.objects.create_user(
        email="first@example.com",
        display_name="shared-name",
        password="ExistingPassword123!",
    )
    client = APIClient()

    response = client.post(
        reverse("api:register"),
        registration_payload(
            email="second@example.com",
            display_name="shared-name",
        ),
        format="json",
        HTTP_HOST="localhost",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert user_model.objects.filter(display_name="shared-name").count() == 2


def test_register_handles_database_uniqueness_race(monkeypatch):
    user_model = get_user_model()
    user_model.objects.create_user(
        email="race@example.com",
        display_name="existing-user",
        password="ExistingPassword123!",
    )

    class NoMatch:
        @staticmethod
        def exists():
            return False

    monkeypatch.setattr(user_model.objects, "filter", lambda **kwargs: NoMatch())
    client = APIClient()

    response = client.post(
        reverse("api:register"),
        registration_payload(
            email="RACE@example.com",
            display_name="racing-user",
        ),
        format="json",
        HTTP_HOST="localhost",
    )

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {
        "error": {
            "code": "email_already_exists",
            "message": "An account with this email already exists.",
        }
    }
    assert user_model.objects.count() == 1


@pytest.mark.parametrize(
    ("accept_language", "language"),
    [("cs", "cs"), ("es-ES,es;q=0.9", "es"), ("de", "en"), (None, "en")],
)
def test_new_account_starts_in_the_request_language(accept_language, language):
    headers = {"HTTP_ACCEPT_LANGUAGE": accept_language} if accept_language else {}

    response = APIClient().post(
        reverse("api:register"), registration_payload(), format="json", **headers
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert get_user_model().objects.get().language == language
