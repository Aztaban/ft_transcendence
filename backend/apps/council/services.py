"""Student Council message workflows and moderation transactions."""

from contextlib import contextmanager

from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import APIException, NotAuthenticated, NotFound

from apps.accounts.models import Role, User
from apps.accounts.services.locking import lock_users
from apps.audit.models import AuditLog
from apps.audit.services import record_audit

from .models import SCMessage
from .notifications import delete_sc_message_created_notifications, notify_sc_message_created


class DiscussionNoteConflict(APIException):
    status_code = 409
    default_code = "edit_conflict"
    default_detail = _("Someone else saved the note since you loaded it. Reload it and try again.")


def create_sc_message(*, sender, body):
    with transaction.atomic():
        # Lock the sender and Council recipients in one order before inserting
        # either the message or notifications that reference their user rows.
        members = User.objects.filter(roles__name=Role.Name.SC_MEMBER)
        council_ids = list(members.values_list("pk", flat=True).distinct())
        lock_users(sender.pk, *council_ids)
        sender = User.objects.get(pk=sender.pk)
        if not sender.is_active:
            raise NotAuthenticated()
        message = SCMessage.objects.create(
            sender=sender,
            body=body,
        )
        council_ids = list(
            members.filter(pk__in=council_ids).values_list("pk", flat=True).distinct()
        )
        notify_sc_message_created(message, recipient_ids=council_ids)
    return message


def update_sc_message(*, message, data):
    now = timezone.now()
    with transaction.atomic():
        if "discussion_note" in data:
            version = data["discussion_note_version"]
            updated = SCMessage.objects.filter(
                pk=message.pk, discussion_note_version=version
            ).update(
                discussion_note=data["discussion_note"],
                discussion_note_version=version + 1,
                updated_at=now,
            )
            if updated == 0:
                raise DiscussionNoteConflict()
        if "is_read" in data:
            if data["is_read"]:
                SCMessage.objects.filter(pk=message.pk, read_at__isnull=True).update(
                    read_at=now, updated_at=now
                )
            else:
                SCMessage.objects.filter(pk=message.pk).update(read_at=None, updated_at=now)
    message.refresh_from_db()
    return message


def _lock_message(pk, actor_id):
    # Account deletion locks users before anonymizing their messages. Include the
    # audit actor in the same ordered set before taking the message lock.
    sender_id = SCMessage.objects.filter(pk=pk).values_list("sender_id", flat=True).first()
    lock_users(sender_id, actor_id)
    return (
        SCMessage.objects.select_for_update(of=("self",))
        .select_related("sender")
        .filter(pk=pk)
        .first()
    )


@contextmanager
def locked_message(*, message_id, actor):
    """Keep moderation lookup, input validation and writes in one transaction.

    Views validate the reason after this lookup to preserve missing-object precedence.
    """
    with transaction.atomic():
        message = _lock_message(message_id, actor.pk)
        if message is None:
            raise NotFound()
        yield message


def delete_sc_message(*, message, actor, reason):
    """Delete a message inside locked_message, including its audit and notifications."""
    record_audit(
        actor=actor,
        action=AuditLog.Action.SC_MESSAGE_DELETED,
        target_type=AuditLog.TargetType.SC_MESSAGE,
        target_id=message.pk,
        reason=reason,
    )
    delete_sc_message_created_notifications(message)
    message.delete()


def reveal_sc_message_sender(*, message, actor, reason):
    """Audit the lookup inside locked_message before exposing the sender."""
    record_audit(
        actor=actor,
        action=AuditLog.Action.SC_MESSAGE_SENDER_REVEALED,
        target_type=AuditLog.TargetType.SC_MESSAGE,
        target_id=message.pk,
        reason=reason,
    )
    return message.sender
