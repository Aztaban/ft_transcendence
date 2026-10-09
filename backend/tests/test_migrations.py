"""Every model change ships with its migration."""

import pytest
from django.core.management import call_command


@pytest.mark.django_db
def test_no_model_change_is_missing_a_migration():
    # Exits with an error, failing this test, when makemigrations would create a file.
    call_command("makemigrations", "--check", "--dry-run", verbosity=0)
