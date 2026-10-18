"""URL routes for accounts API (included from api.urls under /api/v1/)."""

from django.urls import path

from . import views

urlpatterns = [
    path("auth/register/", views.register, name="register"),
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/session/", views.session_status, name="session"),
    path("auth/42/redirect/", views.oauth_42_redirect, name="oauth_42_redirect"),
    path("auth/42/callback/", views.oauth_42_callback, name="oauth_42_callback"),
    path("users/me/", views.MeView.as_view(), name="me"),
    path("users/<int:user_id>/", views.user_detail, name="users-detail"),
    path("users/<int:user_id>/roles/", views.assign_role, name="users-assign-role"),
    path(
        "users/<int:user_id>/roles/<int:role_id>/",
        views.revoke_role,
        name="users-revoke-role",
    ),
    path(
        "tutors/<int:user_id>/eligibility/",
        views.tutor_eligibility,
        name="tutors-eligibility",
    ),
    path(
        "tutor-eligibility-requests/",
        views.tutor_eligibility_request_list,
        name="tutor-eligibility-requests-list",
    ),
    path(
        "tutor-eligibility-requests/<int:request_id>/review/",
        views.tutor_eligibility_request_review,
        name="tutor-eligibility-requests-review",
    ),
]
