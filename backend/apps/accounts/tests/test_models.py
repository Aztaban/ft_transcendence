"""Database-backed tests for the custom User model (isolated MySQL test DB)."""

import pytest
from django.contrib.auth import authenticate, get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

pytestmark = pytest.mark.django_db


@pytest.fixture
def user_model():
    return get_user_model()


def test_user_identity_configuration(user_model):
    assert user_model.USERNAME_FIELD == "email"
    assert user_model.REQUIRED_FIELDS == ["display_name"]
    assert user_model._meta.db_table == "user"
    assert user_model._meta.get_field("id").get_internal_type() == "BigAutoField"
    assert user_model._meta.get_field("email").unique is True
    assert user_model._meta.get_field("password").column == "password"


def test_create_user_hashes_password_and_sets_defaults(user_model):
    user = user_model.objects.create_user(
        email="  Alice@EXAMPLE.COM  ",
        password="correct-horse-battery-staple",
        display_name="Alice",
    )
    user.refresh_from_db()

    assert user.email == "alice@example.com"
    assert user.password != "correct-horse-battery-staple"
    assert user.check_password("correct-horse-battery-staple") is True
    assert user.check_password("wrong-password") is False
    assert user.language == user_model.Language.ENGLISH
    assert user.status == user_model.Status.ACTIVE
    assert user.is_active is True
    assert user.intra_login is None
    assert str(user) == "alice@example.com"
    assert user.created_at is not None
    assert user.updated_at is not None
    assert user.updated_at >= user.created_at


@pytest.mark.parametrize("email", [None, "", "   "])
def test_create_user_requires_nonblank_email(user_model, email):
    with pytest.raises(ValueError, match="email address is required"):
        user_model.objects.create_user(email=email, password="secret", display_name="A")


@pytest.mark.parametrize("email", ["not-an-email", "a" * 250 + "@example.com"])
def test_create_user_validates_email(user_model, email):
    with pytest.raises(ValidationError):
        user_model.objects.create_user(email=email, password="secret", display_name="A")


def test_email_uniqueness_after_casefolding(user_model):
    user_model.objects.create_user("Alice@Example.Com", "secret", display_name="Alice")

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            user_model.objects.create_user("alice@example.com", "other", display_name="Another")

    assert user_model.objects.count() == 1


def test_mysql_email_unique_constraint_is_case_insensitive(user_model):
    """Exercise the database constraint, bypassing manager normalization."""
    user_model.objects.create(email="Alice@Example.Com", display_name="Alice")

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            user_model.objects.create(email="alice@example.com", display_name="Another")

    assert user_model.objects.count() == 1


def test_intra_login_is_unique_when_provided(user_model):
    user_model.objects.create_user(
        "one@example.com", "secret", display_name="One", intra_login="a42login"
    )

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            user_model.objects.create_user(
                "two@example.com", "secret", display_name="Two", intra_login="a42login"
            )


def test_multiple_users_can_have_no_intra_login(user_model):
    user_model.objects.create_user("one@example.com", "secret", display_name="One")
    user_model.objects.create_user("two@example.com", "secret", display_name="Two")

    assert user_model.objects.filter(intra_login__isnull=True).count() == 2


def test_display_name_is_required_by_model_validation(user_model):
    user = user_model(email="one@example.com", display_name="")
    user.set_password("secret")

    with pytest.raises(ValidationError) as exc:
        user.full_clean()

    assert "display_name" in exc.value.message_dict


def test_language_and_status_choices_are_validated(user_model):
    user = user_model(email="one@example.com", display_name="One", language="fr")
    user.set_password("secret")

    with pytest.raises(ValidationError) as exc:
        user.full_clean()
    assert "language" in exc.value.message_dict

    user.language = user_model.Language.ENGLISH
    user.status = "pending"
    with pytest.raises(ValidationError) as exc:
        user.full_clean()
    assert "status" in exc.value.message_dict


def test_suspension_blocks_default_django_authentication(user_model):
    user = user_model.objects.create_user("one@example.com", "correct-password", display_name="One")
    assert authenticate(email="one@example.com", password="correct-password") == user

    user.status = user_model.Status.SUSPENDED
    user.save(update_fields=["status"])
    user.refresh_from_db()

    assert user.is_active is False
    assert authenticate(email="one@example.com", password="correct-password") is None

    user.status = user_model.Status.ACTIVE
    user.save(update_fields=["status"])
    assert authenticate(email="one@example.com", password="correct-password") == user


def test_create_superuser_and_reject_invalid_flags(user_model):
    admin = user_model.objects.create_superuser(
        "admin@example.com", "correct-password", display_name="Admin"
    )
    assert admin.is_staff is True
    assert admin.is_superuser is True
    assert admin.is_active is True
    assert admin.check_password("correct-password") is True

    with pytest.raises(ValueError, match="is_staff=True"):
        user_model.objects.create_superuser(
            "invalid@example.com", "secret", display_name="Invalid", is_staff=False
        )
    with pytest.raises(ValueError, match="is_superuser=True"):
        user_model.objects.create_superuser(
            "invalid@example.com", "secret", display_name="Invalid", is_superuser=False
        )
    with pytest.raises(ValueError, match="requires a password"):
        user_model.objects.create_superuser("invalid@example.com", "", display_name="Invalid")


def test_passwords_use_argon2():
    from django.contrib.auth.hashers import check_password, make_password

    password = "TestPassword123!"
    encoded = make_password(password)

    assert encoded.startswith("argon2$")
    assert check_password(password, encoded)
    assert not check_password("wrong-password", encoded)
