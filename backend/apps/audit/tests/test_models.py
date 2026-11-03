"""Audit log persistence: append-only rows and the schema §8.1 indexes."""

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, transaction

from apps.accounts.models import Role
from apps.audit.models import AuditLog

pytestmark = pytest.mark.django_db


@pytest.fixture
def actor():
    Role.objects.get_or_create(name=Role.Name.STUDENT)
    return get_user_model().objects.create_user(email="actor@example.com", display_name="Admin")


def _entry(actor, **overrides):
    fields = {
        "actor": actor,
        "action": AuditLog.Action.ROLE_ASSIGNED,
        "target_type": AuditLog.TargetType.USER,
        "target_id": 42,
        "metadata": {"role": "tutor"},
    }
    fields.update(overrides)
    return AuditLog.objects.create(**fields)


def test_audit_log_round_trips_columns_and_defaults(actor):
    entry = _entry(actor)
    entry.refresh_from_db()

    assert entry.actor == actor
    assert entry.action == "role.assigned"
    assert entry.target_type == "user"
    assert entry.target_id == 42
    assert entry.reason == ""
    assert entry.metadata == {"role": "tutor"}
    assert entry.created_at is not None
    assert entry.updated_at is not None
    assert actor.audit_logs.get() == entry


def test_audit_log_actor_may_be_null():
    entry = AuditLog.objects.create(
        actor=None,
        action=AuditLog.Action.USER_DELETED,
        target_type=AuditLog.TargetType.USER,
        target_id=7,
    )
    entry.refresh_from_db()

    assert entry.actor_id is None
    assert entry.reason == ""
    assert entry.metadata == {}


def test_full_clean_rejects_action_and_target_type_outside_the_contract(actor):
    unknown_action = AuditLog(
        actor=actor,
        action="login",
        target_type=AuditLog.TargetType.USER,
        target_id=1,
    )
    with pytest.raises(ValidationError) as exc:
        unknown_action.full_clean()
    assert set(exc.value.message_dict) == {"action"}

    unknown_target = AuditLog(
        actor=actor,
        action=AuditLog.Action.ROLE_ASSIGNED,
        target_type="session",
        target_id=1,
    )
    with pytest.raises(ValidationError) as exc:
        unknown_target.full_clean()
    assert set(exc.value.message_dict) == {"target_type"}


def test_rows_cannot_be_updated_or_deleted(actor):
    entry = _entry(actor)
    entry.reason = "changed"

    with pytest.raises(ValidationError):
        entry.save()
    entry.refresh_from_db()
    assert entry.reason == ""

    with pytest.raises(ValidationError):
        entry.delete()
    with pytest.raises(ValidationError):
        AuditLog.objects.filter(pk=entry.pk).delete()
    with pytest.raises(ValidationError):
        AuditLog.objects.filter(pk=entry.pk).update(reason="changed")

    entry.refresh_from_db()
    assert entry.reason == ""
    assert AuditLog.objects.filter(pk=entry.pk).exists()


def test_queryset_update_cannot_clear_the_actor_while_the_user_exists(actor):
    entry = _entry(actor)

    with pytest.raises(ValidationError):
        AuditLog.objects.all().update(actor=None)

    entry.refresh_from_db()
    assert entry.actor_id == actor.pk


def test_bulk_update_cannot_change_an_existing_row(actor):
    entry = _entry(actor)
    entry.reason = "rewritten"

    with pytest.raises(ValidationError):
        AuditLog.objects.bulk_update([entry], ["reason"])

    entry.refresh_from_db()
    assert entry.reason == ""


def test_bulk_create_inserts_a_new_row(actor):
    created = AuditLog.objects.bulk_create(
        [
            AuditLog(
                actor=actor,
                action=AuditLog.Action.ROLE_ASSIGNED,
                target_type=AuditLog.TargetType.USER,
                target_id=42,
            )
        ]
    )

    assert len(created) == 1
    stored = AuditLog.objects.get()
    assert stored.actor_id == actor.pk
    assert stored.action == "role.assigned"
    assert stored.target_id == 42
    assert stored.reason == ""
    assert stored.metadata == {}


def test_bulk_create_update_conflicts_cannot_change_an_existing_row(actor):
    entry = _entry(actor)
    replacement = AuditLog(
        pk=entry.pk,
        actor=actor,
        action=AuditLog.Action.ROLE_ASSIGNED,
        target_type=AuditLog.TargetType.USER,
        target_id=actor.pk,
        reason="rewritten",
    )

    with pytest.raises(ValidationError):
        AuditLog.objects.bulk_create(
            [replacement],
            update_conflicts=True,
            update_fields=["reason"],
        )

    entry.refresh_from_db()
    assert entry.reason == ""


def test_deleting_the_actor_keeps_the_row_and_clears_the_actor(actor):
    entry = _entry(actor, target_id=actor.pk)

    actor.delete()

    entry.refresh_from_db()
    assert entry.actor_id is None
    assert entry.action == "role.assigned"
    assert list(AuditLog.objects.values_list("pk", flat=True)) == [entry.pk]


def test_database_has_the_schema_indexes():
    with connection.cursor() as cursor:
        constraints = connection.introspection.get_constraints(cursor, "audit_log")

    assert constraints["audit_log_target_idx"]["index"] is True
    assert constraints["audit_log_target_idx"]["columns"] == ["target_type", "target_id"]
    assert constraints["audit_log_actor_created_idx"]["columns"] == ["actor_id", "created_at"]
    assert constraints["audit_log_action_created_idx"]["columns"] == ["action", "created_at"]


def test_fresh_instance_cannot_update_existing_row(actor):
    entry = _entry(actor)

    replacement = AuditLog(
        pk=entry.pk,
        reason="rewritten",
    )

    with pytest.raises(ValidationError):
        replacement.save(update_fields=["reason"])

    entry.refresh_from_db()
    assert entry.reason == ""


def test_fresh_instance_cannot_overwrite_existing_pk(actor):
    entry = _entry(actor)

    replacement = AuditLog(
        pk=entry.pk,
        actor=actor,
        action=AuditLog.Action.ROLE_ASSIGNED,
        target_type=AuditLog.TargetType.USER,
        target_id=actor.pk,
        reason="rewritten",
    )

    with pytest.raises(IntegrityError), transaction.atomic():
        replacement.save()

    entry.refresh_from_db()
    assert entry.reason == ""
