"""Files are out of scope (R19): the routes planned for them do not exist."""

import pytest
from rest_framework.test import APIClient


@pytest.mark.parametrize(
    "method,path",
    [
        ("post", "/api/v1/files/"),
        ("get", "/api/v1/files/"),
        ("get", "/api/v1/files/1/"),
        ("get", "/api/v1/files/1/download/"),
        ("patch", "/api/v1/files/1/"),
        ("delete", "/api/v1/files/1/"),
        ("put", "/api/v1/users/me/avatar/"),
        ("delete", "/api/v1/users/me/avatar/"),
    ],
)
def test_file_routes_answer_the_json_404(method, path):
    response = getattr(APIClient(), method)(path, HTTP_HOST="localhost")

    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}
