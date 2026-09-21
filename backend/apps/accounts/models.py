from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from apps.core.models import TimeStampedModel

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    class Language(models.TextChoices):
        ENGLISH = "en", "English"
        CZECH = "cs", "Czech"
        SPANISH = "es", "Spanish"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    id = models.BigAutoField(primary_key=True)

    email = models.EmailField(
        max_length=254,
        unique=True,
    )

    display_name = models.CharField(
        max_length=64,
    )

    intra_login = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
    )

    language = models.CharField(
        max_length=2,
        choices=Language.choices,
        default=Language.ENGLISH,
    )

    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.ACTIVE,
    )

    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["display_name"]

    class Meta:
        db_table = "user"

    @property
    def is_active(self):
        """Make Django authentication respect the account status."""
        return self.status == self.Status.ACTIVE

    def __str__(self):
        return self.email
