"""Read-only project representations from api-plan §8.1 and §8.6."""

from rest_framework import serializers

from .models import Project


class UserRefSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    # Avatar storage is not implemented yet; users without an avatar return null.
    avatar_url = serializers.URLField(read_only=True, allow_null=True, default=None)


class ProjectRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ("id", "slug", "name")
        read_only_fields = fields


class ProjectSerializer(ProjectRefSerializer):
    """The detail view supplies eligible_tutors, filtered and sorted."""

    eligible_tutors = UserRefSerializer(many=True, read_only=True)

    class Meta(ProjectRefSerializer.Meta):
        fields = (*ProjectRefSerializer.Meta.fields, "eligible_tutors")
        read_only_fields = fields
