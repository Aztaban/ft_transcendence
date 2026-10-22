"""Project detail representation (api-plan §8.6)."""

from apps.accounts.references import UserRefSerializer
from apps.evaluations.references import ProjectRefSerializer


class ProjectSerializer(ProjectRefSerializer):
    """The detail view supplies eligible_tutors, filtered and sorted."""

    eligible_tutors = UserRefSerializer(many=True, read_only=True)

    class Meta(ProjectRefSerializer.Meta):
        fields = (*ProjectRefSerializer.Meta.fields, "eligible_tutors")
        read_only_fields = fields
