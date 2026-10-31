"""GET /api/v1/tutor-eligibility-requests/{id}/ (api-plan §10.3, §8.9)."""

from datetime import datetime, timezone

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.fields import DateTimeField
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.evaluations.models import Project, TutorEligibilityRequest

pytestmark = pytest.mark.django_db

URL = "api:tutor-eligibility-requests-detail"

NOT_FOUND = {"error": {"code": "not_found", "message": "Not found."}}


@pytest.fixture
def api_client():
    return APIClient()


def iso(dt):
    return DateTimeField().to_representation(dt)


def user_ref(user):
    return {"id": user.id, "display_name": user.display_name, "avatar_url": None}


def project_ref(project):
    return {"id": project.id, "slug": project.slug, "name": project.name}


def make_request(
    requester,
    projects,
    *,
    status_value=TutorEligibilityRequest.Status.PENDING,
    **extra,
):
    request = TutorEligibilityRequest.objects.create(
        requester=requester, status=status_value, **extra
    )
    request.projects.set(projects)
    return request


def expected_eligibility_request(request):
    projects = sorted(request.projects.all(), key=lambda project: project.name)
    return {
        "id": request.id,
        "requester": user_ref(request.requester),
        "projects": [project_ref(project) for project in projects],
        "status": request.status,
        "reviewed_by": user_ref(request.reviewed_by) if request.reviewed_by_id else None,
        "reviewed_at": iso(request.reviewed_at) if request.reviewed_at else None,
        "review_note": request.review_note,
        "created_at": iso(request.created_at),
    }


def detail_url(request_id):
    return reverse(URL, kwargs={"request_id": request_id})


def test_detail_requires_authentication(api_client):
    response = api_client.get(detail_url(1))

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }


def test_requester_sees_own_request_with_projects_sorted_by_name(api_client, make_user):
    tutor = make_user("tutor@example.com", display_name="Bob", roles=(Role.Name.TUTOR,))
    # Inserted out of name order: Libft sorts before get_next_line.
    gnl = Project.objects.create(slug="get_next_line", name="get_next_line")
    libft = Project.objects.create(slug="libft", name="Libft")
    own = make_request(tutor, [gnl, libft])

    api_client.force_authenticate(user=tutor)
    response = api_client.get(detail_url(own.id))

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body == expected_eligibility_request(own)
    assert [project["name"] for project in body["projects"]] == ["Libft", "get_next_line"]


def test_requester_sees_reviewed_request(api_client, make_user):
    tutor = make_user("tutor@example.com", display_name="Bob", roles=(Role.Name.TUTOR,))
    reviewer = make_user("head@example.com", display_name="Ada", roles=(Role.Name.HEAD_TUTOR,))
    libft = Project.objects.create(slug="libft", name="Libft")
    reviewed = make_request(
        tutor,
        [libft],
        status_value=TutorEligibilityRequest.Status.DECLINED,
        reviewed_by=reviewer,
        reviewed_at=datetime(2026, 10, 9, 10, 0, tzinfo=timezone.utc),
        review_note="Not yet.",
    )

    api_client.force_authenticate(user=tutor)
    response = api_client.get(detail_url(reviewed.id))

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == expected_eligibility_request(reviewed)


@pytest.mark.parametrize(
    "email,roles",
    [
        ("head@example.com", (Role.Name.HEAD_TUTOR,)),
        ("admin@example.com", (Role.Name.ADMIN,)),
    ],
)
def test_head_tutor_and_admin_see_another_users_request(api_client, make_user, email, roles):
    viewer = make_user(email, roles=roles)
    tutor = make_user("tutor@example.com", display_name="Bob", roles=(Role.Name.TUTOR,))
    libft = Project.objects.create(slug="libft", name="Libft")
    pending = make_request(tutor, [libft])

    api_client.force_authenticate(user=viewer)
    response = api_client.get(detail_url(pending.id))

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == expected_eligibility_request(pending)


@pytest.mark.parametrize(
    "email,roles",
    [
        ("other@example.com", (Role.Name.TUTOR,)),
        ("student@example.com", (Role.Name.STUDENT,)),
        ("council@example.com", (Role.Name.SC_MEMBER,)),
    ],
)
def test_hidden_request_returns_404(api_client, make_user, email, roles):
    viewer = make_user(email, roles=roles)
    tutor = make_user("tutor@example.com", display_name="Bob", roles=(Role.Name.TUTOR,))
    libft = Project.objects.create(slug="libft", name="Libft")
    pending = make_request(tutor, [libft])

    api_client.force_authenticate(user=viewer)
    response = api_client.get(detail_url(pending.id))

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json() == NOT_FOUND


def test_unknown_request_returns_404(api_client, make_user):
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))

    api_client.force_authenticate(user=head)
    response = api_client.get(detail_url(999999))

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json() == NOT_FOUND
