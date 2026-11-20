"""Shared inputs whose validation is identical across API workflows."""

from rest_framework import serializers


class ReasonSerializer(serializers.Serializer):
    # Keep endpoint component descriptions unchanged when inheriting this input.
    reason = serializers.CharField(min_length=1, max_length=500)


def validate_comma_separated_choices(value, choices):
    """Validate each entry in order, retaining empty entries and per-entry whitespace.

    Callers use CharField to validate and trim the outer query string first.
    """
    field = serializers.ChoiceField(choices=choices)
    return [field.run_validation(item) for item in value.split(",")]
