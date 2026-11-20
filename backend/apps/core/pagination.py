"""Shared list pagination from api-plan §5.7."""

from rest_framework import serializers
from rest_framework.pagination import PageNumberPagination


class APIPageSerializer(serializers.Serializer):
    """Shared page metadata for function views; subclasses declare their results type."""

    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)


class APIPageNumberPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response_schema(self, schema):
        response = super().get_paginated_response_schema(schema)
        response["required"] = ["count", "next", "previous", "results"]
        return response
