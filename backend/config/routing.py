"""WebSocket URL configuration, separate from HTTP URLs (api-plan §9.1)."""

from channels.routing import URLRouter
from django.urls import path

from apps.core.routing import websocket_urlpatterns as core_websocket_urlpatterns

websocket_urlpatterns = [
    path("ws/", URLRouter(core_websocket_urlpatterns)),
]
