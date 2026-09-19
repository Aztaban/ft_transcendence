from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from apps.core.models import TimeStampedModel

from .managers import UserManager


class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    class Language(models.TextChoices):
        ENGLISH = "en", "English"
        CZECH = "cs", "Czech"
        SPANISH = "es", "Spanish"

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

    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["display_name"]

    class Meta:
        db_table = "user"

    def __str__(self):
        return self.email
