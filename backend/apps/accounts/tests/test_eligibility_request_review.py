"""POST /api/v1/tutor-eligibility-requests/{id}/review/ (api-plan §10.3, #176/#177)."""

from datetime import datetime, timezone

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.fields import DateTimeField
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.evaluations.models import Project, TutorEligibility, TutorEligibilityRequest

pytestmark = pytest.mark.django_db

User = get_user_model()
PASSWORD = "secret"
REVIEW = "api:tutor-eligibility-requests-review"

# Reviewers allowed by api-plan §10.3 (several users on the lucky path).
REVIEWERS = (Role.Name.HEAD_TUTOR, Role.Name.ADMIN)
# Authenticated callers who must not review.
FORBIDDEN_REVIEWERS = (Role.Name.STUDENT, Role.Name.TUTOR)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def make_user():
    def _make(email, display_name=None, roles=(), **extra):
        user = User.objects.create_user(
            email=email,
            password=PASSWORD,
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


def make_pending(requester, projects):
    request = TutorEligibilityRequest.objects.create(requester=requester)
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


def review_url(request_id):
    return reverse(REVIEW, kwargs={"request_id": request_id})


def test_review_requires_authentication(api_client, make_user):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    project = Project.objects.create(slug="libft", name="Libft")
    pending = make_pending(tutor, [project])

    response = api_client.post(
        review_url(pending.id),
        {"decision": "approved"},
        format="json",
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }


@pytest.mark.parametrize("actor_role", FORBIDDEN_REVIEWERS)
def test_review_forbidden_for_non_reviewers(api_client, make_user, actor_role):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    actor = make_user(f"actor-{actor_role}@example.com", roles=(actor_role,))
    project = Project.objects.create(slug="libft", name="Libft")
    pending = make_pending(tutor, [project])

    api_client.force_authenticate(user=actor)
    response = api_client.post(
        review_url(pending.id),
        {"decision": "approved"},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["error"]["code"] == "permission_denied"


@pytest.mark.parametrize("reviewer_role", REVIEWERS)
def test_cannot_review_own_request(api_client, make_user, reviewer_role):
    reviewer = make_user(f"self-{reviewer_role}@example.com", roles=(reviewer_role,))
    project = Project.objects.create(slug="libft", name="Libft")
    pending = make_pending(reviewer, [project])

    api_client.force_authenticate(user=reviewer)
    response = api_client.post(
        review_url(pending.id),
        {"decision": "approved"},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json()["error"]["code"] == "cannot_review_own_request"


def test_review_unknown_request_returns_404(api_client, make_user):
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))

    api_client.force_authenticate(user=head)
    response = api_client.post(
        review_url(999999),
        {"decision": "approved"},
        format="json",
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json()["error"]["code"] == "not_found"


@pytest.mark.parametrize("decision", [None, "", "invalid", "pending", "a" * 32])
def test_review_rejects_invalid_decision(api_client, make_user, decision):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    project = Project.objects.create(slug="libft", name="Libft")
    pending = make_pending(tutor, [project])

    body = {"review_note": "x"}
    if decision is not None:
        body["decision"] = decision

    api_client.force_authenticate(user=head)
    response = api_client.post(review_url(pending.id), body, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert "decision" in error["fields"]
    pending.refresh_from_db()
    assert pending.status == TutorEligibilityRequest.Status.PENDING


@pytest.mark.parametrize("reviewer_role", REVIEWERS)
def test_approve_creates_eligibility_rows(api_client, make_user, reviewer_role):
    """Lucky path #176: Head Tutor or Admin approves → eligibility rows exist."""
    tutor = make_user("tutor@example.com", display_name="Bob", roles=(Role.Name.TUTOR,))
    reviewer = make_user(
        f"reviewer-{reviewer_role}@example.com",
        display_name=reviewer_role,
        roles=(reviewer_role,),
    )
    zebra = Project.objects.create(slug="zebra_eval", name="Zebra")
    libft = Project.objects.create(slug="libft", name="Libft")
    pending = make_pending(tutor, [zebra, libft])

    api_client.force_authenticate(user=reviewer)
    response = api_client.post(
        review_url(pending.id),
        {"decision": "approved", "review_note": "ok"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    pending.refresh_from_db()
    assert response.json() == expected_eligibility_request(pending)
    assert pending.status == TutorEligibilityRequest.Status.APPROVED
    assert pending.reviewed_by_id == reviewer.id
    assert pending.review_note == "ok"
    rows = list(
        TutorEligibility.objects.filter(tutor=tutor)
        .select_related("project")
        .order_by("project__name")
    )
    assert [row.project_id for row in rows] == [libft.id, zebra.id]
    assert all(row.granted_by_request_id == pending.id for row in rows)


@pytest.mark.parametrize("reviewer_role", REVIEWERS)
def test_decline_does_not_create_eligibility_rows(api_client, make_user, reviewer_role):
    """Lucky path #177: Head Tutor or Admin declines → no eligibility rows."""
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    reviewer = make_user(f"reviewer-{reviewer_role}@example.com", roles=(reviewer_role,))
    libft = Project.objects.create(slug="libft", name="Libft")
    pending = make_pending(tutor, [libft])

    api_client.force_authenticate(user=reviewer)
    response = api_client.post(
        review_url(pending.id),
        {"decision": "declined", "review_note": "not yet"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    pending.refresh_from_db()
    assert response.json() == expected_eligibility_request(pending)
    assert pending.status == TutorEligibilityRequest.Status.DECLINED
    assert pending.reviewed_by_id == reviewer.id
    assert TutorEligibility.objects.filter(tutor=tutor).count() == 0


@pytest.mark.parametrize(
    "prior_status",
    [
        TutorEligibilityRequest.Status.APPROVED,
        TutorEligibilityRequest.Status.DECLINED,
    ],
)
def test_already_reviewed_returns_409(api_client, make_user, prior_status):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    admin = make_user("admin@example.com", roles=(Role.Name.ADMIN,))
    libft = Project.objects.create(slug="libft", name="Libft")
    reviewed = TutorEligibilityRequest.objects.create(
        requester=tutor,
        status=prior_status,
        reviewed_by=head,
        reviewed_at=datetime(2026, 10, 9, 10, 0, tzinfo=timezone.utc),
        review_note="done",
    )
    reviewed.projects.set([libft])

    api_client.force_authenticate(user=admin)
    response = api_client.post(
        review_url(reviewed.id),
        {"decision": "declined"},
        format="json",
    )

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {
        "error": {
            "code": "eligibility_request_already_reviewed",
            "message": "This eligibility request has already been reviewed.",
        }
    }


def test_review_through_session_needs_csrf(api_client, make_user):
    _ = api_client
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    project = Project.objects.create(slug="libft", name="Libft")
    pending = make_pending(tutor, [project])

    browser = APIClient(enforce_csrf_checks=True)
    browser.get(reverse("api:session"), HTTP_HOST="localhost")
    login = browser.post(
        reverse("api:login"),
        {"email": head.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
    )
    assert login.status_code == status.HTTP_200_OK

    without = browser.post(
        review_url(pending.id),
        {"decision": "approved"},
        format="json",
        HTTP_HOST="localhost",
    )
    with_token = browser.post(
        review_url(pending.id),
        {"decision": "approved"},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
    )

    assert without.status_code == status.HTTP_403_FORBIDDEN
    assert without.json()["error"]["code"] == "csrf_failed"
    assert with_token.status_code == status.HTTP_200_OK
