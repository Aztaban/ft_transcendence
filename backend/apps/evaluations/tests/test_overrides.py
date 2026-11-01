"""Head Tutor/Admin overrides, participant behavior and atomic side effects."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier

import pytest
from django.db import close_old_connections
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.audit.models import AuditLog
from apps.evaluations.models import EvaluationRequest
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db
NOW = datetime(2026, 10, 31, 10, tzinfo=timezone.utc)


def action_url(evaluation, action):
    return reverse(f"api:evaluation-request-{action}", kwargs={"pk": evaluation.pk})


def post_action(client, evaluation, action, data, *, csrf=True):
    headers = {"HTTP_HOST": "localhost", "HTTP_ACCEPT_LANGUAGE": "en"}
    if csrf:
        headers["HTTP_X_CSRFTOKEN"] = client.cookies["csrftoken"].value
    return client.post(action_url(evaluation, action), data, format="json", **headers)


@pytest.mark.parametrize("action", ["release", "cancel"])
@pytest.mark.parametrize("role", ["head_tutor", "admin"])
@pytest.mark.parametrize("state", ["awaiting_confirmation", "confirmed"])
def test_override_response_audit_notifications_and_events(
    override_evaluation,
    override_response,
    make_session_client,
    user_event_sender,
    django_capture_on_commit_callbacks,
    action,
    role,
    state,
):
    evaluation, student, picker, actor, eligible = override_evaluation
    actor.roles.set(Role.objects.filter(name=role))
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(status=state)
    client = make_session_client(actor)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    with django_capture_on_commit_callbacks(execute=True):
        response = post_action(client, evaluation, action, {"reason": "  Resolve conflict  "})
        user_event_sender.assert_not_awaited()
        assert response.status_code == 200
        if action == "release":
            override_response.update(status="pending", picked_by=None, starts_at=None, ends_at=None)
        else:
            override_response.update(
                status="cancelled",
                is_history=True,
                cancelled_by={"id": actor.pk, "display_name": "Ada", "avatar_url": None},
                cancelled_at="2026-10-31T10:00:00Z",
            )
        assert response.json() == override_response
    assert list(
        AuditLog.objects.values(
            "actor_id", "action", "target_type", "target_id", "reason", "metadata"
        )
    ) == [
        {
            "actor_id": actor.pk,
            "action": (
                "evaluation.released_by_override"
                if action == "release"
                else "evaluation.cancelled_by_override"
            ),
            "target_type": "evaluation_request",
            "target_id": evaluation.pk,
            "reason": "Resolve conflict",
            "metadata": {},
        }
    ]
    project = {"id": evaluation.project_id, "slug": "override_project", "name": "Override project"}
    payload = {"request_id": evaluation.pk, "project": project}
    if action == "release":
        payload["tutor"] = {"id": picker.pk, "display_name": "Bob"}
    else:
        payload["cancelled_by"] = {"id": actor.pk, "display_name": "Ada"}
    event = "evaluation.released" if action == "release" else "evaluation.cancelled"
    assert list(
        Notification.objects.order_by("recipient_id").values(
            "recipient_id", "type", "payload", "target_url"
        )
    ) == [
        {
            "recipient_id": student.pk,
            "type": event,
            "payload": payload,
            "target_url": f"/evaluations/{evaluation.pk}",
        },
        {
            "recipient_id": picker.pk,
            "type": event,
            "payload": payload,
            "target_url": f"/evaluations/{evaluation.pk}",
        },
    ]
    messages = [args.args for args in user_event_sender.await_args_list]
    workflow = [group for group, message in messages if message.get("event") == event]
    assert workflow == [f"user_{student.pk}", f"user_{picker.pk}"] + (
        [f"user_{eligible.pk}"] if action == "release" else []
    )
    for _, message in messages:
        if message.get("event") == event:
            assert message == {
                "type": "user.event",
                "event": event,
                "data": {
                    "id": evaluation.pk,
                    "status": "pending" if action == "release" else "cancelled",
                },
            }


@pytest.mark.parametrize("action", ["release", "cancel"])
@pytest.mark.parametrize(
    "data,message",
    [
        ({}, "This field is required."),
        ({"reason": " "}, "This field may not be blank."),
        ({"reason": None}, "This field may not be null."),
        ({"reason": "x" * 501}, "Ensure this field has no more than 500 characters."),
    ],
)
def test_override_requires_valid_reason(
    override_evaluation, make_session_client, action, data, message
):
    evaluation, _, _, actor, _ = override_evaluation
    client = make_session_client(actor)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    before = EvaluationRequest.objects.values().get(pk=evaluation.pk)
    response = post_action(client, evaluation, action, data)
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {"reason": [message]},
        }
    }
    assert EvaluationRequest.objects.values().get(pk=evaluation.pk) == before
    assert not AuditLog.objects.exists()
    assert not Notification.objects.exists()


@pytest.mark.parametrize("action", ["release", "cancel"])
def test_override_requires_csrf(override_evaluation, make_session_client, action):
    evaluation, _, _, actor, _ = override_evaluation
    client = make_session_client(actor)
    response = post_action(client, evaluation, action, {"reason": "Review"}, csrf=False)
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "csrf_failed",
            "message": "CSRF verification failed. Reload the page and try again.",
        }
    }


@pytest.mark.parametrize("offset", [timedelta(), timedelta(seconds=1)])
def test_override_release_cannot_release_started_slot(
    override_evaluation, make_session_client, offset
):
    evaluation, _, _, actor, _ = override_evaluation
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(
        starts_at=NOW - offset, ends_at=NOW + timedelta(hours=1)
    )
    client = make_session_client(actor)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    response = post_action(client, evaluation, "release", {"reason": "Review"})
    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "evaluation_already_started",
            "message": "This evaluation has already started.",
        }
    }
    assert not AuditLog.objects.exists()


@pytest.mark.parametrize("result", [None, "passed", "failed"])
def test_override_cancel_after_start_requires_unrecorded_result(
    override_evaluation, override_response, make_session_client, result
):
    evaluation, _, _, actor, _ = override_evaluation
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(
        starts_at=NOW - timedelta(hours=2),
        ends_at=NOW - timedelta(hours=1),
        result=result,
        completed_at=NOW if result else None,
    )
    client = make_session_client(actor)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    response = post_action(client, evaluation, "cancel", {"reason": "Review"})
    if result:
        assert response.status_code == 409
        assert response.json() == {
            "error": {
                "code": "invalid_state_transition",
                "message": "Only active requests without a result can be cancelled.",
            }
        }
        assert not AuditLog.objects.exists()
    else:
        assert response.status_code == 200
        override_response.update(
            status="cancelled",
            is_history=True,
            starts_at="2026-10-31T08:00:00Z",
            ends_at="2026-10-31T09:00:00Z",
            cancelled_by={"id": actor.pk, "display_name": "Ada", "avatar_url": None},
            cancelled_at="2026-10-31T10:00:00Z",
        )
        assert response.json() == override_response


@pytest.mark.parametrize("action", ["release", "cancel"])
def test_privileged_participant_keeps_ordinary_behavior(
    override_evaluation, override_response, make_session_client, action
):
    evaluation, student, picker, _, _ = override_evaluation
    user = student if action == "cancel" else picker
    user.roles.add(Role.objects.get(name="head_tutor"))
    client = make_session_client(user)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    response = post_action(client, evaluation, action, {})
    assert response.status_code == 200
    if action == "cancel":
        override_response.update(
            status="cancelled",
            is_history=True,
            cancelled_by={"id": student.pk, "display_name": "Alice", "avatar_url": None},
            cancelled_at="2026-10-31T10:00:00Z",
        )
    else:
        override_response.update(status="pending", picked_by=None, starts_at=None, ends_at=None)
    assert response.json() == override_response
    assert not AuditLog.objects.exists()
    assert Notification.objects.count() == 1


def test_override_cancel_pending_notifies_student_and_refreshes_queue(
    override_evaluation,
    override_response,
    make_session_client,
    user_event_sender,
    django_capture_on_commit_callbacks,
):
    evaluation, student, picker, actor, eligible = override_evaluation
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(
        status="pending", picked_by=None, starts_at=None, ends_at=None
    )
    client = make_session_client(actor)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    with django_capture_on_commit_callbacks(execute=True):
        response = post_action(client, evaluation, "cancel", {"reason": "Review"})
    assert response.status_code == 200
    override_response.update(
        status="cancelled",
        is_history=True,
        picked_by=None,
        starts_at=None,
        ends_at=None,
        cancelled_by={"id": actor.pk, "display_name": "Ada", "avatar_url": None},
        cancelled_at="2026-10-31T10:00:00Z",
    )
    assert response.json() == override_response
    assert list(Notification.objects.values_list("recipient_id", flat=True)) == [student.pk]
    assert [
        args.args[0]
        for args in user_event_sender.await_args_list
        if args.args[1].get("event") == "evaluation.cancelled"
    ] == [f"user_{student.pk}", f"user_{picker.pk}", f"user_{eligible.pk}"]


def test_overriding_picker_cancellation_does_not_notify_actor(
    override_evaluation, make_session_client
):
    evaluation, student, picker, _, _ = override_evaluation
    picker.roles.add(Role.objects.get(name="head_tutor"))
    client = make_session_client(picker)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    response = post_action(client, evaluation, "cancel", {"reason": "Review"})
    assert response.status_code == 200
    assert list(Notification.objects.values_list("recipient_id", flat=True)) == [student.pk]
    assert AuditLog.objects.get().actor_id == picker.pk


@pytest.mark.parametrize(
    "action,state",
    [
        ("release", "pending"),
        ("release", "cancelled"),
        ("release", "expired"),
        ("cancel", "cancelled"),
        ("cancel", "expired"),
    ],
)
def test_overrides_respect_terminal_and_unpicked_states(
    override_evaluation, make_session_client, action, state
):
    evaluation, _, _, actor, _ = override_evaluation
    changes = {"status": state}
    if state != "cancelled":
        changes.update(picked_by=None, starts_at=None, ends_at=None)
    if state == "cancelled":
        changes["cancelled_at"] = NOW
    if state == "expired":
        changes["expired_at"] = NOW
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(**changes)
    client = make_session_client(actor)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    response = post_action(client, evaluation, action, {"reason": "Review"})
    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "invalid_state_transition",
            "message": (
                "Only picked requests without a result can be released."
                if action == "release"
                else "Only active requests without a result can be cancelled."
            ),
        }
    }
    assert not AuditLog.objects.exists()
    assert not Notification.objects.exists()


@pytest.mark.parametrize("action", ["release", "cancel"])
@pytest.mark.parametrize("role", ["student", "tutor", "sc_member"])
def test_reason_does_not_grant_override_permissions(
    override_evaluation, make_session_client, action, role
):
    evaluation, _, _, actor, _ = override_evaluation
    actor.roles.set(Role.objects.filter(name=role))
    client = make_session_client(actor)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    response = post_action(client, evaluation, action, {"reason": "Review"})
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}
    assert not AuditLog.objects.exists()


def test_privileged_student_cannot_override_own_timing_or_release(
    override_evaluation, make_session_client
):
    evaluation, student, _, _, _ = override_evaluation
    student.roles.add(Role.objects.get(name="admin"))
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(
        starts_at=NOW, ends_at=NOW + timedelta(hours=1)
    )
    client = make_session_client(student)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    cancel = post_action(client, evaluation, "cancel", {"reason": "Review"})
    assert cancel.status_code == 409
    assert cancel.json() == {
        "error": {
            "code": "evaluation_already_started",
            "message": "This evaluation has already started.",
        }
    }
    release = post_action(client, evaluation, "release", {"reason": "Review"})
    assert release.status_code == 403
    assert release.json() == {
        "error": {
            "code": "permission_denied",
            "message": "You do not have permission to perform this action.",
        }
    }


@pytest.mark.parametrize("action", ["release", "cancel"])
@pytest.mark.parametrize("service", ["record_audit", "create_notification"])
def test_failed_override_rolls_back_everything(
    override_evaluation,
    make_session_client,
    user_event_sender,
    monkeypatch,
    django_capture_on_commit_callbacks,
    action,
    service,
):
    from apps.evaluations import notifications, services

    evaluation, _, _, actor, _ = override_evaluation
    client = make_session_client(actor)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    module = services if service == "record_audit" else notifications
    original = getattr(module, service)

    def fail_after_write(**kwargs):
        original(**kwargs)
        raise RuntimeError("Injected override failure")

    monkeypatch.setattr(module, service, fail_after_write)
    before = EvaluationRequest.objects.values().get(pk=evaluation.pk)
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = post_action(client, evaluation, action, {"reason": "Review"})
    assert response.status_code == 500
    assert response.json() == {
        "error": {"code": "server_error", "message": "Something went wrong. Please try again."}
    }
    assert EvaluationRequest.objects.values().get(pk=evaluation.pk) == before
    assert not AuditLog.objects.exists()
    assert not Notification.objects.exists()
    assert callbacks == []
    user_event_sender.assert_not_awaited()


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("action", ["release", "cancel"])
def test_competing_overrides_have_one_winner(override_evaluation, user_event_sender, action):
    evaluation, _, _, actor, _ = override_evaluation
    ready = Barrier(2)

    def submit():
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(actor)
            ready.wait(timeout=10)
            return client.post(
                action_url(evaluation, action), {"reason": "Review"}, format="json"
            ).status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        requests = [pool.submit(submit) for _ in range(2)]
        assert sorted(request.result(timeout=20) for request in requests) == [200, 409]
    assert AuditLog.objects.count() == 1
    assert Notification.objects.count() == 2


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("override_action", ["release", "cancel"])
@pytest.mark.parametrize("participant_action", ["confirm", "decline"])
def test_override_and_participant_transition_do_not_deadlock(
    override_evaluation, user_event_sender, override_action, participant_action
):
    evaluation, student, _, actor, _ = override_evaluation
    EvaluationRequest.objects.filter(pk=evaluation.pk).update(status="awaiting_confirmation")
    ready = Barrier(2)

    def submit(user, action, data):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(user)
            ready.wait(timeout=10)
            return client.post(action_url(evaluation, action), data, format="json").status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        override = pool.submit(submit, actor, override_action, {"reason": "Review"})
        participant = pool.submit(submit, student, participant_action, {})
        statuses = [override.result(timeout=20), participant.result(timeout=20)]
    assert 200 in statuses
    assert set(statuses) <= {200, 409}
    assert AuditLog.objects.count() == (1 if statuses[0] == 200 else 0)
