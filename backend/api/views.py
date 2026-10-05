from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([AllowAny])
def api_root(request):
    """Return API status and provide a CSRF cookie for browser login."""
    return Response(
        {
            "status": "ok",
            "version": "v1",
        }
    )
