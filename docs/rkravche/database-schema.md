# Database Schema

**Status:** Draft for team review
**Owner:** rkravche, IT Architect
**Last updated:** July 28, 2026

---

## 1. Purpose

This document describes the MySQL schema: entities, relations and the constraints that enforce product rules (single claim per slot, role attribution, message anonymity). Tables are implemented as Django models; migrations are the source of truth once code exists.

Conventions:

- `id` is a `BIGINT AUTO_INCREMENT` surrogate key on every table; `created_at` / `updated_at` exist everywhere (omitted below for clarity); FKs note `ON DELETE` only where non-obvious.
- All tables are InnoDB.
- Datetime columns are `DATETIME(6)` holding UTC.
- The default collation is case-insensitive, so unique indexes on email and slugs reject case-variant duplicates without extra work.
- Sections marked "YES" are agreed by the team and safe to build against. Sections marked "?" are proposals only, pending a team decision do not implement until confirmed.

---

## 2. Identity and access "YES"

### user
| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT AUTO_INCREMENT | |
| email | varchar(254) UNIQUE | login identifier (mandatory email+password auth); case-insensitive by collation |
| password_hash | text | managed by Django (Argon2, salted) |
| display_name | varchar(64) | shown in the UI — email is not a display name |
| intra_login | varchar(64) UNIQUE NULL | set when linked via 42 OAuth |
| avatar_file_id | FK file.id NULL | default avatar when NULL |
| language | enum | `en`, `cs`, `es` |
| status | enum | `active`, `suspended` |

### role
| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT AUTO_INCREMENT| |
| name | varchar(254) UNIQUE | |

Seed rows: `student`, `tutor`, `head_tutor`, `sc_member`, `admin`.

### user_roles
| Column | Type | Notes |
| --- | --- | --- |
| user_id | FK user.id | |
| role_id | FK role.id | |

`UNIQUE (user_id, role_id)`. Every authenticated user implicitly holds Student capabilities.

---

## 3. Evaluations "YES"

### project
| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT AUTO_INCREMENT| |
| slug | varchar(64) UNIQUE | e.g. `libft` |
| name | text | |
| is_active | bool | inactive projects are hidden but not deleted |

### tutor_eligibility
| Column | Type | Notes |
| --- | --- | --- |
| tutor_id | FK user.id | |
| project_id | FK project.id | |

`UNIQUE (tutor_id, project_id)`.

### evaluation_request
| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT AUTO_INCREMENT| |
| student_id | FK user.id | |
| project_id | FK project.id | |
| note | text | optional |
| status | enum | `open`, `scheduled`, `cancelled`, `expired`, `completed` |
| expires_at | datetime(6) | Celery decides `open` → `expired` |

### request_slot
| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT AUTO_INCREMENT| |
| request_id | FK evaluation_request.id | CASCADE |
| starts_at | datetime(6) | must be future at creation |
| ends_at | datetime(6) | must be after `starts_at` at creation |

### evaluation
| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT AUTO_INCREMENT| |
| tutor_id | FK user.id | |
| slot_id | FK request_slot.id UNIQUE | we want the evaluation to explicitly show which slot it used to free it if someone cancels the evaluation |
| status | enum | `scheduled`, `completed` |
| feedback | text NULL | required on completed |
| completed_at | datetime(6) NULL | |

**`UNIQUE (slot_id)` is what prevents two tutors claiming the same time.** The foreign key alone would not, it happily allows many evaluations pointing at one slot. With the unique index MySQL rejects the second tutor's insert even if our code has a bug, and the API turns that rejection into "this time is no longer available".

The request is reached through the slot (`slot_id` → `request_slot.request_id`), so no separate `request_id` column is needed.

**Open item:** no rule is yet defined for what happens to a request's *other* proposed slots once one is claimed. Needs a decision likely: leave them, and let the API stop surfacing them once `evaluation_request.status != open`.

---

## 4. Notifications "YES"

### notification
| Column | Type | Notes |
| --- | --- | --- |
| target_id | FK user.id | recipient |
| type | varchar(64) | what happened, e.g. `evaluation.claimed` |
| payload | json | the details needed to write the text: project, tutor name, time |
| target_url | varchar(255) | in-app link, e.g. `/evaluations/42`. |
| read_at | datetime(6) NULL | unread = NULL |

The sentence the user reads is never stored. It is written on screen from `type` + `payload` at the moment it is displayed, which is what keeps old notifications correct after a user switches language.

---

## 5. Student Council domain

### sc_message "YES" — CONFIRMED, agreed by the team

The only Student Council feature currently agreed: students/hitchhikers send anonymous messages, SC members read them, mark them read, and they remain as a shared history for the council to discuss internally.

| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT AUTO_INCREMENT | |
| sender_id | FK user.id NULL | retained even though messages are anonymous, in case abuse ever needs tracing — see note below |
| body | text | the message content |
| read_at | datetime(6) NULL | NULL = unread. Set when any SC member opens it. |
| discussion_note | text NULL | optional internal note SC members add while discussing it among themselves — never shown to the sender |

**Anonymity is an API/UI contract, not a database contract.** `sender_id` is stored, but no API response or SC facing screen ever includes it. This is the only compromise on "fully anonymous"  it exists purely so abuse can be traced by an Administrator through a separate, audited path, not so SC members can see who sent something. If the team wants *zero* identity retention instead (true fire and forget anonymity, no abuse tracing possible), that's a one line change here (drop `sender_id` entirely) should be confirmed either way rather than left implicit.

There's no `subject` or `status` field — the only agreed behavior is read/unread plus a shared discussion trail. Add fields back if/when a real triage or categorization workflow is confirmed.

---

### announcement "?" — NOT YET AGREED

> **Status: open for team discussion, not confirmed.** Describes a possible SC to community posting board (public/students/tutors broadcasts). Do not build against this until the team confirms it's in scope.

| Column | Type | Notes |
| --- | --- | --- |
| author_id | FK user.id |  |
| title | text | |
| body | text | |
| audience | enum | `public`, `students`, `tutors`, `sc_members`, `all_authenticated` — an enum, not an FK to `role`, because `public` and `all_authenticated` are not roles |
| published_at | datetime(6) NULL | NULL = draft |

---

### Polls "?" — NOT YET AGREED

> **Status: open for team discussion, not confirmed.** Proposal only, written to resolve the anonymity gap flagged in `architecture-questions.md` Q2 (the original single table `poll_vote` let anyone with DB access match a voter to their choice, contradicting the anonymity promise in `privacy-requirements.md` §8). Before this is final, the team should agree on:
> - whether split ballot/vote tables are the right approach at all,
> - whether poll results should ever be recomputable/auditable (this design makes that structurally impossible),
> - who is allowed to create polls,
> - and the open per-poll questions from `privacy-requirements.md` §8 (can users change their vote? how long is ballot data retained?).
>
> Do not build against this until confirmed.

### poll
| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT AUTO_INCREMENT| |
| author_id | FK user.id | |
| question | text | |

### poll_option
| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT AUTO_INCREMENT| |
| poll_id | FK poll.id | |
| body | text | |
| position | int | |

### poll_ballot
| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT AUTO_INCREMENT | |
| poll_id | FK poll.id | |
| user_id | FK user.id | records *that* this user voted, not *what* they chose |

`UNIQUE (poll_id, user_id)` — this alone prevents double voting.

### poll_vote
| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT AUTO_INCREMENT | |
| poll_id | FK poll.id | |
| option_id | FK poll_option.id | |

No `user_id` column here, and no FK, join, or code path connecting a `poll_vote` row back to a `poll_ballot` row. That absence is what makes anonymity a database-level guarantee instead of a documented policy — *if the team confirms this is the approach they want* (see warning above). The vote is inserted in the same transaction as the ballot, but as two independent inserts, so a rollback can't leave one without the other.

---

## 6. Files "YES"

### file
| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT AUTO_INCREMENT| |
| owner_id | FK user.id | |
| kind | enum | `avatar`, `tutor_resource`, `announcement_attachment` |
| name | text | the original name, shown to the user |
| random_name | text | two users upload `image.png` and now we have two ambiguous files on the disk |
| visibility | enum | `owner`, `tutors`, `authenticated`, `public` — checked by Django before the file is served |

Note: `announcement_attachment` as a `kind` value depends on the `announcement` table above ("?" not yet agreed). If announcements end up out of scope, this enum value should be dropped too.

---

# Administration "YES"

The administration module provides tools for managing the platform and handling exceptional situations.

This module is restricted to users with elevated permissions.

Main responsibilities:

- Monitor invalid system states.
- Resolve evaluation problems manually.
- Maintain audit records.
- Provide administrative control over important actions.

All administrative actions should be logged for security and accountability.

---

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/admin/evaluations/exceptions/` | Head Tutor, Administrator | Returns evaluations or requests that are stuck in an invalid state. |
| POST | `/admin/evaluations/{id}/resolve/` | Head Tutor, Administrator | Allows manual correction of evaluation states. Action must be logged. |
| GET | `/admin/audit-log/` | Administrator | Read-only access to administrative activity logs. |

---

# Administrative Action Logging

Sensitive administrative operations should record:

```text id="x7d3vz"
actor
action
target
timestamp
reason
```

## Final Notes

This API plan represents the communication contract between the React frontend and Python backend.

The goal is to keep development consistent, predictable, and maintainable.

Confirmed features marked as **YES** can be implemented.

Features marked with **?** require team discussion before development.