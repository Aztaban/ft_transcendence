"""Notification API contracts, including idempotent read actions."""

from datetime import datetime, timezone

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from drf_spectacular.generators import SchemaGenerator
from drf_spectacular.validation import validate_schema
from rest_framework.test import APIClient

from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db

CREATED = datetime(2026, 10, 20, 12, tzinfo=timezone.utc)
READ = datetime(2026, 10, 20, 13, tzinfo=timezone.utc)


@pytest.fixture
def people():
    User = get_user_model()
    return (
        User.objects.create_user(
            email="owner@example.com", display_name="Owner", password="secret"
        ),
        User.objects.create_user(email="other@example.com", display_name="Other"),
    )


@pytest.fixture
def client(people):
    client = APIClient()
    client.force_authenticate(people[0])
    return client


@pytest.fixture
def notifications(people):
    first = Notification.objects.create(
        id=41,
        recipient=people[0],
        type="resource.deleted",
        payload={"title": "Old guide"},
        read_at=READ,
    )
    second = Notification.objects.create(
        id=42,
        recipient=people[0],
        type="eligibility.decided",
        payload={"request_id": 7, "decision": "approved", "review_note": ""},
        target_url="/eligibility-requests/7",
    )
    Notification.objects.create(
        id=43,
        recipient=people[1],
        type="resource.deleted",
        payload={"title": "Private"},
    )
    Notification.objects.filter(pk__in=[41, 42]).update(created_at=CREATED)
    return first, second


@pytest.mark.parametrize(
    "method,name,kwargs",
    [
        ("get", "notification-list", {}),
        ("get", "notification-unread-count", {}),
        ("delete", "notification-delete", {"pk": 42}),
        ("post", "notification-read", {"pk": 42}),
        ("post", "notification-read-all", {}),
    ],
)
def test_endpoints_require_session(method, name, kwargs):
    response = getattr(APIClient(), method)(reverse(f"api:{name}", kwargs=kwargs))
    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }


@pytest.mark.parametrize("query", [{}, {"unread": "false"}])
def test_list_returns_exact_own_representation_newest_first(client, notifications, query):
    response = client.get(reverse("api:notification-list"), query)
    assert response.status_code == 200
    assert response.json() == {
        "count": 2,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": 42,
                "type": "eligibility.decided",
                "payload": {"request_id": 7, "decision": "approved", "review_note": ""},
                "target_url": "/eligibility-requests/7",
                "read_at": None,
                "created_at": "2026-10-20T12:00:00Z",
            },
            {
                "id": 41,
                "type": "resource.deleted",
                "payload": {"title": "Old guide"},
                "target_url": "",
                "read_at": "2026-10-20T13:00:00Z",
                "created_at": "2026-10-20T12:00:00Z",
            },
        ],
    }


def test_list_filters_unread(client, notifications):
    response = client.get(reverse("api:notification-list"), {"unread": "true"})
    assert response.status_code == 200
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": 42,
                "type": "eligibility.decided",
                "payload": {"request_id": 7, "decision": "approved", "review_note": ""},
                "target_url": "/eligibility-requests/7",
                "read_at": None,
                "created_at": "2026-10-20T12:00:00Z",
            }
        ],
    }


@pytest.mark.parametrize("value", ["yes", "1", "invalid", ""])
def test_list_rejects_unknown_filter_values(client, value):
    response = client.get(reverse("api:notification-list"), {"unread": value})
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {"unread": [f'"{value}" is not a valid choice.']},
        }
    }


def test_empty_list_and_count(client):
    response = client.get(reverse("api:notification-list"))
    assert response.status_code == 200
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}
    response = client.get(reverse("api:notification-unread-count"))
    assert response.status_code == 200
    assert response.json() == {"count": 0}


def test_unread_count_excludes_read_and_other_users_notifications(client, notifications):
    response = client.get(reverse("api:notification-unread-count"))
    assert response.status_code == 200
    assert response.json() == {"count": 1}


def test_list_paginates_with_links(client, notifications):
    response = client.get(reverse("api:notification-list"), {"page": 2, "page_size": 1})
    assert response.status_code == 200
    assert response.json() == {
        "count": 2,
        "next": None,
        "previous": "http://testserver/api/v1/notifications/?page_size=1",
        "results": [
            {
                "id": 41,
                "type": "resource.deleted",
                "payload": {"title": "Old guide"},
                "target_url": "",
                "read_at": "2026-10-20T13:00:00Z",
                "created_at": "2026-10-20T12:00:00Z",
            }
        ],
    }


@pytest.mark.parametrize("query,size", [({}, 20), ({"page_size": 999}, 100)])
def test_pagination_default_and_maximum(client, people, query, size):
    Notification.objects.bulk_create(
        [
            Notification(recipient=people[0], type="resource.deleted", payload={"title": "Guide"})
            for _ in range(101)
        ]
    )
    response = client.get(reverse("api:notification-list"), query)
    assert response.status_code == 200
    assert response.json()["count"] == 101
    assert len(response.json()["results"]) == size


@pytest.mark.parametrize("pk", [43, 999])
def test_delete_hides_other_users_and_missing_notifications(client, notifications, pk):
    response = client.delete(reverse("api:notification-delete", kwargs={"pk": pk}))
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}
    assert Notification.objects.count() == 3


@pytest.mark.parametrize("csrf", [True, False])
def test_delete_through_real_login_requires_csrf(people, notifications, csrf):
    client = APIClient(enforce_csrf_checks=True)
    client.get(reverse("api:session"))
    login = client.post(
        reverse("api:login"),
        {"email": "owner@example.com", "password": "secret"},
        format="json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert login.status_code == 200
    headers = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}
    response = client.delete(reverse("api:notification-delete", kwargs={"pk": 42}), **headers)
    if csrf:
        assert response.status_code == 204
        assert response.content == b""
        assert list(Notification.objects.order_by("pk").values_list("pk", flat=True)) == [41, 43]
    else:
        assert response.status_code == 403
        assert response.json() == {
            "error": {
                "code": "csrf_failed",
                "message": "CSRF verification failed. Reload the page and try again.",
            }
        }
        assert Notification.objects.count() == 3


@pytest.mark.parametrize(
    "method,name,kwargs",
    [
        ("post", "notification-list", {}),
        ("get", "notification-delete", {"pk": 42}),
        ("patch", "notification-delete", {"pk": 42}),
        ("post", "notification-unread-count", {}),
    ],
)
def test_unsupported_methods_cannot_create_read_or_edit_notifications(
    client, notifications, method, name, kwargs
):
    response = getattr(client, method)(reverse(f"api:{name}", kwargs=kwargs))
    assert response.status_code == 405
    assert response.json() == {
        "error": {"code": "method_not_allowed", "message": "Method not allowed."}
    }
    assert Notification.objects.count() == 3


def test_notification_schema_matches_public_representation_and_routes():
    schema = SchemaGenerator().get_schema(request=None, public=True)
    validate_schema(schema)
    notification = schema["components"]["schemas"]["Notification"]
    assert set(notification["properties"]) == {
        "id",
        "type",
        "payload",
        "target_url",
        "read_at",
        "created_at",
    }
    assert set(notification["required"]) == {
        "id",
        "type",
        "payload",
        "target_url",
        "read_at",
        "created_at",
    }
    assert notification["properties"]["read_at"]["nullable"] is True
    assert notification["properties"]["payload"]["type"] == "object"
    for path, method in [
        ("notifications/", "get"),
        ("notifications/unread-count/", "get"),
        ("notifications/{id}/", "delete"),
        ("notifications/{id}/read/", "post"),
        ("notifications/read-all/", "post"),
    ]:
        assert schema["paths"][f"/api/v1/{path}"][method]["security"] == [{"cookieAuth": []}]
    for path, response_status in [
        ("notifications/{id}/read/", "200"),
        ("notifications/read-all/", "204"),
    ]:
        operation = schema["paths"][f"/api/v1/{path}"]["post"]
        assert "requestBody" not in operation
        assert response_status in operation["responses"]
        assert (
            next(p for p in operation["parameters"] if p["name"] == "X-CSRFToken")["required"]
            is True
        )


def test_mark_read_returns_exact_notification_and_preserves_timestamp_on_retry(
    client, notifications, monkeypatch
):
    monkeypatch.setattr("apps.notifications.views.timezone.now", lambda: READ)
    url = reverse("api:notification-read", kwargs={"pk": 42})
    response = client.post(url)
    assert response.status_code == 200
    assert response.json() == {
        "id": 42,
        "type": "eligibility.decided",
        "payload": {"request_id": 7, "decision": "approved", "review_note": ""},
        "target_url": "/eligibility-requests/7",
        "read_at": "2026-10-20T13:00:00Z",
        "created_at": "2026-10-20T12:00:00Z",
    }
    monkeypatch.setattr(
        "apps.notifications.views.timezone.now",
        lambda: datetime(2026, 10, 21, 14, tzinfo=timezone.utc),
    )
    retry = client.post(url)
    assert retry.status_code == 200
    assert retry.json() == {
        "id": 42,
        "type": "eligibility.decided",
        "payload": {"request_id": 7, "decision": "approved", "review_note": ""},
        "target_url": "/eligibility-requests/7",
        "read_at": "2026-10-20T13:00:00Z",
        "created_at": "2026-10-20T12:00:00Z",
    }
    changed = Notification.objects.get(pk=42)
    assert changed.read_at == READ
    assert changed.updated_at == READ
    assert Notification.objects.get(pk=43).read_at is None
    assert client.get(reverse("api:notification-unread-count")).json() == {"count": 0}
    assert client.get(reverse("api:notification-list"), {"unread": "true"}).json() == {
        "count": 0,
        "next": None,
        "previous": None,
        "results": [],
    }


@pytest.mark.parametrize("pk", [43, 999])
def test_mark_read_hides_other_users_and_missing_notifications(client, notifications, pk):
    response = client.post(reverse("api:notification-read", kwargs={"pk": pk}))
    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}
    assert Notification.objects.get(pk=42).read_at is None
    assert Notification.objects.get(pk=43).read_at is None


def test_read_all_changes_only_own_unread_rows_and_is_idempotent(
    client, notifications, monkeypatch
):
    already_read_updated = Notification.objects.get(pk=41).updated_at
    monkeypatch.setattr("apps.notifications.views.timezone.now", lambda: READ)
    url = reverse("api:notification-read-all")
    response = client.post(url)
    assert response.status_code == 204
    assert response.content == b""
    monkeypatch.setattr(
        "apps.notifications.views.timezone.now",
        lambda: datetime(2026, 10, 21, 14, tzinfo=timezone.utc),
    )
    response = client.post(url)
    assert response.status_code == 204
    assert response.content == b""
    assert Notification.objects.get(pk=41).read_at == READ
    assert Notification.objects.get(pk=41).updated_at == already_read_updated
    assert Notification.objects.get(pk=42).read_at == READ
    assert Notification.objects.get(pk=42).updated_at == READ
    assert Notification.objects.get(pk=43).read_at is None
    assert client.get(reverse("api:notification-unread-count")).json() == {"count": 0}


def test_read_all_with_no_notifications_returns_no_content(client):
    response = client.post(reverse("api:notification-read-all"))
    assert response.status_code == 204
    assert response.content == b""


@pytest.mark.parametrize(
    "name,kwargs",
    [
        ("notification-read", {"pk": 42}),
        ("notification-read-all", {}),
    ],
)
@pytest.mark.parametrize("csrf", [True, False])
def test_read_actions_through_real_login_require_csrf(people, notifications, name, kwargs, csrf):
    client = APIClient(enforce_csrf_checks=True)
    client.get(reverse("api:session"))
    login = client.post(
        reverse("api:login"),
        {"email": "owner@example.com", "password": "secret"},
        format="json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert login.status_code == 200
    headers = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value} if csrf else {}
    response = client.post(reverse(f"api:{name}", kwargs=kwargs), **headers)
    if csrf:
        assert response.status_code == (200 if name == "notification-read" else 204)
        assert Notification.objects.get(pk=42).read_at is not None
    else:
        assert response.status_code == 403
        assert response.json() == {
            "error": {
                "code": "csrf_failed",
                "message": "CSRF verification failed. Reload the page and try again.",
            }
        }
        assert Notification.objects.get(pk=42).read_at is None
    assert Notification.objects.get(pk=43).read_at is None


@pytest.mark.parametrize(
    "name,kwargs",
    [
        ("notification-read", {"pk": 42}),
        ("notification-read-all", {}),
    ],
)
def test_read_actions_reject_get_without_changing_state(client, notifications, name, kwargs):
    response = client.get(reverse(f"api:{name}", kwargs=kwargs))
    assert response.status_code == 405
    assert response.json() == {
        "error": {"code": "method_not_allowed", "message": "Method not allowed."}
    }
    assert Notification.objects.get(pk=42).read_at is None
