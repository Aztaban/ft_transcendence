from django.contrib.auth.base_user import BaseUserManager


class UserManager(BaseUserManager):
    use_in_migrations = True

    @classmethod
    def normalize_email(cls, email):
        """Use one canonical email spelling for this case-insensitive project."""
        if not email:
            return email
        return super().normalize_email(email.strip()).casefold()

    def create_user(self, email, password=None, **extra_fields):
        if not email or not email.strip():
            raise ValueError("An email address is required")

        email = self.normalize_email(email)
        email = self.model._meta.get_field("email").clean(email, None)

        user = self.model(
            email=email,
            **extra_fields,
        )

        user.set_password(password)
        user.save(using=self._db)

        return user

    def create_superuser(self, email, password, **extra_fields):
        if not password:
            raise ValueError("A superuser requires a password")

        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("A superuser must have is_staff=True")

        if extra_fields.get("is_superuser") is not True:
            raise ValueError("A superuser must have is_superuser=True")

        return self.create_user(
            email=email,
            password=password,
            **extra_fields,
        )
