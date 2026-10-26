"""Eligibility notifications are stored with the workflow and pushed after commit."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, call

import pytest
from django.contrib.auth import get_user_model
from django.db import transaction
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.evaluations.models import Project, TutorEligibility, TutorEligibilityRequest
from apps.notifications.models import Notification
from apps.notifications.services import create_notification

pytestmark = pytest.mark.django_db


@pytest.fixture
def actors(empty_project_catalog):
    for name in Role.Name.values:
        Role.objects.get_or_create(name=name)
    users = []
    for pk, display_name, role in [
        (701, "Tutor", Role.Name.TUTOR),
        (702, "Head", Role.Name.HEAD_TUTOR),
        (703, "Other Head", Role.Name.HEAD_TUTOR),
        (704, "Admin", Role.Name.ADMIN),
        (705, "Student", Role.Name.STUDENT),
    ]:
        user = get_user_model().objects.create_user(
            id=pk, email=f"user-{pk}@example.com", display_name=display_name, password="secret"
        )
        user.roles.add(Role.objects.get(name=role))
        users.append(user)
    Project.objects.create(id=801, slug="libft", name="Libft")
    Project.objects.create(id=802, slug="minishell", name="Minishell")
    return users


@pytest.fixture(autouse=True)
def send(monkeypatch):
    sender = AsyncMock()
    monkeypatch.setattr(
        "apps.core.events.get_channel_layer", lambda: SimpleNamespace(group_send=sender)
    )
    return sender


def browser_for(user):
    client = APIClient(enforce_csrf_checks=True)
    client.get(reverse("api:session"))
    response = client.post(
        reverse("api:login"),
        {"email": user.email, "password": "secret"},
        format="json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    return client


def submit(client):
    return client.post(
        reverse("api:tutor-eligibility-requests-list"),
        {"project_ids": [802, 801]},
        format="json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )


def pending_request():
    pending = TutorEligibilityRequest.objects.create(requester_id=701)
    pending.projects.set([801, 802])
    return pending


def review(client, pending, decision="approved", review_note="Welcome"):
    return client.post(
        reverse("api:tutor-eligibility-requests-review", kwargs={"request_id": pending.pk}),
        {"decision": decision, "review_note": review_note},
        format="json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )


def test_submission_notifies_only_head_tutors_with_exact_facts_and_events(
    actors, send, django_capture_on_commit_callbacks
):
    # Multiple roles do not duplicate a Head Tutor's notification.
    actors[1].roles.add(Role.objects.get(name=Role.Name.ADMIN))
    client = browser_for(actors[0])
    with django_capture_on_commit_callbacks(execute=True):
        response = submit(client)
        assert response.status_code == 201
        send.assert_not_awaited()
        pending_id = response.json()["id"]
        assert list(
            Notification.objects.order_by("recipient_id").values(
                "recipient_id", "type", "payload", "target_url", "read_at"
            )
        ) == [
            {
                "recipient_id": 702,
                "type": "eligibility.requested",
                "payload": {
                    "request_id": pending_id,
                    "requester": {"id": 701, "display_name": "Tutor"},
                    "projects": [
                        {"id": 801, "slug": "libft", "name": "Libft"},
                        {"id": 802, "slug": "minishell", "name": "Minishell"},
                    ],
                },
                "target_url": f"/eligibility-requests/{pending_id}",
                "read_at": None,
            },
            {
                "recipient_id": 703,
                "type": "eligibility.requested",
                "payload": {
                    "request_id": pending_id,
                    "requester": {"id": 701, "display_name": "Tutor"},
                    "projects": [
                        {"id": 801, "slug": "libft", "name": "Libft"},
                        {"id": 802, "slug": "minishell", "name": "Minishell"},
                    ],
                },
                "target_url": f"/eligibility-requests/{pending_id}",
                "read_at": None,
            },
        ]
    notifications = list(Notification.objects.order_by("recipient_id"))
    assert send.await_args_list == [
        call(
            "user_702",
            {
                "type": "user.event",
                "event": "notification.created",
                "data": {"id": notifications[0].pk},
            },
        ),
        call(
            "user_703",
            {
                "type": "user.event",
                "event": "notification.created",
                "data": {"id": notifications[1].pk},
            },
        ),
        call(
            "user_702",
            {"type": "user.event", "event": "eligibility.requested", "data": {"id": pending_id}},
        ),
        call(
            "user_703",
            {"type": "user.event", "event": "eligibility.requested", "data": {"id": pending_id}},
        ),
    ]


def test_head_tutor_requester_gets_queue_event_but_no_self_notification(
    actors, send, django_capture_on_commit_callbacks
):
    client = browser_for(actors[1])
    with django_capture_on_commit_callbacks(execute=True):
        response = submit(client)
    assert response.status_code == 201
    assert list(Notification.objects.values_list("recipient_id", flat=True)) == [703]
    assert (
        call(
            "user_702",
            {
                "type": "user.event",
                "event": "eligibility.requested",
                "data": {"id": response.json()["id"]},
            },
        )
        in send.await_args_list
    )
    assert len(send.await_args_list) == 3


def test_submission_without_head_tutors_still_succeeds(
    actors, send, django_capture_on_commit_callbacks
):
    for user in actors[1:3]:
        user.roles.remove(Role.objects.get(name=Role.Name.HEAD_TUTOR))
    client = browser_for(actors[0])
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = submit(client)
    assert response.status_code == 201
    assert not Notification.objects.exists()
    assert callbacks == []
    send.assert_not_awaited()


@pytest.mark.parametrize("decision", ["approved", "declined"])
@pytest.mark.parametrize("reviewer_index", [1, 3])
def test_decision_notifies_only_requester_after_commit(
    actors, send, django_capture_on_commit_callbacks, decision, reviewer_index
):
    pending = pending_request()
    client = browser_for(actors[reviewer_index])
    with django_capture_on_commit_callbacks(execute=True):
        response = review(client, pending, decision)
        assert response.status_code == 200
        send.assert_not_awaited()
        assert list(
            Notification.objects.values("recipient_id", "type", "payload", "target_url", "read_at")
        ) == [
            {
                "recipient_id": 701,
                "type": "eligibility.decided",
                "payload": {
                    "request_id": pending.pk,
                    "decision": decision,
                    "review_note": "Welcome",
                },
                "target_url": f"/eligibility-requests/{pending.pk}",
                "read_at": None,
            }
        ]
    notification = Notification.objects.get()
    assert send.await_args_list == [
        call(
            "user_701",
            {
                "type": "user.event",
                "event": "notification.created",
                "data": {"id": notification.pk},
            },
        ),
        call(
            "user_701",
            {
                "type": "user.event",
                "event": "eligibility.decided",
                "data": {"id": pending.pk, "status": decision},
            },
        ),
    ]
    assert TutorEligibility.objects.filter(tutor_id=701).count() == (
        2 if decision == "approved" else 0
    )
    # A repeated review cannot create another notification or event.
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        repeated = review(client, pending, decision)
    assert repeated.status_code == 409
    assert repeated.json() == {
        "error": {
            "code": "eligibility_request_already_reviewed",
            "message": "This eligibility request has already been reviewed.",
        }
    }
    assert Notification.objects.count() == 1
    assert callbacks == []
    assert send.await_count == 2


@pytest.mark.parametrize("action", ["submit", "review"])
def test_outer_rollback_discards_workflow_notifications_and_events(
    actors, send, django_capture_on_commit_callbacks, action
):
    pending = pending_request() if action == "review" else None
    client = browser_for(actors[1] if action == "review" else actors[0])
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        with pytest.raises(RuntimeError, match="rollback"):
            with transaction.atomic():
                response = review(client, pending) if pending else submit(client)
                assert response.status_code == (200 if pending else 201)
                assert Notification.objects.exists()
                raise RuntimeError("rollback")
    assert callbacks == []
    send.assert_not_awaited()
    assert not Notification.objects.exists()
    assert not TutorEligibility.objects.exists()
    if pending:
        pending.refresh_from_db()
        assert pending.status == "pending"
    else:
        assert not TutorEligibilityRequest.objects.exists()


@pytest.mark.parametrize("action", ["submit", "review"])
def test_notification_failure_rolls_back_the_whole_action(
    actors, send, monkeypatch, django_capture_on_commit_callbacks, action
):
    pending = pending_request() if action == "review" else None
    client = browser_for(actors[1] if pending else actors[0])

    def fail_after_notification(**kwargs):
        create_notification(**kwargs)
        raise RuntimeError("Injected notification failure")

    monkeypatch.setattr(
        "apps.evaluations.notifications.create_notification", fail_after_notification
    )
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = review(client, pending) if pending else submit(client)
    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "server_error",
            "message": "Something went wrong. Please try again.",
        }
    }
    assert not Notification.objects.exists()
    assert not TutorEligibility.objects.exists()
    assert callbacks == []
    send.assert_not_awaited()
    if pending:
        pending.refresh_from_db()
        assert pending.status == "pending"
        assert pending.reviewed_at is None
    else:
        assert not TutorEligibilityRequest.objects.exists()


@pytest.mark.parametrize("action", ["submit", "review"])
def test_missing_csrf_creates_no_notification_or_event(
    actors, send, django_capture_on_commit_callbacks, action
):
    pending = pending_request() if action == "review" else None
    client = browser_for(actors[1] if pending else actors[0])
    url = (
        reverse("api:tutor-eligibility-requests-review", kwargs={"request_id": pending.pk})
        if pending
        else reverse("api:tutor-eligibility-requests-list")
    )
    body = {"decision": "approved"} if pending else {"project_ids": [801]}
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = client.post(url, body, format="json")
    assert response.status_code == 403
    assert response.json() == {
        "error": {
            "code": "csrf_failed",
            "message": "CSRF verification failed. Reload the page and try again.",
        }
    }
    assert not Notification.objects.exists()
    assert callbacks == []
    send.assert_not_awaited()
