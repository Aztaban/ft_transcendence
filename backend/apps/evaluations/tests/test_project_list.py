"""GET /projects/ contract: authenticated, active only, sorted, not paginated."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from apps.evaluations.models import Project

pytestmark = pytest.mark.django_db


@pytest.fixture
def session_client():
    user = get_user_model().objects.create_user(
        email="student@example.com", password="test-password", display_name="Student"
    )
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(user)
    return client


def test_project_list_requires_authentication():
    response = APIClient().get(reverse("api:project-list"))

    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }


def test_project_list_returns_active_projects_sorted_by_name(session_client):
    Project.objects.create(id=4, slug="push_swap", name="push_swap")
    Project.objects.create(id=7, slug="born2beroot", name="Born2beroot")
    Project.objects.create(id=9, slug="retired", name="Retired", is_active=False)

    response = session_client.get(reverse("api:project-list"))

    assert response.status_code == 200
    assert response.json() == [
        {"id": 7, "slug": "born2beroot", "name": "Born2beroot"},
        {"id": 4, "slug": "push_swap", "name": "push_swap"},
    ]


@pytest.mark.parametrize("inactive_project_exists", [False, True])
def test_project_list_returns_empty_list_without_active_projects(
    session_client, inactive_project_exists
):
    if inactive_project_exists:
        Project.objects.create(slug="retired", name="Retired", is_active=False)

    response = session_client.get(reverse("api:project-list"))

    assert response.status_code == 200
    assert response.json() == []


def test_project_list_ignores_pagination_parameters(session_client):
    Project.objects.create(id=4, slug="push_swap", name="push_swap")
    Project.objects.create(id=7, slug="born2beroot", name="Born2beroot")

    response = session_client.get(reverse("api:project-list"), {"page": 2, "page_size": 1})

    assert response.status_code == 200
    assert response.json() == [
        {"id": 7, "slug": "born2beroot", "name": "Born2beroot"},
        {"id": 4, "slug": "push_swap", "name": "push_swap"},
    ]


def test_project_list_rejects_suspended_session(session_client):
    get_user_model().objects.filter(email="student@example.com").update(status="suspended")

    response = session_client.get(reverse("api:project-list"))

    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }
