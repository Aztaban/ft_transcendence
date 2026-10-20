"""Student decline (#197) and returning requests to the open queue (#199)."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from types import SimpleNamespace
from unittest.mock import AsyncMock, call

import pytest
from django.contrib.auth import get_user_model
from django.db import close_old_connections, transaction
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.evaluations.models import EvaluationRequest, Project, TutorEligibility
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


@pytest.fixture(autouse=True)
def event_sender(monkeypatch):
    sender = AsyncMock()
    monkeypatch.setattr(
        "apps.core.events.get_channel_layer", lambda: SimpleNamespace(group_send=sender)
    )
    return sender


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


def test_decline_with_real_session_and_no_body(
    student, evaluation, expected, monkeypatch, event_sender, django_capture_on_commit_callbacks
):
    at = NOW + timedelta(minutes=1)
    monkeypatch.setattr("django.utils.timezone.now", lambda: at)
    client = session_client(student)
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = client.post(
            decline_url(),
            HTTP_HOST="localhost",
            HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
        )
        event_sender.assert_not_awaited()
    expected["updated_at"] = "2026-10-10T09:01:00Z"
    assert response.status_code == 200
    assert response.json() == expected
    assert len(callbacks) == 1
    assert event_sender.await_args_list == [
        call(
            "user_7",
            {
                "type": "user.event",
                "event": "evaluation.declined",
                "data": {"id": 17, "status": "pending"},
            },
        ),
        call(
            "user_42",
            {
                "type": "user.event",
                "event": "evaluation.declined",
                "data": {"id": 17, "status": "pending"},
            },
        ),
    ]
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"
    assert evaluation.picked_by_id is None
    assert evaluation.starts_at is None
    assert evaluation.ends_at is None
    assert evaluation.created_at == NOW
    assert evaluation.updated_at == at
    assert evaluation.note == "Parsing."


@pytest.mark.parametrize("picker_id", [42, 43])
def test_declined_request_returns_anonymously_to_queue_and_can_be_picked_again(
    student, tutor, evaluation, expected, picker_id
):
    other_tutor = get_user_model().objects.create_user(
        id=43, email="cara@example.com", display_name="Cara"
    )
    other_tutor.roles.add(Role.objects.get(name="tutor"))
    clients = {}
    for user in (tutor, other_tutor):
        TutorEligibility.objects.create(tutor=user, project=evaluation.project)
        clients[user.pk] = APIClient()
        clients[user.pk].force_authenticate(user)
    list_url = reverse("api:evaluation-request-list")
    detail_url = reverse("api:evaluation-request-detail", kwargs={"pk": 17})
    for client in clients.values():
        response = client.get(list_url, {"scope": "open"})
        assert response.status_code == 200
        assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}

    owner_client = session_client(student)
    response = owner_client.post(
        decline_url(),
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=owner_client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    assert response.json() == expected
    response = owner_client.get(
        list_url, {"scope": "mine", "history": "false"}, HTTP_HOST="localhost"
    )
    assert response.status_code == 200
    assert response.json() == {"count": 1, "next": None, "previous": None, "results": [expected]}
    response = clients[42].get(list_url, {"scope": "picked", "history": "false"})
    assert response.status_code == 200
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}

    anonymous = {**expected, "student": None}
    for client in clients.values():
        response = client.get(list_url, {"scope": "open"})
        assert response.status_code == 200
        assert response.json() == {
            "count": 1,
            "next": None,
            "previous": None,
            "results": [anonymous],
        }
        response = client.get(detail_url)
        assert response.status_code == 200
        assert response.json() == anonymous

    # Both the former picker and a different eligible tutor can propose a new time.
    response = clients[picker_id].post(
        reverse("api:evaluation-request-pick-slot", kwargs={"pk": 17}),
        {"starts_at": "2026-10-13T16:00:00Z", "ends_at": "2026-10-13T16:30:00Z"},
        format="json",
    )
    picked = {
        **expected,
        "status": "awaiting_confirmation",
        "picked_by": {
            "id": picker_id,
            "display_name": "Bob" if picker_id == 42 else "Cara",
            "avatar_url": None,
        },
        "starts_at": "2026-10-13T16:00:00Z",
        "ends_at": "2026-10-13T16:30:00Z",
    }
    assert response.status_code == 200
    assert response.json() == picked
    response = owner_client.get(detail_url, HTTP_HOST="localhost")
    assert response.status_code == 200
    assert response.json() == picked
    for client in clients.values():
        response = client.get(list_url, {"scope": "open"})
        assert response.status_code == 200
        assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}
    response = clients[picker_id].get(list_url, {"scope": "picked", "history": "false"})
    assert response.status_code == 200
    assert response.json() == {"count": 1, "next": None, "previous": None, "results": [picked]}
    evaluation.refresh_from_db()
    assert evaluation.pk == 17
    assert evaluation.picked_by_id == picker_id
    assert evaluation.starts_at == datetime(2026, 10, 13, 16, tzinfo=timezone.utc)
    assert evaluation.ends_at == datetime(2026, 10, 13, 16, 30, tzinfo=timezone.utc)


def test_former_picker_without_eligibility_loses_access_after_decline(
    student, tutor, evaluation, expected
):
    tutor_client = APIClient()
    tutor_client.force_authenticate(tutor)
    detail_url = reverse("api:evaluation-request-detail", kwargs={"pk": 17})
    response = tutor_client.get(detail_url)
    assert response.status_code == 200
    assert response.json() == {
        **expected,
        "status": "awaiting_confirmation",
        "picked_by": {"id": 42, "display_name": "Bob", "avatar_url": None},
        "starts_at": "2026-10-12T15:00:00Z",
        "ends_at": "2026-10-12T15:45:00Z",
    }
    client = APIClient()
    client.force_authenticate(student)
    response = client.post(decline_url())
    assert response.status_code == 200
    assert response.json() == expected
    response = tutor_client.get(detail_url)
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}
    response = tutor_client.get(reverse("api:evaluation-request-list"), {"scope": "open"})
    assert response.status_code == 200
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}


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
def test_other_states_rejected(
    student, evaluation, status, event_sender, django_capture_on_commit_callbacks
):
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
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = client.post(decline_url())
    assert callbacks == []
    event_sender.assert_not_awaited()
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
def test_competing_transitions_have_one_winner(
    student, evaluation, expected, competing_action, event_sender
):
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
    if winner == "confirm":
        message = {
            "type": "user.event",
            "event": "evaluation.confirmed",
            "data": {"id": 17, "status": "confirmed"},
        }
    else:
        message = {
            "type": "user.event",
            "event": "evaluation.declined",
            "data": {"id": 17, "status": "pending"},
        }
    assert event_sender.await_args_list == [call("user_7", message), call("user_42", message)]


def test_decline_event_refreshes_only_active_eligible_queues(
    student, tutor, evaluation, event_sender, django_capture_on_commit_callbacks
):
    other_project = Project.objects.create(slug="other", name="Other")
    for pk, roles, status, project in (
        (43, ("head_tutor",), "active", evaluation.project),
        (44, ("tutor", "head_tutor"), "active", evaluation.project),
        (45, ("student",), "active", evaluation.project),
        (46, ("admin",), "active", evaluation.project),
        (47, ("tutor",), "suspended", evaluation.project),
        (48, ("tutor",), "deleted", evaluation.project),
        (49, ("tutor",), "active", other_project),
        (50, ("tutor",), "active", None),
    ):
        user = get_user_model().objects.create_user(
            id=pk, email=f"recipient-{pk}@example.com", status=status
        )
        user.roles.add(*Role.objects.filter(name__in=roles))
        if project is not None:
            TutorEligibility.objects.create(tutor=user, project=project)
    # Participants who are also eligible receive only one message.
    student.roles.add(Role.objects.get(name="tutor"))
    for participant in (student, tutor):
        TutorEligibility.objects.create(tutor=participant, project=evaluation.project)
    with django_capture_on_commit_callbacks(execute=True):
        decline_request(evaluation)
    message = {
        "type": "user.event",
        "event": "evaluation.declined",
        "data": {"id": 17, "status": "pending"},
    }
    assert event_sender.await_args_list == [
        call("user_7", message),
        call("user_42", message),
        call("user_43", message),
        call("user_44", message),
    ]


def test_stale_decline_notifies_actual_picker_before_clearing_pick(
    evaluation, event_sender, django_capture_on_commit_callbacks
):
    new_picker = get_user_model().objects.create_user(id=43, email="new-picker@example.com")
    new_picker.roles.add(Role.objects.get(name="tutor"))
    EvaluationRequest.objects.filter(pk=17).update(picked_by=new_picker)
    assert evaluation.picked_by_id == 42
    with django_capture_on_commit_callbacks(execute=True):
        decline_request(evaluation)
    message = {
        "type": "user.event",
        "event": "evaluation.declined",
        "data": {"id": 17, "status": "pending"},
    }
    assert event_sender.await_args_list == [call("user_7", message), call("user_43", message)]
    assert evaluation.picked_by_id is None


def test_rolled_back_decline_sends_no_event(
    evaluation, event_sender, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        with pytest.raises(RuntimeError, match="rollback"):
            with transaction.atomic():
                decline_request(evaluation)
                raise RuntimeError("rollback")
    assert callbacks == []
    event_sender.assert_not_awaited()
    evaluation.refresh_from_db()
    assert evaluation.status == "awaiting_confirmation"
    assert evaluation.picked_by_id == 42


@pytest.mark.django_db(transaction=True)
def test_decline_succeeds_and_logs_when_event_delivery_fails(
    student, evaluation, expected, event_sender, caplog
):
    event_sender.side_effect = ConnectionError("Redis unavailable")
    client = session_client(student)
    response = client.post(
        decline_url(),
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    assert response.json() == expected
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"
    assert evaluation.picked_by_id is None
    assert "Redis unavailable" in caplog.text
    assert any(record.exc_info for record in caplog.records)
