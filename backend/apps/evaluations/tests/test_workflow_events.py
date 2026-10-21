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
from apps.evaluations.services import create_request, edit_note, release_slot

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
        sender.assert_not_awaited()
    else:
        assert len(callbacks) == 1
        assert sender.await_args_list == [
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
