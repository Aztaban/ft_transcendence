"""Admin audit log list (api-plan §10.9): representation, order, pagination, permissions."""

from datetime import datetime, timezone

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.audit.models import AuditLog

pytestmark = pytest.mark.django_db

PASSWORD = "secret"
OLDER = datetime(2026, 10, 9, 8, 0, tzinfo=timezone.utc)
NEWER = datetime(2026, 10, 9, 9, 0, tzinfo=timezone.utc)
DENIED = {
    "error": {
        "code": "permission_denied",
        "message": "You do not have permission to perform this action.",
    }
}


def audit_log_url():
    return reverse("api:admin-audit-log")


def make_user(email, display_name, *roles):
    user = get_user_model().objects.create_user(
        email=email, password=PASSWORD, display_name=display_name
    )
    if roles:
        user.roles.add(*Role.objects.filter(name__in=roles))
    return user


def admin_client():
    admin = make_user("admin@example.com", "Admin", Role.Name.ADMIN)
    client = APIClient()
    client.force_authenticate(admin)
    return client, admin


def create_entry(monkeypatch, when, **overrides):
    fields = {
        "actor": None,
        "action": AuditLog.Action.ROLE_ASSIGNED,
        "target_type": AuditLog.TargetType.USER,
        "target_id": 42,
        "reason": "",
        "metadata": {"role": "tutor"},
    }
    fields.update(overrides)
    monkeypatch.setattr("django.utils.timezone.now", lambda: when)
    return AuditLog.objects.create(**fields)


def entry_body(entry, actor):
    return {
        "id": entry.id,
        "actor": actor,
        "action": entry.action,
        "target_type": entry.target_type,
        "target_id": entry.target_id,
        "reason": entry.reason,
        "metadata": entry.metadata,
        "created_at": entry.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def test_missing_session_returns_contract_error():
    response = APIClient().get(audit_log_url())
    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }


@pytest.mark.parametrize(
    "role",
    [Role.Name.STUDENT, Role.Name.TUTOR, Role.Name.HEAD_TUTOR, Role.Name.SC_MEMBER],
)
def test_non_admin_roles_are_denied(role):
    user = make_user(f"{role}@example.com", role, role)
    client = APIClient()
    client.force_authenticate(user)
    response = client.get(audit_log_url())
    assert response.status_code == 403
    assert response.json() == DENIED


def test_admin_sees_an_empty_log():
    client, _ = admin_client()
    response = client.get(audit_log_url())
    assert response.status_code == 200
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}


def test_entries_match_the_contract_and_newest_created_at_comes_first(monkeypatch):
    client, _ = admin_client()
    actor = make_user("actor@example.com", "Ada")
    deleted_actor = make_user("gone@example.com", "Gone")
    older = create_entry(monkeypatch, OLDER, actor=actor, reason="kept for review")
    newer = create_entry(
        monkeypatch,
        NEWER,
        action=AuditLog.Action.SC_MESSAGE_DELETED,
        target_type=AuditLog.TargetType.SC_MESSAGE,
        target_id=7,
        reason="abuse",
        metadata={"reason_recorded": True},
    )
    orphaned = create_entry(monkeypatch, NEWER, actor=deleted_actor, target_id=8)
    deleted_actor.delete()

    response = client.get(audit_log_url())

    assert response.status_code == 200
    assert response.json() == {
        "count": 3,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": orphaned.id,
                "actor": None,
                "action": "role.assigned",
                "target_type": "user",
                "target_id": 8,
                "reason": "",
                "metadata": {"role": "tutor"},
                "created_at": "2026-10-09T09:00:00Z",
            },
            {
                "id": newer.id,
                "actor": None,
                "action": "sc_message.deleted",
                "target_type": "sc_message",
                "target_id": 7,
                "reason": "abuse",
                "metadata": {"reason_recorded": True},
                "created_at": "2026-10-09T09:00:00Z",
            },
            {
                "id": older.id,
                "actor": {"id": actor.id, "display_name": "Ada", "avatar_url": None},
                "action": "role.assigned",
                "target_type": "user",
                "target_id": 42,
                "reason": "kept for review",
                "metadata": {"role": "tutor"},
                "created_at": "2026-10-09T08:00:00Z",
            },
        ],
    }


def test_same_timestamp_orders_by_newest_id(monkeypatch):
    client, _ = admin_client()
    first = create_entry(monkeypatch, NEWER, target_id=1)
    second = create_entry(monkeypatch, NEWER, target_id=2)
    first.refresh_from_db()
    second.refresh_from_db()
    assert first.created_at == second.created_at == NEWER

    response = client.get(audit_log_url())

    assert response.status_code == 200
    assert [row["id"] for row in response.json()["results"]] == [second.id, first.id]


def test_pagination_returns_the_contract_envelope(monkeypatch):
    client, _ = admin_client()
    older = create_entry(monkeypatch, OLDER, target_id=1)
    newer = create_entry(monkeypatch, NEWER, target_id=2)
    url = audit_log_url()

    first = client.get(url, {"page_size": 1})
    assert first.status_code == 200
    assert first.json() == {
        "count": 2,
        "next": f"http://testserver{url}?page=2&page_size=1",
        "previous": None,
        "results": [entry_body(newer, None)],
    }

    second = client.get(url, {"page": 2, "page_size": 1})
    assert second.status_code == 200
    assert second.json() == {
        "count": 2,
        "next": None,
        "previous": f"http://testserver{url}?page_size=1",
        "results": [entry_body(older, None)],
    }


def test_session_authentication_allows_an_admin():
    admin = make_user("admin@example.com", "Admin", Role.Name.ADMIN)
    client = APIClient(enforce_csrf_checks=True)
    assert client.login(email=admin.email, password=PASSWORD)
    response = client.get(audit_log_url())
    assert response.status_code == 200
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}
