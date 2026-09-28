from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from apps.core.models import TimeStampedModel

from .managers import UserManager


class Role(TimeStampedModel):
    """Platform role seedable by name (student, tutor, head_tutor, sc_member, admin)."""

    class Name(models.TextChoices):
        STUDENT = "student", "Student"
        TUTOR = "tutor", "Tutor"
        HEAD_TUTOR = "head_tutor", "Head Tutor"
        SC_MEMBER = "sc_member", "Student Council"
        ADMIN = "admin", "Admin"

    id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=254, unique=True)

    class Meta:
        db_table = "role"

    def __str__(self):
        return self.name


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

    roles = models.ManyToManyField(
        Role,
        through="UserRole",
        related_name="users",
        blank=True,
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["display_name"]

    class Meta:
        db_table = "user"

    @property
    def is_active(self):
        """Make Django authentication respect the account status."""
        return self.status == self.Status.ACTIVE

    def has_role(self, name: str) -> bool:
        """Return True when this user holds the given role name."""
        return self.roles.filter(name=name).exists()

    def __str__(self):
        return self.email


class UserRole(TimeStampedModel):
    """Join table for users and roles (UNIQUE user + role)."""

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="user_roles",
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.CASCADE,
        related_name="user_roles",
    )

    class Meta:
        db_table = "user_roles"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "role"],
                name="uniq_user_roles_user_role",
            ),
        ]

    def __str__(self):
        return f"{self.user_id}:{self.role_id}"
