"""The database itself rejects inconsistent rows (docs/database-schema.md §3, §4.1)."""

from datetime import datetime, timedelta, timezone

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError

from apps.evaluations.models import (
    EvaluationRequest,
    Project,
    TutorEligibility,
    TutorEligibilityRequest,
)

pytestmark = pytest.mark.django_db

START = datetime(2026, 10, 12, 15, 0, tzinfo=timezone.utc)
END = START + timedelta(minutes=45)
NOW = datetime(2026, 10, 10, 9, 0, tzinfo=timezone.utc)


@pytest.fixture
def people():
    User = get_user_model()
    student = User.objects.create_user(email="student@example.com", display_name="Student")
    tutor = User.objects.create_user(email="tutor@example.com", display_name="Tutor")
    return student, tutor


@pytest.fixture
def project():
    return Project.objects.create(slug="libft", name="Libft")


def assert_rejected(model, **fields):
    with pytest.raises(IntegrityError), transaction.atomic():
        model.objects.create(**fields)


def test_project_slug_is_unique(project):
    with pytest.raises(IntegrityError), transaction.atomic():
        Project.objects.create(slug="libft", name="Libft again")


def test_projects_are_listed_by_name():
    Project.objects.create(slug="push_swap", name="push_swap")
    Project.objects.create(slug="born2beroot", name="Born2beroot")

    assert [p.name for p in Project.objects.all()] == ["Born2beroot", "push_swap"]


@pytest.mark.parametrize(
    "extra",
    [
        {"status": "pending"},
        {"status": "awaiting_confirmation", "pick": True},
        {"status": "confirmed", "pick": True},
        {
            "status": "confirmed",
            "pick": True,
            "result": "passed",
            "feedback": "Clean code.",
            "completed_at": END,
        },
        {"status": "cancelled", "cancelled_at": NOW},
        {"status": "expired", "expired_at": NOW},
    ],
    ids=["pending", "awaiting", "confirmed", "confirmed_with_result", "cancelled", "expired"],
)
def test_consistent_requests_are_accepted(people, project, extra):
    student, tutor = people
    fields = dict(extra)
    if fields.pop("pick", False):
        fields.update(picked_by=tutor, starts_at=START, ends_at=END)

    EvaluationRequest.objects.create(student=student, project=project, **fields)

    assert EvaluationRequest.objects.count() == 1


@pytest.mark.parametrize(
    "fields",
    [
        # eval_req_pick_consistent: the three pick fields go together
        {"status": "awaiting_confirmation", "pick": True, "ends_at": None},
        # eval_req_pick_matches_status
        {"status": "pending", "pick": True},
        {"status": "awaiting_confirmation"},
        {"status": "confirmed"},
        {"status": "cancelled", "cancelled_at": NOW, "pick": True},
        # eval_req_slot_order
        {"status": "confirmed", "pick": True, "ends_at": START},
        # eval_req_cancel_consistent
        {"status": "cancelled"},
        {"status": "pending", "cancelled_at": NOW},
        # eval_req_expire_consistent
        {"status": "expired"},
        {"status": "pending", "expired_at": NOW},
        # eval_req_result_only_confirmed
        {"status": "pending", "result": "passed"},
        {"status": "awaiting_confirmation", "pick": True, "completed_at": END},
    ],
    ids=[
        "partial_pick",
        "pending_with_pick",
        "awaiting_without_pick",
        "confirmed_without_pick",
        "cancelled_keeps_pick",
        "ends_not_after_start",
        "cancelled_without_time",
        "cancel_time_on_pending",
        "expired_without_time",
        "expire_time_on_pending",
        "result_on_pending",
        "completed_before_confirmed",
    ],
)
def test_inconsistent_requests_are_rejected_by_the_database(people, project, fields):
    student, tutor = people
    fields = dict(fields)
    if fields.pop("pick", False):
        fields = {"picked_by": tutor, "starts_at": START, "ends_at": END, **fields}

    assert_rejected(EvaluationRequest, student=student, project=project, **fields)


def test_project_with_requests_cannot_be_deleted(people, project):
    EvaluationRequest.objects.create(student=people[0], project=project)

    with pytest.raises(ProtectedError):
        project.delete()


def test_eligibility_request_lists_each_project_once(people, project):
    request = TutorEligibilityRequest.objects.create(requester=people[1])
    request.projects.add(project)

    with pytest.raises(IntegrityError), transaction.atomic():
        TutorEligibilityRequest.projects.through.objects.create(request=request, project=project)


def test_project_listed_in_an_eligibility_request_cannot_be_deleted(people, project):
    request = TutorEligibilityRequest.objects.create(requester=people[1])
    request.projects.add(project)

    with pytest.raises(ProtectedError):
        project.delete()


def test_a_tutor_is_eligible_for_a_project_only_once(people, project):
    tutor = people[1]
    TutorEligibility.objects.create(tutor=tutor, project=project)

    assert_rejected(TutorEligibility, tutor=tutor, project=project)


@pytest.mark.parametrize(
    "fields",
    [
        {"status": "pending", "reviewed_at": NOW},
        {"status": "approved"},
        {"status": "declined"},
    ],
    ids=["pending_with_review_time", "approved_without_review_time", "declined_without_time"],
)
def test_eligibility_review_fields_follow_the_status(people, fields):
    assert_rejected(TutorEligibilityRequest, requester=people[1], **fields)
