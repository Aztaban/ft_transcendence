"""URL routes for accounts API (included from api.urls under /api/v1/)."""

from django.urls import path

from .views import admin_users, authentication, oauth, profiles, roles
from .views.people_search import PeopleSearchView

urlpatterns = [
    path("admin/users/", admin_users.AdminUserListView.as_view(), name="admin-users-list"),
    path(
        "admin/users/<int:user_id>/suspend/",
        admin_users.AdminUserSuspendView.as_view(),
        name="admin-users-suspend",
    ),
    path(
        "admin/users/<int:user_id>/reactivate/",
        admin_users.AdminUserReactivateView.as_view(),
        name="admin-users-reactivate",
    ),
    path(
        "admin/users/<int:user_id>/",
        admin_users.AdminUserDetailView.as_view(),
        name="admin-users-detail",
    ),
    path("search/people/", PeopleSearchView.as_view(), name="search-people"),
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
