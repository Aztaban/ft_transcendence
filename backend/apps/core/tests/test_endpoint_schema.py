"""Previously undocumented endpoints expose their actual OpenAPI contracts (BE-7)."""

import re

import pytest
from drf_spectacular.generators import SchemaGenerator
from drf_spectacular.validation import validate_schema


@pytest.fixture(scope="module")
def schema():
    result = SchemaGenerator().get_schema(request=None, public=True)
    validate_schema(result)
    return result


@pytest.mark.parametrize(
    "path,method,statuses",
    [
        ("/api/v1/", "get", {"200", "406", "429", "500"}),
        (
            "/api/v1/auth/register/",
            "post",
            {"201", "400", "403", "406", "409", "415", "429", "500"},
        ),
        (
            "/api/v1/auth/login/",
            "post",
            {"200", "400", "401", "403", "406", "415", "429", "500"},
        ),
        ("/api/v1/auth/logout/", "post", {"204", "403", "406", "429", "500"}),
        ("/api/v1/auth/session/", "get", {"200", "406", "429", "500"}),
        ("/api/v1/auth/42/redirect/", "get", {"302", "406", "429", "500"}),
        ("/api/v1/auth/42/callback/", "get", {"302", "406", "429", "500"}),
        (
            "/api/v1/users/{user_id}/roles/{role_id}/",
            "delete",
            {"204", "401", "403", "404", "406", "409", "429", "500"},
        ),
    ],
)
def test_documented_statuses_and_error_envelopes(schema, path, method, statuses):
    operation = schema["paths"][path][method]
    assert set(operation["responses"]) == statuses
    for status, response in operation["responses"].items():
        if int(status) >= 400:
            assert response["content"]["application/json"]["schema"] == {
                "$ref": "#/components/schemas/ErrorResponse"
            }
    if method in {"post", "delete"}:
        header = next(p for p in operation["parameters"] if p["name"] == "X-CSRFToken")
        assert header["in"] == "header"
        assert header["required"] is True
        assert "csrf_failed" in operation["responses"]["403"]["description"]
    if "204" in operation["responses"]:
        assert "requestBody" not in operation
        assert "content" not in operation["responses"]["204"]
    if method == "delete":
        assert operation["security"] == [{"cookieAuth": []}]
    else:
        assert operation.get("security", []) == []


def test_authentication_inputs_and_outputs_have_distinct_shapes(schema):
    components = schema["components"]["schemas"]
    register = schema["paths"]["/api/v1/auth/register/"]["post"]
    login = schema["paths"]["/api/v1/auth/login/"]["post"]
    for operation, request_name, status in (
        (register, "Registration", "201"),
        (login, "Login", "200"),
    ):
        assert operation["requestBody"]["required"] is True
        assert operation["requestBody"]["content"]["application/json"]["schema"] == {
            "$ref": f"#/components/schemas/{request_name}"
        }
        assert operation["responses"][status]["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/AuthenticationResult"
        }
    assert set(components["AuthenticationResult"]["properties"]) == {
        "id",
        "email",
        "display_name",
        "message",
    }
    assert set(components["AuthenticationResult"]["required"]) == {
        "id",
        "email",
        "display_name",
        "message",
    }
    assert components["Registration"]["properties"]["password"]["writeOnly"] is True
    assert components["Login"]["required"] == ["email", "password"]
    assert "invalid_credentials" in login["responses"]["401"]["description"]
    assert "email_already_exists" in register["responses"]["409"]["description"]


def test_session_schema_requires_nullable_user_and_documents_both_states(schema):
    components = schema["components"]["schemas"]
    assert components["SessionStatus"]["properties"] == {
        "authenticated": {"type": "boolean", "readOnly": True},
        "user": {
            "allOf": [{"$ref": "#/components/schemas/SessionUser"}],
            "readOnly": True,
            "nullable": True,
        },
    }
    assert components["SessionStatus"]["required"] == ["authenticated", "user"]
    assert components["SessionUser"]["properties"] == {
        "id": {"type": "integer", "readOnly": True},
        "email": {"type": "string", "format": "email", "readOnly": True},
        "display_name": {"type": "string", "readOnly": True},
    }


def test_oauth_is_documented_as_browser_redirects(schema):
    for action in ("redirect", "callback"):
        operation = schema["paths"][f"/api/v1/auth/42/{action}/"]["get"]
        assert "requestBody" not in operation
        response = operation["responses"]["302"]
        assert "content" not in response
        assert response["headers"]["Location"]["schema"] == {"type": "string"}
        assert response["headers"]["Location"]["required"] is True
    callback = schema["paths"]["/api/v1/auth/42/callback/"]["get"]
    assert {(p["name"], p["in"]) for p in callback["parameters"]} == {
        ("state", "query"),
        ("code", "query"),
        ("error", "query"),
    }


def test_root_and_shared_error_component_shapes(schema):
    components = schema["components"]["schemas"]
    assert components["APIRoot"]["required"] == ["status", "version"]
    assert set(components["APIRoot"]["properties"]) == {"status", "version"}
    for field, value in (("status", "ok"), ("version", "v1")):
        reference = components["APIRoot"]["properties"][field]["allOf"][0]["$ref"]
        assert components[reference.rsplit("/", 1)[1]]["enum"] == [value]
    assert components["ErrorResponse"]["properties"] == {
        "error": {"$ref": "#/components/schemas/Error"}
    }
    assert components["Error"]["required"] == ["code", "message"]
    assert components["Error"]["properties"]["fields"]["additionalProperties"] == {
        "type": "array",
        "items": {"type": "string"},
    }


@pytest.mark.parametrize(
    "path,method,errors",
    [
        ("users/me/", "get", {}),
        (
            "users/me/",
            "patch",
            {400: "validation_error", 403: "csrf_failed", 415: "unsupported_media_type"},
        ),
        ("users/{user_id}/", "get", {404: "not_found"}),
        (
            "users/{user_id}/roles/",
            "post",
            {
                400: "validation_error",
                403: "permission_denied role_not_assignable csrf_failed",
                404: "not_found",
                415: "unsupported_media_type",
            },
        ),
        ("projects/", "get", {}),
        ("projects/{slug}/", "get", {404: "not_found"}),
        ("tutors/{user_id}/eligibility/", "get", {404: "not_found"}),
        (
            "tutor-eligibility-requests/",
            "get",
            {400: "validation_error", 404: "not_found"},
        ),
        (
            "tutor-eligibility-requests/",
            "post",
            {
                400: "validation_error",
                403: "permission_denied csrf_failed",
                409: "eligibility_request_pending",
                415: "unsupported_media_type",
            },
        ),
        (
            "tutor-eligibility-requests/{request_id}/review/",
            "post",
            {
                400: "validation_error",
                403: "permission_denied cannot_review_own_request csrf_failed",
                404: "not_found",
                409: "eligibility_request_already_reviewed",
                415: "unsupported_media_type",
            },
        ),
        (
            "evaluation-requests/",
            "get",
            {400: "validation_error", 403: "permission_denied", 404: "not_found"},
        ),
        (
            "evaluation-requests/",
            "post",
            {
                400: "validation_error",
                403: "csrf_failed",
                409: "active_request_exists",
                415: "unsupported_media_type",
            },
        ),
        ("evaluation-requests/{id}/", "get", {404: "not_found"}),
        (
            "evaluation-requests/{id}/",
            "patch",
            {
                400: "validation_error",
                403: "permission_denied csrf_failed",
                404: "not_found",
                409: "invalid_state_transition",
                415: "unsupported_media_type",
            },
        ),
        (
            "evaluation-requests/{id}/pick-slot/",
            "post",
            {
                400: "validation_error",
                403: "not_eligible cannot_pick_own_request csrf_failed",
                404: "not_found",
                409: "request_not_pending slot_overlaps student_unavailable",
                415: "unsupported_media_type",
            },
        ),
    ],
)
def test_remaining_implemented_operations_document_relevant_errors(schema, path, method, errors):
    operation = schema["paths"][f"/api/v1/{path}"][method]
    expected = {
        401: "not_authenticated",
        406: "not_acceptable",
        429: "throttled",
        500: "server_error",
        **errors,
    }
    assert {int(code) for code in operation["responses"] if int(code) >= 400} == set(expected)
    for status, codes in expected.items():
        response = operation["responses"][str(status)]
        assert set(re.findall(r"`([^`]+)`", response["description"])) == set(codes.split())
        assert response["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/ErrorResponse"
        }
    if method in {"post", "patch"}:
        header = next(p for p in operation["parameters"] if p["name"] == "X-CSRFToken")
        assert header["required"] is True
        assert header["in"] == "header"
