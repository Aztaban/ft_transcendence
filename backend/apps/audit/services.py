"""Write one audit row inside the caller's transaction (schema §8.1)."""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.translation import gettext_lazy as _

from apps.audit.models import AuditLog


@transaction.atomic
def record_audit(*, actor, action, target_type, target_id, reason="", metadata=None) -> AuditLog:
    """Insert an append-only audit entry. ``metadata`` None is stored as ``{}``.

    Call this inside the action's transaction so a later failure rolls the row back.
    There is no WebSocket event: api-plan §9 does not list one for the audit log.
    """
    if metadata is None:
        metadata = {}
    if not isinstance(metadata, dict):
        raise ValidationError({"metadata": _("Audit metadata must be an object.")})

    entry = AuditLog(
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=target_id,
        reason=reason,
        metadata=metadata,
    )
    entry.full_clean()
    entry.save()
    return entry
