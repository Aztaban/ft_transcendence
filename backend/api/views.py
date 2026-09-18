from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def api_root(request):
    """Return a minimal response confirming that API v1 is available."""
    return Response(
        {
            "status": "ok",
            "version": "v1",
        }
    )
