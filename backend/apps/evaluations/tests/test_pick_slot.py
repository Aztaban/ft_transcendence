"""POST /evaluation-requests/{id}/pick-slot/ (issues #190 through #193).

An eligible Hitchhiker claims a pending request inside a transaction that locks
both people and rejects an overlapping evaluation. Exactly one concurrent pick
of the same request wins.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Barrier

import pytest
from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.evaluations.models import EvaluationRequest, Project, TutorEligibility
from apps.evaluations.views import pick_slot as claim_pending_request

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("empty_project_catalog")]
NOW = datetime(2026, 10, 10, 9, tzinfo=timezone.utc)
PASSWORD = "RequestPassword123!"
SLOT = {"starts_at": "2026-10-12T15:00:00Z", "ends_at": "2026-10-12T15:45:00Z"}
NOT_PENDING = {
    "error": {
        "code": "request_not_pending",
        "message": "This request is no longer pending.",
    }
}


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


def claim(expected):
    expected.update(
        status="awaiting_confirmation",
        picked_by={"id": 42, "display_name": "Bob", "avatar_url": None},
        starts_at=SLOT["starts_at"],
        ends_at=SLOT["ends_at"],
    )
    return expected


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
    assert response.json() == claim(expected)
    evaluation.refresh_from_db()
    assert evaluation.status == "awaiting_confirmation"
    assert evaluation.picked_by_id == hitchhiker.pk
    assert evaluation.starts_at == datetime(2026, 10, 12, 15, tzinfo=timezone.utc)
    assert evaluation.ends_at == datetime(2026, 10, 12, 15, 45, tzinfo=timezone.utc)


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
        (
            {"starts_at": "2026-10-12T15:00:00", "ends_at": "2026-10-12T15:45:00Z"},
            {"starts_at": ["Datetime must include a timezone (Z or an offset)."]},
        ),
        (
            {"starts_at": "2026-10-12T15:00:00Z", "ends_at": "2026-10-12T15:45:00"},
            {"ends_at": ["Datetime must include a timezone (Z or an offset)."]},
        ),
        (
            {"starts_at": "2026-10-12T15:00:00Z", "ends_at": "2026-10-12T15:00:00Z"},
            {"ends_at": ["End time must be after start time."]},
        ),
        (
            {"starts_at": "2026-10-12T15:45:00Z", "ends_at": "2026-10-12T15:00:00Z"},
            {"ends_at": ["End time must be after start time."]},
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
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"
    assert evaluation.starts_at is None
    assert evaluation.ends_at is None


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
    assert response.json() == claim(expected)
    evaluation.refresh_from_db()
    assert evaluation.status == "awaiting_confirmation"
    assert evaluation.picked_by_id == hitchhiker.pk


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
    expected.update(
        status="awaiting_confirmation",
        picked_by={"id": 44, "display_name": "Fran", "avatar_url": None},
        starts_at=SLOT["starts_at"],
        ends_at=SLOT["ends_at"],
    )
    assert response.status_code == 200
    assert response.json() == expected
    evaluation.refresh_from_db()
    assert evaluation.status == "awaiting_confirmation"
    assert evaluation.picked_by_id == head_tutor.pk


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


def test_second_pick_is_rejected(hitchhiker, evaluation):
    client = APIClient()
    client.force_authenticate(hitchhiker)
    assert client.post(pick_url(), SLOT, format="json").status_code == 200
    response = client.post(
        pick_url(),
        {"starts_at": "2026-10-13T15:00:00Z", "ends_at": "2026-10-13T16:00:00Z"},
        format="json",
    )
    assert response.status_code == 409
    assert response.json() == NOT_PENDING
    evaluation.refresh_from_db()
    assert evaluation.picked_by_id == hitchhiker.pk
    assert evaluation.starts_at == datetime(2026, 10, 12, 15, tzinfo=timezone.utc)


def test_head_tutor_cannot_take_a_picked_request(hitchhiker, project, evaluation):
    client = APIClient()
    client.force_authenticate(hitchhiker)
    assert client.post(pick_url(), SLOT, format="json").status_code == 200
    head = get_user_model().objects.create_user(
        id=43, email="dana@example.com", display_name="Dana", password=PASSWORD
    )
    grant(head, "head_tutor")
    TutorEligibility.objects.create(tutor=head, project=project)
    client.force_authenticate(head)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 409
    assert response.json() == NOT_PENDING
    evaluation.refresh_from_db()
    assert evaluation.picked_by_id == hitchhiker.pk


def test_other_hitchhiker_cannot_see_a_picked_request(hitchhiker, project, evaluation):
    client = APIClient()
    client.force_authenticate(hitchhiker)
    assert client.post(pick_url(), SLOT, format="json").status_code == 200
    other = get_user_model().objects.create_user(
        id=46, email="fay@example.com", display_name="Fay", password=PASSWORD
    )
    grant(other, "tutor")
    TutorEligibility.objects.create(tutor=other, project=project)
    client.force_authenticate(other)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}
    evaluation.refresh_from_db()
    assert evaluation.picked_by_id == hitchhiker.pk


@pytest.fixture
def seeded_roles():
    for name in ("student", "tutor"):
        Role.objects.get_or_create(name=name)


@pytest.mark.django_db(transaction=True)
def test_only_one_hitchhiker_wins(seeded_roles, student, project, evaluation, monkeypatch):
    contenders = []
    for pk, email, name in ((42, "bob@example.com", "Bob"), (46, "fay@example.com", "Fay")):
        user = get_user_model().objects.create_user(
            id=pk, email=email, display_name=name, password=PASSWORD
        )
        grant(user, "tutor")
        TutorEligibility.objects.create(tutor=user, project=project)
        contenders.append(pk)
    # Both callers pass visibility lookup, then wait, then compete on the update.
    # Waiting before the request lets the winner hide the row and the loser sees 404.
    barrier = Barrier(2)

    def claim_after_lookup(evaluation, user, starts_at, ends_at):
        barrier.wait(timeout=10)
        return claim_pending_request(evaluation, user, starts_at, ends_at)

    monkeypatch.setattr("apps.evaluations.views.pick_slot", claim_after_lookup)

    def submit(user_id):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(get_user_model().objects.get(pk=user_id))
            response = client.post(pick_url(), SLOT, format="json")
            return response.status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(submit, contenders))
    assert sorted(responses) == [200, 409]
    evaluation.refresh_from_db()
    assert evaluation.status == "awaiting_confirmation"
    assert evaluation.picked_by_id in set(contenders)


SLOT_OVERLAPS = {
    "error": {
        "code": "slot_overlaps",
        "message": "You already have an evaluation at that time.",
    }
}
STUDENT_UNAVAILABLE = {
    "error": {
        "code": "student_unavailable",
        "message": "The student already has an evaluation at that time.",
    }
}


def book(student, project, picked_by, starts_at, ends_at, status="awaiting_confirmation", **fields):
    return EvaluationRequest.objects.create(
        student=student,
        project=project,
        picked_by=picked_by,
        starts_at=starts_at,
        ends_at=ends_at,
        status=status,
        **fields,
    )


def other_project():
    return Project.objects.create(id=5, slug="ft_printf", name="ft_printf")


def test_hitchhiker_calendar_overlap_is_rejected(hitchhiker, student, project, evaluation):
    cara = get_user_model().objects.create_user(
        id=8, email="cara@example.com", display_name="Cara", password=PASSWORD
    )
    book(
        cara,
        other_project(),
        hitchhiker,
        datetime(2026, 10, 12, 15, 30, tzinfo=timezone.utc),
        datetime(2026, 10, 12, 16, 15, tzinfo=timezone.utc),
    )
    client = APIClient()
    client.force_authenticate(hitchhiker)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 409
    assert response.json() == SLOT_OVERLAPS
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"


def test_hitchhiker_overlap_as_student_is_rejected(hitchhiker, project, evaluation):
    dana = get_user_model().objects.create_user(
        id=43, email="dana@example.com", display_name="Dana", password=PASSWORD
    )
    book(
        hitchhiker,
        other_project(),
        dana,
        datetime(2026, 10, 12, 15, tzinfo=timezone.utc),
        datetime(2026, 10, 12, 15, 45, tzinfo=timezone.utc),
        status="confirmed",
    )
    client = APIClient()
    client.force_authenticate(hitchhiker)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 409
    assert response.json() == SLOT_OVERLAPS
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"


@pytest.mark.parametrize("status", ["awaiting_confirmation", "confirmed"])
def test_student_overlap_is_rejected(hitchhiker, student, evaluation, status):
    fay = get_user_model().objects.create_user(
        id=46, email="fay@example.com", display_name="Fay", password=PASSWORD
    )
    book(
        student,
        other_project(),
        fay,
        datetime(2026, 10, 12, 14, 30, tzinfo=timezone.utc),
        datetime(2026, 10, 12, 15, 15, tzinfo=timezone.utc),
        status=status,
    )
    client = APIClient()
    client.force_authenticate(hitchhiker)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 409
    assert response.json() == STUDENT_UNAVAILABLE
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"


def test_touching_slot_is_free(hitchhiker, student, evaluation, expected):
    fay = get_user_model().objects.create_user(
        id=46, email="fay@example.com", display_name="Fay", password=PASSWORD
    )
    book(
        student,
        other_project(),
        fay,
        datetime(2026, 10, 12, 14, 15, tzinfo=timezone.utc),
        datetime(2026, 10, 12, 15, tzinfo=timezone.utc),
    )
    client = APIClient()
    client.force_authenticate(hitchhiker)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 200
    assert response.json() == claim(expected)


def test_cancelled_booking_does_not_block(hitchhiker, student, evaluation, expected):
    fay = get_user_model().objects.create_user(
        id=46, email="fay@example.com", display_name="Fay", password=PASSWORD
    )
    book(
        student,
        other_project(),
        fay,
        datetime(2026, 10, 12, 15, tzinfo=timezone.utc),
        datetime(2026, 10, 12, 15, 45, tzinfo=timezone.utc),
        status="cancelled",
        cancelled_at=NOW,
    )
    client = APIClient()
    client.force_authenticate(hitchhiker)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 200
    assert response.json() == claim(expected)


@pytest.mark.django_db(transaction=True)
def test_same_student_slots_are_serialized(seeded_roles, student):
    libft = Project.objects.create(id=4, slug="libft", name="Libft")
    printf = Project.objects.create(id=5, slug="ft_printf", name="ft_printf")
    first = EvaluationRequest.objects.create(id=17, student=student, project=libft)
    second = EvaluationRequest.objects.create(id=18, student=student, project=printf)
    pairs = (
        (42, "bob@example.com", "Bob", libft),
        (46, "fay@example.com", "Fay", printf),
    )
    for pk, email, name, project in pairs:
        user = get_user_model().objects.create_user(
            id=pk, email=email, display_name=name, password=PASSWORD
        )
        grant(user, "tutor")
        TutorEligibility.objects.create(tutor=user, project=project)
    barrier = Barrier(2)

    def submit(item):
        user_id, request_id = item
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(get_user_model().objects.get(pk=user_id))
            barrier.wait(timeout=10)
            response = client.post(pick_url(request_id), SLOT, format="json")
            code = None if response.status_code == 200 else response.json()["error"]["code"]
            return response.status_code, code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(submit, ((42, first.pk), (46, second.pk))))
    assert sorted(responses) == [(200, None), (409, "student_unavailable")]
    assert EvaluationRequest.objects.filter(status="awaiting_confirmation").count() == 1
    assert EvaluationRequest.objects.filter(status="pending").count() == 1


def test_hitchhiker_overlap_wins_when_both_are_busy(hitchhiker, student, evaluation):
    fay = get_user_model().objects.create_user(
        id=46, email="fay@example.com", display_name="Fay", password=PASSWORD
    )
    cara = get_user_model().objects.create_user(
        id=8, email="cara@example.com", display_name="Cara", password=PASSWORD
    )
    overlap = (
        datetime(2026, 10, 12, 15, tzinfo=timezone.utc),
        datetime(2026, 10, 12, 15, 45, tzinfo=timezone.utc),
    )
    book(student, other_project(), fay, *overlap)
    book(
        cara,
        Project.objects.create(id=6, slug="get_next_line", name="get_next_line"),
        hitchhiker,
        *overlap,
    )
    client = APIClient()
    client.force_authenticate(hitchhiker)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 409
    assert response.json() == SLOT_OVERLAPS
    evaluation.refresh_from_db()
    assert evaluation.status == "pending"


def test_eligible_head_tutor_picks(project, evaluation, expected):
    head = get_user_model().objects.create_user(
        id=43, email="dana@example.com", display_name="Dana", password=PASSWORD
    )
    grant(head, "head_tutor")
    TutorEligibility.objects.create(tutor=head, project=project)
    client = APIClient()
    client.force_authenticate(head)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 200
    expected.update(
        status="awaiting_confirmation",
        picked_by={"id": 43, "display_name": "Dana", "avatar_url": None},
        starts_at=SLOT["starts_at"],
        ends_at=SLOT["ends_at"],
    )
    assert response.json() == expected
    evaluation.refresh_from_db()
    assert evaluation.status == "awaiting_confirmation"
    assert evaluation.picked_by_id == head.pk


@pytest.mark.parametrize("status,stamp", [("cancelled", "cancelled_at"), ("expired", "expired_at")])
def test_closed_request_cannot_be_picked(project, evaluation, status, stamp):
    head = get_user_model().objects.create_user(
        id=43, email="dana@example.com", display_name="Dana", password=PASSWORD
    )
    grant(head, "head_tutor")
    TutorEligibility.objects.create(tutor=head, project=project)
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(status=status, **{stamp: NOW})
    client = APIClient()
    client.force_authenticate(head)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 409
    assert response.json() == NOT_PENDING
    evaluation.refresh_from_db()
    assert evaluation.status == status
    assert evaluation.picked_by_id is None


@pytest.mark.parametrize("status,stamp", [("cancelled", "cancelled_at"), ("expired", "expired_at")])
def test_closed_request_with_overlapping_booking_is_not_pending(project, evaluation, status, stamp):
    head = get_user_model().objects.create_user(
        id=43, email="dana@example.com", display_name="Dana", password=PASSWORD
    )
    fay = get_user_model().objects.create_user(
        id=46, email="fay@example.com", display_name="Fay", password=PASSWORD
    )
    grant(head, "head_tutor")
    TutorEligibility.objects.create(tutor=head, project=project)
    book(
        evaluation.student,
        other_project(),
        fay,
        datetime(2026, 10, 12, 15, tzinfo=timezone.utc),
        datetime(2026, 10, 12, 15, 45, tzinfo=timezone.utc),
    )
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(status=status, **{stamp: NOW})
    client = APIClient()
    client.force_authenticate(head)
    response = client.post(pick_url(), SLOT, format="json")
    assert response.status_code == 409
    assert response.json() == NOT_PENDING
    evaluation.refresh_from_db()
    assert evaluation.status == status
    assert evaluation.picked_by_id is None


@pytest.mark.django_db(transaction=True)
def test_one_hitchhiker_cannot_take_two_slots(seeded_roles):
    alice = get_user_model().objects.create_user(
        id=7, email="alice@example.com", display_name="Alice", password=PASSWORD
    )
    cara = get_user_model().objects.create_user(
        id=8, email="cara@example.com", display_name="Cara", password=PASSWORD
    )
    bob = get_user_model().objects.create_user(
        id=42, email="bob@example.com", display_name="Bob", password=PASSWORD
    )
    grant(bob, "tutor")
    libft = Project.objects.create(id=4, slug="libft", name="Libft")
    printf = Project.objects.create(id=5, slug="ft_printf", name="ft_printf")
    TutorEligibility.objects.create(tutor=bob, project=libft)
    TutorEligibility.objects.create(tutor=bob, project=printf)
    first = EvaluationRequest.objects.create(id=17, student=alice, project=libft)
    second = EvaluationRequest.objects.create(id=18, student=cara, project=printf)
    barrier = Barrier(2)

    def submit(request_id):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(get_user_model().objects.get(pk=bob.pk))
            barrier.wait(timeout=10)
            response = client.post(pick_url(request_id), SLOT, format="json")
            code = None if response.status_code == 200 else response.json()["error"]["code"]
            return response.status_code, code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(submit, (first.pk, second.pk)))
    assert sorted(responses) == [(200, None), (409, "slot_overlaps")]
    assert EvaluationRequest.objects.filter(status="awaiting_confirmation").count() == 1
    assert EvaluationRequest.objects.get(status="awaiting_confirmation").picked_by_id == bob.pk
