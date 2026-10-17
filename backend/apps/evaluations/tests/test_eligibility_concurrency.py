"""MySQL eligibility races and approval atomicity (api-plan §10.3, schema §3.2–3.4)."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from threading import Barrier

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, close_old_connections, connection, connections
from django.db.models.query import QuerySet
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.evaluations.models import Project, TutorEligibility, TutorEligibilityRequest

pytestmark = pytest.mark.django_db(transaction=True)
NOW = datetime(2026, 10, 17, 12, tzinfo=timezone.utc)
PASSWORD = "EligibilityPassword123!"


@pytest.fixture
def actors(monkeypatch, empty_project_catalog):
    assert connection.vendor == "mysql", "These tests require real MySQL row locking."
    monkeypatch.setattr("django.utils.timezone.now", lambda: NOW)
    for name in Role.Name.values:
        Role.objects.get_or_create(name=name)
    users = []
    for pk, name, role in (
        (701, "Tutor", Role.Name.TUTOR),
        (702, "Head", Role.Name.HEAD_TUTOR),
        (703, "Admin", Role.Name.ADMIN),
    ):
        user = get_user_model().objects.create_user(
            id=pk, email=f"{name.lower()}@example.com", display_name=name, password=PASSWORD
        )
        user.roles.add(Role.objects.get(name=role))
        users.append(user)
    Project.objects.create(id=801, slug="libft", name="Libft")
    Project.objects.create(id=802, slug="minishell", name="Minishell")
    return users


def browser_for(user):
    browser = APIClient(enforce_csrf_checks=True)
    browser.get(reverse("api:session"), HTTP_HOST="localhost")
    response = browser.post(
        reverse("api:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    return browser


def compete(browsers, url, bodies):
    """Each worker owns its browser and database connection; propagate thread failures."""

    def submit(args):
        browser, body = args
        close_old_connections()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT CONNECTION_ID()")
                connection_id = cursor.fetchone()[0]
            response = browser.post(
                url,
                body,
                format="json",
                HTTP_HOST="localhost",
                HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
            )
            return response, connection_id
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(submit, zip(browsers, bodies, strict=True)))
    assert len({connection_id for _, connection_id in results}) == 2
    return [response for response, _ in results]


def test_competing_submissions_create_only_one_pending_request(actors, monkeypatch):
    tutor, _, _ = actors
    browsers = [browser_for(tutor), browser_for(tutor)]
    barrier = Barrier(2)
    original_get = QuerySet.get

    def get_after_both_reach_requester_lock(queryset, *args, **kwargs):
        if queryset.model is get_user_model() and queryset.query.select_for_update:
            # Rendezvous before acquiring the lock: waiting after acquisition deadlocks.
            barrier.wait(timeout=10)
        return original_get(queryset, *args, **kwargs)

    monkeypatch.setattr(QuerySet, "get", get_after_both_reach_requester_lock)
    responses = compete(
        browsers,
        reverse("api:tutor-eligibility-requests-list"),
        [{"project_ids": [801, 802]}, {"project_ids": [801, 802]}],
    )

    assert sorted(response.status_code for response in responses) == [201, 409]
    winner = next(response for response in responses if response.status_code == 201)
    loser = next(response for response in responses if response.status_code == 409)
    pending = TutorEligibilityRequest.objects.get(requester=tutor)
    assert winner.json() == {
        "id": pending.id,
        "requester": {"id": 701, "display_name": "Tutor", "avatar_url": None},
        "projects": [
            {"id": 801, "slug": "libft", "name": "Libft"},
            {"id": 802, "slug": "minishell", "name": "Minishell"},
        ],
        "status": "pending",
        "reviewed_by": None,
        "reviewed_at": None,
        "review_note": "",
        "created_at": "2026-10-17T12:00:00Z",
    }
    assert loser.json() == {
        "error": {
            "code": "eligibility_request_pending",
            "message": "You already have a pending eligibility request.",
        }
    }
    assert TutorEligibilityRequest.objects.count() == 1
    assert pending.status == "pending"
    assert list(pending.projects.order_by("id").values_list("id", flat=True)) == [801, 802]
    assert TutorEligibilityRequest.projects.through.objects.count() == 2
    assert TutorEligibility.objects.count() == 0


@pytest.mark.parametrize(
    "decisions", [("approved", "approved"), ("approved", "declined"), ("declined", "declined")]
)
def test_competing_reviews_have_one_winner_and_consistent_grants(actors, monkeypatch, decisions):
    tutor, head, admin = actors
    pending = TutorEligibilityRequest.objects.create(requester=tutor)
    pending.projects.set([801, 802])
    # Existing eligibility is retained without changing its provenance (schema §3.4).
    existing = TutorEligibility.objects.create(tutor=tutor, project_id=801)
    browsers = [browser_for(head), browser_for(admin)]
    barrier = Barrier(2)
    original_update = QuerySet.update

    def update_after_both_reviewers_reach_claim(queryset, **kwargs):
        if queryset.model is TutorEligibilityRequest:
            barrier.wait(timeout=10)
        return original_update(queryset, **kwargs)

    monkeypatch.setattr(QuerySet, "update", update_after_both_reviewers_reach_claim)
    responses = compete(
        browsers,
        reverse("api:tutor-eligibility-requests-review", kwargs={"request_id": pending.id}),
        [
            {"decision": decisions[0], "review_note": "Head decision"},
            {"decision": decisions[1], "review_note": "Admin decision"},
        ],
    )

    assert sorted(response.status_code for response in responses) == [200, 409]
    winner_index = next(i for i, response in enumerate(responses) if response.status_code == 200)
    reviewer = [head, admin][winner_index]
    decision = decisions[winner_index]
    note = ["Head decision", "Admin decision"][winner_index]
    assert responses[winner_index].json() == {
        "id": pending.id,
        "requester": {"id": 701, "display_name": "Tutor", "avatar_url": None},
        "projects": [
            {"id": 801, "slug": "libft", "name": "Libft"},
            {"id": 802, "slug": "minishell", "name": "Minishell"},
        ],
        "status": decision,
        "reviewed_by": {
            "id": reviewer.id,
            "display_name": reviewer.display_name,
            "avatar_url": None,
        },
        "reviewed_at": "2026-10-17T12:00:00Z",
        "review_note": note,
        "created_at": "2026-10-17T12:00:00Z",
    }
    assert responses[1 - winner_index].json() == {
        "error": {
            "code": "eligibility_request_already_reviewed",
            "message": "This eligibility request has already been reviewed.",
        }
    }
    pending.refresh_from_db()
    assert (pending.status, pending.reviewed_by_id, pending.review_note, pending.reviewed_at) == (
        decision,
        reviewer.id,
        note,
        NOW,
    )
    existing.refresh_from_db()
    assert existing.granted_by_request_id is None
    grants = list(
        TutorEligibility.objects.order_by("project_id").values_list(
            "tutor_id", "project_id", "granted_by_request_id"
        )
    )
    if decision == "approved":
        assert grants == [(701, 801, None), (701, 802, pending.id)]
    else:
        assert grants == [(701, 801, None)]


def test_failed_grant_creation_rolls_back_review_and_partial_grants(actors, monkeypatch):
    tutor, head, _ = actors
    pending = TutorEligibilityRequest.objects.create(requester=tutor)
    pending.projects.set([801, 802])
    browser = browser_for(head)
    original_bulk_create = QuerySet.bulk_create
    partial_writes = []

    def fail_after_first_grant(queryset, objs, **kwargs):
        if queryset.model is TutorEligibility:
            original_bulk_create(queryset, objs[:1], **kwargs)
            partial_writes.append(
                (
                    TutorEligibility.objects.filter(granted_by_request=pending).count(),
                    TutorEligibilityRequest.objects.get(pk=pending.id).status,
                )
            )
            raise IntegrityError("Injected failure after a partial grant write")
        return original_bulk_create(queryset, objs, **kwargs)

    with monkeypatch.context() as patch:
        patch.setattr(QuerySet, "bulk_create", fail_after_first_grant)
        response = browser.post(
            reverse("api:tutor-eligibility-requests-review", kwargs={"request_id": pending.id}),
            {"decision": "approved", "review_note": "Approve both"},
            format="json",
            HTTP_HOST="localhost",
            HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
        )
    # Assert outside the view: its exception handler also catches AssertionError.
    assert partial_writes == [(1, "approved")]
    assert response.status_code == 500
    assert response.json() == {
        "error": {"code": "server_error", "message": "Something went wrong. Please try again."}
    }
    pending.refresh_from_db()
    assert (pending.status, pending.reviewed_by_id, pending.reviewed_at, pending.review_note) == (
        "pending",
        None,
        None,
        "",
    )
    assert TutorEligibility.objects.count() == 0
    assert list(pending.projects.order_by("id").values_list("id", flat=True)) == [801, 802]

    # The rolled-back request remains reviewable and grants both projects on retry.
    retried = browser.post(
        reverse("api:tutor-eligibility-requests-review", kwargs={"request_id": pending.id}),
        {"decision": "approved"},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
    )
    assert retried.status_code == 200
    pending.refresh_from_db()
    assert pending.status == "approved"
    assert list(
        TutorEligibility.objects.order_by("project_id").values_list(
            "tutor_id", "project_id", "granted_by_request_id"
        )
    ) == [(701, 801, pending.id), (701, 802, pending.id)]
