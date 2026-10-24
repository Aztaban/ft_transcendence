"""API messages follow Accept-Language (api-plan §5.5)."""

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db

_INVALID_REGISTRATION = {
    "email": "not-an-email",
    "display_name": "student",
    "password": "TemporaryPassword123!",
}


def _post_registration(accept_language):
    return APIClient().post(
        reverse("api:register"),
        _INVALID_REGISTRATION,
        format="json",
        HTTP_HOST="localhost",
        HTTP_ACCEPT_LANGUAGE=accept_language,
    )


def test_czech_accept_language_translates_message_and_field_errors():
    response = _post_registration("cs")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Opravte prosím pole registrace.",
            "fields": {"email": ["Vložte platnou e-mailovou adresu."]},
        }
    }


def test_regional_czech_accept_language_uses_czech():
    response = _post_registration("cs-CZ")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Opravte prosím pole registrace.",
            "fields": {"email": ["Vložte platnou e-mailovou adresu."]},
        }
    }


def test_spanish_accept_language_translates_message_and_field_errors():
    response = _post_registration("es")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Corrija los campos del registro.",
            "fields": {"email": ["Introduzca una dirección de correo electrónico válida."]},
        }
    }


def test_unsupported_accept_language_falls_back_to_english():
    response = _post_registration("de")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the registration fields.",
            "fields": {"email": ["Enter a valid email address."]},
        }
    }
