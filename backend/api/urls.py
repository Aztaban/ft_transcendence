from django.urls import include, path

from apps.accounts.views import (
    LoginView,
    LogoutView,
    MeView,
    oauth_42_callback,
    oauth_42_redirect,
    register,
    session_status,
)
from apps.evaluations.views import ProjectDetailView, ProjectListView

from .views import api_root

app_name = "api"

urlpatterns = [
    path("", api_root, name="root"),
    path("auth/register/", register, name="register"),
    path("users/me/", MeView.as_view(), name="me"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/session/", session_status, name="session"),
    path("projects/", ProjectListView.as_view(), name="project-list"),
    path("projects/<slug:slug>/", ProjectDetailView.as_view(), name="project-detail"),
    path("auth/42/redirect/", oauth_42_redirect, name="oauth_42_redirect"),
    path("auth/42/callback/", oauth_42_callback, name="oauth_42_callback"),
    path("", include("apps.accounts.urls")),
]
