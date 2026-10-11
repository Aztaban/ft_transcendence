"""Consumer routes mounted at /ws/ by config.routing."""

from django.urls import path

from .consumers import ConnectionConsumer

websocket_urlpatterns = [
    path("", ConnectionConsumer.as_asgi()),
]
