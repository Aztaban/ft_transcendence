"""Rate limits (docs/api-plan.md §5.9). The rates live in settings.REST_FRAMEWORK."""

from rest_framework.throttling import SimpleRateThrottle, UserRateThrottle


class AuthRateThrottle(SimpleRateThrottle):
    """Login and registration, counted per client IP even for a logged-in caller.

    Behind Nginx the IP comes from X-Forwarded-For (NUM_PROXIES = 1).
    """

    scope = "auth"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class SCMessageSendRateThrottle(UserRateThrottle):
    """Limits sending a council message, 10 per hour per user (api-plan §5.9).

    The inbox list shares the /sc-messages/ URL, so only POST is counted.
    """

    scope = "sc_message_send"

    def allow_request(self, request, view):
        if request.method != "POST":
            return True
        return super().allow_request(request, view)
