"""Manual result entry is limited to ended, confirmed evaluations (api-plan §7.1)."""

from datetime import datetime, timedelta, timezone

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse

from apps.evaluations.models import EvaluationRequest, Project

pytestmark = pytest.mark.django_db
NOW = datetime(2026, 10, 17, 12, tzinfo=timezone.utc)
ERROR = "Results can only be entered for confirmed evaluations whose end time has passed."


@pytest.fixture
def evaluation(monkeypatch):
    monkeypatch.setattr("django.utils.timezone.now", lambda: NOW)
    user = get_user_model().objects.create_user(email="student@example.com", display_name="Student")
    tutor = get_user_model().objects.create_user(email="tutor@example.com", display_name="Tutor")
    project = Project.objects.create(slug="admin-results", name="Admin results")
    return EvaluationRequest.objects.create(
        student=user,
        project=project,
        status="confirmed",
        picked_by=tutor,
        starts_at=NOW - timedelta(hours=2),
        ends_at=NOW - timedelta(hours=1),
    )


@pytest.fixture
def browser():
    get_user_model().objects.create_superuser(
        email="staff@example.com", password="AdminResultPassword123!", display_name="Staff"
    )
    client = Client(enforce_csrf_checks=True)
    login_url = reverse("admin:login")
    client.get(login_url)
    response = client.post(
        login_url,
        {"username": "staff@example.com", "password": "AdminResultPassword123!"},
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 302
    return client


def submit(browser, evaluation, **overrides):
    url = reverse("admin:evaluations_evaluationrequest_change", args=[evaluation.pk])
    response = browser.get(url)
    assert response.status_code == 200
    payload = {
        "result": "",
        "feedback": "",
        "completed_at_0": "",
        "completed_at_1": "",
        "_save": "Save",
    }
    payload.update(overrides)
    return browser.post(url, payload, HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value)


@pytest.mark.parametrize("field", ["result", "feedback", "completed_at"])
@pytest.mark.parametrize(
    "state,end_delta",
    [
        ("pending", None),
        ("awaiting_confirmation", -60),
        ("cancelled", -60),
        ("expired", None),
        ("confirmed", 60),
        ("confirmed", 0),
    ],
    ids=["pending", "awaiting", "cancelled", "expired", "confirmed_future", "end_boundary"],
)
def test_admin_rejects_result_fields_before_completion(
    browser, evaluation, field, state, end_delta
):
    evaluation.status = state
    if end_delta is None:
        evaluation.picked_by = None
        evaluation.starts_at = None
        evaluation.ends_at = None
    else:
        evaluation.ends_at = NOW + timedelta(minutes=end_delta)
        evaluation.starts_at = evaluation.ends_at - timedelta(minutes=45)
    if state == "cancelled":
        evaluation.cancelled_at = NOW
    if state == "expired":
        evaluation.expired_at = NOW
    evaluation.save()
    payload = {
        "result": {"result": "passed"},
        "feedback": {"feedback": "Clean code."},
        "completed_at": {"completed_at_0": "2026-10-17", "completed_at_1": "12:00:00"},
    }[field]

    response = submit(browser, evaluation, **payload)

    assert response.status_code == 200
    assert response.context["adminform"].form.errors == {field: [ERROR]}
    evaluation.refresh_from_db()
    assert (evaluation.result, evaluation.feedback, evaluation.completed_at) == (None, "", None)
    assert evaluation.status == state


@pytest.mark.parametrize("result", ["passed", "failed"])
def test_admin_saves_results_after_confirmed_evaluation(browser, evaluation, result):
    response = submit(
        browser,
        evaluation,
        result=result,
        feedback="Clean code.",
        completed_at_0="2026-10-17",
        completed_at_1="12:00:00",
    )

    assert response.status_code == 302
    evaluation.refresh_from_db()
    assert (evaluation.result, evaluation.feedback, evaluation.completed_at) == (
        result,
        "Clean code.",
        NOW,
    )
    assert evaluation.status == "confirmed"
    assert evaluation.starts_at == NOW - timedelta(hours=2)
    assert evaluation.ends_at == NOW - timedelta(hours=1)


@pytest.mark.parametrize("field", ["feedback", "completed_at"])
def test_admin_does_not_require_a_result_when_recording_other_fields(browser, evaluation, field):
    payload = (
        {"feedback": "Clean code."}
        if field == "feedback"
        else {
            "completed_at_0": "2026-10-17",
            "completed_at_1": "12:00:00",
        }
    )
    response = submit(browser, evaluation, **payload)

    assert response.status_code == 302
    evaluation.refresh_from_db()
    assert evaluation.result is None
    assert evaluation.feedback == ("Clean code." if field == "feedback" else "")
    assert evaluation.completed_at == (NOW if field == "completed_at" else None)


def test_admin_rejects_all_populated_fields_and_ignores_forged_lifecycle_fields(
    browser, evaluation
):
    evaluation.status = "awaiting_confirmation"
    evaluation.save()

    response = submit(
        browser,
        evaluation,
        result="passed",
        feedback="Clean code.",
        completed_at_0="2026-10-17",
        completed_at_1="12:00:00",
        status="confirmed",
        ends_at_0="2026-10-16",
        ends_at_1="12:00:00",
    )

    assert response.status_code == 200
    assert response.context["adminform"].form.errors == {
        "result": [ERROR],
        "feedback": [ERROR],
        "completed_at": [ERROR],
    }
    evaluation.refresh_from_db()
    assert evaluation.status == "awaiting_confirmation"
    assert (evaluation.result, evaluation.feedback, evaluation.completed_at) == (None, "", None)


def test_admin_accepts_blank_result_fields_for_unfinished_evaluation(browser, evaluation):
    evaluation.ends_at = NOW + timedelta(hours=1)
    evaluation.save()

    response = submit(browser, evaluation)

    assert response.status_code == 302
    evaluation.refresh_from_db()
    assert (evaluation.result, evaluation.feedback, evaluation.completed_at) == (None, "", None)


def test_admin_can_correct_or_clear_existing_results(browser, evaluation):
    evaluation.result = "passed"
    evaluation.feedback = "Old feedback"
    evaluation.completed_at = NOW
    evaluation.save()

    corrected = submit(browser, evaluation, result="failed", feedback="Corrected feedback")
    assert corrected.status_code == 302
    evaluation.refresh_from_db()
    assert (evaluation.result, evaluation.feedback, evaluation.completed_at) == (
        "failed",
        "Corrected feedback",
        None,
    )
    cleared = submit(browser, evaluation)
    assert cleared.status_code == 302
    evaluation.refresh_from_db()
    assert (evaluation.result, evaluation.feedback, evaluation.completed_at) == (None, "", None)


def test_admin_result_update_publishes_after_commit(
    browser, evaluation, monkeypatch, django_capture_on_commit_callbacks
):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock, call

    sender = AsyncMock()
    monkeypatch.setattr(
        "apps.core.events.get_channel_layer", lambda: SimpleNamespace(group_send=sender)
    )
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = submit(browser, evaluation, result="passed")
        assert response.status_code == 302
        sender.assert_not_awaited()
    assert len(callbacks) == 1
    assert sender.await_args_list == [
        call(
            f"user_{user_id}",
            {
                "type": "user.event",
                "event": "evaluation.updated",
                "data": {"id": evaluation.pk, "status": "confirmed"},
            },
        )
        for user_id in sorted((evaluation.student_id, evaluation.picked_by_id))
    ]
