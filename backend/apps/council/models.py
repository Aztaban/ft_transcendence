from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class SCMessage(TimeStampedModel):
    """Storage for anonymous message sent to student council"""

    id = models.BigAutoField(primary_key=True)
    # Stored only for abuse investigation; never returned by the API except by the
    # audited reveal-sender endpoint (api-plan §10.6).
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    body = models.TextField()
    read_at = models.DateTimeField(null=True, blank=True)
    discussion_note = models.TextField(blank=True, default="")
    discussion_note_version = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "sc_message"
        indexes = [
            models.Index(fields=["read_at", "created_at"], name="sc_message_read_created_idx"),
        ]
