from django.urls import path

from .views import api_root

app_name = "api"

urlpatterns = [
    path("", api_root, name="root"),
]
