"""Student Council inbox routes, included under /api/v1/."""

from django.urls import path

from . import views

urlpatterns = [
    path("sc-messages/", views.sc_message_list, name="sc-message-list"),
]
