"""Project detail representation and eligible Hitchhiker selection (api-plan §8.6)."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.evaluations.models import Project, TutorEligibility

pytestmark = pytest.mark.django_db


@pytest.fixture
def project():
    return Project.objects.create(id=4, slug="push_swap", name="push_swap")


@pytest.fixture
def session_client():
    user = get_user_model().objects.create_user(
        email="student@example.com", password="test-password", display_name="Student"
    )
    client = APIClient(enforce_csrf_checks=True)
    client.force_login(user)
    return client


def create_tutor(user_id, display_name, project, roles, status="active"):
    user = get_user_model().objects.create_user(
        id=user_id,
        email=f"user{user_id}@example.com",
        display_name=display_name,
        status=status,
    )
    user.roles.add(*(Role.objects.get(name=name) for name in roles))
    TutorEligibility.objects.create(tutor=user, project=project)
    return user


def test_project_detail_requires_authentication(project):
    response = APIClient().get(reverse("api:project-detail", kwargs={"slug": "push_swap"}))

    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }


def test_project_detail_returns_empty_eligible_tutors(session_client, project):
    response = session_client.get(reverse("api:project-detail", kwargs={"slug": "push_swap"}))

    assert response.status_code == 200
    assert response.json() == {
        "id": 4,
        "slug": "push_swap",
        "name": "push_swap",
        "eligible_tutors": [],
    }


def test_project_detail_filters_sorts_and_deduplicates_tutors(session_client, project):
    create_tutor(42, "Bob", project, ["tutor"])
    create_tutor(43, "Alice", project, ["head_tutor"])
    create_tutor(44, "Charlie", project, ["tutor", "head_tutor"])
    create_tutor(45, "Suspended", project, ["tutor"], status="suspended")
    create_tutor(46, "Student", project, ["student"])
    create_tutor(47, "Admin", project, ["admin"])
    create_tutor(48, "Council", project, ["sc_member"])
    other_project = Project.objects.create(slug="born2beroot", name="Born2beroot")
    create_tutor(49, "Other project", other_project, ["tutor"])
    unapproved = get_user_model().objects.create_user(
        id=50, email="unapproved@example.com", display_name="Unapproved"
    )
    unapproved.roles.add(Role.objects.get(name="tutor"))

    response = session_client.get(reverse("api:project-detail", kwargs={"slug": "push_swap"}))

    assert response.status_code == 200
    assert response.json() == {
        "id": 4,
        "slug": "push_swap",
        "name": "push_swap",
        "eligible_tutors": [
            {"id": 43, "display_name": "Alice", "avatar_url": None},
            {"id": 42, "display_name": "Bob", "avatar_url": None},
            {"id": 44, "display_name": "Charlie", "avatar_url": None},
        ],
    }


@pytest.mark.parametrize("change", ["role_removed", "eligibility_revoked", "suspended"])
def test_project_detail_reflects_eligibility_changes(session_client, project, change):
    tutor = create_tutor(42, "Alice", project, ["tutor"])
    url = reverse("api:project-detail", kwargs={"slug": "push_swap"})

    before = session_client.get(url)
    assert before.status_code == 200
    assert before.json() == {
        "id": 4,
        "slug": "push_swap",
        "name": "push_swap",
        "eligible_tutors": [{"id": 42, "display_name": "Alice", "avatar_url": None}],
    }

    if change == "role_removed":
        tutor.roles.remove(Role.objects.get(name="tutor"))
        assert TutorEligibility.objects.filter(tutor=tutor, project=project).exists()
    elif change == "eligibility_revoked":
        TutorEligibility.objects.filter(tutor=tutor, project=project).delete()
    else:
        get_user_model().objects.filter(pk=tutor.pk).update(status="suspended")

    after = session_client.get(url)
    assert after.status_code == 200
    assert after.json() == {
        "id": 4,
        "slug": "push_swap",
        "name": "push_swap",
        "eligible_tutors": [],
    }


@pytest.mark.parametrize("slug", ["missing", "born2beroot"])
def test_project_detail_hides_unknown_and_inactive_projects(session_client, slug):
    Project.objects.create(slug="born2beroot", name="Born2beroot", is_active=False)

    response = session_client.get(reverse("api:project-detail", kwargs={"slug": slug}))

    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}


def test_project_detail_rejects_suspended_session(session_client, project):
    get_user_model().objects.filter(email="student@example.com").update(status="suspended")

    response = session_client.get(reverse("api:project-detail", kwargs={"slug": "push_swap"}))

    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }
