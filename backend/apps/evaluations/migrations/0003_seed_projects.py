from django.db import migrations

# Common Core projects that must be evaluated by a Hitchhiker, Old and New Core
# (42 Prague students documentation, "Milestone Projects"). Slugs appear in URLs
# and never change; names can be corrected in the admin.
PROJECTS = (
    ("born2beroot", "born2beroot"),
    ("push_swap", "push_swap"),
    ("minishell", "minishell"),
    ("cpp09", "cpp09"),
    ("codexion", "Codexion"),
    ("fly-in", "Fly-In"),
    ("rag-against-the-machine", "RAG against the machine"),
    ("the-answer-protocol", "The Answer Protocol"),
    ("agent-smith", "Agent Smith"),
)


def seed_projects(apps, schema_editor):
    Project = apps.get_model("evaluations", "Project")
    database = schema_editor.connection.alias
    for slug, name in PROJECTS:
        Project.objects.using(database).get_or_create(slug=slug, defaults={"name": name})


class Migration(migrations.Migration):

    dependencies = [
        ("evaluations", "0002_keep_pick_on_cancel"),
    ]

    # Reversal keeps the rows: requests and eligibilities may already point to them.
    operations = [migrations.RunPython(seed_projects, migrations.RunPython.noop)]
