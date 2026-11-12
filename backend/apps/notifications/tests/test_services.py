"""Notification creation is durable before delivery and follows workflow rollback."""

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction

from apps.accounts.models import Role
from apps.notifications.models import Notification
from apps.notifications.services import create_notification

pytestmark = pytest.mark.django_db


@pytest.fixture
def recipient():
    # Transactional tests flush seeded roles between runs.
    Role.objects.get_or_create(name=Role.Name.STUDENT)
    return get_user_model().objects.create_user(
        email="recipient@example.com", display_name="Recipient"
    )


def test_creation_stores_exact_facts_and_defers_recipient_only_event(
    recipient, user_event_sender, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        notification = create_notification(
            recipient_id=recipient.pk,
            notification_type=Notification.Type.ELIGIBILITY_DECIDED,
            payload={"request_id": 7, "decision": "approved", "review_note": ""},
            target_url="/eligibility-requests/7",
        )
        user_event_sender.assert_not_awaited()
        notification.refresh_from_db()
        assert notification.recipient_id == recipient.pk
        assert notification.type == "eligibility.decided"
        assert notification.payload == {
            "request_id": 7,
            "decision": "approved",
            "review_note": "",
        }
        assert notification.target_url == "/eligibility-requests/7"
        assert notification.read_at is None
        assert notification.created_at is not None
        original_id = notification.pk
        notification.pk = 999999
    assert len(callbacks) == 1
    user_event_sender.assert_awaited_once_with(
        f"user_{recipient.pk}",
        {"type": "user.event", "event": "notification.created", "data": {"id": original_id}},
    )


def test_creation_supports_notifications_without_a_target(
    recipient, user_event_sender, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True):
        notification = create_notification(
            recipient_id=recipient.pk,
            notification_type="account.updated",
            payload={"fields": ["email"]},
        )
    notification.refresh_from_db()
    assert notification.target_url == ""
    assert notification.payload == {"fields": ["email"]}


@pytest.mark.parametrize(
    "overrides,field",
    [
        ({"notification_type": "system_message"}, "type"),
        ({"recipient_id": 999999}, "recipient"),
        ({"payload": ["Guide"]}, "payload"),
        ({"payload": {"title": object()}}, "payload"),
        ({"target_url": "/" + "a" * 255}, "target_url"),
    ],
)
def test_invalid_input_creates_no_row_or_event(
    recipient, user_event_sender, django_capture_on_commit_callbacks, overrides, field
):
    arguments = {
        "recipient_id": recipient.pk,
        "notification_type": "account.updated",
        "payload": {"fields": ["email"]},
    }
    arguments.update(overrides)
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        with pytest.raises(ValidationError) as exc:
            create_notification(**arguments)
    assert set(exc.value.message_dict) == {field}
    assert not Notification.objects.exists()
    assert callbacks == []
    user_event_sender.assert_not_awaited()


def test_workflow_rollback_removes_notification_and_discards_delivery(
    recipient, user_event_sender, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        with pytest.raises(RuntimeError, match="rollback"):
            with transaction.atomic():
                get_user_model().objects.filter(pk=recipient.pk).update(display_name="Changed")
                create_notification(
                    recipient_id=recipient.pk,
                    notification_type="account.updated",
                    payload={"fields": ["display_name"]},
                    target_url="/profile",
                )
                raise RuntimeError("rollback")
    recipient.refresh_from_db()
    assert recipient.display_name == "Recipient"
    assert not Notification.objects.exists()
    assert callbacks == []
    user_event_sender.assert_not_awaited()


@pytest.mark.django_db(transaction=True)
def test_delivery_waits_for_outermost_commit(recipient, user_event_sender):
    with transaction.atomic():
        with transaction.atomic():
            notification = create_notification(
                recipient_id=recipient.pk,
                notification_type="account.updated",
                payload={"fields": ["email"]},
            )
        user_event_sender.assert_not_awaited()
    assert Notification.objects.filter(pk=notification.pk).exists()
    user_event_sender.assert_awaited_once_with(
        f"user_{recipient.pk}",
        {"type": "user.event", "event": "notification.created", "data": {"id": notification.pk}},
    )


@pytest.mark.django_db(transaction=True)
def test_delivery_failure_preserves_committed_notification(recipient, user_event_sender, caplog):
    user_event_sender.side_effect = ConnectionError("Redis unavailable")
    notification = create_notification(
        recipient_id=recipient.pk,
        notification_type="account.updated",
        payload={"fields": ["email"]},
    )
    assert Notification.objects.filter(pk=notification.pk).exists()
    assert "Redis unavailable" in caplog.text
