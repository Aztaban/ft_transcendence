"""Admin audit log list (api-plan §10.9): representation, order, pagination, permissions."""

from datetime import datetime, timezone

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role, User
from apps.audit.models import AuditLog

pytestmark = pytest.mark.django_db

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


def admin_client(make_user, *, roles=(Role.Name.ADMIN,)):
    admin = make_user("admin@example.com", "Admin", roles)
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
    "roles",
    [
        (Role.Name.STUDENT,),
        (Role.Name.TUTOR,),
        (Role.Name.HEAD_TUTOR,),
        (Role.Name.SC_MEMBER,),
        (Role.Name.STUDENT, Role.Name.TUTOR, Role.Name.HEAD_TUTOR, Role.Name.SC_MEMBER),
    ],
)
@pytest.mark.parametrize(
    "flags",
    [{}, {"is_staff": True}, {"is_staff": True, "is_superuser": True}],
    ids=["ordinary", "django-staff", "django-superuser"],
)
def test_non_admin_roles_are_denied(make_user, roles, flags):
    user = make_user("viewer@example.com", roles=roles, **flags)
    client = APIClient()
    client.force_authenticate(user)
    response = client.get(audit_log_url())
    assert response.status_code == 403
    assert response.json() == DENIED


@pytest.mark.parametrize(
    "roles",
    [
        (Role.Name.ADMIN,),
        (Role.Name.STUDENT, Role.Name.ADMIN),
        tuple(Role.Name.values),
    ],
)
def test_admin_sees_an_empty_log_without_django_staff_access(make_user, roles):
    client, admin = admin_client(make_user, roles=roles)
    assert admin.is_staff is False
    assert admin.is_superuser is False
    response = client.get(audit_log_url())
    assert response.status_code == 200
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}


def test_entries_match_the_contract_and_newest_created_at_comes_first(make_user, monkeypatch):
    client, _ = admin_client(make_user)
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


def test_same_timestamp_orders_by_newest_id(make_user, monkeypatch):
    client, _ = admin_client(make_user)
    first = create_entry(monkeypatch, NEWER, target_id=1)
    second = create_entry(monkeypatch, NEWER, target_id=2)
    first.refresh_from_db()
    second.refresh_from_db()
    assert first.created_at == second.created_at == NEWER

    response = client.get(audit_log_url())

    assert response.status_code == 200
    assert [row["id"] for row in response.json()["results"]] == [second.id, first.id]


def test_pagination_returns_the_contract_envelope(make_user, monkeypatch):
    client, _ = admin_client(make_user)
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


def ids(response):
    return [row["id"] for row in response.json()["results"]]


def test_filters_combine_and_keep_newest_first(make_user, monkeypatch):
    client, admin = admin_client(make_user)
    other = make_user("other@example.com", "Other")
    match = create_entry(monkeypatch, NEWER, actor=admin, target_id=7)
    create_entry(monkeypatch, OLDER, actor=admin, target_id=7)
    create_entry(
        monkeypatch,
        NEWER,
        actor=other,
        action=AuditLog.Action.ROLE_REVOKED,
        target_type=AuditLog.TargetType.SC_MESSAGE,
        target_id=7,
    )
    create_entry(monkeypatch, NEWER, actor=admin, target_id=8)

    response = client.get(
        audit_log_url(),
        {
            "actor": admin.id,
            "action": "role.assigned,role.revoked",
            "target_type": "user",
            "target_id": 7,
            "from": "2026-10-09T11:00:00+02:00",
            "to": "2026-10-09T09:00:00Z",
        },
    )

    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert ids(response) == [match.id]


def test_from_and_to_are_inclusive(make_user, monkeypatch):
    client, _ = admin_client(make_user)
    older = create_entry(monkeypatch, OLDER, target_id=1)
    newer = create_entry(monkeypatch, NEWER, target_id=2)

    response = client.get(
        audit_log_url(),
        {"from": "2026-10-09T08:00:00Z", "to": "2026-10-09T08:00:00Z"},
    )

    assert response.status_code == 200
    assert ids(response) == [older.id]
    assert newer.id not in ids(response)


def test_pagination_keeps_the_filter(make_user, monkeypatch):
    client, _ = admin_client(make_user)
    create_entry(monkeypatch, OLDER, target_id=1)
    create_entry(monkeypatch, NEWER, target_id=1)
    create_entry(monkeypatch, NEWER, target_id=2)
    url = audit_log_url()

    response = client.get(url, {"target_id": 1, "page_size": 1})

    assert response.status_code == 200
    assert response.json()["count"] == 2
    assert response.json()["next"] == f"http://testserver{url}?page=2&page_size=1&target_id=1"


@pytest.mark.parametrize(
    "params,field,message",
    [
        ({"actor": "nope"}, "actor", "A valid integer is required."),
        ({"actor": 0}, "actor", "Ensure this value is greater than or equal to 1."),
        ({"action": "role.assigned,nope"}, "action", '"nope" is not a valid choice.'),
        ({"target_type": "missing"}, "target_type", '"missing" is not a valid choice.'),
        ({"target_id": "x"}, "target_id", "A valid integer is required."),
        (
            {"from": "2026-10-09T08:00:00"},
            "from",
            "Datetime must include a timezone (Z or an offset).",
        ),
        (
            {"to": "monday"},
            "to",
            "Datetime has wrong format. Use one of these formats instead: "
            "YYYY-MM-DDThh:mm[:ss[.uuuuuu]][+HH:MM|-HH:MM|Z].",
        ),
    ],
)
def test_filter_validation(make_user, params, field, message):
    client, _ = admin_client(make_user)
    response = client.get(audit_log_url(), params)
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {field: [message]},
        }
    }


def test_session_permissions_follow_role_changes_without_logging_in_again(
    make_user, make_session_client
):
    user = make_user("viewer@example.com")
    client = make_session_client(user)
    session_id = client.cookies["sessionid"].value

    response = client.get(audit_log_url())
    assert response.status_code == 403
    assert response.json() == DENIED

    admin_role = Role.objects.get(name=Role.Name.ADMIN)
    user.roles.add(admin_role)
    response = client.get(audit_log_url())
    assert response.status_code == 200
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}

    user.roles.remove(admin_role)
    response = client.get(audit_log_url())
    assert response.status_code == 403
    assert response.json() == DENIED
    assert client.cookies["sessionid"].value == session_id


def test_suspended_admin_session_is_not_authenticated(make_user, make_session_client):
    admin = make_user("admin@example.com", roles=(Role.Name.ADMIN,))
    client = make_session_client(admin)
    User.objects.filter(pk=admin.pk, status=User.Status.ACTIVE).update(status=User.Status.SUSPENDED)

    response = client.get(audit_log_url())

    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }
