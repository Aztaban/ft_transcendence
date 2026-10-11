"""Request API contracts and MySQL concurrency."""

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

pytestmark = pytest.mark.django_db
NOW = datetime(2026, 10, 10, 9, tzinfo=timezone.utc)
PASSWORD = "RequestPassword123!"


def list_url():
    return reverse("api:evaluation-request-list")


def detail_url(pk=17):
    return reverse("api:evaluation-request-detail", kwargs={"pk": pk})


@pytest.fixture(autouse=True)
def fixed_time(monkeypatch):
    monkeypatch.setattr("django.utils.timezone.now", lambda: NOW)


@pytest.fixture
def student():
    return get_user_model().objects.create_user(
        id=7, email="alice@example.com", display_name="Alice", password=PASSWORD
    )


@pytest.fixture
def other():
    return get_user_model().objects.create_user(
        id=42, email="bob@example.com", display_name="Bob", password=PASSWORD
    )


@pytest.fixture
def project():
    return Project.objects.create(id=4, slug="libft", name="Libft")


@pytest.fixture
def client(student):
    client = APIClient()
    client.force_authenticate(student)
    return client


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


def logged_in_client(student):
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


@pytest.mark.parametrize(
    "method,detail", [("get", False), ("post", False), ("get", True), ("patch", True)]
)
def test_requires_authentication(method, detail):
    response = getattr(APIClient(), method)(
        detail_url() if detail else list_url(), {}, format="json"
    )
    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }


@pytest.mark.parametrize("note", [None, "Parsing.", "x" * 500])
def test_create_real_session(student, project, expected, note):
    client = logged_in_client(student)
    payload = {"project_id": 4, "student": 42, "status": "cancelled"}
    if note is not None:
        payload["note"] = note
    response = client.post(
        list_url(),
        payload,
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 201
    created = EvaluationRequest.objects.get()
    expected.update(id=created.pk, note=note or "")
    assert response.json() == expected
    assert (created.student_id, created.project_id, created.status, created.note) == (
        7,
        4,
        "pending",
        note or "",
    )


@pytest.mark.parametrize("method", ["post", "patch"])
def test_csrf_required(student, evaluation, method):
    client = logged_in_client(student)
    response = getattr(client, method)(
        list_url() if method == "post" else detail_url(),
        {"note": "Changed"},
        format="json",
        HTTP_HOST="localhost",
    )
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "csrf_failed",
            "message": "CSRF verification failed. Reload the page and try again.",
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.note == "Parsing."


@pytest.mark.parametrize(
    "payload,field,message",
    [
        ({}, "project_id", "This field is required."),
        ({"project_id": None}, "project_id", "This field may not be null."),
        ({"project_id": "wrong"}, "project_id", "Incorrect type. Expected pk value, received str."),
        ({"project_id": 99}, "project_id", 'Invalid pk "99" - object does not exist.'),
        ({"project_id": 4, "note": None}, "note", "This field may not be null."),
        (
            {"project_id": 4, "note": "x" * 501},
            "note",
            "Ensure this field has no more than 500 characters.",
        ),
    ],
)
def test_create_validation(client, project, payload, field, message):
    response = client.post(list_url(), payload, format="json")
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {field: [message]},
        }
    }
    assert not EvaluationRequest.objects.exists()


def test_inactive_project(client, project):
    Project.objects.filter(pk=4).update(is_active=False)
    response = client.post(list_url(), {"project_id": 4}, format="json")
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {"project_id": ['Invalid pk "4" - object does not exist.']},
        }
    }


def set_state(state, other, *, past=False):
    fields = {"status": state}
    if state in ("confirmed", "awaiting_confirmation"):
        offset = -2 if past else 1
        fields.update(
            picked_by=other,
            starts_at=NOW + timedelta(hours=offset),
            ends_at=NOW + timedelta(hours=offset + 1),
        )
    elif state == "cancelled":
        fields["cancelled_at"] = NOW
    elif state == "expired":
        fields["expired_at"] = NOW
    EvaluationRequest.objects.filter(pk=17).update(**fields)


@pytest.mark.parametrize("state", ["pending", "awaiting_confirmation", "confirmed"])
def test_duplicate_active_request(client, evaluation, other, state):
    set_state(state, other)
    response = client.post(list_url(), {"project_id": 4}, format="json")
    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "active_request_exists",
            "message": "You already have an active request for this project.",
        }
    }
    assert EvaluationRequest.objects.count() == 1


@pytest.mark.parametrize("state", ["cancelled", "expired", "confirmed"])
def test_history_allows_new_request(client, evaluation, other, state, expected):
    set_state(state, other, past=True)
    response = client.post(list_url(), {"project_id": 4}, format="json")
    assert response.status_code == 201
    expected.update(id=EvaluationRequest.objects.exclude(pk=17).get().pk, note="")
    assert response.json() == expected


@pytest.mark.parametrize(
    "role,eligible,allowed",
    [
        ("student", False, False),
        ("student", True, False),
        ("tutor", False, False),
        ("tutor", True, True),
        ("head_tutor", False, True),
        ("admin", False, True),
        ("sc_member", False, False),
    ],
)
def test_private_detail(other, project, evaluation, expected, role, eligible, allowed):
    grant(other, role)
    if eligible:
        TutorEligibility.objects.create(tutor=other, project=project)
    client = APIClient()
    client.force_authenticate(other)
    response = client.get(detail_url())
    assert response.status_code == (200 if allowed else 404)
    assert response.json() == (
        expected if allowed else {"error": {"code": "not_found", "message": "Not found."}}
    )


def test_owner_detail(client, evaluation, expected):
    response = client.get(detail_url())
    assert response.status_code == 200
    assert response.json() == expected


def test_picker_detail_without_role(other, evaluation, expected):
    set_state("awaiting_confirmation", other)
    client = APIClient()
    client.force_authenticate(other)
    response = client.get(detail_url())
    expected.update(
        status="awaiting_confirmation",
        picked_by={"id": 42, "display_name": "Bob", "avatar_url": None},
        starts_at="2026-10-10T10:00:00Z",
        ends_at="2026-10-10T11:00:00Z",
    )
    assert response.status_code == 200
    assert response.json() == expected


def test_edit_real_session(student, evaluation, expected):
    client = logged_in_client(student)
    response = client.patch(
        detail_url(),
        {"note": "Changed", "status": "confirmed", "project_id": 99},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    expected["note"] = "Changed"
    assert response.json() == expected


@pytest.mark.parametrize("payload", [{}, {"note": ""}, {"note": "x" * 500}])
def test_edit_boundaries(client, evaluation, expected, payload):
    response = client.patch(detail_url(), payload, format="json")
    assert response.status_code == 200
    expected.update(payload)
    assert response.json() == expected


@pytest.mark.parametrize(
    "note,message",
    [
        (None, "This field may not be null."),
        ("x" * 501, "Ensure this field has no more than 500 characters."),
    ],
)
def test_edit_validation(client, evaluation, note, message):
    response = client.patch(detail_url(), {"note": note}, format="json")
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {"note": [message]},
        }
    }


@pytest.mark.parametrize("state", ["awaiting_confirmation", "confirmed", "cancelled", "expired"])
def test_edit_pending_only(client, evaluation, other, state):
    set_state(state, other)
    response = client.patch(detail_url(), {"note": "Changed"}, format="json")
    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "invalid_state_transition",
            "message": "Only pending requests can be edited.",
        }
    }
    evaluation.refresh_from_db()
    assert evaluation.note == "Parsing."


@pytest.mark.parametrize(
    "role,eligible,http_status",
    [
        ("student", False, 404),
        ("tutor", True, 403),
        ("head_tutor", False, 403),
        ("admin", False, 403),
    ],
)
def test_edit_not_owner(other, project, evaluation, role, eligible, http_status):
    grant(other, role)
    if eligible:
        TutorEligibility.objects.create(tutor=other, project=project)
    client = APIClient()
    client.force_authenticate(other)
    response = client.patch(detail_url(), {"note": "Changed"}, format="json")
    assert response.status_code == http_status
    assert response.json() == (
        {"error": {"code": "not_found", "message": "Not found."}}
        if http_status == 404
        else {
            "error": {
                "code": "permission_denied",
                "message": "You do not have permission to perform this action.",
            }
        }
    )


def test_list_mine(client, evaluation, other, project, expected):
    EvaluationRequest.objects.create(student=other, project=project)
    response = client.get(list_url())
    assert response.status_code == 200
    assert response.json() == {"count": 1, "next": None, "previous": None, "results": [expected]}


@pytest.mark.parametrize("scope", ["open", "picked", "all"])
def test_role_gated_scopes(client, scope):
    response = client.get(list_url(), {"scope": scope})
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "permission_denied",
            "message": "You do not have permission to perform this action.",
        }
    }


@pytest.mark.parametrize("role", ["tutor", "head_tutor"])
def test_open_scope(other, student, project, evaluation, expected, role):
    grant(other, role)
    TutorEligibility.objects.create(tutor=other, project=project)
    EvaluationRequest.objects.create(student=other, project=project)
    ineligible = Project.objects.create(slug="push_swap", name="Push swap")
    EvaluationRequest.objects.create(student=student, project=ineligible)
    EvaluationRequest.objects.create(
        student=student, project=project, status="expired", expired_at=NOW
    )
    client = APIClient()
    client.force_authenticate(other)
    response = client.get(list_url(), {"scope": "open"})
    assert response.status_code == 200
    assert response.json() == {"count": 1, "next": None, "previous": None, "results": [expected]}


@pytest.mark.parametrize("role", ["head_tutor", "admin"])
def test_all_scope(other, evaluation, expected, role):
    grant(other, role)
    client = APIClient()
    client.force_authenticate(other)
    response = client.get(list_url(), {"scope": "all"})
    assert response.status_code == 200
    assert response.json() == {"count": 1, "next": None, "previous": None, "results": [expected]}


@pytest.mark.parametrize(
    "params,field,message",
    [
        ({"scope": "wrong"}, "scope", '"wrong" is not a valid choice.'),
        ({"status": "pending,wrong"}, "status", '"wrong" is not a valid choice.'),
        ({"history": "yes"}, "history", '"yes" is not a valid choice.'),
        ({"ordering": "note"}, "ordering", '"note" is not a valid choice.'),
    ],
)
def test_filter_validation(client, params, field, message):
    response = client.get(list_url(), params)
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {field: [message]},
        }
    }


@pytest.mark.parametrize(
    "params,include",
    [
        ({"history": "false"}, True),
        ({"history": "true"}, False),
        ({"status": "pending,confirmed"}, True),
        ({"status": "expired"}, False),
        ({"project": "libft"}, True),
        ({"project": "missing"}, False),
    ],
)
def test_filters(client, evaluation, expected, params, include):
    response = client.get(list_url(), params)
    assert response.status_code == 200
    assert response.json() == {
        "count": 1 if include else 0,
        "next": None,
        "previous": None,
        "results": [expected] if include else [],
    }


@pytest.mark.parametrize("state", ["cancelled", "expired", "confirmed"])
def test_history_fields(client, evaluation, other, expected, state):
    set_state(state, other, past=True)
    expected.update(status=state, is_history=True)
    if state == "cancelled":
        expected["cancelled_at"] = "2026-10-10T09:00:00Z"
    elif state == "expired":
        expected["expired_at"] = "2026-10-10T09:00:00Z"
    else:
        expected.update(
            picked_by={"id": 42, "display_name": "Bob", "avatar_url": None},
            starts_at="2026-10-10T07:00:00Z",
            ends_at="2026-10-10T08:00:00Z",
        )
    response = client.get(list_url(), {"history": "true"})
    assert response.status_code == 200
    assert response.json() == {"count": 1, "next": None, "previous": None, "results": [expected]}
    assert client.get(list_url(), {"history": "false"}).json() == {
        "count": 0,
        "next": None,
        "previous": None,
        "results": [],
    }


def test_pagination_and_ordering(client, student, project, evaluation, expected):
    EvaluationRequest.objects.create(id=18, student=student, project=project)
    EvaluationRequest.objects.filter(pk=18).update(created_at=NOW + timedelta(seconds=1))
    newer = dict(expected, id=18, note="", created_at="2026-10-10T09:00:01Z")
    response = client.get(list_url(), {"page_size": 1}, HTTP_HOST="localhost")
    assert response.json() == {
        "count": 2,
        "next": "http://localhost/api/v1/evaluation-requests/?page=2&page_size=1",
        "previous": None,
        "results": [newer],
    }
    response = client.get(list_url(), {"page_size": 1, "page": 2}, HTTP_HOST="localhost")
    assert response.json() == {
        "count": 2,
        "next": None,
        "previous": "http://localhost/api/v1/evaluation-requests/?page_size=1",
        "results": [expected],
    }
    response = client.get(list_url(), {"ordering": "created_at"})
    assert response.json() == {
        "count": 2,
        "next": None,
        "previous": None,
        "results": [expected, newer],
    }


@pytest.mark.django_db(transaction=True)
def test_concurrent_creates(student, project):
    barrier = Barrier(2)

    def submit(_):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(get_user_model().objects.get(pk=7))
            barrier.wait(timeout=10)
            response = client.post(list_url(), {"project_id": 4}, format="json")
            return response.status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(submit, range(2)))
    assert sorted(responses) == [201, 409]
    assert EvaluationRequest.objects.filter(student=student, project=project).count() == 1


@pytest.mark.parametrize("role", ["tutor", "head_tutor"])
def test_picked_scope(other, student, project, evaluation, expected, role):
    grant(other, role)
    set_state("awaiting_confirmation", other)
    EvaluationRequest.objects.create(student=student, project=project)
    client = APIClient()
    client.force_authenticate(other)
    response = client.get(list_url(), {"scope": "picked"})
    expected.update(
        status="awaiting_confirmation",
        picked_by={"id": 42, "display_name": "Bob", "avatar_url": None},
        starts_at="2026-10-10T10:00:00Z",
        ends_at="2026-10-10T11:00:00Z",
    )
    assert response.status_code == 200
    assert response.json() == {"count": 1, "next": None, "previous": None, "results": [expected]}


@pytest.mark.parametrize("method", ["get", "patch"])
def test_missing_request(client, method):
    response = getattr(client, method)(detail_url(99), {}, format="json")
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}


def test_pagination_caps_page_size(client, student, project, expected):
    EvaluationRequest.objects.bulk_create(
        [EvaluationRequest(id=pk, student=student, project=project) for pk in range(17, 118)]
    )
    response = client.get(list_url(), {"page_size": 1000, "page": 2}, HTTP_HOST="localhost")
    expected.update(id=117, note="")
    assert response.status_code == 200
    assert response.json() == {
        "count": 101,
        "next": None,
        "previous": "http://localhost/api/v1/evaluation-requests/?page_size=1000",
        "results": [expected],
    }


def test_create_is_open_to_every_authenticated_user(client, student, project, expected):
    student.roles.clear()
    response = client.post(list_url(), {"project_id": 4}, format="json")
    assert response.status_code == 201
    expected.update(id=EvaluationRequest.objects.get().pk, note="")
    assert response.json() == expected


def test_note_conditional_update_detects_state_change(evaluation, other):
    from apps.evaluations.services import InvalidStateTransition, edit_note

    set_state("awaiting_confirmation", other)
    # The instance still says pending, as it would if a pick raced with this edit.
    with pytest.raises(InvalidStateTransition):
        edit_note(evaluation, {"note": "Changed"})
    evaluation.refresh_from_db()
    assert evaluation.status == "awaiting_confirmation"
    assert evaluation.note == "Parsing."
