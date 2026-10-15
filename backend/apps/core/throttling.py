"""Rate limits (docs/api-plan.md §5.9). The rates live in settings.REST_FRAMEWORK."""

from rest_framework.throttling import SimpleRateThrottle


class AuthRateThrottle(SimpleRateThrottle):
    """Login and registration, counted per client IP even for a logged-in caller.

    Behind Nginx the IP comes from X-Forwarded-For (NUM_PROXIES = 1).
    """

    scope = "auth"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}
