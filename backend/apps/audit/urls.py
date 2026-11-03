"""Audit routes, included under the shared /api/v1/ prefix."""

from django.urls import path

from apps.audit.views import AuditLogListView

urlpatterns = [
    path("admin/audit-log/", AuditLogListView.as_view(), name="admin-audit-log"),
]
