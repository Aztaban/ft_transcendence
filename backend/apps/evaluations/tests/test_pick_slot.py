"""POST /evaluation-requests/{id}/pick-slot/ (issues #190 and #191).

The route accepts a slot from an eligible Hitchhiker and returns the request.
A single winner, the row locks and the move to awaiting_confirmation come next.
"""

from datetime import datetime, timezone

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.evaluations.models import EvaluationRequest, Project, TutorEligibility

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("empty_project_catalog")]
NOW = datetime(2026, 10, 10, 9, tzinfo=timezone.utc)
PASSWORD = "RequestPassword123!"
SLOT = {"starts_at": "2026-10-12T15:00:00Z", "ends_at": "2026-10-12T15:45:00Z"}


def pick_url(pk=17):
    return reverse("api:evaluation-request-pick-slot", kwargs={"pk": pk})


@pytest.fixture(autouse=True)
def fixed_time(monkeypatch):
    monkeypatch.setattr("django.utils.timezone.now", lambda: NOW)


@pytest.fixture
def student():
    return get_user_model().objects.create_user(
        id=7, email="alice@example.com", display_name="Alice", password=PASSWORD
    )


@pytest.fixture
def project():
    return Project.objects.create(id=4, slug="libft", name="Libft")


@pytest.fixture
def evaluation(student, project):
    return EvaluationRequest.objects.create(
        id=17, student=student, project=project, note="Parsing."
    )


@pytest.fixture
def expected():
    return {
        "id": 17,
        "student": {"id": 7, "display_name": "Alice", "avatar_url": None},
        "project": {"id": 4, "slug": "libft", "name": "Libft"},
        "note": "Parsing.",
        "status": "pending",
        "picked_by": None,
        "starts_at": None,
        "ends_at": None,
        "cancelled_by": None,
        "cancelled_at": None,
        "expired_at": None,
        "result": None,
        "feedback": "",
        "completed_at": None,
        "is_history": False,
        "created_at": "2026-10-10T09:00:00Z",
        "updated_at": "2026-10-10T09:00:00Z",
    }


def grant(user, role):
    user.roles.add(Role.objects.get(name=role))


@pytest.fixture
def hitchhiker(project):
    user = get_user_model().objects.create_user(
        id=42, email="bob@example.com", display_name="Bob", password=PASSWORD
    )
    grant(user, "tutor")
    TutorEligibility.objects.create(tutor=user, project=project)
    return user


def logged_in_client(user):
    client = APIClient(enforce_csrf_checks=True)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    response = client.post(
        reverse("api:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    return client


def test_requires_authentication():
    response = APIClient().post(pick_url(), SLOT, format="json")
    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }


def test_pick_slot_real_session(hitchhiker, evaluation, expected):
    client = logged_in_client(hitchhiker)
    response = client.post(
        pick_url(),
        SLOT,
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    expected["student"] = None
    assert response.json() == expected
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"
    assert evaluation.picked_by_id is None
    assert evaluation.starts_at is None
    assert evaluation.ends_at is None


def test_csrf_required(student, evaluation):
    client = logged_in_client(student)
    response = client.post(pick_url(), SLOT, format="json", HTTP_HOST="localhost")
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "csrf_failed",
            "message": "CSRF verification failed. Reload the page and try again.",
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.starts_at is None


@pytest.mark.parametrize(
    "payload,fields",
    [
        (
            {},
            {
                "starts_at": ["This field is required."],
                "ends_at": ["This field is required."],
            },
        ),
        ({"starts_at": "2026-10-12T15:00:00Z"}, {"ends_at": ["This field is required."]}),
        (
            {"starts_at": None, "ends_at": "2026-10-12T15:45:00Z"},
            {"starts_at": ["This field may not be null."]},
        ),
        (
            {"starts_at": "monday", "ends_at": "2026-10-12T15:45:00Z"},
            {
                "starts_at": [
                    "Datetime has wrong format. Use one of these formats instead: "
                    "YYYY-MM-DDThh:mm[:ss[.uuuuuu]][+HH:MM|-HH:MM|Z]."
                ]
            },
        ),
    ],
)
def test_pick_slot_validation(hitchhiker, evaluation, payload, fields):
    client = APIClient()
    client.force_authenticate(hitchhiker)
    response = client.post(pick_url(), payload, format="json")
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": fields,
        }
    }


def test_unknown_request_is_not_found(student):
    client = APIClient()
    client.force_authenticate(student)
    response = client.post(pick_url(99), SLOT, format="json")
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}


def test_hidden_request_is_not_found(project, evaluation):
    stranger = get_user_model().objects.create_user(
        id=8, email="cara@example.com", display_name="Cara", password=PASSWORD
    )
    client = APIClient()
    client.force_authenticate(stranger)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"


def test_eligible_hitchhiker_can_call_the_endpoint(hitchhiker, evaluation, expected):
    client = APIClient()
    client.force_authenticate(hitchhiker)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 200
    expected["student"] = None
    assert response.json() == expected
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"
    assert evaluation.picked_by_id is None


def test_student_is_not_eligible(student, evaluation):
    client = APIClient()
    client.force_authenticate(student)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "not_eligible",
            "message": "You are not eligible to evaluate this project.",
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"


def test_hitchhiker_cannot_pick_own_request(student, project, evaluation):
    grant(student, "tutor")
    TutorEligibility.objects.create(tutor=student, project=project)
    client = APIClient()
    client.force_authenticate(student)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "cannot_pick_own_request",
            "message": "You cannot pick your own request.",
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.picked_by_id is None


@pytest.mark.parametrize("role", ["head_tutor", "admin"])
def test_override_without_eligibility_is_refused(evaluation, role):
    user = get_user_model().objects.create_user(
        id=43, email="dana@example.com", display_name="Dana", password=PASSWORD
    )
    grant(user, role)
    client = APIClient()
    client.force_authenticate(user)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "not_eligible",
            "message": "You are not eligible to evaluate this project.",
        }
    }


def test_eligible_head_tutor_can_pick(project, evaluation, expected):
    head_tutor = get_user_model().objects.create_user(
        id=44, email="fran@example.com", display_name="Fran", password=PASSWORD
    )
    grant(head_tutor, "head_tutor")
    TutorEligibility.objects.create(tutor=head_tutor, project=project)
    client = APIClient()
    client.force_authenticate(head_tutor)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 200
    assert response.json() == expected
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"
    assert evaluation.picked_by_id is None


def test_retained_eligibility_without_hitchhiker_role_is_refused(student, project, evaluation):
    TutorEligibility.objects.create(tutor=student, project=project)
    client = APIClient()
    client.force_authenticate(student)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "not_eligible",
            "message": "You are not eligible to evaluate this project.",
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"
    assert evaluation.picked_by_id is None


def test_eligibility_for_another_project_hides_the_request(evaluation):
    other_project = Project.objects.create(id=5, slug="ft_printf", name="ft_printf")
    tutor = get_user_model().objects.create_user(
        id=45, email="erin@example.com", display_name="Erin", password=PASSWORD
    )
    grant(tutor, "tutor")
    TutorEligibility.objects.create(tutor=tutor, project=other_project)
    client = APIClient()
    client.force_authenticate(tutor)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"
