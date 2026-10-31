"""Suspension/reactivation permissions, atomic state changes and session invalidation."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier

import pytest
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.sessions.models import Session
from django.db import close_old_connections
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role, User, UserRole
from apps.audit.models import AuditLog
from apps.evaluations.models import (
    EvaluationRequest,
    Project,
    TutorEligibility,
    TutorEligibilityRequest,
)
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db
ACTIONS = ["suspend", "reactivate"]


def status_url(user_id, action):
    return reverse(f"api:admin-users-{action}", kwargs={"user_id": user_id})


def post_status(client, user_id, action, data=None, *, csrf=True, language="en"):
    headers = {"HTTP_HOST": "localhost", "HTTP_ACCEPT_LANGUAGE": language}
    if csrf:
        headers["HTTP_X_CSRFTOKEN"] = client.cookies["csrftoken"].value
    return client.post(
        status_url(user_id, action),
        {"reason": "Policy review"} if data is None else data,
        format="json",
        **headers,
    )


@pytest.mark.parametrize("action", ACTIONS)
@pytest.mark.parametrize("role", [None, "student", "tutor", "head_tutor", "sc_member"])
def test_status_actions_require_an_admin(admin_user_directory, action, role):
    client, admin, target = admin_user_directory
    if role is None:
        response = APIClient().post(status_url(target.pk, action), {"reason": "Review"})
        assert response.status_code == 401
        assert response.json() == {
            "error": {"code": "not_authenticated", "message": "Authentication required."}
        }
    else:
        admin.roles.set(Role.objects.filter(name=role))
        response = post_status(client, target.pk, action)
        assert response.status_code == 403
        assert response.json() == {
            "error": {
                "code": "permission_denied",
                "message": "You do not have permission to perform this action.",
            }
        }
    assert not AuditLog.objects.exists()


@pytest.mark.parametrize("action", ACTIONS)
def test_status_actions_require_csrf(admin_user_directory, action):
    client, _, target = admin_user_directory
    response = post_status(client, target.pk, action, csrf=False)
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "csrf_failed",
            "message": "CSRF verification failed. Reload the page and try again.",
        }
    }
    assert not AuditLog.objects.exists()


@pytest.mark.parametrize("action", ACTIONS)
@pytest.mark.parametrize(
    "reason,stored_reason", [("  Review  ", "Review"), ("x", "x"), ("x" * 500, "x" * 500)]
)
def test_status_change_returns_exact_admin_user_and_audit(
    admin_user_directory,
    admin_user_bodies,
    user_event_sender,
    django_capture_on_commit_callbacks,
    action,
    reason,
    stored_reason,
):
    client, admin, target = admin_user_directory
    initial, final = ("active", "suspended") if action == "suspend" else ("suspended", "active")
    User.objects.filter(pk=target.pk).update(status=initial)
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = post_status(client, target.pk, action, {"reason": reason})
        user_event_sender.assert_not_awaited()
        assert response.status_code == 200
        expected = admin_user_bodies["target"]
        expected["status"] = final
        assert response.json() == expected
    assert list(
        AuditLog.objects.values(
            "actor_id", "action", "target_type", "target_id", "reason", "metadata"
        )
    ) == [
        {
            "actor_id": admin.pk,
            "action": "user.suspended" if action == "suspend" else "user.reactivated",
            "target_type": "user",
            "target_id": target.pk,
            "reason": stored_reason,
            "metadata": {},
        }
    ]
    assert not Notification.objects.exists()
    if action == "suspend":
        assert len(callbacks) == 1
        user_event_sender.assert_awaited_once_with(
            f"user_{target.pk}", {"type": "session.ended", "data": {}}
        )
    else:
        assert callbacks == []
        user_event_sender.assert_not_awaited()


@pytest.mark.parametrize("action", ACTIONS)
@pytest.mark.parametrize(
    "data,message",
    [
        ({}, "This field is required."),
        ({"reason": ""}, "This field may not be blank."),
        ({"reason": "   "}, "This field may not be blank."),
        ({"reason": None}, "This field may not be null."),
        ({"reason": "x" * 501}, "Ensure this field has no more than 500 characters."),
        ({"reason": []}, "Not a valid string."),
    ],
)
def test_invalid_reason_changes_nothing(admin_user_directory, action, data, message):
    client, _, target = admin_user_directory
    initial = "active" if action == "suspend" else "suspended"
    User.objects.filter(pk=target.pk).update(status=initial)
    response = post_status(client, target.pk, action, data)
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {"reason": [message]},
        }
    }
    target.refresh_from_db()
    assert target.status == initial
    assert not AuditLog.objects.exists()


@pytest.mark.parametrize(
    "action,initial",
    [
        ("suspend", "suspended"),
        ("suspend", "deleted"),
        ("reactivate", "active"),
        ("reactivate", "deleted"),
    ],
)
@pytest.mark.parametrize(
    "language,message",
    [
        ("en", "This action is not allowed in the user's current status."),
        ("cs", "Tato akce není v aktuálním stavu uživatele povolena."),
        ("es", "Esta acción no está permitida en el estado actual del usuario."),
    ],
)
def test_invalid_state_is_a_409_without_side_effects(
    admin_user_directory,
    user_event_sender,
    django_capture_on_commit_callbacks,
    action,
    initial,
    language,
    message,
):
    client, _, target = admin_user_directory
    User.objects.filter(pk=target.pk).update(status=initial)
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = post_status(client, target.pk, action, language=language)
    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "invalid_user_status",
            "message": message,
        }
    }
    target.refresh_from_db()
    assert target.status == initial
    assert not AuditLog.objects.exists()
    assert not Notification.objects.exists()
    assert callbacks == []
    user_event_sender.assert_not_awaited()


@pytest.mark.parametrize("action", ACTIONS)
@pytest.mark.parametrize(
    "language,message",
    [
        ("en", "You cannot change your own account status."),
        ("cs", "Nemůžete změnit stav svého vlastního účtu."),
        ("es", "No puedes cambiar el estado de tu propia cuenta."),
    ],
)
def test_admin_cannot_change_own_status(admin_user_directory, action, language, message):
    client, admin, _ = admin_user_directory
    response = post_status(client, admin.pk, action, language=language)
    assert response.status_code == 409
    assert response.json() == {"error": {"code": "cannot_modify_self", "message": message}}
    admin.refresh_from_db()
    assert admin.status == "active"
    assert not AuditLog.objects.exists()


@pytest.mark.parametrize("action", ACTIONS)
def test_unknown_account_is_a_404(admin_user_directory, action):
    client, _, _ = admin_user_directory
    response = post_status(client, 999999, action)
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}


def test_suspension_removes_all_target_sessions_and_reactivation_does_not_restore_them(
    admin_user_directory,
    admin_user_bodies,
    make_user,
    make_session_client,
    user_event_sender,
    django_capture_on_commit_callbacks,
):
    client, admin, target = admin_user_directory
    browsers = [make_session_client(target) for _ in range(3)]
    keys = [browser.session.session_key for browser in browsers]
    now = datetime(2026, 10, 31, 10, tzinfo=timezone.utc)
    Session.objects.filter(session_key=keys[-1]).update(expire_date=now - timedelta(days=1))
    other = make_user("other@example.com", language="en")
    other_browser = make_session_client(other)
    other_key = other_browser.session.session_key
    anonymous = SessionStore()
    anonymous["anonymous"] = True
    anonymous.save()
    admin_key = client.session.session_key

    with django_capture_on_commit_callbacks(execute=True):
        response = post_status(client, target.pk, "suspend")
        assert response.status_code == 200
        expected = admin_user_bodies["target"]
        expected.update(status="suspended", last_login="2026-10-31T10:00:00Z")
        assert response.json() == expected
        assert not Session.objects.filter(session_key__in=keys).exists()
        user_event_sender.assert_not_awaited()
    user_event_sender.assert_awaited_once_with(
        f"user_{target.pk}", {"type": "session.ended", "data": {}}
    )
    assert set(Session.objects.values_list("session_key", flat=True)) == {
        admin_key,
        other_key,
        anonymous.session_key,
    }
    assert not APIClient().login(email=target.email, password="secret")
    response = post_status(client, target.pk, "reactivate")
    assert response.status_code == 200
    expected["status"] = "active"
    assert response.json() == expected
    for browser in browsers:
        expired = browser.get(reverse("api:me"))
        assert expired.status_code == 401
        assert expired.json() == {
            "error": {"code": "not_authenticated", "message": "Authentication required."}
        }
    assert APIClient().login(email=target.email, password="secret")
    assert Session.objects.filter(session_key=other_key).exists()
    assert Session.objects.filter(session_key=admin_key).exists()


@pytest.mark.parametrize("action", ACTIONS)
def test_status_change_preserves_evaluations_picks_roles_and_eligibility(
    admin_user_directory, admin_user_bodies, make_user, action
):
    client, _, target = admin_user_directory
    tutor = Role.objects.get(name="tutor")
    target.roles.add(tutor)
    peer = make_user("peer@example.com", roles=("student", "tutor"))
    project = Project.objects.create(slug="account_status", name="Account status project")
    TutorEligibility.objects.create(tutor=target, project=project)
    eligibility = TutorEligibilityRequest.objects.create(requester=target)
    eligibility.projects.add(project)
    EvaluationRequest.objects.create(student=target, project=project)
    start = datetime(2026, 11, 1, 10, tzinfo=timezone.utc)
    for state in ("awaiting_confirmation", "confirmed"):
        for student, picker in ((target, peer), (peer, target)):
            EvaluationRequest.objects.create(
                student=student,
                picked_by=picker,
                project=project,
                status=state,
                starts_at=start,
                ends_at=start + timedelta(hours=1),
            )
    models = (
        EvaluationRequest,
        UserRole,
        TutorEligibility,
        TutorEligibilityRequest,
        TutorEligibilityRequest.projects.through,
        Notification,
    )
    before = [list(model.objects.order_by("pk").values()) for model in models]
    User.objects.filter(pk=target.pk).update(
        status="active" if action == "suspend" else "suspended"
    )

    response = post_status(client, target.pk, action)

    assert response.status_code == 200
    expected = admin_user_bodies["target"]
    expected["status"] = "suspended" if action == "suspend" else "active"
    expected["roles"].append({"id": tutor.pk, "name": "tutor"})
    assert response.json() == expected
    assert [list(model.objects.order_by("pk").values()) for model in models] == before


@pytest.mark.parametrize(
    "action,service",
    [
        ("suspend", "record_audit"),
        ("suspend", "end_user_sessions"),
        ("reactivate", "record_audit"),
    ],
)
def test_failure_rolls_back_status_audit_sessions_and_events(
    admin_user_directory,
    make_session_client,
    monkeypatch,
    user_event_sender,
    django_capture_on_commit_callbacks,
    action,
    service,
):
    from apps.accounts.views import admin_users

    client, _, target = admin_user_directory
    browser = make_session_client(target)
    key = browser.session.session_key
    User.objects.filter(pk=target.pk).update(
        status="active" if action == "suspend" else "suspended"
    )
    before = User.objects.values().get(pk=target.pk)
    original = getattr(admin_users, service)

    def fail_after_write(*args, **kwargs):
        original(*args, **kwargs)
        raise RuntimeError("Injected status change failure")

    monkeypatch.setattr(admin_users, service, fail_after_write)
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = post_status(client, target.pk, action)
    assert response.status_code == 500
    assert response.json() == {
        "error": {"code": "server_error", "message": "Something went wrong. Please try again."}
    }
    assert User.objects.values().get(pk=target.pk) == before
    assert Session.objects.filter(session_key=key).exists()
    assert not AuditLog.objects.exists()
    assert not Notification.objects.exists()
    assert callbacks == []
    user_event_sender.assert_not_awaited()


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("action", ACTIONS)
def test_concurrent_status_changes_have_one_winner(make_user, user_event_sender, action):
    for name in ("student", "admin"):
        Role.objects.get_or_create(name=name)
    admin = make_user("admin@example.com", roles=("admin",))
    target = make_user(
        "target@example.com", status="active" if action == "suspend" else "suspended"
    )
    ready = Barrier(2)

    def change():
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(admin)
            ready.wait(timeout=10)
            response = client.post(
                status_url(target.pk, action), {"reason": "Review"}, format="json"
            )
            return response.status_code, response.json()
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        requests = [pool.submit(change) for _ in range(2)]
        outcomes = sorted(
            (request.result(timeout=20) for request in requests), key=lambda result: result[0]
        )
    assert [status for status, _ in outcomes] == [200, 409]
    assert outcomes[1][1] == {
        "error": {
            "code": "invalid_user_status",
            "message": "This action is not allowed in the user's current status.",
        }
    }
    target.refresh_from_db()
    assert target.status == ("suspended" if action == "suspend" else "active")
    assert AuditLog.objects.count() == 1
    if action == "suspend":
        user_event_sender.assert_awaited_once_with(
            f"user_{target.pk}", {"type": "session.ended", "data": {}}
        )
    else:
        user_event_sender.assert_not_awaited()
