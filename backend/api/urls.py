from django.urls import include, path

from apps.accounts.views import LoginView, LogoutView, MeView, register, session_status

from .views import api_root

app_name = "api"

urlpatterns = [
    path("", api_root, name="root"),
    path("auth/register/", register, name="register"),
    path("users/me/", MeView.as_view(), name="me"),
    path("auth/login/", LoginView.as_view(), name="login"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/session/", session_status, name="session"),
    path("", include("apps.accounts.urls")),
]
