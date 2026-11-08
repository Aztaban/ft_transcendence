"""The Hitchhiker stays anonymous to the student until the student confirms (R18, api-plan 8.7)."""

from datetime import datetime, timedelta, timezone

import pytest
from django.urls import reverse

from apps.accounts.models import Role
from apps.audit.models import AuditLog
from apps.evaluations.models import EvaluationRequest, TutorEligibility
from apps.evaluations.serializers.requests import EvaluationRequestSerializer
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db

NOW = "2026-10-31T10:00:00Z"
NOW_DT = datetime(2026, 10, 31, 10, tzinfo=timezone.utc)
ALICE = {"display_name": "Alice", "avatar_url": None}
BOB = {"display_name": "Bob", "avatar_url": None}
ADA = {"display_name": "Ada", "avatar_url": None}
PROJECT = {"slug": "override_project", "name": "Override project"}


def session(make_session_client, user):
    client = make_session_client(user)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    return client


def get(client, url, **params):
    return client.get(url, params, HTTP_HOST="localhost", HTTP_ACCEPT_LANGUAGE="en")


def detail(client, evaluation):
    return get(client, reverse("api:evaluation-request-detail", kwargs={"pk": evaluation.pk}))


def post(client, evaluation, action, data=None):
    return client.post(
        reverse(f"api:evaluation-request-{action}", kwargs={"pk": evaluation.pk}),
        data or {},
        format="json",
        HTTP_HOST="localhost",
        HTTP_ACCEPT_LANGUAGE="en",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )


def set_state(evaluation, state, cancelled_by=None):
    """Store a state directly; the workflow tests below go through the API."""
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(
        status=state,
        cancelled_by=cancelled_by,
        cancelled_at=NOW_DT if state == "cancelled" else None,
    )


def body(override_response, state, student, *, picked_by, cancelled_by=None):
    """The whole representation in `state`, with the two fields that depend on the viewer."""
    expected = {**override_response, "status": state, "picked_by": picked_by}
    if state == "cancelled":
        expected.update(cancelled_by=cancelled_by, cancelled_at=NOW, is_history=True)
    return expected


def notifications():
    return list(
        Notification.objects.order_by("recipient_id").values(
            "recipient_id", "type", "payload", "target_url"
        )
    )


def as_ref(user, name):
    return {"id": user.pk, **name}


@pytest.mark.parametrize(
    "state,hidden",
    [("awaiting_confirmation", True), ("confirmed", False), ("cancelled", True)],
)
def test_the_student_sees_the_hitchhiker_only_on_a_confirmed_request(
    override_evaluation, override_response, make_session_client, state, hidden
):
    evaluation, student, picker, _, _ = override_evaluation
    set_state(evaluation, state, cancelled_by=student if state == "cancelled" else None)

    response = detail(session(make_session_client, student), evaluation)

    assert response.status_code == 200
    assert response.json() == body(
        override_response,
        state,
        student,
        picked_by=None if hidden else as_ref(picker, BOB),
        cancelled_by=as_ref(student, ALICE),
    )


@pytest.mark.parametrize("state", ["awaiting_confirmation", "cancelled"])
@pytest.mark.parametrize("viewer", ["picker", "head_tutor", "admin"])
def test_everyone_else_who_can_open_the_request_still_sees_the_hitchhiker(
    override_evaluation, override_response, make_session_client, state, viewer
):
    evaluation, student, picker, actor, _ = override_evaluation
    set_state(evaluation, state, cancelled_by=student if state == "cancelled" else None)
    if viewer == "admin":
        actor.roles.set(Role.objects.filter(name="admin"))

    response = detail(
        session(make_session_client, picker if viewer == "picker" else actor), evaluation
    )

    assert response.status_code == 200
    assert response.json() == body(
        override_response,
        state,
        student,
        picked_by=as_ref(picker, BOB),
        cancelled_by=as_ref(student, ALICE),
    )


def test_the_slot_stays_visible_to_the_student_without_the_hitchhiker(
    override_evaluation, make_session_client
):
    evaluation, student, _, _, _ = override_evaluation
    set_state(evaluation, "awaiting_confirmation")

    response = detail(session(make_session_client, student), evaluation)

    assert response.json()["picked_by"] is None
    assert response.json()["starts_at"] == "2026-11-01T10:00:00Z"
    assert response.json()["ends_at"] == "2026-11-01T10:45:00Z"


@pytest.mark.parametrize(
    "state,params",
    [
        ("awaiting_confirmation", {"scope": "mine"}),
        ("cancelled", {"scope": "mine", "history": "true"}),
    ],
)
def test_the_student_list_hides_the_hitchhiker(
    override_evaluation, override_response, make_session_client, state, params
):
    evaluation, student, _, _, _ = override_evaluation
    set_state(evaluation, state, cancelled_by=student if state == "cancelled" else None)

    response = get(
        session(make_session_client, student),
        reverse("api:evaluation-request-list"),
        **params,
    )

    assert response.status_code == 200
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [
            body(
                override_response,
                state,
                student,
                picked_by=None,
                cancelled_by=as_ref(student, ALICE),
            )
        ],
    }


def test_the_hitchhikers_own_list_keeps_a_cancelled_evaluation(
    override_evaluation, override_response, make_session_client
):
    evaluation, student, picker, _, _ = override_evaluation
    set_state(evaluation, "cancelled", cancelled_by=student)

    response = get(
        session(make_session_client, picker),
        reverse("api:evaluation-request-list"),
        scope="picked",
        history="true",
    )

    assert response.json()["results"] == [
        body(
            override_response,
            "cancelled",
            student,
            picked_by=as_ref(picker, BOB),
            cancelled_by=as_ref(student, ALICE),
        )
    ]


@pytest.mark.parametrize("role", ["head_tutor", "admin"])
@pytest.mark.parametrize("state", ["awaiting_confirmation", "cancelled"])
def test_a_privileged_student_does_not_see_their_own_hitchhiker(
    override_evaluation, make_session_client, role, state
):
    evaluation, student, _, _, _ = override_evaluation
    student.roles.add(Role.objects.get(name=role))
    set_state(evaluation, state, cancelled_by=student if state == "cancelled" else None)
    client = session(make_session_client, student)

    assert detail(client, evaluation).json()["picked_by"] is None
    results = get(client, reverse("api:evaluation-request-list"), scope="all").json()["results"]
    assert [row["picked_by"] for row in results] == [None]


def test_the_exceptions_list_names_the_hitchhiker_except_to_the_student(
    override_evaluation, make_session_client
):
    evaluation, student, picker, actor, _ = override_evaluation
    set_state(evaluation, "awaiting_confirmation")
    TutorEligibility.objects.filter(tutor=picker).delete()
    url = reverse("api:evaluation-request-exceptions")

    results = get(session(make_session_client, actor), url).json()["results"]
    assert [row["picked_by"] for row in results] == [as_ref(picker, BOB)]

    student.roles.add(Role.objects.get(name="head_tutor"))
    results = get(session(make_session_client, student), url).json()["results"]
    assert [row["picked_by"] for row in results] == [None]


def test_a_serializer_without_a_viewer_hides_the_hitchhiker(override_evaluation):
    evaluation, _, _, _, _ = override_evaluation
    set_state(evaluation, "awaiting_confirmation")
    evaluation.refresh_from_db()

    assert EvaluationRequestSerializer(evaluation).data["picked_by"] is None


def test_confirming_reveals_the_hitchhiker(
    override_evaluation, override_response, make_session_client
):
    evaluation, student, picker, _, _ = override_evaluation
    set_state(evaluation, "awaiting_confirmation")
    client = session(make_session_client, student)
    assert detail(client, evaluation).json()["picked_by"] is None

    response = post(client, evaluation, "confirm")

    assert response.status_code == 200
    assert response.json() == {**override_response, "picked_by": as_ref(picker, BOB)}


@pytest.mark.parametrize("state", ["awaiting_confirmation", "confirmed"])
def test_the_student_who_cancels_loses_the_name_and_the_hitchhiker_keeps_the_history(
    override_evaluation, override_response, make_session_client, state
):
    evaluation, student, picker, _, _ = override_evaluation
    set_state(evaluation, state)

    response = post(session(make_session_client, student), evaluation, "cancel")

    assert response.status_code == 200
    assert response.json() == body(
        override_response,
        "cancelled",
        student,
        picked_by=None,
        cancelled_by=as_ref(student, ALICE),
    )
    evaluation.refresh_from_db()
    assert evaluation.picked_by_id == picker.pk
    assert notifications() == [
        {
            "recipient_id": picker.pk,
            "type": "evaluation.cancelled",
            "payload": {
                "request_id": evaluation.pk,
                "project": {"id": evaluation.project_id, **PROJECT},
                "cancelled_by": {"id": student.pk, "display_name": "Alice"},
            },
            "target_url": f"/evaluations/{evaluation.pk}",
        }
    ]
    assert detail(session(make_session_client, picker), evaluation).json() == body(
        override_response,
        "cancelled",
        student,
        picked_by=as_ref(picker, BOB),
        cancelled_by=as_ref(student, ALICE),
    )


def test_a_hitchhiker_who_cancels_by_override_stays_anonymous_to_the_student(
    override_evaluation, override_response, make_session_client
):
    evaluation, student, picker, actor, _ = override_evaluation
    picker.roles.add(Role.objects.get(name="head_tutor"))
    set_state(evaluation, "awaiting_confirmation")

    response = post(session(make_session_client, picker), evaluation, "cancel", {"reason": "Sick"})

    assert response.status_code == 200
    assert response.json() == body(
        override_response,
        "cancelled",
        student,
        picked_by=as_ref(picker, BOB),
        cancelled_by=as_ref(picker, BOB),
    )
    assert detail(session(make_session_client, student), evaluation).json() == body(
        override_response, "cancelled", student, picked_by=None, cancelled_by=None
    )
    assert detail(session(make_session_client, actor), evaluation).json() == body(
        override_response,
        "cancelled",
        student,
        picked_by=as_ref(picker, BOB),
        cancelled_by=as_ref(picker, BOB),
    )
    assert notifications() == [
        {
            "recipient_id": student.pk,
            "type": "evaluation.cancelled",
            "payload": {
                "request_id": evaluation.pk,
                "project": {"id": evaluation.project_id, **PROJECT},
                "cancelled_by": None,
            },
            "target_url": f"/evaluations/{evaluation.pk}",
        }
    ]
    assert list(AuditLog.objects.values_list("actor_id", "action", "reason")) == [
        (picker.pk, "evaluation.cancelled_by_override", "Sick")
    ]


def test_another_head_tutor_who_cancels_is_still_named_to_the_student(
    override_evaluation, override_response, make_session_client
):
    evaluation, student, picker, actor, _ = override_evaluation
    set_state(evaluation, "awaiting_confirmation")

    response = post(
        session(make_session_client, actor), evaluation, "cancel", {"reason": "Conflict"}
    )

    assert response.status_code == 200
    assert detail(session(make_session_client, student), evaluation).json() == body(
        override_response,
        "cancelled",
        student,
        picked_by=None,
        cancelled_by=as_ref(actor, ADA),
    )
    payload = {
        "request_id": evaluation.pk,
        "project": {"id": evaluation.project_id, **PROJECT},
        "cancelled_by": {"id": actor.pk, "display_name": "Ada"},
    }
    assert [(row["recipient_id"], row["payload"]) for row in notifications()] == sorted(
        [(student.pk, payload), (picker.pk, payload)], key=lambda row: row[0]
    )


def test_a_student_who_is_head_tutor_and_cancels_their_own_request_is_named_to_the_hitchhiker(
    override_evaluation, make_session_client
):
    evaluation, student, picker, _, _ = override_evaluation
    student.roles.add(Role.objects.get(name="head_tutor"))
    set_state(evaluation, "awaiting_confirmation")

    response = post(session(make_session_client, student), evaluation, "cancel")

    assert response.json()["cancelled_by"] == as_ref(student, ALICE)
    assert notifications()[0]["payload"]["cancelled_by"] == {
        "id": student.pk,
        "display_name": "Alice",
    }


def test_the_slot_notification_does_not_name_the_hitchhiker(
    override_evaluation, make_session_client
):
    evaluation, student, picker, _, _ = override_evaluation
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(
        status="pending", picked_by=None, starts_at=None, ends_at=None
    )

    response = post(
        session(make_session_client, picker),
        evaluation,
        "pick-slot",
        {"starts_at": "2026-11-01T11:00:00Z", "ends_at": "2026-11-01T11:45:00Z"},
    )

    assert response.status_code == 200
    assert notifications() == [
        {
            "recipient_id": student.pk,
            "type": "evaluation.slot_picked",
            "payload": {
                "request_id": evaluation.pk,
                "project": {"id": evaluation.project_id, **PROJECT},
                "starts_at": "2026-11-01T11:00:00Z",
                "ends_at": "2026-11-01T11:45:00Z",
            },
            "target_url": f"/evaluations/{evaluation.pk}",
        }
    ]


@pytest.mark.parametrize("state", ["awaiting_confirmation", "confirmed"])
def test_releasing_a_slot_does_not_name_the_hitchhiker(
    override_evaluation, make_session_client, state
):
    evaluation, student, picker, _, _ = override_evaluation
    set_state(evaluation, state)

    response = post(session(make_session_client, picker), evaluation, "release")

    assert response.status_code == 200
    assert notifications() == [
        {
            "recipient_id": student.pk,
            "type": "evaluation.released",
            "payload": {
                "request_id": evaluation.pk,
                "project": {"id": evaluation.project_id, **PROJECT},
            },
            "target_url": f"/evaluations/{evaluation.pk}",
        }
    ]


def test_nothing_the_student_can_read_names_the_hitchhiker_before_confirming(
    override_evaluation, make_session_client
):
    """Walk the real flow and search every answer, so a new field cannot leak the name."""
    evaluation, student, picker, _, _ = override_evaluation
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(
        status="pending", picked_by=None, starts_at=None, ends_at=None
    )
    student_client = session(make_session_client, student)
    picker_client = session(make_session_client, picker)
    slot = {
        "starts_at": (NOW_DT + timedelta(days=1)).isoformat(),
        "ends_at": (NOW_DT + timedelta(days=1, minutes=45)).isoformat(),
    }

    def assert_anonymous(*responses):
        answers = [
            *responses,
            detail(student_client, evaluation),
            get(student_client, reverse("api:evaluation-request-list"), scope="mine"),
            get(
                student_client,
                reverse("api:evaluation-request-list"),
                scope="mine",
                history="true",
            ),
            get(student_client, reverse("api:notification-list")),
        ]
        for answer in answers:
            assert answer.status_code == 200
            assert "Bob" not in answer.content.decode()
            assert picker.email not in answer.content.decode()

    assert post(picker_client, evaluation, "pick-slot", slot).status_code == 200
    assert_anonymous()

    assert post(picker_client, evaluation, "release").status_code == 200
    assert_anonymous()

    assert post(picker_client, evaluation, "pick-slot", slot).status_code == 200
    assert_anonymous(post(student_client, evaluation, "decline"))

    assert post(picker_client, evaluation, "pick-slot", slot).status_code == 200
    assert_anonymous(post(student_client, evaluation, "cancel"))


def test_after_confirming_the_student_reads_the_name(override_evaluation, make_session_client):
    evaluation, student, picker, _, _ = override_evaluation
    set_state(evaluation, "awaiting_confirmation")
    client = session(make_session_client, student)
    assert "Bob" not in detail(client, evaluation).content.decode()

    assert post(client, evaluation, "confirm").status_code == 200

    assert detail(client, evaluation).json()["picked_by"] == as_ref(picker, BOB)
    results = get(client, reverse("api:evaluation-request-list"), scope="mine").json()["results"]
    assert [row["picked_by"] for row in results] == [as_ref(picker, BOB)]
