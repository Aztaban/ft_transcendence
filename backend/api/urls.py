from django.urls import path

from apps.accounts.views import LoginView, register

from .views import api_root

app_name = "api"

urlpatterns = [
    path("", api_root, name="root"),
    path("auth/register/", register, name="register"),
    path("auth/login/", LoginView.as_view(), name="login"),
]
