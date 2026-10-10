"""Consumer routes mounted at /ws/ by config.routing.

The connection consumer is added as an empty-path route in #231. Keep this
registry empty until it exists; no placeholder consumer accepts connections.
Session authentication and origin checks follow in #232.
"""

websocket_urlpatterns = []
