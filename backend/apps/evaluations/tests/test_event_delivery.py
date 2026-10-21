"""Session-authenticated evaluation actions reach affected users through Redis."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from asgiref.sync import async_to_sync
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.evaluations.models import EvaluationRequest, Project, TutorEligibility
from apps.notifications.models import Notification
from config.asgi import application

pytestmark = [
    pytest.mark.django_db(transaction=True),
    pytest.mark.usefixtures("empty_project_catalog"),
]
NOW = datetime(2026, 10, 10, 9, tzinfo=timezone.utc)
START = datetime(2026, 10, 12, 15, tzinfo=timezone.utc)
PASSWORD = "EventDeliveryPassword123!"


@pytest.fixture(autouse=True)
def isolated_redis(settings, monkeypatch):
    monkeypatch.setattr("django.utils.timezone.now", lambda: NOW)
    config = dict(
        settings.CHANNEL_LAYERS["default"]["CONFIG"], prefix=f"test.evaluations.{uuid4().hex}"
    )
    settings.CHANNEL_LAYERS = {
        "default": {"BACKEND": "channels_redis.core.RedisChannelLayer", "CONFIG": config}
    }


def login_client(user):
    client = APIClient(enforce_csrf_checks=True)
    response = client.get(reverse("api:session"), HTTP_HOST="localhost")
    assert response.status_code == 200
    assert response.json() == {"authenticated": False, "user": None}
    response = client.post(
        reverse("api:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    assert response.json() == {
        "id": user.pk,
        "email": user.email,
        "display_name": user.display_name,
        "message": "Logged in successfully.",
    }
    return client


@pytest.fixture
def participants():
    for role in Role.Name.values:
        Role.objects.get_or_create(name=role)
    project = Project.objects.create(id=4, slug="libft", name="Libft")
    elsewhere = Project.objects.create(slug="elsewhere", name="Elsewhere")
    users, clients = {}, {}
    for user_id, name, roles, eligible_project in (
        (7, "Student", ("student",), None),
        (42, "Picker", ("tutor",), project),
        (43, "Eligible", ("head_tutor", "tutor"), project),
        (44, "Former tutor", ("student",), project),
        (45, "Other project", ("tutor",), elsewhere),
        (46, "Ineligible", ("tutor",), None),
    ):
        user = get_user_model().objects.create_user(
            id=user_id,
            email=f"delivery-{user_id}@example.com",
            display_name=name,
            password=PASSWORD,
        )
        user.roles.add(*Role.objects.filter(name__in=roles))
        if eligible_project is not None:
            TutorEligibility.objects.create(tutor=user, project=eligible_project)
        users[user_id] = user
        clients[user_id] = login_client(user)
    return project, users, clients, login_client(users[7])


def socket(client):
    key = client.cookies[settings.SESSION_COOKIE_NAME].value
    return WebsocketCommunicator(
        application,
        "/ws/",
        headers=[
            (b"origin", b"https://localhost"),
            (b"cookie", f"{settings.SESSION_COOKIE_NAME}={key}".encode()),
        ],
    )


@pytest.mark.parametrize(
    "action,initial_status,expected_event,recipients,picker_eligible,rollback",
    [
        (
            "pick-slot",
            "pending",
            {
                "event": "evaluation.slot_picked",
                "data": {"id": 17, "status": "awaiting_confirmation"},
            },
            (7, 42, 43),
            True,
            False,
        ),
        (
            "confirm",
            "awaiting_confirmation",
            {"event": "evaluation.confirmed", "data": {"id": 17, "status": "confirmed"}},
            (7, 42),
            True,
            False,
        ),
        (
            "decline",
            "awaiting_confirmation",
            {"event": "evaluation.declined", "data": {"id": 17, "status": "pending"}},
            (7, 42, 43),
            True,
            False,
        ),
        (
            "decline",
            "awaiting_confirmation",
            {"event": "evaluation.declined", "data": {"id": 17, "status": "pending"}},
            (7, 42, 43),
            False,
            False,
        ),
        (
            "release",
            "awaiting_confirmation",
            {"event": "evaluation.released", "data": {"id": 17, "status": "pending"}},
            (7, 42, 43),
            False,
            False,
        ),
        (
            "release",
            "confirmed",
            {"event": "evaluation.released", "data": {"id": 17, "status": "pending"}},
            (7, 42, 43),
            True,
            False,
        ),
        (
            "cancel",
            "pending",
            {"event": "evaluation.cancelled", "data": {"id": 17, "status": "cancelled"}},
            (7, 42, 43),
            True,
            False,
        ),
        (
            "cancel",
            "awaiting_confirmation",
            {"event": "evaluation.cancelled", "data": {"id": 17, "status": "cancelled"}},
            (7, 42),
            True,
            False,
        ),
        (
            "cancel",
            "confirmed",
            {"event": "evaluation.cancelled", "data": {"id": 17, "status": "cancelled"}},
            (7, 42),
            True,
            False,
        ),
        (
            "decline",
            "awaiting_confirmation",
            {"event": "evaluation.declined", "data": {"id": 17, "status": "pending"}},
            (),
            True,
            True,
        ),
    ],
    ids=[
        "pick",
        "confirm",
        "decline",
        "decline-revoked-eligibility",
        "release-revoked-eligibility",
        "release-confirmed",
        "cancel-pending",
        "cancel-awaiting",
        "cancel-confirmed",
        "rollback",
    ],
)
def test_http_action_delivers_only_to_affected_authenticated_connections(
    participants, action, initial_status, expected_event, recipients, picker_eligible, rollback
):
    project, users, clients, student_device = participants
    if not picker_eligible:
        TutorEligibility.objects.filter(tutor=users[42]).delete()
    picked = initial_status != "pending"
    evaluation = EvaluationRequest.objects.create(
        id=17,
        student=users[7],
        project=project,
        note="Private student note",
        status=initial_status,
        picked_by=users[42] if picked else None,
        starts_at=START if picked else None,
        ends_at=START + timedelta(minutes=45) if picked else None,
    )
    response_picked = (
        action == "pick-slot" or (action == "cancel" and picked) or action == "confirm"
    )
    expected_response = {
        "id": 17,
        "student": (
            None
            if action == "release"
            else {"id": 7, "display_name": "Student", "avatar_url": None}
        ),
        "project": {"id": 4, "slug": "libft", "name": "Libft"},
        "note": "Private student note",
        "status": expected_event["data"]["status"],
        "picked_by": (
            {"id": 42, "display_name": "Picker", "avatar_url": None} if response_picked else None
        ),
        "starts_at": "2026-10-12T15:00:00Z" if response_picked else None,
        "ends_at": "2026-10-12T15:45:00Z" if response_picked else None,
        "cancelled_by": (
            {"id": 7, "display_name": "Student", "avatar_url": None} if action == "cancel" else None
        ),
        "cancelled_at": "2026-10-10T09:00:00Z" if action == "cancel" else None,
        "expired_at": None,
        "result": None,
        "feedback": "",
        "completed_at": None,
        "is_history": action == "cancel",
        "created_at": "2026-10-10T09:00:00Z",
        "updated_at": "2026-10-10T09:00:00Z",
    }

    def perform_action():
        actor = clients[42] if action in ("pick-slot", "release") else clients[7]
        data = (
            {"starts_at": "2026-10-12T15:00:00Z", "ends_at": "2026-10-12T15:45:00Z"}
            if action == "pick-slot"
            else {}
        )
        with transaction.atomic():
            response = actor.post(
                reverse(f"api:evaluation-request-{action}", kwargs={"pk": 17}),
                data,
                format="json",
                HTTP_HOST="localhost",
                HTTP_X_CSRFTOKEN=actor.cookies["csrftoken"].value,
            )
            assert response.status_code == 200
            assert response.json() == expected_response
            if rollback:
                transaction.set_rollback(True)
        if not rollback and (
            action in ("pick-slot", "confirm", "decline") or (action == "cancel" and picked)
        ):
            return Notification.objects.get().pk
        return None

    def assert_committed_state():
        evaluation.refresh_from_db()
        assert evaluation.status == (
            initial_status if rollback else expected_event["data"]["status"]
        )

    async def exercise():
        layer = get_channel_layer()
        connections = [(user_id, socket(client)) for user_id, client in clients.items()]
        connections.extend([(7, socket(clients[7])), (7, socket(student_device))])
        try:
            for _, communicator in connections:
                assert await communicator.connect() == (True, None)
            notification_id = await database_sync_to_async(perform_action)()
            for user_id, communicator in connections:
                if user_id in recipients:
                    assert await communicator.receive_json_from(timeout=3) == expected_event
                notification_recipient = {"pick-slot": 7, "confirm": 42, "decline": 42}.get(action)
                if action == "cancel" and picked:
                    notification_recipient = 42
                if not rollback and user_id == notification_recipient:
                    assert await communicator.receive_json_from(timeout=3) == {
                        "event": "notification.created",
                        "data": {"id": notification_id},
                    }
                # Also detects duplicate pushes to a user with multiple roles.
                assert await communicator.receive_nothing(timeout=0.1)
            await database_sync_to_async(assert_committed_state)()
        finally:
            for _, communicator in connections:
                await communicator.disconnect()
            # Clean only this test's prefix, never the application's Redis keys.
            await layer.flush()
            await layer.close_pools()

    async_to_sync(exercise)()
