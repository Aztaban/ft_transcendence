"""Administration exception conditions and existing override resolution (§10.9)."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.evaluations.models import EvaluationRequest, Project, TutorEligibility

pytestmark = pytest.mark.django_db


def exceptions_url():
    return reverse("api:evaluation-request-exceptions")


@pytest.mark.parametrize("role", [None, "student", "tutor", "sc_member"])
def test_exception_list_requires_head_tutor_or_admin(override_evaluation, role):
    _, _, _, actor, _ = override_evaluation
    client = APIClient()
    if role is not None:
        actor.roles.set(Role.objects.filter(name=role))
        client.force_authenticate(actor)
    response = client.get(exceptions_url())
    assert response.status_code == (401 if role is None else 403)
    assert response.json() == {
        "error": {
            "code": "not_authenticated" if role is None else "permission_denied",
            "message": (
                "Authentication required."
                if role is None
                else "You do not have permission to perform this action."
            ),
        }
    }


@pytest.mark.parametrize("role", ["head_tutor", "admin"])
@pytest.mark.parametrize(
    "cause",
    ["role", "eligibility", "other_project", "student_suspended", "picker_suspended", "result"],
)
def test_exception_list_matches_full_representation(
    override_evaluation, override_response, make_session_client, role, cause
):
    evaluation, student, picker, actor, _ = override_evaluation
    actor.roles.set(Role.objects.filter(name=role))
    problem = "tutor_lost_eligibility"
    if cause == "role":
        picker.roles.remove(Role.objects.get(name="tutor"))
    elif cause in ("eligibility", "other_project"):
        TutorEligibility.objects.filter(tutor=picker, project=evaluation.project).delete()
        if cause == "other_project":
            project = Project.objects.create(slug="different-project", name="Different project")
            TutorEligibility.objects.create(tutor=picker, project=project)
    elif cause in ("student_suspended", "picker_suspended"):
        participant = student if cause == "student_suspended" else picker
        participant.status = "suspended"
        participant.save(update_fields=["status"])
        problem = "participant_inactive"
    else:
        EvaluationRequest.objects.filter(pk=evaluation.pk).update(
            starts_at=timezone.now() - timedelta(days=8, minutes=45),
            ends_at=timezone.now() - timedelta(days=8),
        )
        override_response.update(
            starts_at="2026-10-23T09:15:00Z",
            ends_at="2026-10-23T10:00:00Z",
            is_history=True,
        )
        problem = "result_missing"
    response = make_session_client(actor).get(exceptions_url())
    assert response.status_code == 200
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [{**override_response, "problem": problem}],
    }


@pytest.mark.parametrize("role", ["tutor", "head_tutor"])
def test_either_hitchhiker_role_keeps_the_pick_eligible(override_evaluation, role):
    _, _, picker, actor, _ = override_evaluation
    picker.roles.set(Role.objects.filter(name__in=("student", role)))
    client = APIClient()
    client.force_authenticate(actor)
    response = client.get(exceptions_url())
    assert response.status_code == 200
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}


@pytest.mark.parametrize(
    "offset", [timedelta(0), timedelta(microseconds=-1), timedelta(microseconds=1)]
)
def test_missing_result_threshold_is_strict(override_evaluation, override_response, offset):
    evaluation, _, _, actor, _ = override_evaluation
    end = timezone.now() - timedelta(days=7) + offset
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(
        starts_at=end - timedelta(minutes=45), ends_at=end
    )
    client = APIClient()
    client.force_authenticate(actor)
    response = client.get(exceptions_url())
    assert response.status_code == 200
    if offset >= timedelta(0):
        assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}
    else:
        override_response.update(
            starts_at="2026-10-24T09:14:59.999999Z",
            ends_at="2026-10-24T09:59:59.999999Z",
            is_history=True,
            problem="result_missing",
        )
        assert response.json() == {
            "count": 1,
            "next": None,
            "previous": None,
            "results": [override_response],
        }


@pytest.mark.parametrize(
    "status,start,end,cause,matches",
    [
        ("pending", None, None, "student_suspended", True),
        ("pending", None, None, "eligibility", False),
        ("awaiting_confirmation", -1, 1, "eligibility", True),
        ("awaiting_confirmation", 1, 2, "picker_suspended", True),
        ("confirmed", 0, 1, "eligibility", False),
        ("confirmed", -1, 1, "eligibility", False),
        ("confirmed", -1, 1, "student_suspended", True),
        ("confirmed", -2, 0, "student_suspended", False),
        ("confirmed", -2, -1, "picker_suspended", False),
        ("confirmed", -10, -9, "recorded_result", False),
        ("cancelled", -10, -9, "student_suspended", False),
        ("cancelled", 1, 2, "eligibility", False),
        ("expired", None, None, "student_suspended", False),
    ],
)
def test_exception_conditions_respect_lifecycle(
    override_evaluation, override_response, status, start, end, cause, matches
):
    evaluation, student, picker, actor, _ = override_evaluation
    at = timezone.now()
    values = {
        "status": status,
        "starts_at": at + timedelta(days=start) if start is not None else None,
        "ends_at": at + timedelta(days=end) if end is not None else None,
        "picked_by": picker if start is not None else None,
        "cancelled_at": at if status == "cancelled" else None,
        "expired_at": at if status == "expired" else None,
    }
    if cause == "eligibility":
        TutorEligibility.objects.filter(tutor=picker, project=evaluation.project).delete()
    elif cause == "recorded_result":
        values.update(result="failed", completed_at=at)
    else:
        participant = student if cause == "student_suspended" else picker
        participant.status = "suspended"
        participant.save(update_fields=["status"])
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(**values)
    client = APIClient()
    client.force_authenticate(actor)
    response = client.get(exceptions_url())
    assert response.status_code == 200
    if not matches:
        assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}
    else:
        override_response.update(
            status=status,
            starts_at=(
                values["starts_at"].isoformat().replace("+00:00", "Z")
                if start is not None
                else None
            ),
            ends_at=(
                values["ends_at"].isoformat().replace("+00:00", "Z") if end is not None else None
            ),
            picked_by=override_response["picked_by"] if start is not None else None,
            problem="tutor_lost_eligibility" if cause == "eligibility" else "participant_inactive",
        )
        assert response.json() == {
            "count": 1,
            "next": None,
            "previous": None,
            "results": [override_response],
        }


def test_result_missing_uses_configured_interval(override_evaluation, override_response, settings):
    evaluation, _, _, actor, _ = override_evaluation
    settings.EVALUATION_RESULT_MISSING_DAYS = 3
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(
        starts_at=timezone.now() - timedelta(days=4, minutes=45),
        ends_at=timezone.now() - timedelta(days=4),
    )
    client = APIClient()
    client.force_authenticate(actor)
    response = client.get(exceptions_url())
    assert response.status_code == 200
    override_response.update(
        starts_at="2026-10-27T09:15:00Z",
        ends_at="2026-10-27T10:00:00Z",
        is_history=True,
        problem="result_missing",
    )
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [override_response],
    }


def test_overlapping_problems_show_one_row_with_documented_priority(
    override_evaluation, override_response
):
    evaluation, student, picker, actor, _ = override_evaluation
    student.status = "suspended"
    student.save(update_fields=["status"])
    picker.roles.remove(Role.objects.get(name="tutor"))
    TutorEligibility.objects.filter(tutor=picker, project=evaluation.project).delete()
    client = APIClient()
    client.force_authenticate(actor)
    response = client.get(exceptions_url())
    assert response.status_code == 200
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [{**override_response, "problem": "participant_inactive"}],
    }
    student.status = "active"
    student.save(update_fields=["status"])
    response = client.get(exceptions_url())
    assert response.status_code == 200
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [{**override_response, "problem": "tutor_lost_eligibility"}],
    }


@pytest.mark.parametrize(
    "query,start,stop,next_url,previous_url",
    [
        ({}, 0, 20, "http://testserver/api/v1/admin/evaluation-requests/exceptions/?page=2", None),
        (
            {"page_size": 1, "page": 2},
            1,
            2,
            "http://testserver/api/v1/admin/evaluation-requests/exceptions/?page=3&page_size=1",
            "http://testserver/api/v1/admin/evaluation-requests/exceptions/?page_size=1",
        ),
        (
            {"page_size": 999},
            0,
            100,
            "http://testserver/api/v1/admin/evaluation-requests/exceptions/?page=2&page_size=999",
            None,
        ),
    ],
)
def test_exception_list_uses_shared_pagination_and_stable_ordering(
    override_evaluation,
    override_response,
    query,
    start,
    stop,
    next_url,
    previous_url,
):
    evaluation, student, picker, actor, _ = override_evaluation
    # Both Hitchhiker roles must not duplicate results through a roles join.
    picker.roles.add(Role.objects.get(name="head_tutor"))
    TutorEligibility.objects.filter(tutor=picker, project=evaluation.project).delete()
    copies = [
        EvaluationRequest.objects.create(
            student=student,
            project=evaluation.project,
            status="confirmed",
            picked_by=picker,
            starts_at=evaluation.starts_at,
            ends_at=evaluation.ends_at,
        )
        for _ in range(104)
    ]
    # An ordinary request must be filtered before pagination and count.
    EvaluationRequest.objects.create(student=student, project=evaluation.project)
    client = APIClient()
    client.force_authenticate(actor)
    response = client.get(exceptions_url(), query)
    assert response.status_code == 200
    ordered_ids = [obj.pk for obj in reversed(copies)] + [evaluation.pk]
    assert response.json() == {
        "count": 105,
        "next": next_url,
        "previous": previous_url,
        "results": [
            {**override_response, "id": pk, "problem": "tutor_lost_eligibility"}
            for pk in ordered_ids[start:stop]
        ],
    }


def test_invalid_exception_page_returns_documented_error(override_evaluation):
    _, _, _, actor, _ = override_evaluation
    client = APIClient()
    client.force_authenticate(actor)
    response = client.get(exceptions_url(), {"page": 2})
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}


@pytest.mark.parametrize("action", ["release", "cancel"])
def test_exception_resolves_through_existing_override(
    override_evaluation, make_session_client, user_event_sender, action
):
    evaluation, _, picker, actor, _ = override_evaluation
    TutorEligibility.objects.filter(tutor=picker, project=evaluation.project).delete()
    client = make_session_client(actor)
    assert client.get(exceptions_url()).json()["count"] == 1
    client.get(reverse("api:session"))
    response = client.post(
        reverse(f"api:evaluation-request-{action}", kwargs={"pk": evaluation.pk}),
        {"reason": "Resolve the exception"},
        format="json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    response = client.get(exceptions_url())
    assert response.status_code == 200
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}
