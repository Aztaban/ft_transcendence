# Evaluation demo (#59)

Our guide during the evaluation: how to prepare the stack, then one script per part. Each script says what to do, what to say, and where it lives in the code.

| Order | Part | Script | Time |
|---|---|---|---|
| 1 | Becoming a Hitchhiker, picking a slot | [hitchhiker-workflow.md](hitchhiker-workflow.md) (#384) | 4–5 min |
| 2 | Requesting, confirming and cancelling an evaluation | [student-workflow.md](student-workflow.md) (#383) | 4–5 min |
| 3 | Student Council | [student-council.md](student-council.md) (#385) | 3–5 min |
| 4 | Permissions, tried by the evaluators | [permissions.md](permissions.md) (#386) | 3–5 min |

Parts 1 and 2 are one story told from both sides: the Hitchhiker must be eligible before the student's request can be picked.

## Setup: a clean database and three accounts

Run these from the repository root. The demo starts from an empty database: no accounts, no requests, no messages, only the seeded roles and campus projects.

1. **Clean database.** A fresh clone already has one: run `make up` and go to step 2. On a machine that has run the project before, remove the old data first:

   ```bash
   docker compose down -v   # stops the stack and deletes its volumes: database, certificate, node_modules
   make up                  # rebuilds; the backend applies the migrations (roles, projects)
   ```

   Wait until the backend is healthy (`docker compose ps`), then open `https://localhost` and accept the self-signed certificate.

2. **The Admin account** (in a second terminal, while the stack runs):

   ```bash
   docker compose exec backend python manage.py createsuperuser
   ```

   Answer the prompts, for example email `admin@example.com`, display name `Admin`, and a password. A Django superuser starts with the `student` role only: it gets no application roles.

3. **Its roles:** `admin`, `head_tutor` (to review eligibility requests in the Hitchhiker workspace) and `sc_member` (for the council part). Use the email from step 2:

   ```bash
   docker compose exec backend python manage.py shell -c "from apps.accounts.models import Role, User; u = User.objects.get(email='admin@example.com'); u.roles.add(*Role.objects.filter(name__in=['admin', 'head_tutor', 'sc_member'])); print(sorted(u.roles.values_list('name', flat=True)))"
   ```

   It prints `['admin', 'head_tutor', 'sc_member', 'student']`. The same can be done by hand in the Django admin (`https://localhost/admin/` → Users → the user → Roles). `admin` can only be given there or by this command, never through the API.

4. **Two more accounts**, registered in the app on `https://localhost/register`:
   - the **student**, e.g. `student@example.com`, display name `Student`;
   - the future **Hitchhiker**, e.g. `hitchhiker@example.com`, display name `Hitchhiker`. It gets the `tutor` role live during part 1.

   Registering is also part of the demo ("create an account"); 42 login works the same way if the OAuth keys are set in `.env`.

## Screen

Use three browser windows, each with its own session: a normal window, a private window, and a second browser (or a second browser profile). Log in:

| Window | Account | Workspace |
|---|---|---|
| A | Admin | switch as each script says (HITCHHIKER, COUNCIL, ADMIN) |
| B | Hitchhiker | HITCHHIKER once the role is given |
| C | Student | STUDENT |

Two windows side by side are enough for each step; the scripts say which.

## Results

Evaluation results are entered in the Django admin after an evaluation ends (README → *Recording evaluation results*). A slot starts at least 30 minutes ahead, so a result cannot be shown on an evaluation created during the demo. Tell the evaluators, and show the form at `https://localhost/admin/` → Evaluations → Evaluation requests if they ask.
