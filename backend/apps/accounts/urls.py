"""URL routes for accounts API (included from api.urls under /api/v1/)."""

from django.urls import path

from .views import authentication, oauth, profiles, roles

urlpatterns = [
    path("auth/register/", authentication.register, name="register"),
    path("auth/login/", authentication.LoginView.as_view(), name="login"),
    path("auth/logout/", authentication.LogoutView.as_view(), name="logout"),
    path("auth/session/", authentication.session_status, name="session"),
    path("auth/42/redirect/", oauth.oauth_42_redirect, name="oauth_42_redirect"),
    path("auth/42/callback/", oauth.oauth_42_callback, name="oauth_42_callback"),
    path("users/me/", profiles.MeView.as_view(), name="me"),
    path("users/<int:user_id>/", profiles.user_detail, name="users-detail"),
    path("users/<int:user_id>/roles/", roles.assign_role, name="users-assign-role"),
    path(
        "users/<int:user_id>/roles/<int:role_id>/",
        roles.revoke_role,
        name="users-revoke-role",
    ),
]
