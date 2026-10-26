"""History remains available until its configured retention period elapses."""

from datetime import datetime, timedelta, timezone

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from apps.notifications.models import Notification
from apps.notifications.tasks import purge_old_notifications

pytestmark = pytest.mark.django_db

NOW = datetime(2026, 10, 21, 12, tzinfo=timezone.utc)


@pytest.mark.parametrize("retention_days", [90, 7])
def test_purge_uses_creation_time_and_preserves_cutoff_for_all_recipients(
    settings, monkeypatch, retention_days
):
    settings.NOTIFICATION_RETENTION_DAYS = retention_days
    monkeypatch.setattr("apps.notifications.tasks.timezone.now", lambda: NOW)
    cutoff = NOW - timedelta(days=retention_days)
    expected_kept = []
    for index in range(2):
        user = get_user_model().objects.create_user(
            email=f"history-{index}@example.com", display_name="Recipient"
        )
        for read_at in [None, NOW]:
            for created_at in [
                cutoff - timedelta(microseconds=1),
                cutoff,
                cutoff + timedelta(microseconds=1),
            ]:
                notification = Notification.objects.create(
                    recipient=user,
                    type="resource.deleted",
                    payload={"title": "Guide"},
                    read_at=read_at,
                )
                Notification.objects.filter(pk=notification.pk).update(created_at=created_at)
                if created_at >= cutoff:
                    expected_kept.append(notification.pk)

    assert purge_old_notifications() == 4
    assert list(Notification.objects.order_by("pk").values_list("pk", flat=True)) == expected_kept
    # Retrying the same scheduled run preserves the same history.
    assert purge_old_notifications() == 0
    assert list(Notification.objects.order_by("pk").values_list("pk", flat=True)) == expected_kept


def test_retained_history_remains_listed_and_purged_rows_leave_unread_count(monkeypatch, settings):
    settings.NOTIFICATION_RETENTION_DAYS = 90
    monkeypatch.setattr("apps.notifications.tasks.timezone.now", lambda: NOW)
    user = get_user_model().objects.create_user(
        email="history@example.com", display_name="Recipient"
    )
    for pk, read_at, created_at in [
        (201, NOW, NOW),
        (202, None, NOW - timedelta(days=91)),
        (203, NOW, NOW - timedelta(days=91)),
    ]:
        Notification.objects.create(
            id=pk,
            recipient=user,
            type="resource.deleted",
            payload={"title": "Guide"},
            read_at=read_at,
        )
        Notification.objects.filter(pk=pk).update(created_at=created_at)
    client = APIClient()
    client.force_authenticate(user)
    assert client.get(reverse("api:notification-unread-count")).json() == {"count": 1}

    assert purge_old_notifications() == 2

    response = client.get(reverse("api:notification-list"))
    assert response.status_code == 200
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": 201,
                "type": "resource.deleted",
                "payload": {"title": "Guide"},
                "target_url": "",
                "read_at": "2026-10-21T12:00:00Z",
                "created_at": "2026-10-21T12:00:00Z",
            }
        ],
    }
    response = client.get(reverse("api:notification-unread-count"))
    assert response.status_code == 200
    assert response.json() == {"count": 0}


def test_daily_retention_task_is_discoverable_by_celery(settings):
    from config.celery import app

    app.autodiscover_tasks(force=True)
    entry = settings.CELERY_BEAT_SCHEDULE["purge-old-notifications-daily"]
    assert entry["schedule"] == 86400.0
    assert entry["task"] == "purge_old_notifications"
    assert app.tasks[entry["task"]].run == purge_old_notifications.run
