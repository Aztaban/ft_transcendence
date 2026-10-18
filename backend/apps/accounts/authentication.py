"""Session authentication with CSRF protection for public write endpoints."""

from rest_framework.authentication import SessionAuthentication


class CsrfEnforcedSessionAuthentication(SessionAuthentication):
    """Check CSRF even when there is no authenticated session (api-plan §5.4)."""

    def authenticate(self, request):
        authentication = super().authenticate(request)
        # DRF's normal session authentication only checks CSRF for logged-in users.
        if authentication is None:
            self.enforce_csrf(request)
        return authentication
