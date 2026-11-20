# Student Council demo (#385)

A 3–5 minute walkthrough of the Student Council for the evaluation: what to do, what to say, and where each step lives in the code.

## Before you start

The demo starts from an empty database: no accounts and no messages, only the seeded roles and campus projects. Run these from the repository root.

1. **Start from a clean database.** A fresh clone already has one: run `make up` and skip to step 2. On a machine that has run the project before, remove the old data first:

   ```bash
   docker compose down -v   # stops the stack and deletes its volumes: database, certificate, node_modules
   make up                  # rebuilds; the backend applies the migrations (roles, projects)
   ```

   Wait until the backend is healthy (`docker compose ps`), then open `https://localhost` and accept the new self-signed certificate.

2. **Create the Admin account** (in a second terminal, while the stack runs):

   ```bash
   docker compose exec backend python manage.py createsuperuser
   ```

   Answer the prompts, for example email `admin@example.com`, display name `Admin`, and a password. The account starts with the `student` role only: a Django superuser gets no application roles.

3. **Give it the `admin` and `sc_member` roles** (use the email from step 2):

   ```bash
   docker compose exec backend python manage.py shell -c "from apps.accounts.models import Role, User; u = User.objects.get(email='admin@example.com'); u.roles.add(*Role.objects.filter(name__in=['admin', 'sc_member'])); print(sorted(u.roles.values_list('name', flat=True)))"
   ```

   It prints `['admin', 'sc_member', 'student']`. The same can be done by hand in the Django admin (`https://localhost/admin/` → Users → the user → Roles).

4. **Create the student** in the app: open `https://localhost/register` and register, for example `student@example.com`. A new account has only the `student` role.

Then set up the screen:

- **Window 1 (normal):** log in as the student, Student workspace.
- **Window 2 (private window):** log in as the Admin, switch to the **COUNCIL** workspace.
- Put the two windows side by side, then share the screen.

## The story

| # | What you do | What you say |
|---|---|---|
| 1 | Window 1: **Student Council** → write a message (e.g. "The 3rd floor fridge is broken again.") → **Send** → "Message Sent" popup | Any student or Hitchhiker can write to the council. The message is **anonymous**: the council never sees who sent it. |
| 2 | Window 2: the **bell gets a badge** without reloading; open the panel | Real time + notifications: every council member is notified live over the WebSocket, and the notification stays in the notification center. |
| 3 | **Messages** → the new message (unread) → open it | The inbox lists unread messages, newest first. Opening a message does not mark it read by itself. |
| 4 | **Mark as read** → "Done…" popup; then **Mark as unread** | Read state is shared by the whole council. |
| 5 | Write a **discussion note** → **Save note** | The note is shared by all council members. It is saved with a version number: if a colleague saved in between, you get a conflict instead of overwriting their text. |
| 6 | **History** | The history lists every message the council has received, read or not, newest first, with its state. |
| 7 | Back to the message → **Reveal sender** → reason ("Abuse investigation: threatening message") → the sender is shown | Only an **Admin** can do this, only with a reason (10–500 characters), and every reveal is written to the audit log. |
| 8 | **Delete** an abusive message → reason → it disappears, also from the notifications | Deleting also needs a reason and removes the message's notifications for every council member. |
| 9 | Window 2: **ADMIN** workspace → **Audit log** → filter by action | Both actions are there: who, when, which message, and why. |

Close with: "Anonymous for the council, accountable for the admins: only an admin can reveal a sender, never silently."

## Where it is in the code

| Step | Frontend | API | Backend |
|---|---|---|---|
| Send | `pages/CouncilMessagePage.tsx`, `features/council/MessageSentDialog.tsx`, `api/scMessages.ts` → `sendSCMessage` | `POST /api/v1/sc-messages/` (throttled) | `apps/council/views.py` → `sc_message_list`; the sender is stored but never serialized (`serializers.py`) |
| Notification | `store/NotificationCountContext.tsx`, `features/notifications/NotificationPanel.tsx`, `websocket/` (re-fetch on event) | `GET /notifications/`, WebSocket `/ws/` | `apps/council/notifications.py` → `notify_sc_message_created` → `create_notification` + `publish_user_event` after commit |
| Inbox / message | `pages/CouncilInboxPage.tsx`, `pages/CouncilInboxMessagePage.tsx` | `GET /sc-messages/?unread=true`, `GET /sc-messages/{id}/` | `sc_message_list`, `sc_message_detail`; permission `CanReadCouncilInbox` (sc_member or admin) |
| Read / note | `CouncilInboxMessagePage.tsx` | `PATCH /sc-messages/{id}/` with `is_read` and/or `discussion_note` + `discussion_note_version` | atomic conditional update on the version (`filter(pk, version).update(version + 1)`) → 409 `edit_conflict` |
| History | `pages/CouncilHistoryPage.tsx` (both lists through `features/council/useCouncilMessages.ts`) | `GET /sc-messages/` (no filter) | same list endpoint |
| Reveal | `features/council/ModerationDialog.tsx` | `POST /sc-messages/{id}/reveal-sender/` `{reason}` | permission `CanModerateCouncilMessage` (admin only); `record_audit(...)` every time |
| Delete | `ModerationDialog.tsx` | `DELETE /sc-messages/{id}/` `{reason}` | `select_for_update`, audit row, `delete_sc_message_created_notifications` |
| Audit log | `pages/AuditLogPage.tsx`, `api/audit.ts` | `GET /api/v1/admin/audit-log/` with filters (action, target, dates) | `apps/audit/` (`record_audit`, `AuditLog`); admins only |

Contract: `docs/api-plan.md` §8.10 (SCMessage), §10.6 (council endpoints), §10.9 (audit log).

## Likely questions

- **How is the sender anonymous if you can reveal them?** The sender is stored, so abuse can be investigated, but no council endpoint returns it. Only the admin-only reveal endpoint does, and it always writes an audit row.
- **What if two members edit the note at once?** The second save sends an old version and gets 409 `edit_conflict`; nothing is overwritten.
- **Who can see the inbox?** Only `sc_member` and `admin`, checked on the server on every request; a student gets 403.
