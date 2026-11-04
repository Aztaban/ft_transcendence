"""record_audit stores a row and rolls it back with the caller's transaction."""

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction

from apps.accounts.models import Role
from apps.audit.models import AuditLog
from apps.audit.services import record_audit

pytestmark = pytest.mark.django_db


@pytest.fixture
def actor():
    Role.objects.get_or_create(name=Role.Name.STUDENT)
    return get_user_model().objects.create_user(email="actor@example.com", display_name="Admin")


def test_record_audit_stores_empty_reason_and_object_metadata(actor):
    entry = record_audit(
        actor=actor,
        action=AuditLog.Action.ROLE_ASSIGNED,
        target_type=AuditLog.TargetType.USER,
        target_id=42,
    )
    entry.refresh_from_db()

    assert entry.actor_id == actor.pk
    assert entry.action == "role.assigned"
    assert entry.target_type == "user"
    assert entry.target_id == 42
    assert entry.reason == ""
    assert entry.metadata == {}


def test_record_audit_keeps_a_reason_and_metadata(actor):
    entry = record_audit(
        actor=None,
        action="eligibility.revoked",
        target_type="tutor_eligibility",
        target_id=9,
        reason="no longer active",
        metadata={"project_id": 4},
    )
    entry.refresh_from_db()

    assert entry.actor_id is None
    assert entry.reason == "no longer active"
    assert entry.metadata == {"project_id": 4}


def test_record_audit_rejects_a_non_object_metadata_and_an_unknown_action(actor):
    with pytest.raises(ValidationError) as exc:
        record_audit(
            actor=actor,
            action=AuditLog.Action.ROLE_ASSIGNED,
            target_type=AuditLog.TargetType.USER,
            target_id=1,
            metadata=["tutor"],
        )
    assert set(exc.value.message_dict) == {"metadata"}
    assert AuditLog.objects.count() == 0

    with pytest.raises(ValidationError) as exc:
        record_audit(
            actor=actor,
            action="login",
            target_type=AuditLog.TargetType.USER,
            target_id=1,
        )
    assert set(exc.value.message_dict) == {"action"}
    assert AuditLog.objects.count() == 0


def test_record_audit_rolls_back_with_the_caller_transaction(actor):
    with pytest.raises(RuntimeError):
        with transaction.atomic():
            record_audit(
                actor=actor,
                action=AuditLog.Action.ROLE_ASSIGNED,
                target_type=AuditLog.TargetType.USER,
                target_id=42,
            )
            raise RuntimeError("action failed")

    assert AuditLog.objects.count() == 0
