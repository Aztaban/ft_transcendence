"""Student confirmation (#196) and Pending Evaluations visibility (#198)."""

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
from apps.evaluations.services import InvalidStateTransition, confirm_request

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("empty_project_catalog")]
NOW = datetime(2026, 10, 10, 9, tzinfo=timezone.utc)
START = datetime(2026, 10, 12, 15, tzinfo=timezone.utc)
PASSWORD = "RequestPassword123!"
INVALID_STATE = {
    "error": {
        "code": "invalid_state_transition",
        "message": "Only requests awaiting confirmation can be confirmed.",
    }
}


def confirm_url(pk=17):
    return reverse("api:evaluation-request-confirm", kwargs={"pk": pk})


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
        "status": "confirmed",
        "picked_by": {"id": 42, "display_name": "Bob", "avatar_url": None},
        "starts_at": "2026-10-12T15:00:00Z",
        "ends_at": "2026-10-12T15:45:00Z",
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


def test_confirm_with_real_session_and_no_body(student, evaluation, expected):
    client = session_client(student)
    response = client.post(
        confirm_url(),
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    assert response.json() == expected
    evaluation.refresh_from_db()
    assert evaluation.status == "confirmed"
    assert evaluation.picked_by_id == 42
    assert evaluation.starts_at == START
    assert evaluation.ends_at == START + timedelta(minutes=45)

    # Re-fetch using exactly the existing PendingPage student query.
    response = client.get(
        reverse("api:evaluation-request-list"),
        {"scope": "mine", "status": "confirmed", "history": "false", "ordering": "starts_at"},
        HTTP_HOST="localhost",
    )
    assert response.status_code == 200
    assert response.json() == {"count": 1, "next": None, "previous": None, "results": [expected]}


def test_authentication_required():
    response = APIClient().post(confirm_url())
    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }


def test_confirmation_updates_both_participants_pending_lists(student, tutor, evaluation, expected):
    student_client = session_client(student)
    tutor_client = APIClient()
    tutor_client.force_authenticate(tutor)
    list_url = reverse("api:evaluation-request-list")
    student_query = {
        "scope": "mine",
        "status": "confirmed",
        "history": "false",
        "ordering": "starts_at",
    }
    tutor_query = {"scope": "picked", "history": "false", "ordering": "starts_at"}

    # These are the exact queries issued by PendingPage for its two workspaces.
    response = student_client.get(list_url, student_query, HTTP_HOST="localhost")
    assert response.status_code == 200
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}
    awaiting = {**expected, "status": "awaiting_confirmation"}
    response = tutor_client.get(list_url, tutor_query)
    assert response.status_code == 200
    assert response.json() == {"count": 1, "next": None, "previous": None, "results": [awaiting]}

    response = student_client.post(
        confirm_url(),
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=student_client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    assert response.json() == expected
    for client, query in ((student_client, student_query), (tutor_client, tutor_query)):
        response = client.get(list_url, query, HTTP_HOST="localhost")
        assert response.status_code == 200
        assert response.json() == {
            "count": 1,
            "next": None,
            "previous": None,
            "results": [expected],
        }
        response = client.get(
            reverse("api:evaluation-request-detail", kwargs={"pk": 17}), HTTP_HOST="localhost"
        )
        assert response.status_code == 200
        assert response.json() == expected

    # It no longer belongs to either participant's awaiting-confirmation list.
    for client, scope in ((student_client, "mine"), (tutor_client, "picked")):
        response = client.get(
            list_url,
            {"scope": scope, "status": "awaiting_confirmation", "history": "false"},
            HTTP_HOST="localhost",
        )
        assert response.status_code == 200
        assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}


@pytest.mark.parametrize("scope", ["mine", "picked"])
def test_confirmed_evaluation_is_hidden_from_other_participants_lists(
    student, evaluation, expected, scope
):
    owner_client = APIClient()
    owner_client.force_authenticate(student)
    response = owner_client.post(confirm_url())
    assert response.status_code == 200
    assert response.json() == expected

    stranger = get_user_model().objects.create_user(email="stranger@example.com")
    stranger.roles.add(Role.objects.get(name="tutor"))
    client = APIClient()
    client.force_authenticate(stranger)
    query = {"scope": scope, "history": "false", "ordering": "starts_at"}
    if scope == "mine":
        query["status"] = "confirmed"
    response = client.get(reverse("api:evaluation-request-list"), query)
    assert response.status_code == 200
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}
    response = client.get(reverse("api:evaluation-request-detail", kwargs={"pk": 17}))
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}


@pytest.mark.parametrize("scope", ["mine", "picked"])
@pytest.mark.parametrize(
    "at,is_history",
    [
        (START, False),
        (START + timedelta(minutes=45), False),
        (START + timedelta(minutes=45, microseconds=1), True),
    ],
)
def test_confirmed_slot_stays_pending_until_its_end_passes(
    student, tutor, evaluation, expected, monkeypatch, scope, at, is_history
):
    client = APIClient()
    client.force_authenticate(student)
    response = client.post(confirm_url())
    assert response.status_code == 200
    assert response.json() == expected

    monkeypatch.setattr("django.utils.timezone.now", lambda: at)
    client.force_authenticate(student if scope == "mine" else tutor)
    expected["is_history"] = is_history
    for history in ("false", "true"):
        query = {"scope": scope, "history": history, "ordering": "starts_at"}
        if scope == "mine":
            query["status"] = "confirmed"
        response = client.get(reverse("api:evaluation-request-list"), query)
        assert response.status_code == 200
        if (history == "true") == is_history:
            assert response.json() == {
                "count": 1,
                "next": None,
                "previous": None,
                "results": [expected],
            }
        else:
            assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}
    evaluation.refresh_from_db()
    assert evaluation.status == "confirmed"
    assert evaluation.result is None


def test_csrf_required(student, evaluation):
    response = session_client(student).post(confirm_url(), HTTP_HOST="localhost")
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "csrf_failed",
            "message": "CSRF verification failed. Reload the page and try again.",
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.status == "awaiting_confirmation"


@pytest.mark.parametrize("role", ["tutor", "head_tutor", "admin"])
def test_visible_non_owner_cannot_confirm(tutor, evaluation, role):
    tutor.roles.add(Role.objects.get(name=role))
    client = APIClient()
    client.force_authenticate(tutor)
    response = client.post(confirm_url())
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "permission_denied",
            "message": "You do not have permission to perform this action.",
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.status == "awaiting_confirmation"


@pytest.mark.parametrize("pk", [17, 999])
def test_hidden_or_missing_request_returns_404(evaluation, pk):
    stranger = get_user_model().objects.create_user(email="stranger@example.com")
    client = APIClient()
    client.force_authenticate(stranger)
    response = client.post(confirm_url(pk))
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
    response = client.post(confirm_url())
    assert response.status_code == 409
    assert response.json() == INVALID_STATE
    evaluation.refresh_from_db()
    assert evaluation.status == status


@pytest.mark.parametrize("offset", [timedelta(0), timedelta(microseconds=1)])
def test_start_boundary_rejected(student, evaluation, monkeypatch, offset):
    monkeypatch.setattr("django.utils.timezone.now", lambda: START + offset)
    client = APIClient()
    client.force_authenticate(student)
    response = client.post(confirm_url())
    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "evaluation_already_started",
            "message": "This evaluation has already started.",
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.status == "awaiting_confirmation"


def test_just_before_start_is_allowed(student, evaluation, monkeypatch, expected):
    monkeypatch.setattr("django.utils.timezone.now", lambda: START - timedelta(microseconds=1))
    client = APIClient()
    client.force_authenticate(student)
    response = client.post(confirm_url())
    expected["updated_at"] = "2026-10-12T14:59:59.999999Z"
    assert response.status_code == 200
    assert response.json() == expected


def test_stale_instance_cannot_confirm_released_pick(evaluation):
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(
        status="pending", picked_by=None, starts_at=None, ends_at=None
    )
    with pytest.raises(InvalidStateTransition):
        confirm_request(evaluation)
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"


@pytest.mark.django_db(transaction=True)
def test_concurrent_confirmation_has_one_winner(student, evaluation, expected):
    barrier = Barrier(2)

    def submit(_):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(get_user_model().objects.get(pk=student.pk))
            barrier.wait(timeout=10)
            response = client.post(confirm_url())
            return response.status_code, response.json()
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = sorted(executor.map(submit, range(2)))
    assert responses == [(200, expected), (409, INVALID_STATE)]
    evaluation.refresh_from_db()
    assert evaluation.status == "confirmed"
