"""Picking Hitchhiker release (#202): permissions, queue visibility and concurrency."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier

import pytest
from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.urls import reverse
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.evaluations.models import EvaluationRequest, Project, TutorEligibility
from apps.evaluations.services import InvalidStateTransition, release_slot

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("empty_project_catalog")]
NOW = datetime(2026, 10, 10, 9, tzinfo=timezone.utc)
START = datetime(2026, 10, 12, 15, tzinfo=timezone.utc)
PASSWORD = "RequestPassword123!"
INVALID_STATE = {
    "error": {
        "code": "invalid_state_transition",
        "message": "Only picked requests without a result can be released.",
    }
}


def release_url(pk=17):
    return reverse("api:evaluation-request-release", kwargs={"pk": pk})


@pytest.fixture(autouse=True)
def fixed_time(monkeypatch):
    monkeypatch.setattr("django.utils.timezone.now", lambda: NOW)


@pytest.fixture
def seeded_roles():
    for name in Role.Name.values:
        Role.objects.get_or_create(name=name)


@pytest.fixture
def student(seeded_roles):
    return get_user_model().objects.create_user(
        id=7, email="alice@example.com", display_name="Alice"
    )


@pytest.fixture
def tutor(seeded_roles):
    user = get_user_model().objects.create_user(
        id=42, email="bob@example.com", display_name="Bob", password=PASSWORD
    )
    user.roles.add(Role.objects.get(name="tutor"))
    return user


@pytest.fixture
def evaluation(student, tutor):
    project = Project.objects.create(id=4, slug="libft", name="Libft")
    TutorEligibility.objects.create(tutor=tutor, project=project)
    return EvaluationRequest.objects.create(
        id=17,
        student=student,
        project=project,
        note="Parsing.",
        status="awaiting_confirmation",
        picked_by=tutor,
        starts_at=START,
        ends_at=START + timedelta(minutes=45),
    )


@pytest.fixture
def expected():
    return {
        "id": 17,
        "student": None,
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


def session_client(tutor):
    client = APIClient(enforce_csrf_checks=True)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    response = client.post(
        reverse("api:login"),
        {"email": tutor.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    return client


@pytest.mark.parametrize("state", ["awaiting_confirmation", "confirmed"])
def test_release_with_real_session_returns_to_queue(student, tutor, evaluation, expected, state):
    EvaluationRequest.objects.filter(pk=17).update(status=state)
    client = session_client(tutor)
    response = client.post(
        release_url(),
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    assert response.json() == expected
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"
    assert evaluation.student_id == 7
    assert evaluation.note == "Parsing."
    assert evaluation.picked_by_id is None
    assert evaluation.starts_at is None
    assert evaluation.ends_at is None
    list_url = reverse("api:evaluation-request-list")
    response = client.get(list_url, {"scope": "open"}, HTTP_HOST="localhost")
    assert response.status_code == 200
    assert response.json() == {"count": 1, "next": None, "previous": None, "results": [expected]}
    for history in ("true", "false"):
        response = client.get(
            list_url, {"scope": "picked", "history": history}, HTTP_HOST="localhost"
        )
        assert response.status_code == 200
        assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}
    owner_client = APIClient()
    owner_client.force_authenticate(student)
    response = owner_client.get(list_url, {"scope": "mine", "history": "false"})
    expected["student"] = {"id": 7, "display_name": "Alice", "avatar_url": None}
    assert response.status_code == 200
    assert response.json() == {"count": 1, "next": None, "previous": None, "results": [expected]}


def test_authentication_required():
    response = APIClient().post(release_url())
    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }


def test_csrf_required(tutor, evaluation):
    response = session_client(tutor).post(release_url(), HTTP_HOST="localhost")
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "csrf_failed",
            "message": "CSRF verification failed. Reload the page and try again.",
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.picked_by_id == 42


@pytest.mark.parametrize("role", ["student", "tutor", "head_tutor", "admin"])
def test_visible_non_picker_cannot_release(student, evaluation, role):
    student.roles.add(Role.objects.get(name=role))
    client = APIClient()
    client.force_authenticate(student)
    response = client.post(release_url())
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "permission_denied",
            "message": "You do not have permission to perform this action.",
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.picked_by_id == 42


@pytest.mark.parametrize("pk", [17, 999])
def test_hidden_or_missing_request_returns_404(evaluation, pk):
    user = get_user_model().objects.create_user(email="stranger@example.com")
    client = APIClient()
    client.force_authenticate(user)
    response = client.post(release_url(pk))
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}


def test_lost_eligibility_does_not_prevent_releasing_existing_pick(tutor, evaluation, expected):
    TutorEligibility.objects.filter(tutor=tutor).delete()
    client = APIClient()
    client.force_authenticate(tutor)
    response = client.post(release_url())
    assert response.status_code == 200
    assert response.json() == expected


def test_picker_must_still_hold_hitchhiker_role(tutor, evaluation):
    tutor.roles.remove(Role.objects.get(name="tutor"))
    client = APIClient()
    client.force_authenticate(tutor)
    response = client.post(release_url())
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "permission_denied",
            "message": "You do not have permission to perform this action.",
        }
    }


def test_head_tutor_can_release_own_pick(tutor, evaluation, expected):
    tutor.roles.remove(Role.objects.get(name="tutor"))
    tutor.roles.add(Role.objects.get(name="head_tutor"))
    client = APIClient()
    client.force_authenticate(tutor)
    response = client.post(release_url())
    expected["student"] = {"id": 7, "display_name": "Alice", "avatar_url": None}
    assert response.status_code == 200
    assert response.json() == expected


@pytest.mark.parametrize("state", ["awaiting_confirmation", "confirmed"])
@pytest.mark.parametrize("offset", [timedelta(0), timedelta(minutes=1), timedelta(hours=1)])
def test_at_or_after_start_rejected(tutor, evaluation, state, offset, monkeypatch):
    EvaluationRequest.objects.filter(pk=17).update(status=state)
    monkeypatch.setattr("django.utils.timezone.now", lambda: START + offset)
    client = APIClient()
    client.force_authenticate(tutor)
    response = client.post(release_url())
    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "evaluation_already_started",
            "message": "This evaluation has already started.",
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.status == state
    assert evaluation.picked_by_id == 42


def test_just_before_start_allowed(tutor, evaluation, expected, monkeypatch):
    monkeypatch.setattr("django.utils.timezone.now", lambda: START - timedelta(microseconds=1))
    client = APIClient()
    client.force_authenticate(tutor)
    response = client.post(release_url())
    expected["updated_at"] = "2026-10-12T14:59:59.999999Z"
    assert response.status_code == 200
    assert response.json() == expected


def test_cancelled_pick_cannot_be_released(student, tutor, evaluation):
    EvaluationRequest.objects.filter(pk=17).update(
        status="cancelled", cancelled_by=student, cancelled_at=NOW
    )
    client = APIClient()
    client.force_authenticate(tutor)
    response = client.post(release_url())
    assert response.status_code == 409
    assert response.json() == INVALID_STATE
    evaluation.refresh_from_db()
    assert evaluation.status == "cancelled"
    assert evaluation.picked_by_id == 42


def test_recorded_result_cannot_be_released(tutor, evaluation):
    EvaluationRequest.objects.filter(pk=17).update(status="confirmed", result="passed")
    client = APIClient()
    client.force_authenticate(tutor)
    response = client.post(release_url())
    assert response.status_code == 409
    assert response.json() == INVALID_STATE
    evaluation.refresh_from_db()
    assert evaluation.result == "passed"
    assert evaluation.status == "confirmed"


@pytest.mark.parametrize("state", ["pending", "expired"])
def test_stale_snapshot_cannot_release_unpicked_request(tutor, evaluation, state):
    changes = {"status": state, "picked_by": None, "starts_at": None, "ends_at": None}
    if state == "expired":
        changes["expired_at"] = NOW
    EvaluationRequest.objects.filter(pk=17).update(**changes)
    with pytest.raises(InvalidStateTransition):
        release_slot(evaluation, tutor)
    evaluation.refresh_from_db()
    assert evaluation.status == state


def test_stale_snapshot_cannot_release_another_tutors_new_pick(tutor, evaluation):
    replacement = get_user_model().objects.create_user(id=43, email="cara@example.com")
    EvaluationRequest.objects.filter(pk=17).update(picked_by=replacement)
    with pytest.raises(PermissionDenied):
        release_slot(evaluation, tutor)
    evaluation.refresh_from_db()
    assert evaluation.picked_by_id == 43
    assert evaluation.status == "awaiting_confirmation"


@pytest.mark.django_db(transaction=True)
def test_concurrent_releases_have_one_winner(tutor, evaluation, expected, monkeypatch):
    barrier = Barrier(2)

    def synchronized_release(snapshot, user):
        # Both requests passed object permissions before either update starts.
        barrier.wait(timeout=10)
        return release_slot(snapshot, user)

    monkeypatch.setattr("apps.evaluations.views.requests.release_slot", synchronized_release)

    def submit(_):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(get_user_model().objects.get(pk=tutor.pk))
            response = client.post(release_url())
            return response.status_code, response.json()
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = sorted(executor.map(submit, range(2)))
    assert responses == [(200, expected), (409, INVALID_STATE)]
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"
    assert evaluation.picked_by_id is None
