"""Manual result entry is limited to ended, confirmed evaluations (api-plan §7.1)."""

from datetime import datetime, timedelta, timezone

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse

from apps.evaluations.models import EvaluationRequest, Project
from apps.notifications.models import Notification

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
    assert list(
        Notification.objects.order_by("recipient_id").values(
            "recipient_id", "type", "payload", "target_url", "read_at"
        )
    ) == [
        {
            "recipient_id": evaluation.student_id,
            "type": "evaluation.result_recorded",
            "payload": {
                "request_id": evaluation.pk,
                "project": {
                    "id": evaluation.project_id,
                    "slug": "admin-results",
                    "name": "Admin results",
                },
                "result": result,
            },
            "target_url": f"/evaluations/{evaluation.pk}",
            "read_at": None,
        },
        {
            "recipient_id": evaluation.picked_by_id,
            "type": "evaluation.result_recorded",
            "payload": {
                "request_id": evaluation.pk,
                "project": {
                    "id": evaluation.project_id,
                    "slug": "admin-results",
                    "name": "Admin results",
                },
                "result": result,
            },
            "target_url": f"/evaluations/{evaluation.pk}",
            "read_at": None,
        },
    ]


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
    assert not Notification.objects.exists()


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
    assert len(callbacks) == 3
    expected_events = [
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
    expected_events.extend(
        [
            call(
                f"user_{notification.recipient_id}",
                {
                    "type": "user.event",
                    "event": "notification.created",
                    "data": {"id": notification.pk},
                },
            )
            for notification in Notification.objects.order_by("recipient_id")
        ]
    )
    assert sender.await_args_list == expected_events


def test_stale_admin_saves_do_not_duplicate_result_notifications(evaluation):
    from types import SimpleNamespace

    from django.contrib import admin

    first = EvaluationRequest.objects.get(pk=evaluation.pk)
    stale = EvaluationRequest.objects.get(pk=evaluation.pk)
    first.result = "passed"
    stale.result = "passed"
    model_admin = admin.site._registry[EvaluationRequest]
    form = SimpleNamespace(changed_data=["result"])
    model_admin.save_model(None, first, form, change=True)
    model_admin.save_model(None, stale, form, change=True)
    assert Notification.objects.count() == 2
    assert set(Notification.objects.values_list("recipient_id", flat=True)) == {
        evaluation.student_id,
        evaluation.picked_by_id,
    }


def test_result_notification_failure_rolls_back_save_and_partial_notifications(
    browser, evaluation, monkeypatch, django_capture_on_commit_callbacks
):
    from apps.notifications.services import create_notification

    def fail_after_write(**kwargs):
        create_notification(**kwargs)
        raise RuntimeError("Notification failure")

    monkeypatch.setattr("apps.evaluations.notifications.create_notification", fail_after_write)
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        with pytest.raises(RuntimeError, match="Notification failure"):
            submit(browser, evaluation, result="passed")
    evaluation.refresh_from_db()
    assert evaluation.result is None
    assert not Notification.objects.exists()
    assert callbacks == []


def test_result_save_rolls_back_with_outer_transaction(
    browser, evaluation, django_capture_on_commit_callbacks
):
    from django.db import transaction

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        with transaction.atomic():
            response = submit(browser, evaluation, result="passed")
            assert response.status_code == 302
            assert Notification.objects.count() == 2
            transaction.set_rollback(True)
    evaluation.refresh_from_db()
    assert evaluation.result is None
    assert not Notification.objects.exists()
    assert callbacks == []
