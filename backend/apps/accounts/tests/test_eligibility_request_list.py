"""GET/POST /api/v1/tutor-eligibility-requests/ (api-plan §10.3, §8.9)."""

from datetime import datetime, timedelta, timezone

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone as dj_timezone
from rest_framework import status
from rest_framework.fields import DateTimeField
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.evaluations.models import Project, TutorEligibility, TutorEligibilityRequest

pytestmark = pytest.mark.django_db

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def make_user():
    def _make(email, display_name=None, roles=(), **extra):
        user = User.objects.create_user(
            email=email,
            password="secret",
            display_name=display_name or email.split("@")[0],
            **extra,
        )
        if roles:
            user.roles.set(Role.objects.filter(name__in=roles))
        return user

    return _make


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
    projects = sorted(request.projects.all(), key=lambda p: p.name)
    return {
        "id": request.id,
        "requester": user_ref(request.requester),
        "projects": [project_ref(p) for p in projects],
        "status": request.status,
        "reviewed_by": user_ref(request.reviewed_by) if request.reviewed_by_id else None,
        "reviewed_at": iso(request.reviewed_at) if request.reviewed_at else None,
        "review_note": request.review_note,
        "created_at": iso(request.created_at),
    }


def test_list_requires_authentication(api_client):
    response = api_client.get(reverse("api:tutor-eligibility-requests-list"))

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }


def test_tutor_sees_only_own_requests(api_client, make_user):
    tutor = make_user("tutor@example.com", display_name="Bob", roles=(Role.Name.TUTOR,))
    other = make_user("other@example.com", display_name="Other", roles=(Role.Name.TUTOR,))
    libft = Project.objects.create(slug="libft", name="Libft")
    gnl = Project.objects.create(slug="get_next_line", name="get_next_line")
    own = make_request(tutor, [gnl, libft])
    make_request(other, [libft])

    api_client.force_authenticate(user=tutor)
    response = api_client.get(reverse("api:tutor-eligibility-requests-list"))

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [expected_eligibility_request(own)],
    }


def test_head_tutor_sees_all_requests(api_client, make_user):
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    libft = Project.objects.create(slug="libft", name="Libft")
    base = datetime(2026, 10, 9, 8, 0, tzinfo=timezone.utc)

    requests = []
    for i in range(8):
        tutor = make_user(
            f"tutor{i}@example.com",
            display_name=f"Tutor{i}",
            roles=(Role.Name.TUTOR,),
        )
        request = make_request(tutor, [libft])
        TutorEligibilityRequest.objects.filter(pk=request.pk).update(
            created_at=base + timedelta(minutes=i)
        )
        request.refresh_from_db()
        requests.append(request)

    api_client.force_authenticate(user=head)
    response = api_client.get(reverse("api:tutor-eligibility-requests-list"))

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["count"] == 8
    assert body["next"] is None
    assert body["previous"] is None
    results = body["results"]
    assert len(results) == 8
    assert [item["id"] for item in results] == [req.id for req in requests]
    # Spot-check beginning, middle, and end of the ordered list.
    assert results[0] == expected_eligibility_request(requests[0])
    assert results[3] == expected_eligibility_request(requests[3])
    assert results[-1] == expected_eligibility_request(requests[7])


def test_filter_status_pending(api_client, make_user):
    tutor = make_user("tutor@example.com", display_name="Bob", roles=(Role.Name.TUTOR,))
    reviewer = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    libft = Project.objects.create(slug="libft", name="Libft")
    pending = make_request(tutor, [libft])
    make_request(
        tutor,
        [libft],
        status_value=TutorEligibilityRequest.Status.APPROVED,
        reviewed_by=reviewer,
        reviewed_at=datetime(2026, 10, 9, 10, 0, tzinfo=timezone.utc),
        review_note="ok",
    )

    api_client.force_authenticate(user=tutor)
    response = api_client.get(
        reverse("api:tutor-eligibility-requests-list"),
        {"status": "pending"},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [expected_eligibility_request(pending)],
    }


def test_unknown_status_returns_validation_error(api_client, make_user):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))

    api_client.force_authenticate(user=tutor)
    response = api_client.get(
        reverse("api:tutor-eligibility-requests-list"),
        {"status": "nope"},
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert "status" in body["error"]["fields"]


def test_ordering_newest_first(api_client, make_user):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    libft = Project.objects.create(slug="libft", name="Libft")
    older = make_request(tutor, [libft])
    TutorEligibilityRequest.objects.filter(pk=older.pk).update(
        created_at=dj_timezone.now() - timedelta(hours=1)
    )
    older.refresh_from_db()
    newer = make_request(tutor, [libft])

    api_client.force_authenticate(user=tutor)
    response = api_client.get(
        reverse("api:tutor-eligibility-requests-list"),
        {"ordering": "-created_at"},
    )

    assert response.status_code == status.HTTP_200_OK
    assert [item["id"] for item in response.json()["results"]] == [newer.id, older.id]


def test_invalid_ordering_returns_validation_error(api_client, make_user):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))

    api_client.force_authenticate(user=tutor)
    response = api_client.get(
        reverse("api:tutor-eligibility-requests-list"),
        {"ordering": "status"},
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert "ordering" in body["error"]["fields"]


# --- POST /tutor-eligibility-requests/ -------------------------------------------------


PASSWORD = "secret"
URL = "api:tutor-eligibility-requests-list"


def test_create_requires_authentication(api_client):
    response = api_client.post(reverse(URL), {"project_ids": [1]}, format="json")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }


def test_create_requires_hitchhiker_role(api_client, make_user):
    student = make_user("student@example.com", roles=(Role.Name.STUDENT,))
    project = Project.objects.create(slug="libft", name="Libft")

    api_client.force_authenticate(user=student)
    response = api_client.post(reverse(URL), {"project_ids": [project.id]}, format="json")

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["error"]["code"] == "permission_denied"


def test_create_returns_eligibility_request(api_client, make_user):
    tutor = make_user("tutor@example.com", display_name="Bob", roles=(Role.Name.TUTOR,))
    zebra = Project.objects.create(slug="zebra_eval", name="Zebra")
    libft = Project.objects.create(slug="libft", name="Libft")

    api_client.force_authenticate(user=tutor)
    response = api_client.post(
        reverse(URL),
        {"project_ids": [zebra.id, libft.id]},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    body = response.json()
    created = TutorEligibilityRequest.objects.get(pk=body["id"])
    assert body == expected_eligibility_request(created)
    assert body["status"] == "pending"
    assert body["projects"] == [project_ref(libft), project_ref(zebra)]
    assert body["requester"] == user_ref(tutor)


def test_head_tutor_can_submit_eligibility_request(api_client, make_user):
    head = make_user("head@example.com", display_name="Ada", roles=(Role.Name.HEAD_TUTOR,))
    libft = Project.objects.create(slug="libft", name="Libft")

    api_client.force_authenticate(user=head)
    response = api_client.post(reverse(URL), {"project_ids": [libft.id]}, format="json")

    assert response.status_code == status.HTTP_201_CREATED
    created = TutorEligibilityRequest.objects.get()
    assert response.json() == {
        "id": created.id,
        "requester": {"id": head.id, "display_name": "Ada", "avatar_url": None},
        "projects": [{"id": libft.id, "slug": "libft", "name": "Libft"}],
        "status": "pending",
        "reviewed_by": None,
        "reviewed_at": None,
        "review_note": "",
        "created_at": iso(created.created_at),
    }
    assert created.requester_id == head.id
    assert created.status == TutorEligibilityRequest.Status.PENDING


def test_create_rejects_already_eligible_projects(api_client, make_user):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    libft = Project.objects.create(slug="libft", name="Libft")
    TutorEligibility.objects.create(tutor=tutor, project=libft)

    api_client.force_authenticate(user=tutor)
    response = api_client.post(reverse(URL), {"project_ids": [libft.id]}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert "project_ids" in body["error"]["fields"]
    assert "Libft" in body["error"]["fields"]["project_ids"][0]


def test_create_rejects_when_pending_exists(api_client, make_user):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    libft = Project.objects.create(slug="libft", name="Libft")
    make_request(tutor, [libft])

    api_client.force_authenticate(user=tutor)
    response = api_client.post(reverse(URL), {"project_ids": [libft.id]}, format="json")

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {
        "error": {
            "code": "eligibility_request_pending",
            "message": "You already have a pending eligibility request.",
        }
    }


def test_create_through_session_needs_csrf(api_client, make_user):
    _ = api_client
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    project = Project.objects.create(slug="libft", name="Libft")
    browser = APIClient(enforce_csrf_checks=True)
    browser.get(reverse("api:session"), HTTP_HOST="localhost")
    login = browser.post(
        reverse("api:login"),
        {"email": tutor.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
    )
    assert login.status_code == status.HTTP_200_OK

    without = browser.post(
        reverse(URL),
        {"project_ids": [project.id]},
        format="json",
        HTTP_HOST="localhost",
    )
    with_token = browser.post(
        reverse(URL),
        {"project_ids": [project.id]},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
    )

    assert without.status_code == status.HTTP_403_FORBIDDEN
    assert without.json()["error"]["code"] == "csrf_failed"
    assert with_token.status_code == status.HTTP_201_CREATED
