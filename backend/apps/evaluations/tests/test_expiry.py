"""Expiry boundaries, transactional notifications and MySQL races."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from types import SimpleNamespace
from unittest.mock import AsyncMock, call

import pytest
from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection, connections, transaction
from django.db.models.query import QuerySet

from apps.accounts.models import Role
from apps.evaluations.models import EvaluationRequest, Project, TutorEligibility
from apps.evaluations.tasks import expire_evaluation_requests
from apps.notifications.models import Notification
from apps.notifications.services import create_notification

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("empty_project_catalog")]
NOW = datetime(2026, 10, 22, 12, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def fixed_time(monkeypatch):
    monkeypatch.setattr("django.utils.timezone.now", lambda: NOW)


@pytest.fixture(autouse=True)
def send(monkeypatch):
    sender = AsyncMock()
    monkeypatch.setattr(
        "apps.core.events.get_channel_layer", lambda: SimpleNamespace(group_send=sender)
    )
    return sender


@pytest.fixture
def evaluation_factory():
    for name in Role.Name.values:
        Role.objects.get_or_create(name=name)
    project = Project.objects.create(id=4, slug="libft", name="Libft")
    for pk, role, status in [
        (7, "student", "active"),
        (42, "tutor", "active"),
        (43, "head_tutor", "active"),
        (44, "student", "active"),
        (45, "tutor", "suspended"),
    ]:
        user = get_user_model().objects.create_user(
            id=pk, email=f"expiry-{pk}@example.com", display_name="User", status=status
        )
        user.roles.add(Role.objects.get(name=role))
        if pk in (43, 44, 45):
            TutorEligibility.objects.create(tutor=user, project=project)

    def make(status="pending", *, pk=17, start=None, created=None, result=None):
        fields = {}
        if status in ("awaiting_confirmation", "confirmed"):
            start = start if start is not None else NOW - timedelta(minutes=1)
            fields.update(picked_by_id=42, starts_at=start, ends_at=start + timedelta(minutes=45))
        if status == "cancelled":
            fields.update(cancelled_by_id=7, cancelled_at=NOW)
        if status == "expired":
            fields["expired_at"] = NOW - timedelta(days=1)
        evaluation = EvaluationRequest.objects.create(
            id=pk, student_id=7, project=project, status=status, result=result, **fields
        )
        EvaluationRequest.objects.filter(pk=pk).update(
            created_at=created if created is not None else NOW - timedelta(days=15)
        )
        evaluation.refresh_from_db()
        return evaluation

    return make


@pytest.mark.parametrize("delta,expired", [(-1, True), (0, False), (1, False)])
def test_pending_ttl_boundary(evaluation_factory, delta, expired):
    evaluation = evaluation_factory(
        created=NOW - timedelta(days=14) + timedelta(microseconds=delta)
    )
    assert expire_evaluation_requests() == int(expired)
    evaluation.refresh_from_db()
    assert evaluation.status == ("expired" if expired else "pending")
    assert evaluation.expired_at == (NOW if expired else None)


@pytest.mark.parametrize("delta,expired", [(-1, True), (0, True), (1, False)])
def test_unconfirmed_start_boundary(evaluation_factory, delta, expired):
    evaluation = evaluation_factory(
        "awaiting_confirmation", start=NOW + timedelta(microseconds=delta)
    )
    assert expire_evaluation_requests() == int(expired)
    evaluation.refresh_from_db()
    assert evaluation.status == ("expired" if expired else "awaiting_confirmation")
    assert evaluation.picked_by_id == (None if expired else 42)
    if expired:
        assert evaluation.starts_at is None
        assert evaluation.ends_at is None


def test_ttl_is_configurable(evaluation_factory, settings):
    settings.EVALUATION_REQUEST_TTL_DAYS = 3
    old = evaluation_factory(created=NOW - timedelta(days=4))
    recent = evaluation_factory(pk=18, created=NOW - timedelta(days=2))
    assert expire_evaluation_requests() == 1
    old.refresh_from_db()
    recent.refresh_from_db()
    assert old.status == "expired"
    assert recent.status == "pending"


@pytest.mark.parametrize(
    "status,result",
    [
        ("confirmed", None),
        ("confirmed", "passed"),
        ("cancelled", None),
        ("expired", None),
    ],
)
def test_confirmed_and_final_requests_are_unchanged(evaluation_factory, status, result, send):
    evaluation = evaluation_factory(status, start=NOW - timedelta(hours=2), result=result)
    before = EvaluationRequest.objects.values().get(pk=evaluation.pk)
    assert expire_evaluation_requests() == 0
    assert EvaluationRequest.objects.values().get(pk=evaluation.pk) == before
    assert not Notification.objects.exists()
    send.assert_not_awaited()


@pytest.mark.parametrize("previous_status", ["pending", "awaiting_confirmation"])
def test_expiry_stores_exact_facts_and_delivers_after_commit(
    evaluation_factory, send, django_capture_on_commit_callbacks, previous_status, monkeypatch
):
    evaluation = evaluation_factory(previous_status)
    with django_capture_on_commit_callbacks(execute=True):
        assert expire_evaluation_requests() == 1
        send.assert_not_awaited()
        expected = [
            {
                "recipient_id": 7,
                "type": "evaluation.expired",
                "payload": {
                    "request_id": 17,
                    "project": {"id": 4, "slug": "libft", "name": "Libft"},
                    "previous_status": previous_status,
                },
                "target_url": "/evaluations/17",
                "read_at": None,
            }
        ]
        if previous_status == "awaiting_confirmation":
            expected.append(
                {
                    "recipient_id": 42,
                    "type": "evaluation.expired",
                    "payload": {
                        "request_id": 17,
                        "project": {"id": 4, "slug": "libft", "name": "Libft"},
                        "previous_status": "awaiting_confirmation",
                    },
                    "target_url": "/evaluations/17",
                    "read_at": None,
                }
            )
        assert (
            list(
                Notification.objects.order_by("recipient_id").values(
                    "recipient_id", "type", "payload", "target_url", "read_at"
                )
            )
            == expected
        )
    event = {
        "type": "user.event",
        "event": "evaluation.expired",
        "data": {"id": 17, "status": "expired"},
    }
    expected_events = [call("user_7", event)]
    expected_events.append(call("user_43" if previous_status == "pending" else "user_42", event))
    expected_events.extend(
        [
            call(
                f"user_{notification.recipient_id}",
                {
                    "type": "user.event",
                    "event": "notification.created",
                    "data": {"id": notification.pk},
                },
            )
            for notification in Notification.objects.order_by("recipient_id")
        ]
    )
    assert send.await_args_list == expected_events
    evaluation.refresh_from_db()
    assert evaluation.status == "expired"
    assert evaluation.expired_at == NOW
    assert evaluation.updated_at == NOW
    assert evaluation.picked_by_id is None
    assert evaluation.starts_at is None
    assert evaluation.ends_at is None
    monkeypatch.setattr("django.utils.timezone.now", lambda: NOW + timedelta(minutes=5))
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        assert expire_evaluation_requests() == 0
    assert callbacks == []
    assert Notification.objects.count() == (1 if previous_status == "pending" else 2)
    evaluation.refresh_from_db()
    assert evaluation.expired_at == NOW


@pytest.mark.parametrize("previous_status", ["pending", "awaiting_confirmation"])
def test_outer_rollback_preserves_request_and_discards_notifications(
    evaluation_factory, send, django_capture_on_commit_callbacks, previous_status
):
    evaluation = evaluation_factory(previous_status)
    before = EvaluationRequest.objects.values().get(pk=evaluation.pk)
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        with transaction.atomic():
            assert expire_evaluation_requests() == 1
            assert Notification.objects.exists()
            transaction.set_rollback(True)
    assert EvaluationRequest.objects.values().get(pk=evaluation.pk) == before
    assert not Notification.objects.exists()
    assert callbacks == []
    send.assert_not_awaited()


def test_notification_failure_rolls_back_expiry(
    evaluation_factory, send, monkeypatch, django_capture_on_commit_callbacks
):
    evaluation = evaluation_factory("awaiting_confirmation")
    before = EvaluationRequest.objects.values().get(pk=evaluation.pk)

    def fail_after_write(**kwargs):
        create_notification(**kwargs)
        raise RuntimeError("Notification failure")

    monkeypatch.setattr("apps.evaluations.notifications.create_notification", fail_after_write)
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        with pytest.raises(RuntimeError, match="Notification failure"):
            expire_evaluation_requests()
    assert EvaluationRequest.objects.values().get(pk=evaluation.pk) == before
    assert not Notification.objects.exists()
    assert callbacks == []
    send.assert_not_awaited()


def test_request_changed_after_candidate_scan_is_not_expired(evaluation_factory, monkeypatch, send):
    from apps.evaluations.services import lock_participants

    evaluation_factory()

    def change_before_request_lock(picker_id, student_id):
        lock_participants(picker_id, student_id)
        EvaluationRequest.objects.filter(pk=17).update(
            status="confirmed",
            picked_by_id=42,
            starts_at=NOW + timedelta(hours=1),
            ends_at=NOW + timedelta(hours=2),
        )

    monkeypatch.setattr("apps.evaluations.tasks.lock_participants", change_before_request_lock)
    assert expire_evaluation_requests() == 0
    assert EvaluationRequest.objects.get(pk=17).status == "confirmed"
    assert not Notification.objects.exists()
    send.assert_not_awaited()


def test_lost_conditional_update_creates_no_side_effects(evaluation_factory, monkeypatch, send):
    evaluation_factory()
    original = QuerySet.update

    def lose_update(queryset, **fields):
        if queryset.model is EvaluationRequest:
            return 0
        return original(queryset, **fields)

    monkeypatch.setattr(QuerySet, "update", lose_update)
    assert expire_evaluation_requests() == 0
    assert EvaluationRequest.objects.get(pk=17).status == "pending"
    assert not Notification.objects.exists()
    send.assert_not_awaited()


@pytest.mark.django_db(transaction=True)
def test_competing_jobs_expire_and_notify_only_once(evaluation_factory, monkeypatch):
    from apps.evaluations.services import lock_participants

    assert connection.vendor == "mysql"
    evaluation_factory("awaiting_confirmation")
    barrier = Barrier(2)

    def lock_after_both_jobs_scanned(picker_id, student_id):
        barrier.wait(timeout=10)
        lock_participants(picker_id, student_id)

    monkeypatch.setattr("apps.evaluations.tasks.lock_participants", lock_after_both_jobs_scanned)

    def run(_):
        close_old_connections()
        try:
            return expire_evaluation_requests()
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        counts = list(executor.map(run, range(2)))
    assert sorted(counts) == [0, 1]
    assert EvaluationRequest.objects.get(pk=17).status == "expired"
    assert list(
        Notification.objects.order_by("recipient_id").values_list("recipient_id", "type")
    ) == [
        (7, "evaluation.expired"),
        (42, "evaluation.expired"),
    ]


def test_expiry_task_is_discoverable_and_scheduled_every_five_minutes(settings):
    from config.celery import app

    app.autodiscover_tasks(force=True)
    entry = settings.CELERY_BEAT_SCHEDULE["expire-evaluation-requests-every-5m"]
    assert entry["task"] == "expire_evaluation_requests"
    assert entry["schedule"] == 300.0
    assert app.tasks[entry["task"]].run == expire_evaluation_requests.run
