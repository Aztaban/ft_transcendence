"""Student cancellation and the final cancelled state."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier

import pytest
from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.evaluations.models import EvaluationRequest, Project, TutorEligibility
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


@pytest.mark.parametrize(
    "action,message",
    [
        ("confirm", "Only requests awaiting confirmation can be confirmed."),
        ("decline", "Only requests awaiting confirmation can be declined."),
        ("cancel", "Only active requests without a result can be cancelled."),
        ("release", "Only picked requests without a result can be released."),
        ("pick-slot", "This request is no longer pending."),
        ("edit", "Only pending requests can be edited."),
    ],
)
def test_cancelled_request_stays_final_and_preserves_metadata(
    student, tutor, evaluation, expected, monkeypatch, action, message
):
    client = session_client(student)
    response = client.post(
        cancel_url(),
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    assert response.json() == expected

    # An attempted later action must not replace the original cancellation time.
    monkeypatch.setattr("django.utils.timezone.now", lambda: NOW + timedelta(minutes=5))
    actor = tutor if action in ("release", "pick-slot") else student
    other_client = APIClient()
    other_client.force_authenticate(actor)
    if action == "edit":
        response = other_client.patch(
            reverse("api:evaluation-request-detail", kwargs={"pk": 17}),
            {"note": "Changed after cancellation."},
            format="json",
        )
    else:
        payload = {}
        if action == "pick-slot":
            TutorEligibility.objects.create(tutor=tutor, project=evaluation.project)
            payload = {
                "starts_at": "2026-10-13T16:00:00Z",
                "ends_at": "2026-10-13T16:45:00Z",
            }
        response = other_client.post(
            reverse(f"api:evaluation-request-{action}", kwargs={"pk": 17}),
            payload,
            format="json",
        )
    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "request_not_pending" if action == "pick-slot" else "invalid_state_transition",
            "message": message,
        }
    }
    response = client.get(
        reverse("api:evaluation-request-detail", kwargs={"pk": 17}), HTTP_HOST="localhost"
    )
    assert response.status_code == 200
    assert response.json() == expected
    evaluation.refresh_from_db()
    assert evaluation.cancelled_by_id == 7
    assert evaluation.cancelled_at == NOW
    assert evaluation.updated_at == NOW
    assert evaluation.picked_by_id == 42
    assert evaluation.starts_at == START
    assert evaluation.ends_at == START + timedelta(minutes=45)


@pytest.mark.parametrize("state", ["pending", "awaiting_confirmation", "confirmed"])
def test_cancelled_request_does_not_block_new_request_for_same_project(
    student, evaluation, expected, state
):
    changes = {"status": state}
    if state == "pending":
        changes.update(picked_by=None, starts_at=None, ends_at=None)
        expected.update(picked_by=None, starts_at=None, ends_at=None)
    EvaluationRequest.objects.filter(pk=17).update(**changes)
    client = session_client(student)
    headers = {
        "HTTP_HOST": "localhost",
        "HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value,
    }
    response = client.post(cancel_url(), **headers)
    assert response.status_code == 200
    assert response.json() == expected
    response = client.post(
        reverse("api:evaluation-request-list"),
        {"project_id": 4, "note": "A new request."},
        format="json",
        **headers,
    )
    assert response.status_code == 201
    new_request = EvaluationRequest.objects.get(student=student, project_id=4, status="pending")
    assert new_request.pk != 17
    assert response.json() == {
        "id": new_request.pk,
        "student": {"id": 7, "display_name": "Alice", "avatar_url": None},
        "project": {"id": 4, "slug": "libft", "name": "Libft"},
        "note": "A new request.",
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
    response = client.get(
        reverse("api:evaluation-request-detail", kwargs={"pk": 17}), HTTP_HOST="localhost"
    )
    assert response.status_code == 200
    assert response.json() == expected


def test_cancelled_pick_no_longer_reserves_participants_time(student, tutor, evaluation, expected):
    owner_client = APIClient()
    owner_client.force_authenticate(student)
    response = owner_client.post(cancel_url())
    assert response.status_code == 200
    assert response.json() == expected
    # A new request for the same student can use the same tutor and time.
    EvaluationRequest.objects.create(
        id=18, student=student, project=evaluation.project, note="New evaluation."
    )
    TutorEligibility.objects.create(tutor=tutor, project=evaluation.project)
    client = APIClient()
    client.force_authenticate(tutor)
    response = client.post(
        reverse("api:evaluation-request-pick-slot", kwargs={"pk": 18}),
        {"starts_at": "2026-10-12T15:00:00Z", "ends_at": "2026-10-12T15:45:00Z"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json() == {
        **expected,
        "id": 18,
        "note": "New evaluation.",
        "status": "awaiting_confirmation",
        "cancelled_by": None,
        "cancelled_at": None,
        "is_history": False,
    }
    response = owner_client.get(reverse("api:evaluation-request-detail", kwargs={"pk": 17}))
    assert response.status_code == 200
    assert response.json() == expected


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


@pytest.mark.parametrize("state", ["pending", "awaiting_confirmation", "confirmed"])
@pytest.mark.parametrize("role", ["student", "tutor", "head_tutor", "sc_member", "admin"])
def test_other_users_cannot_cancel_across_active_states_with_real_session(
    student, evaluation, expected, state, role
):
    changes = {"status": state}
    if state == "pending":
        changes.update(picked_by=None, starts_at=None, ends_at=None)
    EvaluationRequest.objects.filter(pk=17).update(**changes)
    outsider = get_user_model().objects.create_user(
        id=43, email="outsider@example.com", display_name="Outsider", password=PASSWORD
    )
    outsider.roles.add(Role.objects.get(name=role))
    if role == "tutor":
        TutorEligibility.objects.create(tutor=outsider, project=evaluation.project)
    client = session_client(outsider)
    response = client.post(
        cancel_url(),
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    # Normal cancellation never grants an override. Visible objects give 403;
    # hidden ones give 404, including picked requests for an unrelated tutor.
    visible = role in ("head_tutor", "admin") or (role == "tutor" and state == "pending")
    assert response.status_code == (403 if visible else 404)
    if visible:
        assert response.json() == {
            "error": {
                "code": "permission_denied",
                "message": "You do not have permission to perform this action.",
            }
        }
    else:
        assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}

    # Verify the full representation through the owner's session after the denial.
    expected.update(status=state, cancelled_by=None, cancelled_at=None, is_history=False)
    if state == "pending":
        expected.update(picked_by=None, starts_at=None, ends_at=None)
    owner_client = session_client(student)
    response = owner_client.get(
        reverse("api:evaluation-request-detail", kwargs={"pk": 17}), HTTP_HOST="localhost"
    )
    assert response.status_code == 200
    assert response.json() == expected
    evaluation.refresh_from_db()
    assert evaluation.status == state
    assert evaluation.cancelled_by_id is None
    assert evaluation.cancelled_at is None
    assert evaluation.updated_at == NOW


@pytest.mark.parametrize("role", ["tutor", "head_tutor", "sc_member", "admin"])
def test_additional_roles_do_not_prevent_owner_cancellation(student, evaluation, expected, role):
    student.roles.add(Role.objects.get(name=role))
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


@pytest.mark.parametrize("result", ["passed", "failed"])
@pytest.mark.parametrize("at", [NOW, START + timedelta(hours=1)])
def test_recorded_result_cannot_be_cancelled(student, evaluation, monkeypatch, result, at):
    EvaluationRequest.objects.filter(pk=17).update(status="confirmed", result=result)
    monkeypatch.setattr("django.utils.timezone.now", lambda: at)
    client = APIClient()
    client.force_authenticate(student)
    response = client.post(cancel_url())
    assert response.status_code == 409
    if at == NOW:
        assert response.json() == INVALID_STATE
    else:
        assert response.json() == {
            "error": {
                "code": "evaluation_already_started",
                "message": "This evaluation has already started.",
            }
        }
    evaluation.refresh_from_db()
    assert evaluation.status == "confirmed"
    assert evaluation.result == result
    assert evaluation.cancelled_by_id is None
    assert evaluation.cancelled_at is None
    assert evaluation.updated_at == NOW
    assert evaluation.starts_at == START


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
