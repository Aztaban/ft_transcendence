from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class Notification(TimeStampedModel):
    """Recipient-owned event facts, rendered by the frontend (schema §5.1)."""

    class Type(models.TextChoices):
        EVALUATION_CREATED = "evaluation.created", _("Evaluation created")
        EVALUATION_SLOT_PICKED = "evaluation.slot_picked", _("Evaluation slot picked")
        EVALUATION_CONFIRMED = "evaluation.confirmed", _("Evaluation confirmed")
        EVALUATION_DECLINED = "evaluation.declined", _("Evaluation declined")
        EVALUATION_RELEASED = "evaluation.released", _("Evaluation released")
        EVALUATION_CANCELLED = "evaluation.cancelled", _("Evaluation cancelled")
        EVALUATION_EXPIRED = "evaluation.expired", _("Evaluation expired")
        EVALUATION_RESULT_RECORDED = "evaluation.result_recorded", _("Evaluation result recorded")
        ELIGIBILITY_REQUESTED = "eligibility.requested", _("Eligibility requested")
        ELIGIBILITY_DECIDED = "eligibility.decided", _("Eligibility decided")
        ELIGIBILITY_REVOKED = "eligibility.revoked", _("Eligibility revoked")
        ROLE_CHANGED = "role.changed", _("Role changed")
        ACCOUNT_UPDATED = "account.updated", _("Account updated")
        SC_MESSAGE_CREATED = "sc_message.created", _("Student Council message created")
        RESOURCE_CREATED = "resource.created", _("Resource created")
        RESOURCE_UPDATED = "resource.updated", _("Resource updated")
        RESOURCE_DELETED = "resource.deleted", _("Resource deleted")

    id = models.BigAutoField(primary_key=True)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(max_length=64, choices=Type.choices)
    payload = models.JSONField()
    target_url = models.CharField(max_length=255, blank=True, default="")
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "notification"
        indexes = [
            models.Index(
                fields=["recipient", "read_at", "created_at"],
                name="notif_recipient_read_created",
            ),
        ]
