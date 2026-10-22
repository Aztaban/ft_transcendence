"""The notification type vocabulary is defined by api-plan §8.8."""

import pytest
from django.core.exceptions import ValidationError

from apps.notifications.models import Notification


def test_notification_types_match_the_complete_contract():
    assert set(Notification.Type.values) == {
        "evaluation.created",
        "evaluation.slot_picked",
        "evaluation.confirmed",
        "evaluation.declined",
        "evaluation.released",
        "evaluation.cancelled",
        "evaluation.expired",
        "evaluation.result_recorded",
        "eligibility.requested",
        "eligibility.decided",
        "eligibility.revoked",
        "role.changed",
        "account.updated",
        "sc_message.created",
        "resource.created",
        "resource.updated",
        "resource.deleted",
    }


@pytest.mark.parametrize(
    "value",
    [
        "slot_picked",
        "evaluation_confirmed",
        "evaluation_declined",
        "evaluation_cancelled",
        "eligibility_requested",
        "eligibility_decided",
        "system_message",
    ],
)
def test_notification_type_field_rejects_outdated_issue_examples(value):
    with pytest.raises(ValidationError) as exc:
        Notification._meta.get_field("type").clean(value, Notification())

    assert exc.value.code == "invalid_choice"
