"""Server foundation for #229: HTTP stays usable and Redis crosses instances."""

import asyncio
import json
from uuid import uuid4

from asgiref.sync import async_to_sync
from channels.testing import HttpCommunicator
from channels_redis.core import RedisChannelLayer
from django.conf import settings
from django.core.management import get_commands, load_command_class

from config.asgi import application


def test_development_runserver_uses_asgi():
    provider = get_commands()["runserver"]
    command = load_command_class(provider, "runserver")

    assert provider == "daphne"
    assert command.server_cls.__module__ == "daphne.server"


def test_http_root_remains_available_through_asgi():
    async def request():
        communicator = HttpCommunicator(
            application, "GET", "/api/v1/", headers=[(b"host", b"localhost")]
        )
        return await communicator.get_response()

    response = async_to_sync(request)()

    assert response["status"] == 200
    assert json.loads(response["body"]) == {"status": "ok", "version": "v1"}
    assert any(name == b"Set-Cookie" for name, value in response["headers"])


def test_redis_layer_delivers_between_instances():
    async def exchange():
        # Isolate Redis keys from running application instances and parallel tests.
        config = dict(settings.CHANNEL_LAYERS["default"]["CONFIG"], prefix=f"test.{uuid4().hex}")
        sender = RedisChannelLayer(**config)
        receiver = RedisChannelLayer(**config)
        channel = await receiver.new_channel()
        # Use the documented group and event shape; no socket consumers exist yet.
        group = "user_7"
        message = {"type": "evaluation.created", "data": {"id": 17, "status": "pending"}}
        try:
            await receiver.group_add(group, channel)
            await sender.group_send(group, message)
            return await asyncio.wait_for(receiver.receive(channel), timeout=3)
        finally:
            await receiver.group_discard(group, channel)
            await sender.flush()
            await sender.close_pools()
            await receiver.close_pools()

    assert async_to_sync(exchange)() == {
        "type": "evaluation.created",
        "data": {"id": 17, "status": "pending"},
    }
