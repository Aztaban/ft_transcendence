"""The sc_message table matches docs/database-schema.md §6.1."""

import pytest
from django.contrib.auth import get_user_model
from django.db import connection

from apps.council.models import SCMessage

pytestmark = pytest.mark.django_db


@pytest.fixture
def sender():
    return get_user_model().objects.create_user(email="anna@example.com", display_name="Anna")


def test_new_message_is_unread_with_an_empty_note(sender):
    message = SCMessage.objects.create(sender=sender, body="The fridge is broken again.")

    message.refresh_from_db()
    assert message.read_at is None
    assert message.discussion_note == ""
    assert message.discussion_note_version == 0
    assert message.created_at is not None


def test_message_stays_when_the_sender_is_deleted(sender):
    message = SCMessage.objects.create(sender=sender, body="The fridge is broken again.")

    sender.delete()

    message.refresh_from_db()
    assert message.sender_id is None
    assert message.body == "The fridge is broken again."


def test_a_user_cannot_list_the_messages_they_sent(sender):
    # Senders cannot list their messages (schema §6.1), so the user has no reverse accessor.
    assert not hasattr(sender, "scmessage_set")


def test_table_name_and_unread_index():
    with connection.cursor() as cursor:
        constraints = connection.introspection.get_constraints(cursor, "sc_message")

    indexed_columns = [constraint["columns"] for constraint in constraints.values()]
    assert ["read_at", "created_at"] in indexed_columns
