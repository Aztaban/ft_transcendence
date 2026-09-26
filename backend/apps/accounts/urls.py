"""URL routes for accounts API (mounted under /api/v1/)."""

from django.urls import path

from . import views

urlpatterns = [
    path("users/me/", views.me, name="users-me"),
    path("users/<int:user_id>/roles/", views.assign_role, name="users-assign-role"),
    path(
        "users/<int:user_id>/roles/<str:role_name>/",
        views.revoke_role,
        name="users-revoke-role",
    ),
]
