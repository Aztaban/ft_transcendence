"""Shared project reference representation from api-plan §8.6."""

from rest_framework import serializers

from .models import Project


class ProjectRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ("id", "slug", "name")
        read_only_fields = fields
