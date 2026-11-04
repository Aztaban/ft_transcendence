"""Append-only audit log (schema §8.1)."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class AuditLogQuerySet(models.QuerySet):
    """Rows are never updated or deleted."""

    def update(self, **kwargs):
        # User deletion still nulls actor_id. Django's collector writes SET NULL
        # through UpdateQuery, not QuerySet.update() (schema §8.1).
        raise ValidationError(_("Audit log rows cannot be updated."))

    def bulk_update(self, objs, fields, batch_size=None):
        # Django 5.1 reaches QuerySet.update() from here. Reject this entry
        # point itself so a later Django that writes the SQL directly still cannot.
        raise ValidationError(_("Audit log rows cannot be updated."))

    def bulk_create(
        self,
        objs,
        batch_size=None,
        ignore_conflicts=False,
        update_conflicts=False,
        update_fields=None,
        unique_fields=None,
    ):
        # MySQL applies update_conflicts as ON DUPLICATE KEY UPDATE, which does
        # not pass through QuerySet.update().
        if update_conflicts:
            raise ValidationError(_("Audit log rows cannot be updated."))
        return super().bulk_create(
            objs,
            batch_size=batch_size,
            ignore_conflicts=ignore_conflicts,
            update_conflicts=update_conflicts,
            update_fields=update_fields,
            unique_fields=unique_fields,
        )

    def delete(self):
        raise ValidationError(_("Audit log rows cannot be deleted."))


class AuditLog(TimeStampedModel):
    """One sensitive action. The application inserts rows and never changes them."""

    class Action(models.TextChoices):
        ROLE_ASSIGNED = "role.assigned", _("Role assigned")
        ROLE_REVOKED = "role.revoked", _("Role revoked")
        USER_UPDATED = "user.updated", _("User updated")
        USER_SUSPENDED = "user.suspended", _("User suspended")
        USER_REACTIVATED = "user.reactivated", _("User reactivated")
        USER_DELETED = "user.deleted", _("User deleted")
        ELIGIBILITY_REVIEWED = "eligibility.reviewed", _("Eligibility reviewed")
        ELIGIBILITY_REVOKED = "eligibility.revoked", _("Eligibility revoked")
        EVALUATION_RELEASED_BY_OVERRIDE = (
            "evaluation.released_by_override",
            _("Evaluation released by override"),
        )
        EVALUATION_CANCELLED_BY_OVERRIDE = (
            "evaluation.cancelled_by_override",
            _("Evaluation cancelled by override"),
        )
        SC_MESSAGE_SENDER_REVEALED = "sc_message.sender_revealed", _("Council sender revealed")
        SC_MESSAGE_DELETED = "sc_message.deleted", _("Council message deleted")
        FILE_UPDATED_BY_MODERATOR = "file.updated_by_moderator", _("File updated by moderator")
        FILE_DELETED_BY_MODERATOR = "file.deleted_by_moderator", _("File deleted by moderator")

    class TargetType(models.TextChoices):
        USER = "user", _("User")
        EVALUATION_REQUEST = "evaluation_request", _("Evaluation request")
        TUTOR_ELIGIBILITY_REQUEST = "tutor_eligibility_request", _("Tutor eligibility request")
        TUTOR_ELIGIBILITY = "tutor_eligibility", _("Tutor eligibility")
        SC_MESSAGE = "sc_message", _("Council message")
        FILE = "file", _("File")

    id = models.BigAutoField(primary_key=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=64, choices=Action.choices)
    target_type = models.CharField(max_length=32, choices=TargetType.choices)
    target_id = models.BigIntegerField()
    reason = models.CharField(max_length=500, blank=True, default="")
    # {} is a stored value (no extra context), not a missing one.
    metadata = models.JSONField(blank=True, default=dict)

    objects = AuditLogQuerySet.as_manager()

    class Meta:
        db_table = "audit_log"
        indexes = [
            models.Index(fields=["target_type", "target_id"], name="audit_log_target_idx"),
            models.Index(fields=["actor", "created_at"], name="audit_log_actor_created_idx"),
            models.Index(fields=["action", "created_at"], name="audit_log_action_created_idx"),
        ]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError(_("Audit log rows cannot be updated."))
        if kwargs.get("force_update") or kwargs.get("update_fields") is not None:
            raise ValidationError(_("Audit log rows cannot be updated."))
        kwargs["force_insert"] = True
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError(_("Audit log rows cannot be deleted."))
