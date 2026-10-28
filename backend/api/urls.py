from django.urls import include, path

from .views import api_root

app_name = "api"

urlpatterns = [
    path("", api_root, name="root"),
    path("", include("apps.accounts.urls")),
    path("", include("apps.evaluations.urls")),
    path("", include("apps.notifications.urls")),
    path("", include("apps.council.urls")),
]
