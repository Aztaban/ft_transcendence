"""Student Council inbox routes, included under /api/v1/."""

from django.urls import path

from . import views

urlpatterns = [
    path("sc-messages/", views.sc_message_list, name="sc-message-list"),
    path(
        "sc-messages/<int:pk>/reveal-sender/",
        views.sc_message_reveal_sender,
        name="sc-message-reveal-sender",
    ),
    path("sc-messages/<int:pk>/", views.sc_message_detail, name="sc-message-detail"),
]
