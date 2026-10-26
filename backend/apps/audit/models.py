"""Append-only audit log (schema §8.1)."""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class AuditLogQuerySet(models.QuerySet):
    """Rows are never updated or deleted, except actor clearing on user removal."""

    def update(self, **kwargs):
        # Deleting a user sets actor_id NULL (schema §8.1, ON DELETE SET NULL).
        # Django applies that through QuerySet.update(actor=None). Nothing else may change.
        if kwargs != {"actor": None}:
            raise ValidationError(_("Audit log rows cannot be updated."))
        return super().update(**kwargs)

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
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError(_("Audit log rows cannot be deleted."))
