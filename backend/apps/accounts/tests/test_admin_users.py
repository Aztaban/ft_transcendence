"""Admin user API contract, permissions and transactional side effects."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from unittest.mock import call

import pytest
from django.db import close_old_connections
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role, User
from apps.audit.models import AuditLog
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db

ENDPOINTS = [
    ("get", "admin-users-list"),
    ("get", "admin-users-detail"),
    ("patch", "admin-users-detail"),
]


def user_url(target_id):
    return reverse("api:admin-users-detail", kwargs={"user_id": target_id})


def patch_user(client, target_id, data, *, csrf=True, language="en"):
    headers = {"HTTP_HOST": "localhost", "HTTP_ACCEPT_LANGUAGE": language}
    if csrf:
        headers["HTTP_X_CSRFTOKEN"] = client.cookies["csrftoken"].value
    return client.patch(user_url(target_id), data, format="json", **headers)


@pytest.mark.parametrize("method,route", ENDPOINTS)
@pytest.mark.parametrize("role", [None, "student", "tutor", "head_tutor", "sc_member"])
def test_admin_endpoints_enforce_permissions(admin_user_directory, method, route, role):
    client, admin, target = admin_user_directory
    if role is None:
        client = APIClient()
    else:
        admin.roles.set(Role.objects.filter(name=role))
    url = reverse("api:" + route, kwargs={"user_id": target.pk} if "detail" in route else {})

    response = (
        patch_user(client, target.pk, {})
        if method == "patch" and role is not None
        else getattr(client, method)(url)
    )

    if role is None:
        assert response.status_code == 401
        assert response.json() == {
            "error": {"code": "not_authenticated", "message": "Authentication required."}
        }
    else:
        assert response.status_code == 403
        assert response.json() == {
            "error": {
                "code": "permission_denied",
                "message": "You do not have permission to perform this action.",
            }
        }
    assert not AuditLog.objects.exists()
    assert not Notification.objects.exists()


@pytest.mark.parametrize("view", ["list", "detail"])
@pytest.mark.parametrize("target_status", ["active", "suspended", "deleted"])
def test_admin_user_representation_is_exact(admin_user_directory, view, target_status):
    client, _, target = admin_user_directory
    User.objects.filter(pk=target.pk).update(status=target_status)
    if target_status == "deleted":
        target.roles.clear()
    student = Role.objects.get(name="student")

    if view == "list":
        response = client.get(reverse("api:admin-users-list"), {"q": "alice"})
    else:
        response = client.get(user_url(target.pk))

    assert response.status_code == 200
    expected = {
        "id": target.pk,
        "email": "alice@example.com",
        "display_name": "Alice",
        "avatar_url": None,
        "language": "en",
        "intra_login": "alice42",
        "roles": [] if target_status == "deleted" else [{"id": student.pk, "name": "student"}],
        "status": target_status,
        "created_at": "2026-10-31T10:00:00Z",
        "last_login": None,
    }
    assert response.json() == (
        {"count": 1, "next": None, "previous": None, "results": [expected]}
        if view == "list"
        else expected
    )


@pytest.mark.parametrize("method", ["get", "patch"])
def test_unknown_admin_target_returns_404(admin_user_directory, method):
    client, _, _ = admin_user_directory
    response = (
        client.get(user_url(999999))
        if method == "get"
        else patch_user(client, 999999, {"display_name": "Changed"})
    )
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}


@pytest.mark.parametrize("query", ["ALICE@EXAMPLE", "LIC", "ICE42"])
def test_search_matches_email_display_name_and_42_login(
    admin_user_directory, admin_user_bodies, query
):
    client, _, _ = admin_user_directory
    response = client.get(reverse("api:admin-users-list"), {"q": query})
    assert response.status_code == 200
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [admin_user_bodies["target"]],
    }


def test_empty_search_returns_the_pagination_envelope(admin_user_directory):
    client, _, _ = admin_user_directory
    response = client.get(reverse("api:admin-users-list"), {"q": "not-present"})
    assert response.status_code == 200
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}


def test_role_and_status_filters_combine_without_duplicates(
    admin_user_directory, admin_user_bodies, make_user
):
    client, _, target = admin_user_directory
    target.roles.add(*Role.objects.filter(name__in=["tutor", "sc_member"]))
    User.objects.filter(pk=target.pk).update(status="suspended")
    make_user("other@example.com", roles=("tutor",))

    response = client.get(
        reverse("api:admin-users-list"),
        {
            "role": "tutor,sc_member",
            "status": "suspended,deleted",
            "q": "alice",
        },
    )

    assert response.status_code == 200
    roles = {role.name: role.pk for role in Role.objects.all()}
    expected = admin_user_bodies["target"]
    expected["status"] = "suspended"
    expected["roles"] = [
        {"id": roles["sc_member"], "name": "sc_member"},
        {"id": roles["student"], "name": "student"},
        {"id": roles["tutor"], "name": "tutor"},
    ]
    assert response.json() == {"count": 1, "next": None, "previous": None, "results": [expected]}


@pytest.mark.parametrize("field", ["display_name", "email", "created_at", "last_login"])
@pytest.mark.parametrize("descending", [False, True])
def test_all_documented_orderings(admin_user_directory, admin_user_bodies, field, descending):
    client, admin, target = admin_user_directory
    now = datetime(2026, 10, 31, 10, 0, tzinfo=timezone.utc)
    User.objects.filter(pk=target.pk).update(
        email="a@example.com",
        created_at=now - timedelta(days=1),
        last_login=now - timedelta(days=1),
    )
    User.objects.filter(pk=admin.pk).update(email="z@example.com")
    response = client.get(
        reverse("api:admin-users-list"),
        {
            "ordering": ("-" if descending else "") + field,
        },
    )
    assert response.status_code == 200
    target_body = admin_user_bodies["target"]
    target_body.update(
        email="a@example.com", created_at="2026-10-30T10:00:00Z", last_login="2026-10-30T10:00:00Z"
    )
    admin_body = admin_user_bodies["admin"]
    admin_body["email"] = "z@example.com"
    assert response.json() == {
        "count": 2,
        "next": None,
        "previous": None,
        "results": [admin_body, target_body] if descending else [target_body, admin_body],
    }


def test_pagination_and_default_ordering(admin_user_directory, admin_user_bodies):
    client, _, _ = admin_user_directory
    url = reverse("api:admin-users-list")
    response = client.get(url, {"page_size": 1})
    assert response.status_code == 200
    assert response.json() == {
        "count": 2,
        "previous": None,
        "next": f"http://testserver{url}?page=2&page_size=1",
        "results": [admin_user_bodies["target"]],
    }
    second = client.get(url, {"page": 2, "page_size": 1})
    assert second.status_code == 200
    assert second.json() == {
        "count": 2,
        "previous": f"http://testserver{url}?page_size=1",
        "next": None,
        "results": [admin_user_bodies["admin"]],
    }


@pytest.mark.parametrize(
    "params,field,message",
    [
        ({"role": "tutor,unknown"}, "role", '"unknown" is not a valid choice.'),
        ({"status": "pending"}, "status", '"pending" is not a valid choice.'),
        ({"ordering": "status"}, "ordering", '"status" is not a valid choice.'),
        ({"role": ""}, "role", "This field may not be blank."),
        ({"status": ""}, "status", "This field may not be blank."),
    ],
)
def test_invalid_filters_return_field_errors(admin_user_directory, params, field, message):
    client, _, _ = admin_user_directory
    response = client.get(reverse("api:admin-users-list"), params)
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {field: [message]},
        }
    }


@pytest.mark.parametrize("target_status", ["active", "suspended"])
def test_edit_returns_admin_user_and_commits_exact_facts(
    admin_user_directory, user_event_sender, django_capture_on_commit_callbacks, target_status
):
    client, admin, target = admin_user_directory
    User.objects.filter(pk=target.pk).update(status=target_status)
    student = Role.objects.get(name="student")
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = patch_user(
            client,
            target.pk,
            {
                "display_name": "  Alicia  ",
                "email": "  ALICIA@EXAMPLE.COM  ",
                "language": "cs",
            },
        )
        user_event_sender.assert_not_awaited()
        assert response.status_code == 200
        assert response.json() == {
            "id": target.pk,
            "email": "alicia@example.com",
            "display_name": "Alicia",
            "avatar_url": None,
            "language": "cs",
            "intra_login": "alice42",
            "roles": [{"id": student.pk, "name": "student"}],
            "status": target_status,
            "created_at": "2026-10-31T10:00:00Z",
            "last_login": None,
        }
    assert list(
        AuditLog.objects.values(
            "actor_id", "action", "target_type", "target_id", "reason", "metadata"
        )
    ) == [
        {
            "actor_id": admin.pk,
            "action": "user.updated",
            "target_type": "user",
            "target_id": target.pk,
            "reason": "",
            "metadata": {
                "old": {"display_name": "Alice", "email": "alice@example.com", "language": "en"},
                "new": {"display_name": "Alicia", "email": "alicia@example.com", "language": "cs"},
            },
        }
    ]
    notification = Notification.objects.get()
    assert {
        "recipient_id": notification.recipient_id,
        "type": notification.type,
        "payload": notification.payload,
        "target_url": notification.target_url,
        "read_at": notification.read_at,
    } == {
        "recipient_id": target.pk,
        "type": "account.updated",
        "payload": {"fields": ["display_name", "email", "language"]},
        "target_url": "/profile",
        "read_at": None,
    }
    assert len(callbacks) == 1
    assert user_event_sender.await_args_list == [
        call(
            f"user_{target.pk}",
            {
                "type": "user.event",
                "event": "notification.created",
                "data": {"id": notification.pk},
            },
        )
    ]


def test_patch_requires_csrf(admin_user_directory):
    client, _, target = admin_user_directory
    response = patch_user(client, target.pk, {"display_name": "Changed"}, csrf=False)
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "csrf_failed",
            "message": "CSRF verification failed. Reload the page and try again.",
        }
    }
    target.refresh_from_db()
    assert target.display_name == "Alice"


@pytest.mark.parametrize(
    "data,field,message",
    [
        ({"display_name": "  "}, "display_name", "This field may not be blank."),
        (
            {"display_name": "x" * 65},
            "display_name",
            "Ensure this field has no more than 64 characters.",
        ),
        ({"display_name": None}, "display_name", "This field may not be null."),
        ({"email": "bad"}, "email", "Enter a valid email address."),
        ({"email": ""}, "email", "This field may not be blank."),
        ({"email": None}, "email", "This field may not be null."),
        (
            {"email": "a" * 64 + "@" + "b" * 63 + "." + "c" * 63 + "." + "d" * 58 + ".com"},
            "email",
            "Ensure this field has no more than 254 characters.",
        ),
        ({"language": "cz"}, "language", '"cz" is not a valid choice.'),
        ({"language": None}, "language", "This field may not be null."),
        ({"language": ""}, "language", '"" is not a valid choice.'),
    ],
)
def test_invalid_edits_have_no_side_effects(admin_user_directory, data, field, message):
    client, _, target = admin_user_directory
    response = patch_user(client, target.pk, data)
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {field: [message]},
        }
    }
    target.refresh_from_db()
    assert target.display_name == "Alice"
    assert target.email == "alice@example.com"
    assert target.language == "en"
    assert not AuditLog.objects.exists()
    assert not Notification.objects.exists()


@pytest.mark.parametrize("race", [False, True])
def test_duplicate_email_is_a_409_including_database_race(admin_user_directory, monkeypatch, race):
    client, _, target = admin_user_directory
    if race:
        monkeypatch.setattr(
            "apps.accounts.serializers.admin_users.AdminUserUpdateSerializer.validate_email",
            lambda self, value: value,
        )
    response = patch_user(
        client,
        target.pk,
        {
            "email": "admin@example.com",
            "display_name": "Changed",
        },
    )
    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "email_already_exists",
            "message": "An account with this email already exists.",
        }
    }
    target.refresh_from_db()
    assert target.email == "alice@example.com"
    assert target.display_name == "Alice"
    assert not AuditLog.objects.exists()
    assert not Notification.objects.exists()


@pytest.mark.parametrize(
    "language,message",
    [
        ("en", "Deleted accounts cannot be edited."),
        ("cs", "Smazané účty nelze upravovat."),
        ("es", "Las cuentas eliminadas no se pueden editar."),
    ],
)
def test_deleted_user_cannot_be_edited(admin_user_directory, language, message):
    client, _, target = admin_user_directory
    User.objects.filter(pk=target.pk).update(status="deleted")
    response = patch_user(client, target.pk, {"display_name": "Changed"}, language=language)
    assert response.status_code == 409
    assert response.json() == {"error": {"code": "invalid_user_status", "message": message}}
    target.refresh_from_db()
    assert target.display_name == "Alice"
    assert not AuditLog.objects.exists()
    assert not Notification.objects.exists()


@pytest.mark.parametrize(
    "data",
    [
        {},
        {"email": " ALICE@EXAMPLE.COM ", "display_name": " Alice ", "language": "en"},
        {
            "status": "deleted",
            "roles": [],
            "is_staff": True,
            "password": "changed",
            "intra_login": "changed",
            "avatar_url": "/ignored",
            "unknown": "ignored",
        },
    ],
)
def test_no_op_and_unwritable_fields_produce_no_side_effects(
    admin_user_directory, admin_user_bodies, data
):
    client, _, target = admin_user_directory
    before = User.objects.values().get(pk=target.pk)
    response = patch_user(client, target.pk, data)
    assert response.status_code == 200
    assert response.json() == admin_user_bodies["target"]
    assert User.objects.values().get(pk=target.pk) == before
    assert not AuditLog.objects.exists()
    assert not Notification.objects.exists()


def test_self_edit_is_audited_without_a_notification(admin_user_directory, admin_user_bodies):
    client, admin, _ = admin_user_directory
    response = patch_user(client, admin.pk, {"display_name": "New Admin"})
    assert response.status_code == 200
    expected = admin_user_bodies["admin"]
    expected["display_name"] = "New Admin"
    assert response.json() == expected
    entry = AuditLog.objects.get()
    assert entry.metadata == {"old": {"display_name": "Zed"}, "new": {"display_name": "New Admin"}}
    assert not Notification.objects.exists()


@pytest.mark.parametrize("service", ["record_audit", "create_notification"])
def test_side_effect_failure_rolls_back_everything(
    admin_user_directory,
    monkeypatch,
    django_capture_on_commit_callbacks,
    user_event_sender,
    service,
):
    from apps.accounts.views import admin_users

    client, _, target = admin_user_directory
    original = getattr(admin_users, service)

    def fail_after_insert(**kwargs):
        original(**kwargs)
        raise RuntimeError("Injected failure")

    monkeypatch.setattr(admin_users, service, fail_after_insert)
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = patch_user(client, target.pk, {"display_name": "Changed"})
    assert response.status_code == 500
    assert response.json() == {
        "error": {"code": "server_error", "message": "Something went wrong. Please try again."}
    }
    target.refresh_from_db()
    assert target.display_name == "Alice"
    assert not AuditLog.objects.exists()
    assert not Notification.objects.exists()
    assert callbacks == []
    user_event_sender.assert_not_awaited()


@pytest.mark.django_db(transaction=True)
def test_admins_can_edit_each_other_concurrently(make_user, user_event_sender):
    # Transactional tests can run after the seed data has been flushed.
    for name in ("student", "admin"):
        Role.objects.get_or_create(name=name)
    first = make_user("first@example.com", display_name="First", roles=("admin",))
    second = make_user("second@example.com", display_name="Second", roles=("admin",))
    ready = Barrier(2)

    def edit(actor, target, name):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(actor)
            ready.wait(timeout=10)
            response = client.patch(user_url(target.pk), {"display_name": name}, format="json")
            return response.status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        requests = [
            pool.submit(edit, first, second, "New Second"),
            pool.submit(edit, second, first, "New First"),
        ]
        assert [request.result(timeout=20) for request in requests] == [200, 200]
    first.refresh_from_db()
    second.refresh_from_db()
    assert first.display_name == "New First"
    assert second.display_name == "New Second"
    assert list(
        AuditLog.objects.order_by("target_id").values("actor_id", "target_id", "metadata")
    ) == [
        {
            "actor_id": second.pk,
            "target_id": first.pk,
            "metadata": {"old": {"display_name": "First"}, "new": {"display_name": "New First"}},
        },
        {
            "actor_id": first.pk,
            "target_id": second.pk,
            "metadata": {"old": {"display_name": "Second"}, "new": {"display_name": "New Second"}},
        },
    ]
    assert Notification.objects.count() == 2
