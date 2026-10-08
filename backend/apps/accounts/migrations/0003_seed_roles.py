from django.db import migrations

ROLE_NAMES = (
    "student",
    "tutor",
    "head_tutor",
    "sc_member",
    "admin",
)


def seed_roles(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for name in ROLE_NAMES:
        Role.objects.get_or_create(name=name)


def unseed_roles(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Role.objects.filter(name__in=ROLE_NAMES).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_role_userrole"),
    ]

    operations = [
        migrations.RunPython(seed_roles, unseed_roles),
    ]
