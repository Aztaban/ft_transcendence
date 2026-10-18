"""Validation errors keep top-level field names and lists of strings (api-plan §5.5)."""

import pytest
from rest_framework.exceptions import ParseError, ValidationError

from apps.core.exceptions import envelope_exception_handler, error_response


@pytest.mark.parametrize(
    "detail,fields",
    [
        ("Invalid input.", {"non_field_errors": ["Invalid input."]}),
        (
            ["First error.", "Second error."],
            {"non_field_errors": ["First error.", "Second error."]},
        ),
        ({"note": "Invalid note."}, {"note": ["Invalid note."]}),
        ({"note": ["Invalid note."]}, {"note": ["Invalid note."]}),
        (
            {"project_ids": {0: ["Invalid id."], 2: ["Positive id required."]}},
            {"project_ids": ["Invalid id.", "Positive id required."]},
        ),
        (
            {"items": [{}, {"name": ["Required."]}, {"ids": {0: ["Invalid id."]}}]},
            {"items": ["Required.", "Invalid id."]},
        ),
        (
            {"project_ids": {0: ["Invalid id."], 1: ["Invalid id."]}, "note": ["Too long."]},
            {"project_ids": ["Invalid id.", "Invalid id."], "note": ["Too long."]},
        ),
        (
            [{"name": ["Required."]}, {"name": ["Too long."]}],
            {"non_field_errors": ["Required.", "Too long."]},
        ),
    ],
)
def test_validation_error_envelope_flattens_messages(detail, fields):
    response = envelope_exception_handler(ValidationError(detail), {})

    assert response.status_code == 400
    assert response.data == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": fields,
        }
    }


def test_explicit_error_response_normalizes_nested_field_errors():
    response = error_response(
        "validation_error",
        "Please correct the highlighted fields.",
        400,
        {"project_ids": {0: ["Invalid id."]}},
    )

    assert response.status_code == 400
    assert response.data == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {"project_ids": ["Invalid id."]},
        }
    }


def test_parse_error_keeps_non_field_message_list():
    response = envelope_exception_handler(ParseError("Malformed JSON."), {})

    assert response.status_code == 400
    assert response.data == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {"non_field_errors": ["Malformed JSON."]},
        }
    }
