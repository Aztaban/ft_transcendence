"""Connection handling for the server-push WebSocket."""

import json

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

        # Instance-local membership: the base consumer discards these groups
        # on disconnect. Join only after authentication (api-plan §9.1).
        self.groups = []
        try:
            for group in (f"user_{user.pk}", f"session_{session.session_key}"):
                await self.channel_layer.group_add(group, self.channel_name)
                self.groups.append(group)
            await self.accept()
        except Exception:
            # A failed second join or handshake must not leave a partial member.
            for group in self.groups:
                await self.channel_layer.group_discard(group, self.channel_name)
            self.groups = []
            raise

    async def receive(self, text_data=None, bytes_data=None):
        # This socket is server-push only. Ignore even malformed text/binary
        # frames instead of decoding, echoing or treating them as commands.
        pass

    async def session_ended(self, event):
        """Notify the client before closing an ended session."""
        if getattr(self, "_session_closed", False):
            return
        self._session_closed = True
        await self.send(text_data=json.dumps({"event": "session.ended", "data": {}}))
        await self.close(code=4401)
