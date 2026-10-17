"""Student cancellation: states, timing, ownership, history and CSRF."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier

import pytest
from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.evaluations.models import EvaluationRequest, Project
from apps.evaluations.services import cancel_request

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("empty_project_catalog")]
NOW = datetime(2026, 10, 10, 9, tzinfo=timezone.utc)
START = datetime(2026, 10, 12, 15, tzinfo=timezone.utc)
PASSWORD = "RequestPassword123!"
INVALID_STATE = {
    "error": {
        "code": "invalid_state_transition",
        "message": "Only active requests without a result can be cancelled.",
    }
}


def cancel_url(pk=17):
    return reverse("api:evaluation-request-cancel", kwargs={"pk": pk})


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
        id=7, email="alice@example.com", display_name="Alice", password=PASSWORD
    )


@pytest.fixture
def tutor(seeded_roles):
    user = get_user_model().objects.create_user(id=42, email="bob@example.com", display_name="Bob")
    user.roles.add(Role.objects.get(name="tutor"))
    return user


@pytest.fixture
def evaluation(student, tutor):
    project = Project.objects.create(id=4, slug="libft", name="Libft")
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
        "student": {"id": 7, "display_name": "Alice", "avatar_url": None},
        "project": {"id": 4, "slug": "libft", "name": "Libft"},
        "note": "Parsing.",
        "status": "cancelled",
        "picked_by": {"id": 42, "display_name": "Bob", "avatar_url": None},
        "starts_at": "2026-10-12T15:00:00Z",
        "ends_at": "2026-10-12T15:45:00Z",
        "cancelled_by": {"id": 7, "display_name": "Alice", "avatar_url": None},
        "cancelled_at": "2026-10-10T09:00:00Z",
        "expired_at": None,
        "result": None,
        "feedback": "",
        "completed_at": None,
        "is_history": True,
        "created_at": "2026-10-10T09:00:00Z",
        "updated_at": "2026-10-10T09:00:00Z",
    }


def session_client(student):
    client = APIClient(enforce_csrf_checks=True)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    response = client.post(
        reverse("api:login"),
        {"email": student.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    return client


@pytest.mark.parametrize("state", ["pending", "awaiting_confirmation", "confirmed"])
def test_cancel_each_active_state_with_real_session(student, tutor, evaluation, expected, state):
    changes = {"status": state}
    if state == "pending":
        changes.update(picked_by=None, starts_at=None, ends_at=None)
        expected.update(picked_by=None, starts_at=None, ends_at=None)
    EvaluationRequest.objects.filter(pk=17).update(**changes)
    client = session_client(student)
    response = client.post(
        cancel_url(),
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    assert response.json() == expected
    evaluation.refresh_from_db()
    assert evaluation.status == "cancelled"
    assert evaluation.cancelled_by_id == 7
    assert evaluation.cancelled_at == NOW
    assert evaluation.updated_at == NOW
    assert evaluation.note == "Parsing."

    tutor_client = APIClient()
    tutor_client.force_authenticate(tutor)
    list_url = reverse("api:evaluation-request-list")
    for viewer, scope in ((client, "mine"), (tutor_client, "picked")):
        response = viewer.get(list_url, {"scope": scope, "history": "false"}, HTTP_HOST="localhost")
        assert response.status_code == 200
        assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}
        response = viewer.get(list_url, {"scope": scope, "history": "true"}, HTTP_HOST="localhost")
        assert response.status_code == 200
        if scope == "picked" and state == "pending":
            assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}
        else:
            assert response.json() == {
                "count": 1,
                "next": None,
                "previous": None,
                "results": [expected],
            }


def test_authentication_required():
    response = APIClient().post(cancel_url())
    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }


def test_csrf_required(student, evaluation):
    response = session_client(student).post(cancel_url(), HTTP_HOST="localhost")
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "csrf_failed",
            "message": "CSRF verification failed. Reload the page and try again.",
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.status == "awaiting_confirmation"
    assert evaluation.cancelled_at is None


@pytest.mark.parametrize("role", ["tutor", "head_tutor", "admin"])
def test_non_owner_cannot_use_student_cancellation(tutor, evaluation, role):
    tutor.roles.add(Role.objects.get(name=role))
    client = APIClient()
    client.force_authenticate(tutor)
    response = client.post(cancel_url())
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "permission_denied",
            "message": "You do not have permission to perform this action.",
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.status == "awaiting_confirmation"
    assert evaluation.cancelled_at is None


@pytest.mark.parametrize("pk", [17, 999])
def test_hidden_or_missing_request_returns_404(evaluation, pk):
    stranger = get_user_model().objects.create_user(email="stranger@example.com")
    client = APIClient()
    client.force_authenticate(stranger)
    response = client.post(cancel_url(pk))
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}


@pytest.mark.parametrize("state", ["cancelled", "expired"])
def test_terminal_states_rejected(student, evaluation, state):
    changes = {"status": state}
    if state == "cancelled":
        changes.update(cancelled_by=student, cancelled_at=NOW)
    else:
        changes.update(picked_by=None, starts_at=None, ends_at=None, expired_at=NOW)
    EvaluationRequest.objects.filter(pk=17).update(**changes)
    client = APIClient()
    client.force_authenticate(student)
    response = client.post(cancel_url())
    assert response.status_code == 409
    assert response.json() == INVALID_STATE
    evaluation.refresh_from_db()
    assert evaluation.status == state


@pytest.mark.parametrize("state", ["awaiting_confirmation", "confirmed"])
@pytest.mark.parametrize("offset", [timedelta(0), timedelta(minutes=1), timedelta(hours=1)])
def test_at_or_after_start_rejected(student, evaluation, monkeypatch, state, offset):
    EvaluationRequest.objects.filter(pk=17).update(status=state)
    monkeypatch.setattr("django.utils.timezone.now", lambda: START + offset)
    client = APIClient()
    client.force_authenticate(student)
    response = client.post(cancel_url())
    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "evaluation_already_started",
            "message": "This evaluation has already started.",
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.status == state
    assert evaluation.cancelled_at is None


def test_just_before_start_allowed(student, evaluation, monkeypatch, expected):
    monkeypatch.setattr("django.utils.timezone.now", lambda: START - timedelta(microseconds=1))
    client = APIClient()
    client.force_authenticate(student)
    response = client.post(cancel_url())
    expected.update(
        cancelled_at="2026-10-12T14:59:59.999999Z", updated_at="2026-10-12T14:59:59.999999Z"
    )
    assert response.status_code == 200
    assert response.json() == expected


def test_recorded_result_cannot_be_cancelled(student, evaluation):
    EvaluationRequest.objects.filter(pk=17).update(status="confirmed", result="passed")
    client = APIClient()
    client.force_authenticate(student)
    response = client.post(cancel_url())
    assert response.status_code == 409
    assert response.json() == INVALID_STATE
    evaluation.refresh_from_db()
    assert evaluation.status == "confirmed"
    assert evaluation.result == "passed"


def test_cancellation_refreshes_released_pick(student, evaluation, expected):
    # A decline/release may have cleared the slot after the view fetched the row.
    EvaluationRequest.objects.filter(pk=17).update(
        status="pending", picked_by=None, starts_at=None, ends_at=None
    )
    cancel_request(evaluation)
    expected.update(picked_by=None, starts_at=None, ends_at=None)
    client = APIClient()
    client.force_authenticate(student)
    response = client.get(reverse("api:evaluation-request-detail", kwargs={"pk": 17}))
    assert response.status_code == 200
    assert response.json() == expected


@pytest.mark.django_db(transaction=True)
def test_concurrent_cancellations_have_one_winner(student, evaluation, expected):
    barrier = Barrier(2)

    def submit(_):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(get_user_model().objects.get(pk=student.pk))
            barrier.wait(timeout=10)
            response = client.post(cancel_url())
            return response.status_code, response.json()
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = sorted(executor.map(submit, range(2)))
    assert responses == [(200, expected), (409, INVALID_STATE)]
    evaluation.refresh_from_db()
    assert evaluation.status == "cancelled"
    assert evaluation.picked_by_id == 42
    assert evaluation.starts_at == START
