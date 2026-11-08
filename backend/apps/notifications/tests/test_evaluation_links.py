"""An evaluation notification links only to a request the recipient can still open (R17)."""

from datetime import datetime, timezone

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APIClient

from apps.evaluations.models import EvaluationRequest, Project, TutorEligibility
from apps.notifications.models import Notification

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("empty_project_catalog")]

CREATED = datetime(2026, 10, 20, 12, tzinfo=timezone.utc)
READ = datetime(2026, 10, 20, 13, tzinfo=timezone.utc)
STARTS = datetime(2026, 10, 25, 12, tzinfo=timezone.utc)
ENDS = datetime(2026, 10, 25, 12, 45, tzinfo=timezone.utc)


@pytest.fixture
def people(make_user):
    project = Project.objects.create(id=4, slug="libft", name="Libft")
    student = make_user("student@example.com", id=7)
    declined = make_user("declined@example.com", id=42, roles=("tutor",))
    other = make_user("other@example.com", id=43, roles=("tutor",))
    for tutor in (declined, other):
        TutorEligibility.objects.create(tutor=tutor, project=project)
    return project, student, declined, other


def client_for(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def store(pk, recipient, notification_type, payload):
    Notification.objects.create(
        id=pk,
        recipient=recipient,
        type=notification_type,
        payload=payload,
        target_url="/evaluations/17",
    )
    Notification.objects.filter(pk=pk).update(created_at=CREATED)


def test_declined_link_stays_while_pending_and_empties_once_another_hitchhiker_picks(people):
    project, student, declined, other = people
    EvaluationRequest.objects.create(id=17, student=student, project=project)
    store(
        51,
        declined,
        "evaluation.declined",
        {
            "request_id": 17,
            "project": {"id": 4, "slug": "libft", "name": "Libft"},
            "student": {"id": 7, "display_name": "student"},
        },
    )
    client = client_for(declined)
    url = reverse("api:notification-list")
    # Pending and still eligible: the declined Hitchhiker can open the request.
    assert client.get(url).json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": 51,
                "type": "evaluation.declined",
                "payload": {
                    "request_id": 17,
                    "project": {"id": 4, "slug": "libft", "name": "Libft"},
                    "student": {"id": 7, "display_name": "student"},
                },
                "target_url": "/evaluations/17",
                "read_at": None,
                "created_at": "2026-10-20T12:00:00Z",
            }
        ],
    }
    EvaluationRequest.objects.filter(pk=17).update(
        status="awaiting_confirmation", picked_by=other, starts_at=STARTS, ends_at=ENDS
    )
    # Picked by someone else: the request is hidden from them, so the link is gone.
    assert client.get(url).json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": 51,
                "type": "evaluation.declined",
                "payload": {
                    "request_id": 17,
                    "project": {"id": 4, "slug": "libft", "name": "Libft"},
                    "student": {"id": 7, "display_name": "student"},
                },
                "target_url": "",
                "read_at": None,
                "created_at": "2026-10-20T12:00:00Z",
            }
        ],
    }
    # Only the response changes, the stored row keeps its link.
    assert Notification.objects.get(pk=51).target_url == "/evaluations/17"


def test_stored_hitchhiker_expiry_notice_loses_its_link_and_the_students_keeps_it(
    people, monkeypatch
):
    project, student, declined, _ = people
    # Expiry cleared the pick, so the Hitchhiker who proposed the slot can no longer see it.
    EvaluationRequest.objects.create(
        id=17, student=student, project=project, status="expired", expired_at=CREATED
    )
    payload = {
        "request_id": 17,
        "project": {"id": 4, "slug": "libft", "name": "Libft"},
        "previous_status": "awaiting_confirmation",
    }
    # A notice stored before R17, when expiry still notified the Hitchhiker.
    store(51, declined, "evaluation.expired", payload)
    store(52, student, "evaluation.expired", payload)
    url = reverse("api:notification-list")
    assert client_for(declined).get(url).json()["results"] == [
        {
            "id": 51,
            "type": "evaluation.expired",
            "payload": {
                "request_id": 17,
                "project": {"id": 4, "slug": "libft", "name": "Libft"},
                "previous_status": "awaiting_confirmation",
            },
            "target_url": "",
            "read_at": None,
            "created_at": "2026-10-20T12:00:00Z",
        }
    ]
    assert client_for(student).get(url).json()["results"] == [
        {
            "id": 52,
            "type": "evaluation.expired",
            "payload": {
                "request_id": 17,
                "project": {"id": 4, "slug": "libft", "name": "Libft"},
                "previous_status": "awaiting_confirmation",
            },
            "target_url": "/evaluations/17",
            "read_at": None,
            "created_at": "2026-10-20T12:00:00Z",
        }
    ]
    # Marking one notification read returns it alone, with the same rule.
    monkeypatch.setattr("apps.notifications.views.timezone.now", lambda: READ)
    response = client_for(declined).post(reverse("api:notification-read", kwargs={"pk": 51}))
    assert response.status_code == 200
    assert response.json() == {
        "id": 51,
        "type": "evaluation.expired",
        "payload": {
            "request_id": 17,
            "project": {"id": 4, "slug": "libft", "name": "Libft"},
            "previous_status": "awaiting_confirmation",
        },
        "target_url": "",
        "read_at": "2026-10-20T13:00:00Z",
        "created_at": "2026-10-20T12:00:00Z",
    }


def test_listing_checks_every_evaluation_link_of_a_page_with_one_query(people):
    project, student, declined, _ = people
    client = client_for(declined)
    url = reverse("api:notification-list")

    def add(pk):
        EvaluationRequest.objects.create(id=pk, student=student, project=project)
        Notification.objects.create(
            recipient=declined,
            type="evaluation.created",
            payload={"request_id": pk, "project": {"id": 4, "slug": "libft", "name": "Libft"}},
            target_url=f"/requests/{pk}",
        )

    add(17)
    with CaptureQueriesContext(connection) as one:
        assert client.get(url).status_code == 200
    for pk in (18, 19, 20, 21):
        add(pk)
    with CaptureQueriesContext(connection) as five:
        response = client.get(url)
    assert [notification["target_url"] for notification in response.json()["results"]] == [
        "/requests/21",
        "/requests/20",
        "/requests/19",
        "/requests/18",
        "/requests/17",
    ]
    # More notifications on the page do not add queries.
    assert len(five) == len(one)
    request_queries = [
        query["sql"] for query in five.captured_queries if "`evaluation_request`" in query["sql"]
    ]
    assert len(request_queries) == 1
