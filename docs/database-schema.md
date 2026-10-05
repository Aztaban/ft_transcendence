# Database Schema

**Status:** Approved for implementation (sections marked "?" excepted)
**Owner:** rkravche, IT Architect
**Last updated:** October 6, 2026

---

## 1. Purpose

This document describes the MySQL schema: tables, columns, relations and the constraints that enforce product rules. It is the reference for writing Django models and migrations. The HTTP contract built on top of it is `docs/api-plan.md`.

Once a model is merged to `main`, its migration is the source of truth for exact column types. If code and this document disagree, the disagreement is a bug: fix one of them in the same PR, do not silently follow either.

### Conventions

- Every table has `id BIGINT AUTO_INCREMENT` (`models.BigAutoField`) unless stated otherwise.
- Every table has `created_at` and `updated_at` (`apps.core.models.TimeStampedModel`). They are omitted from the tables below.
- All tables are InnoDB. Datetime columns are `DATETIME(6)` holding UTC (`USE_TZ = True`).
- The default collation is case-insensitive, so unique indexes on email and slugs reject case-variant duplicates. Emails are additionally normalized to lowercase by `UserManager.normalize_email`.
- Enums are stored as `varchar` with Django `TextChoices`. Stored values are lowercase `snake_case` and are exactly the values the API sends.
- Foreign keys are `ON DELETE PROTECT` unless the table says otherwise. Users are never hard-deleted through the application (see §2.4), so most FKs to `user` never fire.
- Table names are set explicitly with `Meta.db_table` and match the headings below.
- Sections marked **YES** are agreed and safe to build. Sections marked **?** are proposals: do not implement them until the team approves them.

---

## 2. Identity and access — YES

### 2.1 user

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | BIGINT | no | |
| email | varchar(254) UNIQUE | no | Login identifier. Lowercased on save. |
| password | varchar(128) | no | Django hash (Argon2). Unusable hash for 42-only accounts. |
| display_name | varchar(64) | no | Shown in the UI. Not unique. |
| intra_id | BIGINT UNSIGNED UNIQUE | yes | 42 user id. Set on first 42 OAuth login; used to recognize returning 42 users. |
| intra_login | varchar(64) UNIQUE | yes | 42 login. Private: never returned by public endpoints. |
| avatar_file_id | FK file.id | yes | `ON DELETE SET NULL`. NULL means the default avatar. |
| language | varchar(2) | no | `en`, `cs`, `es`. Default `en`. |
| status | varchar(16) | no | `active`, `suspended`, `deleted`. Default `active`. Only `active` users can log in. |
| is_staff | bool | no | Access to the Django admin site (`/admin/`). Team members only. Unrelated to the `admin` role. |
| is_superuser | bool | no | Django built-in (`PermissionsMixin`). |
| last_login | datetime(6) | yes | Django built-in. |

`is_active` is a Python property (`status == "active"`), not a column, so Django authentication refuses suspended and deleted users.

There is no `bio` column. Profiles show display name, avatar and roles only.

### 2.2 role

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | BIGINT | no | |
| name | varchar(254) UNIQUE | no | One of the seeded names below. |

Seeded by a data migration, never created through the API: `student`, `tutor`, `head_tutor`, `sc_member`, `admin`.

The UI shows `tutor` as "Hitchhiker" and `sc_member` as "Student Council". The stored and transmitted names never change.

### 2.3 user_roles

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | BIGINT | no | |
| user_id | FK user.id | no | `ON DELETE CASCADE`. |
| role_id | FK role.id | no | `ON DELETE CASCADE`. |

`UNIQUE (user_id, role_id)`. `User.roles` is a `ManyToManyField(Role, through="UserRole")`.

Role rules (enforced in code, described in api-plan §5.8):

- Every account receives `student` when it is created, through registration or first 42 login. `student` is never revoked. The migration that seeds the roles also gives `student` to every user that already exists.
- `head_tutor` includes every `tutor` capability. Code that checks "is a Hitchhiker" accepts either role.
- `admin` does not imply any other role.

### 2.4 Account deletion

Users are never removed with `DELETE FROM user`, because their rows are referenced by other people's evaluation history. Deleting an account (api-plan §10.2) anonymizes it in one transaction:

- `status` = `deleted`, `email` = `deleted-<id>@deleted.invalid`, `display_name` = `Deleted user`
- `intra_id`, `intra_login`, `avatar_file_id` = NULL; the avatar `file` row and its bytes are deleted
- password set unusable; all `user_roles` rows deleted; all sessions of the user ended
- the user's open evaluation requests (`pending`, `awaiting_confirmation`, `confirmed` in the future) are cancelled, with `cancelled_by` = the admin who deleted the account; slots they picked as a Hitchhiker are released (back to `pending`)
- their pending eligibility request, if any, is declined (`reviewed_by` = the admin); their `tutor_eligibility` rows are deleted
- `sender_id` is set to NULL on the messages they sent to the Student Council
- their notifications are deleted
- tutor resources they uploaded are kept, and show the anonymized owner

---

## 3. Projects and eligibility — YES

### 3.1 project

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | BIGINT | no | |
| slug | varchar(64) UNIQUE | no | e.g. `libft`. Used in URLs. |
| name | varchar(128) | no | e.g. `Libft`. |
| is_active | bool | no | Default true. Inactive projects are hidden from lists and cannot get new requests, but existing rows keep pointing at them. |

Projects are seeded by a data migration with the 42 Prague curriculum and maintained afterwards in the Django admin. There is no API for creating or editing projects.

### 3.2 tutor_eligibility_request

One submission by a Hitchhiker listing every project they want to evaluate. A Head Tutor approves or declines the whole request.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | BIGINT | no | |
| requester_id | FK user.id | no | Holds `tutor` or `head_tutor` at submission time. |
| status | varchar(16) | no | `pending`, `approved`, `declined`. Default `pending`. |
| reviewed_by_id | FK user.id | yes | `ON DELETE SET NULL`. The Head Tutor or Admin who decided. |
| reviewed_at | datetime(6) | yes | |
| review_note | varchar(500) | no | Optional reason shown to the requester. Default empty string. |

Constraints:

- `CHECK ((status = 'pending' AND reviewed_by_id IS NULL AND reviewed_at IS NULL) OR (status <> 'pending' AND reviewed_at IS NOT NULL))`
- At most one `pending` request per requester. MySQL cannot express a partial unique index, so this is enforced in code: the create endpoint locks the requester's `user` row (`select_for_update()`) and checks for an existing pending request inside the same transaction.

Index: `(status, created_at)` for the review table.

### 3.3 tutor_eligibility_request_projects

The many-to-many link `TutorEligibilityRequest.projects = ManyToManyField(Project)`.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | BIGINT | no | |
| tutoreligibilityrequest_id | FK tutor_eligibility_request.id | no | `ON DELETE CASCADE`. |
| project_id | FK project.id | no | `ON DELETE PROTECT`. |

`UNIQUE (tutoreligibilityrequest_id, project_id)` (created by Django).

### 3.4 tutor_eligibility

The current permission: which Hitchhiker may pick slots for which project. Every eligibility check reads only this table.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | BIGINT | no | |
| tutor_id | FK user.id | no | `ON DELETE CASCADE`. |
| project_id | FK project.id | no | `ON DELETE CASCADE`. |
| granted_by_request_id | FK tutor_eligibility_request.id | yes | `ON DELETE SET NULL`. The request whose approval created this row. |

`UNIQUE (tutor_id, project_id)`.

Rules:

- Approving a request runs in one transaction: a conditional update moves the request from `pending` to `approved` (0 rows updated means another reviewer was first: 409), then `bulk_create(..., ignore_conflicts=True)` inserts one row per listed project. Projects the tutor was already eligible for are skipped silently.
- Revoking eligibility (api-plan §10.3) deletes the row. It does not change existing `awaiting_confirmation` or `confirmed` evaluation requests; it only prevents new picks.
- Losing the `tutor` role leaves the rows in place. Every pick checks the role and eligibility together, so the rows are inert until the role is given back.

---

## 4. Evaluations — YES

There is one table. A request is created by the student, picked by a Hitchhiker, confirmed or declined by the student, and finally kept as history. There is no separate slot or evaluation table.

### 4.1 evaluation_request

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | BIGINT | no | |
| student_id | FK user.id | no | The requester. |
| project_id | FK project.id | no | |
| note | varchar(500) | no | Optional message from the student. Default empty string. |
| status | varchar(32) | no | `pending`, `awaiting_confirmation`, `confirmed`, `cancelled`, `expired`. Default `pending`. |
| picked_by_id | FK user.id | yes | The Hitchhiker holding the slot. |
| starts_at | datetime(6) | yes | Proposed by the Hitchhiker on pick. |
| ends_at | datetime(6) | yes | |
| cancelled_by_id | FK user.id | yes | `ON DELETE SET NULL`. The student, or the Head Tutor or Admin who cancelled by override. |
| cancelled_at | datetime(6) | yes | |
| expired_at | datetime(6) | yes | Set by the expiry job. |
| result | varchar(16) | yes | `passed`, `failed`. Entered manually by the team in the Django admin. |
| feedback | text | no | Entered manually with the result. Default empty string. |
| completed_at | datetime(6) | yes | Entered manually with the result. |

Check constraints (`Meta.constraints`, one `CheckConstraint` each):

| Name | Rule |
| --- | --- |
| `eval_req_pick_consistent` | `picked_by_id`, `starts_at` and `ends_at` are all NULL or all NOT NULL. |
| `eval_req_pick_matches_status` | Picked fields are NOT NULL exactly when `status` is `awaiting_confirmation` or `confirmed`. A cancelled or expired request keeps no pick. |
| `eval_req_slot_order` | `ends_at > starts_at` when both are set. |
| `eval_req_cancel_consistent` | `cancelled_at` is NOT NULL exactly when `status = 'cancelled'`. |
| `eval_req_expire_consistent` | `expired_at` is NOT NULL exactly when `status = 'expired'`. |
| `eval_req_result_only_confirmed` | `result` and `completed_at` are NULL unless `status = 'confirmed'`. |

A student may have at most one active request per project (api-plan §7.1). MySQL cannot express this as an index, so the create endpoint enforces it in code: it locks the student's `user` row with `select_for_update()` and checks for an active request inside the same transaction.

When a pick is cleared (decline, release, cancel, expire), `picked_by_id`, `starts_at` and `ends_at` are reset to NULL. The fact that a Hitchhiker once picked a request is recorded in the notification and audit trail, not on the row.

Indexes:

- `(status, project_id, created_at)`: the open queue for Hitchhikers
- `(student_id, status)`: a student's requests
- `(picked_by_id, status, starts_at)`: a Hitchhiker's slots and the overlap check
- `(status, starts_at)`: the expiry job

### 4.2 Concurrency: atomic conditional updates

Two Hitchhikers may press "pick" on the same request at the same moment. Protection does not rely on a unique index. Every state change is a single conditional `UPDATE` that names the state it expects:

```python
updated = EvaluationRequest.objects.filter(
    pk=pk, status=Status.PENDING, picked_by__isnull=True
).update(
    status=Status.AWAITING_CONFIRMATION,
    picked_by=tutor, starts_at=starts_at, ends_at=ends_at, updated_at=now(),
)
if updated == 0:
    raise RequestNotPending()  # 409 request_not_pending
```

MySQL locks the row for the statement, so of two simultaneous picks exactly one sees `updated == 1`. The same pattern is mandatory for every transition (confirm, decline, release, cancel, expire), each filtering on its expected `status` and, where relevant, `picked_by`. A plain read-then-`save()` is not allowed for these fields.

The overlap checks (api-plan §7.1) read other rows, so the pick runs inside `transaction.atomic()` and first locks the `user` rows of both the Hitchhiker and the student with `select_for_update()`, in ascending id order so two picks can never deadlock. That serializes picks involving the same people without blocking anyone else.

The check constraints in §4.1 are the database-level safety net: a buggy code path that tries to write an inconsistent row fails instead of corrupting data.

### 4.3 Expiry

A Celery beat task runs every 5 minutes and applies two conditional updates:

- `pending` requests with `created_at` older than 14 days become `expired`
- `awaiting_confirmation` requests whose `starts_at` has passed become `expired` (the student never confirmed)

Both set `expired_at` and clear the pick fields. `confirmed` requests are never expired: once `ends_at` has passed they are history and wait for the team to enter a result.

The 14 days is the setting `EVALUATION_REQUEST_TTL_DAYS`.

---

## 5. Notifications — YES

### 5.1 notification

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | BIGINT | no | |
| recipient_id | FK user.id | no | `ON DELETE CASCADE`. |
| type | varchar(64) | no | One of the types in api-plan §8.8, e.g. `evaluation.slot_picked`. |
| payload | json | no | The facts needed to write the message (ids, names, times). Schema per type in api-plan §8.8. |
| target_url | varchar(255) | no | In-app path the notification opens, e.g. `/evaluations/42`. Empty string when there is none. |
| read_at | datetime(6) | yes | NULL means unread. |

Index: `(recipient_id, read_at, created_at)`.

The sentence the user reads is never stored. The frontend builds it from `type` and `payload` in the user's current language, so old notifications stay correct after a language switch.

Notifications are created only by backend code, in the same transaction as the action that caused them (`transaction.on_commit` for the WebSocket push). A Celery beat task deletes notifications older than 90 days (`NOTIFICATION_RETENTION_DAYS`).

---

## 6. Student Council — sc_message YES, the rest ?

### 6.1 sc_message — YES

Anonymous messages from any user to the Student Council. Council members read them, mark them read or unread, and keep an internal note.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | BIGINT | no | |
| sender_id | FK user.id | yes | `ON DELETE SET NULL`. Stored only for abuse investigation. |
| body | text | no | 1–5000 characters. |
| read_at | datetime(6) | yes | NULL means unread. Shared by all council members. |
| discussion_note | text | no | Internal note by council members. Never shown to the sender. Default empty string. |
| discussion_note_version | int UNSIGNED | no | Default 0. Incremented on every note change; protects against two members overwriting each other. |

Index: `(read_at, created_at)`.

Several council members may edit the note at the same time. A note update is a conditional update on the version the editor started from (`filter(pk=…, discussion_note_version=v).update(discussion_note=…, discussion_note_version=v + 1)`); 0 rows updated means someone else saved first, and the API answers 409 `edit_conflict` (api-plan §10.6).

Anonymity is an API contract, not a database guarantee. `sender_id` is never included in any response except the audited admin endpoint (api-plan §10.6), and every use of that endpoint writes an `audit_log` row. Senders cannot list the messages they sent.

There is no status, archive or reply. "Answered" is impossible by design, because the sender is anonymous.

### 6.2 announcement — ? NOT YET AGREED

> Proposal only. Do not build until the team approves it.

| Column | Type | Notes |
| --- | --- | --- |
| author_id | FK user.id | |
| title | varchar(200) | |
| body | text | |
| audience | varchar(32) | `public`, `all_authenticated`, `students`, `tutors`, `sc_members`. An enum, not an FK to `role`, because `public` and `all_authenticated` are not roles. |
| published_at | datetime(6) NULL | NULL = draft |

### 6.3 Polls — ? NOT YET AGREED

> Proposal only. Before it is final the team must agree whether split ballot/vote tables are wanted (results can never be audited or recounted), who may create polls, and whether votes can be changed.

- `poll` (author_id, question)
- `poll_option` (poll_id, body, position)
- `poll_ballot` (poll_id, user_id) with `UNIQUE (poll_id, user_id)`: records that a user voted, which prevents double voting
- `poll_vote` (poll_id, option_id): records what was chosen, with no column, FK or code path linking it back to a ballot

The ballot and vote are inserted in the same transaction as two independent rows, so a rollback cannot leave one without the other.

---

## 7. Files — YES

### 7.1 file

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | BIGINT | no | |
| owner_id | FK user.id | no | Uploader. |
| kind | varchar(32) | no | `avatar`, `tutor_resource`. |
| visibility | varchar(16) | no | `authenticated` (any logged-in user) or `tutors` (`tutor`, `head_tutor`, `admin`). Avatars are always `authenticated`. |
| project_id | FK project.id | yes | `ON DELETE SET NULL`. Optional project a tutor resource belongs to. Always NULL for avatars. |
| title | varchar(200) | no | Display title. Defaults to the original name. |
| description | varchar(1000) | no | Default empty string. |
| original_name | varchar(255) | no | Filename as uploaded, shown to users. |
| storage_name | varchar(64) UNIQUE | no | Random `uuid4().hex` plus extension. The only name used on disk. |
| content_type | varchar(100) | no | Detected from the file contents, not trusted from the upload. |
| size_bytes | BIGINT UNSIGNED | no | |

Bytes live in the `media` Docker volume under `MEDIA_ROOT/<kind>/<storage_name>`. Nginx never serves that folder; every download goes through Django, which checks permission first.

Deleting a `file` row deletes its bytes (`transaction.on_commit`). Replacing an avatar deletes the previous avatar file; the replacement locks the user's row so two simultaneous uploads cannot leave an orphaned file.

---

## 8. Audit log — YES

### 8.1 audit_log

Append-only record of sensitive actions. Rows are never updated or deleted by the application.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| id | BIGINT | no | |
| actor_id | FK user.id | yes | `ON DELETE SET NULL`. The user who performed the action. |
| action | varchar(64) | no | One of the actions in api-plan §10.9. |
| target_type | varchar(32) | no | `user`, `evaluation_request`, `tutor_eligibility_request`, `tutor_eligibility`, `sc_message`, `file`. |
| target_id | BIGINT | no | Id of the target row. Not an FK, so the log survives deletion of the target. |
| reason | varchar(500) | no | Required for admin overrides and sender reveals; empty otherwise. |
| metadata | json | no | Before/after values or other context. Never contains passwords or message bodies. |

`updated_at` is unused on this table. Index: `(target_type, target_id)`, `(actor_id, created_at)`, `(action, created_at)`.

---

## 9. Background jobs

| Task | Schedule | Effect |
| --- | --- | --- |
| `expire_evaluation_requests` | every 5 min | §4.3 |
| `purge_old_notifications` | daily | §5.1 |

Each task is idempotent: running it twice, or late, gives the same result.

---

## 10. Relationship overview

```
user ──< user_roles >── role
user ──< tutor_eligibility_request ──< tutor_eligibility_request_projects >── project
user ──< tutor_eligibility >── project
user ──< evaluation_request (student) >── project
user ──< evaluation_request (picked_by)
user ──< notification
user ──< sc_message (sender, hidden)
user ──< file (owner);  user ── avatar ──> file
user ──< audit_log (actor)
```
