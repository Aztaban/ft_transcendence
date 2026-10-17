"""Permission/lifecycle coverage for Hitchhiker eligibility (#182, api-plan §7.2, §10.3)."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.evaluations.models import Project, TutorEligibility, TutorEligibilityRequest

pytestmark = pytest.mark.django_db

User = get_user_model()
LIST = "api:tutor-eligibility-requests-list"
REVIEW = "api:tutor-eligibility-requests-review"
ELIGIBILITY = "api:tutors-eligibility"


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


def test_lifecycle_approve_grants_eligibility(api_client, make_user):
    """create → HT approve → GET eligibility lists the projects; no further approval."""
    tutor = make_user("tutor@example.com", display_name="Bob", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    libft = Project.objects.create(slug="libft", name="Libft")
    zebra = Project.objects.create(slug="zebra_eval", name="Zebra")

    api_client.force_authenticate(user=tutor)
    created = api_client.post(
        reverse(LIST),
        {"project_ids": [libft.id, zebra.id]},
        format="json",
    )
    assert created.status_code == status.HTTP_201_CREATED
    request_id = created.json()["id"]
    assert created.json()["status"] == "pending"
    assert TutorEligibility.objects.filter(tutor=tutor).count() == 0

    api_client.force_authenticate(user=head)
    reviewed = api_client.post(
        reverse(REVIEW, kwargs={"request_id": request_id}),
        {"decision": "approved", "review_note": "welcome"},
        format="json",
    )
    assert reviewed.status_code == status.HTTP_200_OK
    assert reviewed.json()["status"] == "approved"
    assert reviewed.json()["reviewed_by"]["id"] == head.id

    api_client.force_authenticate(user=tutor)
    eligibility = api_client.get(reverse(ELIGIBILITY, kwargs={"user_id": tutor.id}))
    assert eligibility.status_code == status.HTTP_200_OK
    assert eligibility.json() == [
        {"id": libft.id, "slug": "libft", "name": "Libft"},
        {"id": zebra.id, "slug": "zebra_eval", "name": "Zebra"},
    ]


def test_lifecycle_decline_then_resubmit(api_client, make_user):
    """create → decline → no eligibility rows → tutor may submit a new request."""
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    libft = Project.objects.create(slug="libft", name="Libft")
    zebra = Project.objects.create(slug="zebra_eval", name="Zebra")

    api_client.force_authenticate(user=tutor)
    first = api_client.post(
        reverse(LIST),
        {"project_ids": [libft.id]},
        format="json",
    )
    assert first.status_code == status.HTTP_201_CREATED

    api_client.force_authenticate(user=head)
    declined = api_client.post(
        reverse(REVIEW, kwargs={"request_id": first.json()["id"]}),
        {"decision": "declined", "review_note": "not yet"},
        format="json",
    )
    assert declined.status_code == status.HTTP_200_OK
    assert declined.json()["status"] == "declined"
    assert TutorEligibility.objects.filter(tutor=tutor).count() == 0

    api_client.force_authenticate(user=tutor)
    second = api_client.post(
        reverse(LIST),
        {"project_ids": [zebra.id]},
        format="json",
    )
    assert second.status_code == status.HTTP_201_CREATED
    assert second.json()["status"] == "pending"
    assert second.json()["id"] != first.json()["id"]
    assert (
        TutorEligibilityRequest.objects.filter(
            requester=tutor,
            status=TutorEligibilityRequest.Status.PENDING,
        ).count()
        == 1
    )


def _validation_error(field_errors):
    return {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": field_errors,
        }
    }


@pytest.mark.parametrize(
    ("project_ids", "field_errors"),
    [
        (None, ["This field is required."]),
        ([], ["This list may not be empty."]),
        ([1, 1], ["Project ids must be distinct."]),
    ],
    ids=["missing", "empty", "duplicates"],
)
def test_create_rejects_invalid_project_ids_shape(api_client, make_user, project_ids, field_errors):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    Project.objects.create(slug="libft", name="Libft")

    body = {} if project_ids is None else {"project_ids": project_ids}
    api_client.force_authenticate(user=tutor)
    response = api_client.post(reverse(LIST), body, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == _validation_error({"project_ids": field_errors})
    assert TutorEligibilityRequest.objects.count() == 0


@pytest.mark.parametrize(
    "project_ids,messages",
    [
        (["abc"], ["A valid integer is required."]),
        ([None], ["This field may not be null."]),
        (
            ["abc", 0],
            ["A valid integer is required.", "Ensure this value is greater than or equal to 1."],
        ),
    ],
)
def test_create_rejects_malformed_project_ids(make_user, project_ids, messages):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    Project.objects.create(slug="libft", name="Libft")
    client = APIClient(enforce_csrf_checks=True)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    login = client.post(
        reverse("api:login"),
        {"email": tutor.email, "password": "secret"},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert login.status_code == status.HTTP_200_OK
    response = client.post(
        reverse(LIST),
        {"project_ids": project_ids},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {"project_ids": messages},
        }
    }
    assert TutorEligibilityRequest.objects.count() == 0
    assert TutorEligibility.objects.count() == 0


def test_create_rejects_unknown_or_inactive_project(api_client, make_user):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    active = Project.objects.create(slug="libft", name="Libft")
    inactive = Project.objects.create(slug="old_proj", name="Old", is_active=False)
    missing_ids = ", ".join(str(pk) for pk in sorted([inactive.id, 999999]))

    api_client.force_authenticate(user=tutor)
    response = api_client.post(
        reverse(LIST),
        {"project_ids": [active.id, inactive.id, 999999]},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == _validation_error(
        {"project_ids": [f"Unknown or inactive project id(s): {missing_ids}."]}
    )
    assert TutorEligibilityRequest.objects.count() == 0
    assert TutorEligibility.objects.count() == 0


def test_create_rejects_more_than_50_project_ids(api_client, make_user):
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))

    api_client.force_authenticate(user=tutor)
    response = api_client.post(
        reverse(LIST),
        {"project_ids": list(range(1, 52))},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == _validation_error({"project_ids": ["Select at most 50 projects."]})
    assert TutorEligibilityRequest.objects.count() == 0


def test_create_rejects_more_than_max_projects(api_client, make_user, settings):
    settings.ELIGIBILITY_REQUEST_MAX_PROJECTS = 2
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    projects = [Project.objects.create(slug=f"proj-{i}", name=f"Proj {i}") for i in range(3)]

    api_client.force_authenticate(user=tutor)
    response = api_client.post(
        reverse(LIST),
        {"project_ids": [p.id for p in projects]},
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == _validation_error({"project_ids": ["Select at most 2 projects."]})
    assert TutorEligibilityRequest.objects.count() == 0


def test_head_tutor_list_sees_pending_for_review_queue(api_client, make_user):
    """Permission slice for #175 backend: HT sees others' pending requests."""
    tutor = make_user("tutor@example.com", display_name="Bob", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    libft = Project.objects.create(slug="libft", name="Libft")
    pending = TutorEligibilityRequest.objects.create(requester=tutor)
    pending.projects.set([libft])

    api_client.force_authenticate(user=head)
    response = api_client.get(reverse(LIST), {"status": "pending"})

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["count"] == 1
    assert body["results"][0]["id"] == pending.id
    assert body["results"][0]["requester"]["display_name"] == "Bob"
    assert body["results"][0]["projects"] == [{"id": libft.id, "slug": "libft", "name": "Libft"}]
