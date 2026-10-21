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
            "evaluation-requests/{id}/confirm/",
            "post",
            {
                403: "permission_denied csrf_failed",
                404: "not_found",
                409: "invalid_state_transition evaluation_already_started",
            },
        ),
        (
            "evaluation-requests/{id}/release/",
            "post",
            {
                403: "permission_denied csrf_failed",
                404: "not_found",
                409: "invalid_state_transition evaluation_already_started",
            },
        ),
        (
            "evaluation-requests/{id}/cancel/",
            "post",
            {
                403: "permission_denied csrf_failed",
                404: "not_found",
                409: "invalid_state_transition evaluation_already_started",
            },
        ),
        (
            "evaluation-requests/{id}/decline/",
            "post",
            {
                403: "permission_denied csrf_failed",
                404: "not_found",
                409: "invalid_state_transition",
            },
        ),
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


@pytest.mark.parametrize("action", ["confirm", "decline", "cancel", "release"])
def test_transition_schema_takes_no_body_and_returns_evaluation_request(schema, action):
    operation = schema["paths"][f"/api/v1/evaluation-requests/{{id}}/{action}/"]["post"]
    assert "requestBody" not in operation
    assert operation["security"] == [{"cookieAuth": []}]
    assert operation["responses"]["200"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/EvaluationRequest"
    }


def test_own_profile_requires_a_session_in_schema(schema):
    for method in ("get", "patch"):
        operation = schema["paths"]["/api/v1/users/me/"][method]
        assert operation["security"] == [{"cookieAuth": []}]


@pytest.mark.parametrize("path", ["evaluation-requests/", "tutor-eligibility-requests/"])
def test_pagination_keys_are_required_even_when_links_are_null(schema, path):
    response = schema["paths"][f"/api/v1/{path}"]["get"]["responses"]["200"]
    reference = response["content"]["application/json"]["schema"]["$ref"]
    page = schema["components"]["schemas"][reference.rsplit("/", 1)[1]]
    assert set(page["required"]) == {"count", "next", "previous", "results"}
    assert set(page["properties"]) == {"count", "next", "previous", "results"}
    for link in ("next", "previous"):
        assert page["properties"][link]["type"] == "string"
        assert page["properties"][link]["nullable"] is True


@pytest.mark.parametrize(
    "path,name,values",
    [
        (
            "evaluation-requests/",
            "status",
            ["pending", "awaiting_confirmation", "confirmed", "cancelled", "expired"],
        ),
        ("evaluation-requests/", "result", ["passed", "failed", "none"]),
        ("tutor-eligibility-requests/", "status", ["pending", "approved", "declined"]),
    ],
)
def test_multi_value_filters_use_comma_separated_query_encoding(schema, path, name, values):
    operation = schema["paths"][f"/api/v1/{path}"]["get"]
    parameter = next(p for p in operation["parameters"] if p["name"] == name)
    assert parameter["in"] == "query"
    assert parameter["style"] == "form"
    assert parameter["explode"] is False
    assert parameter["schema"] == {
        "type": "array",
        "items": {"type": "string", "enum": sorted(values)},
    }


def test_pick_slot_schema_describes_timezone_grid_order_and_timing_limits(schema):
    slot = schema["components"]["schemas"]["EvaluationRequestPickSlot"]
    assert set(slot["required"]) == {"starts_at", "ends_at"}
    for field in ("starts_at", "ends_at"):
        assert slot["properties"][field]["type"] == "string"
        assert slot["properties"][field]["format"] == "date-time"
        description = slot["properties"][field]["description"]
        assert "Timezone required (Z or offset)" in description
        assert "UTC" in description
        assert "15-minute boundary with zero seconds and microseconds" in description
    start = slot["properties"]["starts_at"]["description"]
    end = slot["properties"]["ends_at"]["description"]
    assert "between 30 minutes and 14 days from now, inclusive" in start
    assert "after starts_at" in end
    assert "between 15 and 120 minutes, inclusive" in end
