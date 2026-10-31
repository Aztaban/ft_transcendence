"""Fixtures shared by every backend test."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.audit.models import AuditLog
from apps.council.models import SCMessage
from apps.evaluations.models import (
    EvaluationRequest,
    Project,
    TutorEligibility,
    TutorEligibilityRequest,
)
from apps.notifications.models import Notification


@pytest.fixture
def empty_project_catalog(db):
    """Opt-in isolation for tests that define their own projects instead of migration seeds."""
    Project.objects.all().delete()


@pytest.fixture(autouse=True)
def _fresh_rate_limits():
    """Rate limit counters live in the cache; one test's requests must not throttle the next."""
    cache.clear()


@pytest.fixture
def make_user():
    """Create a user with the password "secret". `roles`, when given, replace the default role."""

    def _make(email, display_name=None, roles=(), **extra):
        user = get_user_model().objects.create_user(
            email=email,
            password="secret",
            display_name=display_name or email.split("@")[0],
            **extra,
        )
        if roles:
            user.roles.set(Role.objects.filter(name__in=roles))
        return user

    return _make


@pytest.fixture
def make_session_client():
    """A password-authenticated session for users created by ``make_user``."""

    def _client(user):
        client = APIClient(enforce_csrf_checks=True)
        assert client.login(email=user.email, password="secret")
        return client

    return _client


@pytest.fixture
def seeded_roles():
    for name in Role.Name.values:
        Role.objects.get_or_create(name=name)


@pytest.fixture
def admin_user_directory(make_user, make_session_client, monkeypatch, seeded_roles):
    """An Admin session and a target with stable timestamps for whole-body assertions."""
    now = datetime(2026, 10, 31, 10, 0, tzinfo=timezone.utc)
    monkeypatch.setattr("django.utils.timezone.now", lambda: now)
    admin = make_user(
        "admin@example.com", display_name="Zed", roles=(Role.Name.ADMIN,), language="en"
    )
    target = make_user(
        "alice@example.com", display_name="Alice", intra_login="alice42", language="en"
    )
    client = make_session_client(admin)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    return client, admin, target


@pytest.fixture
def admin_user_bodies(admin_user_directory):
    """Literal contract examples, independent of serializers and database timestamps."""
    _, admin, target = admin_user_directory
    return {
        "target": {
            "id": target.pk,
            "email": "alice@example.com",
            "display_name": "Alice",
            "avatar_url": None,
            "language": "en",
            "intra_login": "alice42",
            "roles": [{"id": Role.objects.get(name="student").pk, "name": "student"}],
            "status": "active",
            "created_at": "2026-10-31T10:00:00Z",
            "last_login": None,
        },
        "admin": {
            "id": admin.pk,
            "email": "admin@example.com",
            "display_name": "Zed",
            "avatar_url": None,
            "language": "en",
            "intra_login": None,
            "roles": [{"id": Role.objects.get(name="admin").pk, "name": "admin"}],
            "status": "active",
            "created_at": "2026-10-31T10:00:00Z",
            "last_login": "2026-10-31T10:00:00Z",
        },
    }


@pytest.fixture
def user_event_sender(monkeypatch):
    """Capture user-group delivery without depending on Redis."""
    sender = AsyncMock()
    monkeypatch.setattr(
        "apps.core.events.get_channel_layer", lambda: SimpleNamespace(group_send=sender)
    )
    return sender


@pytest.fixture
def override_evaluation(make_user, monkeypatch, seeded_roles):
    now = datetime(2026, 10, 31, 10, tzinfo=timezone.utc)
    monkeypatch.setattr("django.utils.timezone.now", lambda: now)
    student = make_user("student@example.com", display_name="Alice", language="en")
    picker = make_user("picker@example.com", display_name="Bob", roles=("student", "tutor"))
    actor = make_user("actor@example.com", display_name="Ada", roles=("head_tutor",))
    eligible = make_user("eligible@example.com", display_name="Cara", roles=("tutor",))
    project = Project.objects.create(slug="override_project", name="Override project")
    for tutor in (picker, eligible):
        TutorEligibility.objects.create(tutor=tutor, project=project)
    evaluation = EvaluationRequest.objects.create(
        student=student,
        project=project,
        status="confirmed",
        picked_by=picker,
        starts_at=now + timedelta(days=1),
        ends_at=now + timedelta(days=1, minutes=45),
    )
    return evaluation, student, picker, actor, eligible


@pytest.fixture
def override_response(override_evaluation):
    evaluation, student, picker, _, _ = override_evaluation
    return {
        "id": evaluation.pk,
        "student": {"id": student.pk, "display_name": "Alice", "avatar_url": None},
        "project": {
            "id": evaluation.project_id,
            "slug": "override_project",
            "name": "Override project",
        },
        "note": "",
        "status": "confirmed",
        "picked_by": {"id": picker.pk, "display_name": "Bob", "avatar_url": None},
        "starts_at": "2026-11-01T10:00:00Z",
        "ends_at": "2026-11-01T10:45:00Z",
        "cancelled_by": None,
        "cancelled_at": None,
        "expired_at": None,
        "result": None,
        "feedback": "",
        "completed_at": None,
        "is_history": False,
        "created_at": "2026-10-31T10:00:00Z",
        "updated_at": "2026-10-31T10:00:00Z",
    }


@pytest.fixture
def deletion_graph(admin_user_directory, make_user, make_session_client):
    """Existing-model cleanup graph: future work, started/history rows and unrelated data."""
    client, actor, target = admin_user_directory
    now = datetime(2026, 10, 31, 10, tzinfo=timezone.utc)
    target.roles.set(Role.objects.all())
    type(target).objects.filter(pk=target.pk).update(intra_id=4242, language="cs", is_staff=True)
    peer = make_user(
        "peer@example.com", display_name="Bob", roles=("student", "tutor"), language="en"
    )
    other = make_user(
        "other@example.com", display_name="Cara", roles=("student", "tutor"), language="en"
    )
    rows = {}

    def evaluation(label, student, picker=None, state="confirmed", start=None, result=None):
        project = Project.objects.create(slug="delete-" + label, name="Deletion " + label)
        for tutor in (picker, other):
            if tutor is not None:
                TutorEligibility.objects.get_or_create(tutor=tutor, project=project)
        fields = {"student": student, "project": project, "status": state, "picked_by": picker}
        if picker is not None:
            start = start if start is not None else now + timedelta(hours=2)
            fields.update(starts_at=start, ends_at=start + timedelta(minutes=45))
        if state == "cancelled":
            fields.update(cancelled_at=now, cancelled_by=peer)
        if state == "expired":
            fields["expired_at"] = now
        if result is not None:
            fields.update(
                result=result, completed_at=now - timedelta(hours=1), feedback="Keep feedback"
            )
        rows[label] = EvaluationRequest.objects.create(**fields)

    evaluation("own_pending", target, state="pending")
    evaluation("own_awaiting", target, peer, "awaiting_confirmation")
    evaluation("own_awaiting_started", target, peer, "awaiting_confirmation", start=now)
    evaluation("own_future", target, peer)
    evaluation("own_started", target, peer, start=now)
    evaluation("own_history", target, peer, start=now - timedelta(hours=2))
    evaluation("own_result", target, peer, start=now - timedelta(hours=2), result="passed")
    evaluation("own_cancelled", target, peer, "cancelled")
    evaluation("own_expired", target, state="expired")
    evaluation("pick_awaiting", peer, target, "awaiting_confirmation")
    evaluation("pick_future", peer, target)
    evaluation("pick_admin_owned", actor, target)
    evaluation("pick_started", peer, target, start=now)
    evaluation("pick_awaiting_started", peer, target, "awaiting_confirmation", start=now)
    evaluation("pick_history", peer, target, start=now - timedelta(hours=2), result="failed")
    evaluation("unrelated", peer, other)
    project = Project.objects.create(slug="delete-eligibility", name="Deletion eligibility")
    TutorEligibility.objects.create(tutor=target, project=project)
    pending = TutorEligibilityRequest.objects.create(requester=target)
    pending.projects.add(project)
    reviewed = TutorEligibilityRequest.objects.create(
        requester=target,
        status="approved",
        reviewed_by=actor,
        reviewed_at=now - timedelta(days=1),
        review_note="Keep review",
    )
    reviewed.projects.add(project)
    message = SCMessage.objects.create(
        sender=target,
        body="Keep body",
        discussion_note="Keep note",
        discussion_note_version=3,
        read_at=now,
    )
    SCMessage.objects.create(sender=peer, body="Unrelated body")
    for recipient in (target, peer):
        Notification.objects.create(
            recipient=recipient,
            type="role.changed",
            payload={"role": "tutor", "action": "assigned"},
            target_url="/profile",
        )
    history = AuditLog.objects.create(
        actor=target,
        action="role.assigned",
        target_type="user",
        target_id=peer.pk,
        metadata={"role": "tutor"},
    )
    browsers = [make_session_client(target), make_session_client(target)]
    peer_browser = make_session_client(peer)
    return SimpleNamespace(
        client=client,
        actor=actor,
        target=target,
        peer=peer,
        other=other,
        evaluations=rows,
        pending=pending,
        reviewed=reviewed,
        message=message,
        audit=history,
        browsers=browsers,
        peer_browser=peer_browser,
    )
