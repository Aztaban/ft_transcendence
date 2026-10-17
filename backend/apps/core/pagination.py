"""Shared list pagination from api-plan §5.7."""

from rest_framework.pagination import PageNumberPagination


class APIPageNumberPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
