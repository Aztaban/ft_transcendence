"""Create, note edits and releases publish to the contract's recipients (§9.3)."""

from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, call

import pytest
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Role
from apps.evaluations.events import _eligible_hitchhiker_ids
from apps.evaluations.models import EvaluationRequest, Project, TutorEligibility
from apps.evaluations.notifications import notify_evaluation_expired
from apps.evaluations.services import create_request, edit_note, release_slot
from apps.notifications.models import Notification
from apps.notifications.services import create_notification

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("empty_project_catalog")]


@pytest.fixture
def participants():
    for name in Role.Name.values:
        Role.objects.get_or_create(name=name)
    project = Project.objects.create(id=4, slug="libft", name="Libft")
    users = {}
    for user_id, roles, status in (
        (7, ("student",), "active"),
        (42, ("tutor",), "active"),
        (43, ("tutor", "head_tutor"), "active"),
        (44, ("student",), "active"),
        (45, ("tutor",), "suspended"),
    ):
        user = get_user_model().objects.create_user(
            id=user_id, email=f"workflow-{user_id}@example.com", display_name="User", status=status
        )
        user.roles.add(*Role.objects.filter(name__in=roles))
        if user_id in (43, 44, 45):
            TutorEligibility.objects.create(tutor=user, project=project)
        users[user_id] = user
    return project, users


def test_eligible_hitchhikers_query_returns_each_active_hitchhiker_once(participants):
    project, _ = participants
    assert list(_eligible_hitchhiker_ids(project.pk)) == [43]


@pytest.mark.parametrize(
    "action,event,recipients",
    [
        ("create", "evaluation.created", (43,)),
        ("edit", "evaluation.updated", (7, 43)),
        ("release", "evaluation.released", (7, 42, 43)),
    ],
)
@pytest.mark.parametrize("rollback", [False, True])
def test_workflow_event_is_deferred_and_discarded_on_rollback(
    participants,
    monkeypatch,
    django_capture_on_commit_callbacks,
    action,
    event,
    recipients,
    rollback,
):
    project, users = participants
    sender = AsyncMock()
    monkeypatch.setattr(
        "apps.core.events.get_channel_layer", lambda: SimpleNamespace(group_send=sender)
    )
    at = timezone.now()
    evaluation = None
    if action != "create":
        picked = action == "release"
        evaluation = EvaluationRequest.objects.create(
            id=17,
            student=users[7],
            project=project,
            status="awaiting_confirmation" if picked else "pending",
            picked_by=users[42] if picked else None,
            starts_at=at + timedelta(days=1) if picked else None,
            ends_at=at + timedelta(days=1, minutes=45) if picked else None,
        )
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        with transaction.atomic():
            if action == "create":
                evaluation = create_request(users[7], project, "Private note")
            elif action == "edit":
                edit_note(evaluation, {"note": "Changed note"})
            else:
                release_slot(evaluation, users[42])
            sender.assert_not_awaited()
            if rollback:
                transaction.set_rollback(True)
    if rollback:
        assert callbacks == []
        assert not Notification.objects.exists()
        sender.assert_not_awaited()
    else:
        assert len(callbacks) == (1 if action == "edit" else 2)
        expected_events = [
            call(
                f"user_{user_id}",
                {
                    "type": "user.event",
                    "event": event,
                    "data": {"id": evaluation.pk, "status": "pending"},
                },
            )
            for user_id in recipients
        ]
        if action != "edit":
            notification = Notification.objects.get()
            expected_events.append(
                call(
                    "user_43" if action == "create" else "user_7",
                    {
                        "type": "user.event",
                        "event": "notification.created",
                        "data": {"id": notification.pk},
                    },
                )
            )
        assert sender.await_args_list == expected_events


def test_created_notification_filters_recipients_and_preserves_anonymity(participants):
    project, users = participants
    # Exclude the student even if they are an eligible Hitchhiker themselves.
    users[7].roles.add(Role.objects.get(name="tutor"))
    TutorEligibility.objects.create(tutor=users[7], project=project)
    evaluation = create_request(users[7], project, "Private note")
    assert list(
        Notification.objects.values("recipient_id", "type", "payload", "target_url", "read_at")
    ) == [
        {
            "recipient_id": 43,
            "type": "evaluation.created",
            "payload": {
                "request_id": evaluation.pk,
                "project": {"id": 4, "slug": "libft", "name": "Libft"},
            },
            "target_url": f"/evaluations/{evaluation.pk}",
            "read_at": None,
        }
    ]


def test_release_uses_locked_picker_facts_after_clearing_pick(participants):
    project, users = participants
    evaluation = EvaluationRequest.objects.create(
        id=17,
        student=users[7],
        project=project,
        status="confirmed",
        picked_by=users[42],
        starts_at=timezone.now() + timedelta(days=1),
        ends_at=timezone.now() + timedelta(days=1, minutes=45),
    )
    # A stale caller must not supply the tutor identity used by the notification.
    evaluation.picked_by = users[43]
    release_slot(evaluation, users[42])
    assert evaluation.picked_by_id is None
    assert list(
        Notification.objects.values("recipient_id", "type", "payload", "target_url", "read_at")
    ) == [
        {
            "recipient_id": 7,
            "type": "evaluation.released",
            "payload": {
                "request_id": 17,
                "project": {"id": 4, "slug": "libft", "name": "Libft"},
                "tutor": {"id": 42, "display_name": "User"},
            },
            "target_url": "/evaluations/17",
            "read_at": None,
        }
    ]


@pytest.mark.parametrize("action", ["create", "release"])
def test_notification_failure_rolls_back_lifecycle_action(
    participants, monkeypatch, django_capture_on_commit_callbacks, action
):
    project, users = participants
    evaluation = None
    if action == "release":
        evaluation = EvaluationRequest.objects.create(
            id=17,
            student=users[7],
            project=project,
            status="confirmed",
            picked_by=users[42],
            starts_at=timezone.now() + timedelta(days=1),
            ends_at=timezone.now() + timedelta(days=1, minutes=45),
        )
    sender = AsyncMock()
    monkeypatch.setattr(
        "apps.core.events.get_channel_layer", lambda: SimpleNamespace(group_send=sender)
    )

    def fail_after_write(**kwargs):
        create_notification(**kwargs)
        raise RuntimeError("Notification failure")

    monkeypatch.setattr("apps.evaluations.notifications.create_notification", fail_after_write)
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        with pytest.raises(RuntimeError, match="Notification failure"):
            if action == "create":
                create_request(users[7], project, "Private note")
            else:
                release_slot(evaluation, users[42])
    assert callbacks == []
    assert not Notification.objects.exists()
    sender.assert_not_awaited()
    if evaluation is None:
        assert not EvaluationRequest.objects.exists()
    else:
        evaluation.refresh_from_db()
        assert evaluation.status == "confirmed"
        assert evaluation.picked_by_id == 42


@pytest.mark.parametrize("previous_status", ["pending", "awaiting_confirmation"])
def test_expiry_notification_helper_retains_previous_status_and_picker(
    participants, previous_status
):
    project, users = participants
    # The expiry task is pending; its caller must capture these facts before updating.
    evaluation = EvaluationRequest.objects.create(
        id=17, student=users[7], project=project, status="expired", expired_at=timezone.now()
    )
    with transaction.atomic():
        notify_evaluation_expired(
            evaluation,
            previous_status=previous_status,
            previous_picker_id=42 if previous_status == "awaiting_confirmation" else None,
        )
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
