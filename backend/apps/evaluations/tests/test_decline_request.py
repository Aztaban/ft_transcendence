"""Student decline: permissions, sessions and competing state changes."""

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
from apps.evaluations.services import InvalidStateTransition, decline_request

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("empty_project_catalog")]
NOW = datetime(2026, 10, 10, 9, tzinfo=timezone.utc)
START = datetime(2026, 10, 12, 15, tzinfo=timezone.utc)
PASSWORD = "RequestPassword123!"
INVALID_STATE = {
    "error": {
        "code": "invalid_state_transition",
        "message": "Only requests awaiting confirmation can be declined.",
    }
}


def decline_url(pk=17):
    return reverse("api:evaluation-request-decline", kwargs={"pk": pk})


@pytest.fixture(autouse=True)
def fixed_time(monkeypatch):
    monkeypatch.setattr("django.utils.timezone.now", lambda: NOW)


@pytest.fixture
def seeded_roles():
    # Transaction tests flush migration seed data between tests.
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


def test_decline_with_real_session_and_no_body(student, evaluation, expected, monkeypatch):
    at = NOW + timedelta(minutes=1)
    monkeypatch.setattr("django.utils.timezone.now", lambda: at)
    client = session_client(student)
    response = client.post(
        decline_url(),
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    expected["updated_at"] = "2026-10-10T09:01:00Z"
    assert response.status_code == 200
    assert response.json() == expected
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"
    assert evaluation.picked_by_id is None
    assert evaluation.starts_at is None
    assert evaluation.ends_at is None
    assert evaluation.created_at == NOW
    assert evaluation.updated_at == at
    assert evaluation.note == "Parsing."


def test_authentication_required():
    response = APIClient().post(decline_url())
    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }


def test_csrf_required(student, evaluation):
    response = session_client(student).post(decline_url(), HTTP_HOST="localhost")
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "csrf_failed",
            "message": "CSRF verification failed. Reload the page and try again.",
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.status == "awaiting_confirmation"
    assert evaluation.picked_by_id == 42


@pytest.mark.parametrize("role", ["tutor", "head_tutor", "admin"])
def test_visible_non_owner_cannot_decline(tutor, evaluation, role):
    tutor.roles.add(Role.objects.get(name=role))
    client = APIClient()
    client.force_authenticate(tutor)
    response = client.post(decline_url())
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "permission_denied",
            "message": "You do not have permission to perform this action.",
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.status == "awaiting_confirmation"
    assert evaluation.picked_by_id == 42


@pytest.mark.parametrize("pk", [17, 999])
def test_hidden_or_missing_request_returns_404(evaluation, pk):
    stranger = get_user_model().objects.create_user(email="stranger@example.com")
    client = APIClient()
    client.force_authenticate(stranger)
    response = client.post(decline_url(pk))
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}


@pytest.mark.parametrize("status", ["pending", "confirmed", "cancelled", "expired"])
def test_other_states_rejected(student, evaluation, status):
    changes = {"status": status}
    if status in ("pending", "expired"):
        changes.update(picked_by=None, starts_at=None, ends_at=None)
    if status == "expired":
        changes["expired_at"] = NOW
    if status == "cancelled":
        changes.update(cancelled_by=student, cancelled_at=NOW)
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(**changes)
    client = APIClient()
    client.force_authenticate(student)
    response = client.post(decline_url())
    assert response.status_code == 409
    assert response.json() == INVALID_STATE
    evaluation.refresh_from_db()
    assert evaluation.status == status


@pytest.mark.parametrize("offset", [timedelta(0), timedelta(minutes=1)])
def test_decline_allowed_at_or_after_start(student, evaluation, monkeypatch, expected, offset):
    # Unlike confirm/release, decline has no start-time restriction (§7.1).
    monkeypatch.setattr("django.utils.timezone.now", lambda: START + offset)
    client = APIClient()
    client.force_authenticate(student)
    response = client.post(decline_url())
    expected["updated_at"] = (
        "2026-10-12T15:00:00Z" if offset == timedelta(0) else "2026-10-12T15:01:00Z"
    )
    assert response.status_code == 200
    assert response.json() == expected


def test_stale_instance_cannot_decline_confirmed_pick(evaluation):
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(status="confirmed")
    with pytest.raises(InvalidStateTransition):
        decline_request(evaluation)
    evaluation.refresh_from_db()
    assert evaluation.status == "confirmed"
    assert evaluation.picked_by_id == 42
    assert evaluation.starts_at == START


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("competing_action", ["decline", "confirm"])
def test_competing_transitions_have_one_winner(student, evaluation, expected, competing_action):
    barrier = Barrier(2)

    def submit(action):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(get_user_model().objects.get(pk=student.pk))
            url = reverse(f"api:evaluation-request-{action}", kwargs={"pk": 17})
            barrier.wait(timeout=10)
            response = client.post(url)
            return action, response.status_code, response.json()
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(submit, ("decline", competing_action)))
    assert sorted(code for _, code, _ in responses) == [200, 409]
    winner, _, body = next(response for response in responses if response[1] == 200)
    loser, _, error = next(response for response in responses if response[1] == 409)
    if winner == "confirm":
        expected.update(
            status="confirmed",
            picked_by={"id": 42, "display_name": "Bob", "avatar_url": None},
            starts_at="2026-10-12T15:00:00Z",
            ends_at="2026-10-12T15:45:00Z",
        )
    assert body == expected
    assert error == {
        "error": {
            "code": "invalid_state_transition",
            "message": (
                "Only requests awaiting confirmation can be confirmed."
                if loser == "confirm"
                else "Only requests awaiting confirmation can be declined."
            ),
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.status == expected["status"]
