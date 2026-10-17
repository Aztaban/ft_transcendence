"""Shared API references generate one consistent component per representation."""

from django.urls import path
from drf_spectacular.generators import SchemaGenerator

from apps.accounts.views.profiles import MeView, user_detail
from apps.evaluations.views.eligibility import tutor_eligibility_request_list
from apps.evaluations.views.projects import ProjectDetailView
from apps.evaluations.views.requests import EvaluationRequestDetailView


def test_reference_components_are_shared_and_avatar_urls_are_nullable_strings(capsys):
    schema = SchemaGenerator(
        patterns=[
            path("projects/<slug:slug>/", ProjectDetailView.as_view()),
            path("evaluation-requests/<int:pk>/", EvaluationRequestDetailView.as_view()),
            path("tutor-eligibility-requests/", tutor_eligibility_request_list),
            path("users/me/", MeView.as_view()),
            path("users/<int:user_id>/", user_detail),
        ]
    ).get_schema(request=None, public=True)

    assert "Encountered 2 components" not in capsys.readouterr().err
    components = schema["components"]["schemas"]
    assert {name for name in components if name.startswith("UserRef")} == {"UserRef"}
    assert {name for name in components if name.startswith("ProjectRef")} == {"ProjectRef"}
    assert "TutorEligibleProject" not in components
    assert components["UserRef"] == {
        "type": "object",
        "properties": {
            "id": {"type": "integer", "readOnly": True},
            "display_name": {"type": "string", "readOnly": True},
            "avatar_url": {"type": "string", "readOnly": True, "nullable": True},
        },
        "required": ["avatar_url", "display_name", "id"],
    }
    for component in ("Profile", "PublicProfile"):
        assert components[component]["properties"]["avatar_url"] == {
            "type": "string",
            "nullable": True,
            "readOnly": True,
        }

    eligibility = components["EligibilityRequest"]["properties"]
    evaluation = components["EvaluationRequest"]["properties"]
    for field in (
        eligibility["requester"],
        eligibility["reviewed_by"],
        evaluation["student"],
        evaluation["picked_by"],
        evaluation["cancelled_by"],
    ):
        assert field["allOf"] == [{"$ref": "#/components/schemas/UserRef"}]
    for field in (
        eligibility["reviewed_by"],
        evaluation["student"],
        evaluation["picked_by"],
        evaluation["cancelled_by"],
    ):
        assert field["nullable"] is True
    assert components["Project"]["properties"]["eligible_tutors"]["items"] == {
        "$ref": "#/components/schemas/UserRef"
    }
    assert eligibility["projects"]["items"] == {"$ref": "#/components/schemas/ProjectRef"}
    assert evaluation["project"]["allOf"] == [{"$ref": "#/components/schemas/ProjectRef"}]
