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
from apps.evaluations.models import EvaluationRequest, Project, TutorEligibility


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
def admin_user_directory(make_user, make_session_client, monkeypatch):
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
def override_evaluation(make_user, monkeypatch):
    now = datetime(2026, 10, 31, 10, tzinfo=timezone.utc)
    monkeypatch.setattr("django.utils.timezone.now", lambda: now)
    for name in Role.Name.values:
        Role.objects.get_or_create(name=name)
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
