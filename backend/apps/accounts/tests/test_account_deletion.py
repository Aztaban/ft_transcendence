"""Account anonymization, cleanup, rollback and in-flight writes."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from django.contrib.auth import authenticate
from django.contrib.sessions.models import Session
from django.db import close_old_connections
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role, User, UserRole
from apps.audit.models import AuditLog
from apps.council.models import SCMessage
from apps.evaluations.models import EvaluationRequest, TutorEligibility, TutorEligibilityRequest
from apps.notifications.models import Notification
from apps.notifications.services import create_notification

pytestmark = pytest.mark.django_db


def deletion_url(user_id):
    return reverse("api:admin-users-detail", kwargs={"user_id": user_id})


def delete_user(client, user_id, data=None, *, csrf=True):
    headers = {"HTTP_HOST": "localhost", "HTTP_ACCEPT_LANGUAGE": "en"}
    if csrf:
        headers["HTTP_X_CSRFTOKEN"] = client.cookies["csrftoken"].value
    return client.delete(
        deletion_url(user_id),
        {"reason": "Policy review"} if data is None else data,
        format="json",
        **headers,
    )


def database_snapshot():
    models = (
        User,
        UserRole,
        EvaluationRequest,
        TutorEligibility,
        TutorEligibilityRequest,
        TutorEligibilityRequest.projects.through,
        SCMessage,
        Notification,
        AuditLog,
        Session,
    )
    return [list(model.objects.order_by("pk").values()) for model in models]


@pytest.mark.parametrize("role", [None, "student", "tutor", "head_tutor", "sc_member"])
def test_deletion_is_admin_only(admin_user_directory, role):
    client, actor, target = admin_user_directory
    if role is None:
        response = APIClient().delete(deletion_url(target.pk), {"reason": "Review"}, format="json")
        assert response.status_code == 401
        assert response.json() == {
            "error": {"code": "not_authenticated", "message": "Authentication required."}
        }
    else:
        actor.roles.set(Role.objects.filter(name=role))
        response = delete_user(client, target.pk)
        assert response.status_code == 403
        assert response.json() == {
            "error": {
                "code": "permission_denied",
                "message": "You do not have permission to perform this action.",
            }
        }
    target.refresh_from_db()
    assert target.status == "active"


def test_deletion_requires_csrf(admin_user_directory):
    client, _, target = admin_user_directory
    response = delete_user(client, target.pk, csrf=False)
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "csrf_failed",
            "message": "CSRF verification failed. Reload the page and try again.",
        }
    }


@pytest.mark.parametrize(
    "data,message",
    [
        ({}, "This field is required."),
        ({"reason": " "}, "This field may not be blank."),
        ({"reason": None}, "This field may not be null."),
        ({"reason": []}, "Not a valid string."),
        ({"reason": "x" * 501}, "Ensure this field has no more than 500 characters."),
    ],
)
def test_deletion_validates_reason(admin_user_directory, data, message):
    client, _, target = admin_user_directory
    response = delete_user(client, target.pk, data)
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {"reason": [message]},
        }
    }
    target.refresh_from_db()
    assert target.status == "active"
    assert not AuditLog.objects.exists()


@pytest.mark.parametrize("target", ["self", "deleted", "missing"])
def test_invalid_deletion_targets(admin_user_directory, target):
    client, actor, user = admin_user_directory
    user_id = user.pk
    if target == "self":
        user_id = actor.pk
    elif target == "deleted":
        User.objects.filter(pk=user.pk).update(status="deleted")
    else:
        user_id = 999999
    before = database_snapshot()
    response = delete_user(client, user_id)
    if target == "missing":
        assert response.status_code == 404
        assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}
    else:
        assert response.status_code == 409
        assert response.json() == {
            "error": {
                "code": "cannot_modify_self" if target == "self" else "invalid_user_status",
                "message": (
                    "You cannot change your own account status."
                    if target == "self"
                    else "This action is not allowed in the user's current status."
                ),
            }
        }
    assert database_snapshot() == before


@pytest.mark.parametrize("reason", ["x", "x" * 500])
def test_reason_boundaries_and_minimal_account_deletion(
    admin_user_directory, user_event_sender, reason
):
    client, _, target = admin_user_directory
    response = delete_user(client, target.pk, {"reason": reason})
    assert response.status_code == 204
    assert response.content == b""
    target.refresh_from_db()
    assert target.status == "deleted"
    assert not target.has_usable_password()
    assert AuditLog.objects.get(action="user.deleted").reason == reason


@pytest.mark.parametrize("initial_status", ["active", "suspended"])
def test_deletion_anonymizes_and_cleans_every_existing_model(
    deletion_graph,
    admin_user_bodies,
    user_event_sender,
    django_capture_on_commit_callbacks,
    initial_status,
):
    graph = deletion_graph
    target = graph.target
    User.objects.filter(pk=target.pk).update(status=initial_status)
    before_users = User.objects.count()
    before_rows = {
        name: EvaluationRequest.objects.values().get(pk=row.pk)
        for name, row in graph.evaluations.items()
    }
    old_review = TutorEligibilityRequest.objects.values().get(pk=graph.reviewed.pk)
    old_audit = AuditLog.objects.values().get(pk=graph.audit.pk)
    old_message = SCMessage.objects.values().get(pk=graph.message.pk)
    target_keys = [browser.session.session_key for browser in graph.browsers]
    actor_key = graph.client.session.session_key
    peer_key = graph.peer_browser.session.session_key

    with django_capture_on_commit_callbacks(execute=True):
        response = delete_user(graph.client, target.pk, {"reason": "  Policy review  "})
        assert response.status_code == 204
        assert response.content == b""
        user_event_sender.assert_not_awaited()

    target.refresh_from_db()
    assert User.objects.count() == before_users
    assert target.status == "deleted"
    assert target.email == f"deleted-{target.pk}@deleted.invalid"
    assert target.display_name == "Deleted user"
    assert target.intra_id is None
    assert target.intra_login is None
    assert not target.has_usable_password()
    assert authenticate(email="alice@example.com", password="secret") is None
    assert target.is_active is False
    assert not target.roles.exists()
    assert not TutorEligibility.objects.filter(tutor=target).exists()
    assert not Notification.objects.filter(recipient=target).exists()
    assert not Session.objects.filter(session_key__in=target_keys).exists()
    assert set(Session.objects.values_list("session_key", flat=True)) == {actor_key, peer_key}
    graph.pending.refresh_from_db()
    assert graph.pending.status == "declined"
    assert graph.pending.reviewed_by_id == graph.actor.pk
    assert graph.pending.reviewed_at.isoformat() == "2026-10-31T10:00:00+00:00"
    assert TutorEligibilityRequest.objects.values().get(pk=graph.reviewed.pk) == old_review
    assert AuditLog.objects.values().get(pk=graph.audit.pk) == old_audit
    assert SCMessage.objects.values().get(pk=graph.message.pk) == {**old_message, "sender_id": None}

    cancelled = {"own_pending", "own_awaiting", "own_awaiting_started", "own_future"}
    released = {"pick_awaiting", "pick_future", "pick_admin_owned"}
    for label, row in graph.evaluations.items():
        after = EvaluationRequest.objects.values().get(pk=row.pk)
        if label in cancelled:
            assert after == {
                **before_rows[label],
                "status": "cancelled",
                "cancelled_by_id": graph.actor.pk,
                "cancelled_at": graph.pending.reviewed_at,
            }
        elif label in released:
            assert after == {
                **before_rows[label],
                "status": "pending",
                "picked_by_id": None,
                "starts_at": None,
                "ends_at": None,
            }
        else:
            assert after == before_rows[label]

    entry = AuditLog.objects.get(action="user.deleted")
    assert {
        "actor_id": entry.actor_id,
        "target_type": entry.target_type,
        "target_id": entry.target_id,
        "reason": entry.reason,
        "metadata": entry.metadata,
    } == {
        "actor_id": graph.actor.pk,
        "target_type": "user",
        "target_id": target.pk,
        "reason": "Policy review",
        "metadata": {},
    }
    deliveries = [args.args for args in user_event_sender.await_args_list]
    assert deliveries[0] == (f"user_{target.pk}", {"type": "session.ended", "data": {}})
    assert all(group != f"user_{target.pk}" for group, _ in deliveries[1:])
    workflow_ids = {
        message["data"]["id"]
        for _, message in deliveries
        if message.get("event") in ("evaluation.cancelled", "evaluation.released")
    }
    assert workflow_ids == {graph.evaluations[label].pk for label in cancelled | released}
    expected = admin_user_bodies["target"]
    expected.update(
        email=f"deleted-{target.pk}@deleted.invalid",
        display_name="Deleted user",
        intra_login=None,
        roles=[],
        status="deleted",
        language="cs",
        last_login="2026-10-31T10:00:00Z",
    )
    detail = graph.client.get(deletion_url(target.pk))
    assert detail.status_code == 200
    assert detail.json() == expected


def test_other_parties_receive_exact_override_notifications(deletion_graph, user_event_sender):
    graph = deletion_graph
    response = delete_user(graph.client, graph.target.pk)
    assert response.status_code == 204
    assert response.content == b""
    for label in ("own_awaiting", "own_future", "pick_awaiting", "pick_future"):
        evaluation = graph.evaluations[label]
        released = label.startswith("pick_")
        payload = {
            "request_id": evaluation.pk,
            "project": {
                "id": evaluation.project_id,
                "slug": "delete-" + label,
                "name": "Deletion " + label,
            },
        }
        payload.update(
            {"tutor": {"id": graph.target.pk, "display_name": "Deleted user"}}
            if released
            else {"cancelled_by": {"id": graph.actor.pk, "display_name": "Zed"}}
        )
        assert list(
            Notification.objects.filter(payload__request_id=evaluation.pk).values(
                "recipient_id", "type", "payload", "target_url"
            )
        ) == [
            {
                "recipient_id": graph.peer.pk,
                "type": "evaluation.released" if released else "evaluation.cancelled",
                "payload": payload,
                "target_url": f"/evaluations/{evaluation.pk}",
            }
        ]
    assert not Notification.objects.filter(
        payload__request_id=graph.evaluations["pick_admin_owned"].pk
    ).exists()
    assert not Notification.objects.filter(
        payload__request_id=graph.evaluations["own_pending"].pk
    ).exists()


@pytest.mark.parametrize(
    "operation",
    ["end_user_sessions", "cancel_request", "release_deleted_user_slot", "record_audit"],
)
def test_cleanup_failure_rolls_back_all_models_and_events(
    deletion_graph, user_event_sender, monkeypatch, django_capture_on_commit_callbacks, operation
):
    from apps.accounts.services import deletion

    graph = deletion_graph
    before = database_snapshot()
    original = getattr(deletion, operation)

    def fail_after_write(*args, **kwargs):
        original(*args, **kwargs)
        raise RuntimeError("Injected deletion failure")

    monkeypatch.setattr(deletion, operation, fail_after_write)
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = delete_user(graph.client, graph.target.pk)
    assert response.status_code == 500
    assert response.json() == {
        "error": {"code": "server_error", "message": "Something went wrong. Please try again."}
    }
    assert database_snapshot() == before
    assert callbacks == []
    user_event_sender.assert_not_awaited()


@pytest.mark.parametrize("workflow", ["profile", "evaluation", "council"])
def test_stale_authenticated_writes_cannot_restore_deleted_data(
    admin_user_directory, user_event_sender, workflow
):
    client, _, target = admin_user_directory
    project = None
    if workflow == "evaluation":
        from apps.evaluations.models import Project

        project = Project.objects.create(slug="late-evaluation", name="Late evaluation")
    assert delete_user(client, target.pk).status_code == 204
    stale = APIClient()
    stale.force_authenticate(target)
    if workflow == "profile":
        response = stale.patch(reverse("api:me"), {"display_name": "Restored name"}, format="json")
    elif workflow == "evaluation":
        response = stale.post(
            reverse("api:evaluation-request-list"), {"project_id": project.pk}, format="json"
        )
    else:
        response = stale.post(
            reverse("api:sc-message-list"), {"body": "Late message"}, format="json"
        )
    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }
    target.refresh_from_db()
    assert target.status == "deleted"
    assert target.display_name == "Deleted user"
    assert not EvaluationRequest.objects.filter(student=target).exists()
    assert not SCMessage.objects.filter(sender=target).exists()


def test_late_notifications_for_deleted_accounts_are_not_created(
    admin_user_directory, user_event_sender, django_capture_on_commit_callbacks
):
    client, _, target = admin_user_directory
    assert delete_user(client, target.pk).status_code == 204
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        notification = create_notification(
            recipient_id=target.pk,
            notification_type="role.changed",
            payload={"role": "tutor", "action": "assigned"},
            target_url="/profile",
        )
    assert notification is None
    assert not Notification.objects.filter(recipient=target).exists()
    assert callbacks == []


@pytest.mark.django_db(transaction=True)
def test_competing_deletions_have_one_winner(deletion_graph, user_event_sender):
    graph = deletion_graph
    ready = Barrier(2)

    def submit():
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(graph.actor)
            ready.wait(timeout=10)
            response = client.delete(
                deletion_url(graph.target.pk), {"reason": "Review"}, format="json"
            )
            return (
                response.status_code,
                response.content,
                response.json() if response.content else None,
            )
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        requests = [pool.submit(submit) for _ in range(2)]
        responses = sorted(request.result(timeout=30) for request in requests)
    assert responses[0] == (204, b"", None)
    assert responses[1][0] == 409
    assert responses[1][2] == {
        "error": {
            "code": "invalid_user_status",
            "message": "This action is not allowed in the user's current status.",
        }
    }
    assert AuditLog.objects.filter(action="user.deleted").count() == 1
    assert not Notification.objects.filter(recipient=graph.target).exists()


@pytest.mark.django_db(transaction=True)
def test_profile_write_and_deletion_leave_an_anonymized_account(deletion_graph, user_event_sender):
    graph = deletion_graph
    ready = Barrier(2)

    def submit(deleting):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(graph.actor if deleting else graph.target)
            ready.wait(timeout=10)
            if deleting:
                return client.delete(
                    deletion_url(graph.target.pk), {"reason": "Review"}, format="json"
                ).status_code
            return client.patch(
                reverse("api:me"), {"display_name": "Late edit"}, format="json"
            ).status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        deleting = pool.submit(submit, True)
        updating = pool.submit(submit, False)
        assert deleting.result(timeout=30) == 204
        assert updating.result(timeout=30) in (204, 401)
    graph.target.refresh_from_db()
    assert graph.target.status == "deleted"
    assert graph.target.display_name == "Deleted user"
    assert not graph.target.roles.exists()


@pytest.mark.django_db(transaction=True)
def test_review_and_deletion_cannot_leave_new_eligibility(deletion_graph, user_event_sender):
    graph = deletion_graph
    ready = Barrier(2)

    def submit(deleting):
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(graph.actor)
            ready.wait(timeout=10)
            if deleting:
                return client.delete(
                    deletion_url(graph.target.pk), {"reason": "Review"}, format="json"
                ).status_code
            return client.post(
                reverse(
                    "api:tutor-eligibility-requests-review", kwargs={"request_id": graph.pending.pk}
                ),
                {"decision": "approved"},
                format="json",
            ).status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        deleting = pool.submit(submit, True)
        reviewing = pool.submit(submit, False)
        assert deleting.result(timeout=30) == 204
        assert reviewing.result(timeout=30) in (200, 409)
    assert not TutorEligibility.objects.filter(tutor=graph.target).exists()
    assert not Notification.objects.filter(recipient=graph.target).exists()
    graph.pending.refresh_from_db()
    assert graph.pending.status in ("approved", "declined")
