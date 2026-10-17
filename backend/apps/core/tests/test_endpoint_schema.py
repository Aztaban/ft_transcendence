"""Previously undocumented endpoints expose their actual OpenAPI contracts (BE-7)."""

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
