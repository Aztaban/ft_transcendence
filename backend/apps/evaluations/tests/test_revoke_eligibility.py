"""DELETE /api/v1/projects/{slug}/eligibility/{tutor_id}/ (api-plan §10.3)."""

import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Barrier
from types import SimpleNamespace
from unittest.mock import AsyncMock, call

import pytest
from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection, connections, transaction
from django.db.models.query import QuerySet
from django.db.utils import OperationalError
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.audit.models import AuditLog
from apps.evaluations.models import EvaluationRequest, Project, TutorEligibility
from apps.evaluations.services import pick_slot as write_pick
from apps.notifications.models import Notification
from apps.notifications.services import create_notification

pytestmark = pytest.mark.django_db
PASSWORD = "secret"
NOW = datetime(2026, 10, 10, 9, tzinfo=timezone.utc)
SLOT_START = datetime(2026, 10, 12, 15, tzinfo=timezone.utc)
SLOT_END = datetime(2026, 10, 12, 15, 45, tzinfo=timezone.utc)
PICK_SLOT = {"starts_at": "2026-10-12T15:00:00Z", "ends_at": "2026-10-12T15:45:00Z"}
REVIEWERS = (Role.Name.HEAD_TUTOR, Role.Name.ADMIN)
FORBIDDEN = (Role.Name.STUDENT, Role.Name.TUTOR, Role.Name.SC_MEMBER)


@pytest.fixture
def make_user(empty_project_catalog):
    def _make(email, display_name=None, roles=()):
        user = get_user_model().objects.create_user(
            email=email,
            password=PASSWORD,
            display_name=display_name or email.split("@")[0],
        )
        if roles:
            user.roles.add(*Role.objects.filter(name__in=roles))
        return user

    return _make


@pytest.fixture
def project():
    return Project.objects.create(slug="libft", name="Libft")


@pytest.fixture
def other_project():
    return Project.objects.create(slug="minishell", name="Minishell")


def revoke_url(slug="libft", tutor_id=1):
    return reverse("api:project-eligibility-revoke", kwargs={"slug": slug, "tutor_id": tutor_id})


def grant(tutor, project):
    return TutorEligibility.objects.create(tutor=tutor, project=project)


def browser_for(user):
    client = APIClient(enforce_csrf_checks=True)
    client.get(reverse("api:session"))
    response = client.post(
        reverse("api:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    return client


def revoke(client, slug, tutor_id, body=None):
    kwargs = {
        "format": "json",
        "HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value,
    }
    url = revoke_url(slug, tutor_id)
    if body is None:
        return client.delete(url, **kwargs)
    return client.delete(url, body, **kwargs)


@pytest.fixture
def send(monkeypatch):
    sender = AsyncMock()
    monkeypatch.setattr(
        "apps.core.events.get_channel_layer", lambda: SimpleNamespace(group_send=sender)
    )
    return sender


def test_revoke_requires_authentication(make_user, project):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    grant(tutor, project)
    response = APIClient().delete(revoke_url(tutor_id=tutor.pk))
    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }
    assert TutorEligibility.objects.filter(tutor=tutor, project=project).exists()


@pytest.mark.parametrize("actor_role", FORBIDDEN)
def test_revoke_forbidden_for_other_roles(make_user, project, actor_role):
    tutor = make_user("hitchhiker@example.com", roles=(Role.Name.TUTOR,))
    actor = make_user(f"actor-{actor_role}@example.com", roles=(actor_role,))
    grant(tutor, project)
    client = APIClient()
    client.force_authenticate(actor)
    response = client.delete(revoke_url(tutor_id=tutor.pk), format="json")
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "permission_denied",
            "message": "You do not have permission to perform this action.",
        }
    }
    assert TutorEligibility.objects.filter(tutor=tutor, project=project).exists()


@pytest.mark.parametrize("missing", ["project", "tutor", "eligibility"])
def test_missing_eligibility_is_not_found(make_user, project, other_project, missing):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    kept = grant(tutor, other_project)
    slug = project.slug
    tutor_id = tutor.pk
    if missing == "project":
        slug = "unknown"
    elif missing == "tutor":
        tutor_id = tutor.pk + 100
    elif missing == "eligibility":
        grant(tutor, project)
        TutorEligibility.objects.filter(tutor=tutor, project=project).delete()
    client = APIClient()
    client.force_authenticate(head)
    response = client.delete(revoke_url(slug, tutor_id), format="json")
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}
    assert TutorEligibility.objects.filter(pk=kept.pk).exists()
    assert not Notification.objects.exists()
    assert not AuditLog.objects.exists()


@pytest.mark.parametrize("reviewer_role", REVIEWERS)
def test_reviewer_revokes_one_project_and_keeps_the_other(
    make_user, project, other_project, reviewer_role, send, django_capture_on_commit_callbacks
):
    tutor = make_user("tutor@example.com", display_name="Tutor", roles=(Role.Name.TUTOR,))
    reviewer = make_user(f"{reviewer_role}@example.com", roles=(reviewer_role,))
    removed = grant(tutor, project)
    kept = grant(tutor, other_project)
    client = browser_for(reviewer)
    with django_capture_on_commit_callbacks(execute=True):
        response = revoke(client, project.slug, tutor.pk, {"reason": "No longer teaching it."})
        assert response.status_code == 204
        assert response.content == b""
        send.assert_not_awaited()
    assert not TutorEligibility.objects.filter(tutor=tutor, project=project).exists()
    assert TutorEligibility.objects.filter(pk=kept.pk).exists()
    notification = Notification.objects.get()
    assert {
        "recipient_id": notification.recipient_id,
        "type": notification.type,
        "payload": notification.payload,
        "target_url": notification.target_url,
        "read_at": notification.read_at,
    } == {
        "recipient_id": tutor.pk,
        "type": "eligibility.revoked",
        "payload": {"project": {"id": project.pk, "slug": "libft", "name": "Libft"}},
        "target_url": "/profile",
        "read_at": None,
    }
    assert send.await_args_list == [
        call(
            f"user_{tutor.pk}",
            {
                "type": "user.event",
                "event": "notification.created",
                "data": {"id": notification.pk},
            },
        ),
        call(
            f"user_{tutor.pk}",
            {
                "type": "user.event",
                "event": "eligibility.revoked",
                "data": {"project_id": project.pk},
            },
        ),
    ]
    assert list(
        AuditLog.objects.values(
            "actor_id", "action", "target_type", "target_id", "reason", "metadata"
        )
    ) == [
        {
            "actor_id": reviewer.pk,
            "action": "eligibility.revoked",
            "target_type": "tutor_eligibility",
            "target_id": removed.pk,
            "reason": "No longer teaching it.",
            "metadata": {},
        }
    ]


def test_inactive_project_eligibility_can_be_revoked(make_user, send):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    project = Project.objects.create(slug="retired", name="Retired", is_active=False)
    grant(tutor, project)
    client = APIClient()
    client.force_authenticate(head)
    response = client.delete(revoke_url("retired", tutor.pk), {"reason": ""}, format="json")
    assert response.status_code == 204
    assert not TutorEligibility.objects.filter(tutor=tutor, project=project).exists()


def test_blank_or_missing_reason_is_accepted(make_user, project):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    first = grant(tutor, project)
    client = APIClient()
    client.force_authenticate(head)
    missing = client.delete(revoke_url(tutor_id=tutor.pk))
    assert missing.status_code == 204
    second = grant(tutor, project)
    blank = client.delete(revoke_url(tutor_id=tutor.pk), {"reason": ""}, format="json")
    assert blank.status_code == 204
    assert not TutorEligibility.objects.filter(tutor=tutor, project=project).exists()
    assert list(
        AuditLog.objects.order_by("pk").values(
            "actor_id", "action", "target_type", "target_id", "reason", "metadata"
        )
    ) == [
        {
            "actor_id": head.pk,
            "action": "eligibility.revoked",
            "target_type": "tutor_eligibility",
            "target_id": first.pk,
            "reason": "",
            "metadata": {},
        },
        {
            "actor_id": head.pk,
            "action": "eligibility.revoked",
            "target_type": "tutor_eligibility",
            "target_id": second.pk,
            "reason": "",
            "metadata": {},
        },
    ]


def test_reason_over_500_characters_is_rejected(make_user, project):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    grant(tutor, project)
    client = APIClient()
    client.force_authenticate(head)
    response = client.delete(revoke_url(tutor_id=tutor.pk), {"reason": "x" * 501}, format="json")
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {"reason": ["Ensure this field has no more than 500 characters."]},
        }
    }
    assert TutorEligibility.objects.filter(tutor=tutor, project=project).exists()
    assert not Notification.objects.exists()
    assert not AuditLog.objects.exists()


def test_session_revoke_requires_csrf(make_user, project, send, django_capture_on_commit_callbacks):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    grant(tutor, project)
    client = browser_for(head)
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        denied = client.delete(revoke_url(tutor_id=tutor.pk), {"reason": "overlap"}, format="json")
    assert denied.status_code == 403
    assert denied.json() == {
        "error": {
            "code": "csrf_failed",
            "message": "CSRF verification failed. Reload the page and try again.",
        }
    }
    assert TutorEligibility.objects.filter(tutor=tutor, project=project).exists()
    assert not Notification.objects.exists()
    assert callbacks == []
    send.assert_not_awaited()

    accepted = revoke(client, project.slug, tutor.pk)
    assert accepted.status_code == 204
    assert not TutorEligibility.objects.filter(tutor=tutor, project=project).exists()


def test_repeated_revoke_does_not_repeat_side_effects(
    make_user, project, send, django_capture_on_commit_callbacks
):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    grant(tutor, project)
    client = browser_for(head)
    with django_capture_on_commit_callbacks(execute=True):
        assert revoke(client, project.slug, tutor.pk).status_code == 204
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        repeated = revoke(client, project.slug, tutor.pk, {"reason": "again"})
    assert repeated.status_code == 404
    assert repeated.json() == {"error": {"code": "not_found", "message": "Not found."}}
    assert Notification.objects.count() == 1
    assert AuditLog.objects.count() == 1
    assert callbacks == []
    assert send.await_count == 2


def test_existing_picks_stay_and_future_picks_are_refused(make_user, project, monkeypatch):
    monkeypatch.setattr("django.utils.timezone.now", lambda: NOW)
    student = make_user("student@example.com", roles=(Role.Name.STUDENT,))
    other_student = make_user("other@example.com", roles=(Role.Name.STUDENT,))
    tutor = make_user("tutor@example.com", display_name="Tutor", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    grant(tutor, project)
    picked = {
        "picked_by": tutor,
        "starts_at": SLOT_START,
        "ends_at": SLOT_END,
    }
    EvaluationRequest.objects.create(
        student=student,
        project=project,
        status=EvaluationRequest.Status.AWAITING_CONFIRMATION,
        **picked,
    )
    EvaluationRequest.objects.create(
        student=other_student,
        project=project,
        status=EvaluationRequest.Status.CONFIRMED,
        **picked,
    )
    before = list(EvaluationRequest.objects.order_by("pk").values())
    client = APIClient()
    client.force_authenticate(head)
    assert client.delete(revoke_url(tutor_id=tutor.pk), format="json").status_code == 204
    assert list(EvaluationRequest.objects.order_by("pk").values()) == before

    pending = EvaluationRequest.objects.create(student=student, project=project)
    tutor_client = APIClient()
    tutor_client.force_authenticate(tutor)
    refused = tutor_client.post(
        reverse("api:evaluation-request-pick-slot", kwargs={"pk": pending.pk}),
        {"starts_at": "2026-10-12T15:00:00Z", "ends_at": "2026-10-12T15:45:00Z"},
        format="json",
    )
    # A pending request is visible only to Hitchhikers who are still eligible (§8.7).
    assert refused.status_code == 404
    assert refused.json() == {"error": {"code": "not_found", "message": "Not found."}}
    pending.refresh_from_db()
    assert pending.status == EvaluationRequest.Status.PENDING
    assert pending.picked_by_id is None


def test_outer_rollback_discards_revocation(
    make_user, project, send, django_capture_on_commit_callbacks
):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    grant(tutor, project)
    client = browser_for(head)
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        with pytest.raises(RuntimeError, match="rollback"):
            with transaction.atomic():
                response = revoke(client, project.slug, tutor.pk, {"reason": "mistake"})
                assert response.status_code == 204
                assert Notification.objects.filter(type="eligibility.revoked").exists()
                raise RuntimeError("rollback")
    assert callbacks == []
    send.assert_not_awaited()
    assert TutorEligibility.objects.filter(tutor=tutor, project=project).exists()
    assert not Notification.objects.exists()


def test_notification_failure_rolls_back_the_revocation(
    make_user, project, send, monkeypatch, django_capture_on_commit_callbacks
):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    grant(tutor, project)

    def fail_after_notification(**kwargs):
        create_notification(**kwargs)
        raise RuntimeError("Injected notification failure")

    monkeypatch.setattr(
        "apps.evaluations.notifications.create_notification", fail_after_notification
    )
    client = browser_for(head)
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = revoke(client, project.slug, tutor.pk)
    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "server_error",
            "message": "Something went wrong. Please try again.",
        }
    }
    assert TutorEligibility.objects.filter(tutor=tutor, project=project).exists()
    assert not Notification.objects.exists()
    assert callbacks == []
    send.assert_not_awaited()


@pytest.mark.django_db(transaction=True)
def test_competing_revokes_have_one_winner(make_user, monkeypatch):
    assert connection.vendor == "mysql", "This test requires real MySQL row locking."
    # transaction=True flushes seeded roles left by an earlier test in the same run.
    for name in Role.Name.values:
        Role.objects.get_or_create(name=name)
    monkeypatch.setattr(
        "apps.core.events.get_channel_layer",
        lambda: SimpleNamespace(group_send=AsyncMock()),
    )
    tutor = make_user("tutor@example.com", display_name="Tutor", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    admin = make_user("admin@example.com", roles=(Role.Name.ADMIN,))
    project = Project.objects.create(id=801, slug="libft", name="Libft")
    TutorEligibility.objects.create(tutor=tutor, project=project)
    browsers = [browser_for(head), browser_for(admin)]
    barrier = Barrier(2)
    original_fetch = QuerySet._fetch_all
    lock_seen = threading.local()

    def fetch_after_both_reach_the_lock(queryset):
        # Rendezvous before the tutor row lock. Waiting after acquisition deadlocks,
        # and the grant lock is taken only once that user lock is held.
        if (
            queryset.model is get_user_model()
            and queryset.query.select_for_update
            and not getattr(lock_seen, "reached", False)
        ):
            lock_seen.reached = True
            barrier.wait(timeout=10)
        return original_fetch(queryset)

    monkeypatch.setattr(QuerySet, "_fetch_all", fetch_after_both_reach_the_lock)

    def submit(browser):
        close_old_connections()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT CONNECTION_ID()")
                connection_id = cursor.fetchone()[0]
            response = browser.delete(
                revoke_url(project.slug, tutor.pk),
                {"reason": "duplicate"},
                format="json",
                HTTP_HOST="localhost",
                HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
            )
            return response, connection_id
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(submit, browsers))
    assert len({connection_id for _, connection_id in results}) == 2
    responses = [response for response, _ in results]
    assert sorted(response.status_code for response in responses) == [204, 404]
    loser = next(response for response in responses if response.status_code == 404)
    assert loser.json() == {"error": {"code": "not_found", "message": "Not found."}}
    assert not TutorEligibility.objects.filter(tutor=tutor, project=project).exists()
    assert list(Notification.objects.values("recipient_id", "type")) == [
        {"recipient_id": tutor.pk, "type": "eligibility.revoked"}
    ]


def open_pick(make_user):
    """Pending request whose tutor is still eligible. transaction=True drops seeded roles."""
    assert connection.vendor == "mysql", "This test requires real MySQL row locking."
    for name in Role.Name.values:
        Role.objects.get_or_create(name=name)
    student = make_user("student@example.com", display_name="Student", roles=(Role.Name.STUDENT,))
    tutor = make_user("tutor@example.com", display_name="Tutor", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", display_name="Head", roles=(Role.Name.HEAD_TUTOR,))
    project = Project.objects.create(slug="libft", name="Libft")
    grant(tutor, project)
    pending = EvaluationRequest.objects.create(student=student, project=project)
    return tutor, head, project, pending


def post_pick(tutor_id, request_id):
    close_old_connections()
    try:
        client = APIClient()
        client.force_authenticate(get_user_model().objects.get(pk=tutor_id))
        response = client.post(
            reverse("api:evaluation-request-pick-slot", kwargs={"pk": request_id}),
            PICK_SLOT,
            format="json",
        )
        return response.status_code, response.json()
    finally:
        connections.close_all()


def eligibility_lock_is_held(tutor_id, project_id):
    """True when another transaction already holds this grant's row lock."""
    held = False
    try:
        with connection.cursor() as cursor:
            cursor.execute("SET SESSION innodb_lock_wait_timeout = 1")
            cursor.execute(
                """
                SELECT id FROM tutor_eligibility
                WHERE tutor_id = %s AND project_id = %s
                FOR UPDATE
                """,
                [tutor_id, project_id],
            )
    except OperationalError as exc:
        held = exc.args[0] == 1205
    finally:
        connection.rollback()
    with connection.cursor() as cursor:
        cursor.execute("SET SESSION innodb_lock_wait_timeout = 50")
    return held


@pytest.mark.django_db(transaction=True)
def test_revocation_between_permission_check_and_write_refuses_the_pick(
    make_user, send, monkeypatch
):
    """CanPickSlot passes, revocation commits, and only then does the pick write."""
    monkeypatch.setattr("django.utils.timezone.now", lambda: NOW)
    tutor, head, project, pending = open_pick(make_user)
    passed_check = Barrier(2)
    revocation_done = Barrier(2)
    pick_locks = []
    original_fetch = QuerySet._fetch_all

    def fetch(queryset):
        original_fetch(queryset)
        sql = str(queryset.query).upper()
        if (
            queryset.model is TutorEligibility
            and queryset.query.select_for_update
            and "JOIN" not in sql
        ):
            pick_locks.append(queryset._result_cache)

    def pick_after_revocation(evaluation, user, starts_at, ends_at):
        # post() is already past get_object(), so CanPickSlot has passed.
        # The pick transaction and its write start only after revocation commits.
        passed_check.wait(timeout=10)
        revocation_done.wait(timeout=10)
        return write_pick(evaluation, user, starts_at, ends_at)

    monkeypatch.setattr(QuerySet, "_fetch_all", fetch)
    monkeypatch.setattr("apps.evaluations.views.requests.pick_slot", pick_after_revocation)
    head_browser = browser_for(head)
    with ThreadPoolExecutor(max_workers=1) as executor:
        pick_future = executor.submit(post_pick, tutor.pk, pending.pk)
        try:
            passed_check.wait(timeout=10)
            revoked = revoke(head_browser, project.slug, tutor.pk, {"reason": "no longer eligible"})
            assert revoked.status_code == 204
            revocation_done.wait(timeout=10)
            status_code, body = pick_future.result(timeout=10)
        finally:
            passed_check.abort()
            revocation_done.abort()

    assert status_code == 403
    assert body == {
        "error": {
            "code": "not_eligible",
            "message": "You are not eligible to evaluate this project.",
        }
    }
    assert pick_locks == [[]]
    pending.refresh_from_db()
    assert pending.status == EvaluationRequest.Status.PENDING
    assert pending.picked_by_id is None
    assert pending.starts_at is None
    assert pending.ends_at is None
    assert not TutorEligibility.objects.filter(tutor=tutor, project=project).exists()
    assert list(Notification.objects.values("recipient_id", "type")) == [
        {"recipient_id": tutor.pk, "type": "eligibility.revoked"}
    ]
    send.assert_awaited()


@pytest.mark.django_db(transaction=True)
def test_pick_holds_the_eligibility_lock_until_commit(make_user, send, monkeypatch):
    """Revocation waits on the grant row while the pick transaction is still open."""
    monkeypatch.setattr("django.utils.timezone.now", lambda: NOW)
    tutor, head, project, pending = open_pick(make_user)
    held = Barrier(2)
    release = Barrier(2)
    pick_thread = []
    original_fetch = QuerySet._fetch_all

    def fetch(queryset):
        original_fetch(queryset)
        if (
            pick_thread
            and threading.current_thread() is pick_thread[0]
            and queryset.model is TutorEligibility
            and queryset.query.select_for_update
            and queryset._result_cache
        ):
            held.wait(timeout=10)
            release.wait(timeout=10)

    def submit_pick(tutor_id, request_id):
        pick_thread.append(threading.current_thread())
        return post_pick(tutor_id, request_id)

    def submit_revoke(browser, slug, tutor_id):
        close_old_connections()
        try:
            response = revoke(browser, slug, tutor_id, {"reason": "no longer eligible"})
            return response.status_code
        finally:
            connections.close_all()

    monkeypatch.setattr(QuerySet, "_fetch_all", fetch)
    head_browser = browser_for(head)
    with ThreadPoolExecutor(max_workers=2) as executor:
        pick_future = executor.submit(submit_pick, tutor.pk, pending.pk)
        try:
            held.wait(timeout=10)
            revoke_future = executor.submit(submit_revoke, head_browser, project.slug, tutor.pk)
            assert eligibility_lock_is_held(tutor.pk, project.pk)
            pending.refresh_from_db()
            assert pending.status == EvaluationRequest.Status.PENDING
            assert TutorEligibility.objects.filter(tutor=tutor, project=project).exists()
            release.wait(timeout=10)
            pick_status, pick_body = pick_future.result(timeout=10)
            revoke_status = revoke_future.result(timeout=10)
        finally:
            held.abort()
            release.abort()

    assert pick_status == 200
    assert pick_body["status"] == "awaiting_confirmation"
    assert pick_body["picked_by"]["id"] == tutor.pk
    assert revoke_status == 204
    pending.refresh_from_db()
    assert pending.status == EvaluationRequest.Status.AWAITING_CONFIRMATION
    assert pending.picked_by_id == tutor.pk
    assert not TutorEligibility.objects.filter(tutor=tutor, project=project).exists()
    assert list(Notification.objects.order_by("pk").values_list("recipient_id", "type")) == [
        (pending.student_id, "evaluation.slot_picked"),
        (tutor.pk, "eligibility.revoked"),
    ]
    send.assert_awaited()
