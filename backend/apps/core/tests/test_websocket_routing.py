"""Verify #230's protocol and URL dispatch with a test-only ASGI handler."""

import pytest
from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.urls import path

from config.asgi import application


@pytest.fixture
def routed_handler(monkeypatch):
    scopes = []

    async def handler(scope, receive, send):
        scopes.append(scope)
        assert await receive() == {"type": "websocket.connect"}
        await send({"type": "websocket.accept"})
        assert (await receive())["type"] == "websocket.disconnect"

    router = application.application_mapping["websocket"].routes[0].callback
    monkeypatch.setattr(router, "routes", [path("", handler)])
    return scopes


def test_websocket_dispatches_documented_path(routed_handler):
    async def connect():
        communicator = WebsocketCommunicator(application, "/ws/")
        try:
            assert await communicator.connect() == (True, None)
        finally:
            await communicator.disconnect()

    async_to_sync(connect)()

    assert len(routed_handler) == 1
    assert routed_handler[0]["type"] == "websocket"
    assert routed_handler[0]["path"] == "/ws/"
    assert routed_handler[0]["path_remaining"] == ""


@pytest.mark.parametrize("url", ["/ws", "/ws/extra/", "/api/v1/ws/", "/api/v1/"])
def test_other_websocket_paths_do_not_reach_handler(routed_handler, url):
    async def connect():
        communicator = WebsocketCommunicator(application, url)
        with pytest.raises(ValueError, match="No route found for path"):
            await communicator.connect()

    async_to_sync(connect)()

    assert routed_handler == []
