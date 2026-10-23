"""Notification persistence and ownership rules."""

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import connection
from django.utils import timezone

from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db


@pytest.fixture
def recipient():
    return get_user_model().objects.create_user(
        email="recipient@example.com", display_name="Recipient"
    )


def test_notification_round_trips_event_facts_and_defaults(recipient):
    notification = Notification.objects.create(
        recipient=recipient,
        type="eligibility.decided",
        payload={"request_id": 42, "decision": "approved", "review_note": "Approved"},
        target_url="/eligibility-requests/42",
    )
    notification.refresh_from_db()

    assert notification.recipient == recipient
    assert notification.type == "eligibility.decided"
    assert notification.payload == {
        "request_id": 42,
        "decision": "approved",
        "review_note": "Approved",
    }
    assert notification.target_url == "/eligibility-requests/42"
    assert notification.read_at is None
    assert notification.created_at is not None
    assert notification.updated_at >= notification.created_at
    assert recipient.notifications.get() == notification


def test_notification_can_have_no_target_and_persist_a_read_timestamp(recipient):
    notification = Notification.objects.create(
        recipient=recipient, type="resource.deleted", payload={"title": "Guide"}
    )
    notification.full_clean()
    notification.refresh_from_db()
    assert notification.target_url == ""

    read_at = timezone.now()
    Notification.objects.filter(pk=notification.pk, read_at__isnull=True).update(read_at=read_at)
    notification.refresh_from_db()
    assert notification.read_at == read_at


def test_deleting_recipient_deletes_only_their_notifications(recipient):
    other = get_user_model().objects.create_user(email="other@example.com", display_name="Other")
    Notification.objects.create(
        recipient=recipient, type="resource.deleted", payload={"title": "Guide"}
    )
    kept = Notification.objects.create(
        recipient=other, type="resource.deleted", payload={"title": "Another guide"}
    )

    recipient.delete()

    assert list(Notification.objects.values_list("pk", flat=True)) == [kept.pk]


def test_database_has_recipient_read_created_index():
    with connection.cursor() as cursor:
        constraints = connection.introspection.get_constraints(cursor, "notification")

    assert constraints["notif_recipient_read_created"]["index"] is True
    assert constraints["notif_recipient_read_created"]["columns"] == [
        "recipient_id",
        "read_at",
        "created_at",
    ]


def test_notification_rejects_undocumented_type_on_validation(recipient):
    notification = Notification(
        recipient=recipient, type="system_message", payload={"title": "Unsupported"}
    )

    with pytest.raises(ValidationError) as exc:
        notification.full_clean()

    assert set(exc.value.message_dict) == {"type"}
