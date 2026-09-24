from django.urls import path

from apps.accounts.views import register

from .views import api_root

app_name = "api"

urlpatterns = [
    path("", api_root, name="root"),
    path("auth/register/", register, name="register"),
]
