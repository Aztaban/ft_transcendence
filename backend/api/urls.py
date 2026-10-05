from django.urls import path

from apps.accounts.views import MeView, register

from .views import api_root

app_name = "api"

urlpatterns = [
    path("", api_root, name="root"),
    path("auth/register/", register, name="register"),
    path("users/me/", MeView.as_view(), name="me"),
]
