"""Evaluation event snapshots and commit/rollback behavior (api-plan §9.3, #241)."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, call

import pytest
from django.db import transaction

from apps.evaluations.events import EvaluationEvent, publish_evaluation_event
from apps.evaluations.models import EvaluationRequest


@pytest.fixture
def send(monkeypatch):
    sender = AsyncMock()
    monkeypatch.setattr(
        "apps.core.events.get_channel_layer", lambda: SimpleNamespace(group_send=sender)
    )
    return sender


@pytest.mark.django_db
@pytest.mark.parametrize(
    "event,status",
    [
        ("evaluation.created", "pending"),
        ("evaluation.updated", "pending"),
        ("evaluation.slot_picked", "awaiting_confirmation"),
        ("evaluation.confirmed", "confirmed"),
        ("evaluation.declined", "pending"),
        ("evaluation.released", "pending"),
        ("evaluation.cancelled", "cancelled"),
        ("evaluation.expired", "expired"),
    ],
)
def test_evaluation_event_is_deferred_deduplicated_and_snapshotted(
    send, django_capture_on_commit_callbacks, event, status
):
    evaluation = EvaluationRequest(id=17, status=status, note="Private student note")
    recipients = [42, 7, 42]
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        publish_evaluation_event(EvaluationEvent(event), evaluation, user_ids=iter(recipients))
        send.assert_not_awaited()
        evaluation.status = "confirmed"
        evaluation.pk = 99
        recipients.append(99)
    assert len(callbacks) == 1
    assert send.await_args_list == [
        call(
            "user_7",
            {"type": "user.event", "event": event, "data": {"id": 17, "status": status}},
        ),
        call(
            "user_42",
            {"type": "user.event", "event": event, "data": {"id": 17, "status": status}},
        ),
    ]


@pytest.mark.django_db
def test_rollback_discards_event(send, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        with pytest.raises(RuntimeError, match="rollback"):
            with transaction.atomic():
                publish_evaluation_event(
                    EvaluationEvent.CONFIRMED,
                    EvaluationRequest(id=17, status="confirmed"),
                    user_ids=[7],
                )
                raise RuntimeError("rollback")
    assert callbacks == []
    send.assert_not_awaited()


def test_no_recipients_does_not_schedule_delivery(send, monkeypatch):
    on_commit = []
    monkeypatch.setattr("apps.core.events.transaction.on_commit", on_commit.append)
    publish_evaluation_event(
        EvaluationEvent.CONFIRMED, EvaluationRequest(id=17, status="confirmed"), user_ids=[]
    )
    assert on_commit == []
    send.assert_not_awaited()


@pytest.mark.django_db(transaction=True)
def test_delivery_runs_after_outermost_commit(send):
    with transaction.atomic():
        with transaction.atomic():
            publish_evaluation_event(
                EvaluationEvent.CONFIRMED,
                EvaluationRequest(id=17, status="confirmed"),
                user_ids=[7],
            )
        send.assert_not_awaited()
    send.assert_awaited_once_with(
        "user_7",
        {
            "type": "user.event",
            "event": "evaluation.confirmed",
            "data": {"id": 17, "status": "confirmed"},
        },
    )
