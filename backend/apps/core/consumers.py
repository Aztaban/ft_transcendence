"""Connection handling for the server-push WebSocket."""

from channels.generic.websocket import AsyncWebsocketConsumer


class ConnectionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        session = self.scope.get("session")
        if not (
            user is not None
            and user.is_authenticated
            and user.is_active
            and getattr(session, "session_key", None)
        ):
            await self.accept()
            await self.close(code=4401)
            return

        await self.accept()

    async def receive(self, text_data=None, bytes_data=None):
        # This socket is server-push only. Ignore even malformed text/binary
        # frames instead of decoding, echoing or treating them as commands.
        pass
