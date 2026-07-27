# Database Schema

**Status:** Draft for team review
**Owner:** rkravche, IT Architect
**Last updated:** July 27, 2026

---

## 1. Purpose

This document describes the MySQL schema: entities, relations and the constraints that enforce product rules (single claim per slot, single vote per poll, role attribution). Tables are implemented as Django models; migrations are the source of truth once code exists.

Conventions:

- `id` is a `BIGINT AUTO_INCREMENT` surrogate key on every table; `created_at` / `updated_at` exist everywhere (omitted below for clarity); FKs note `ON DELETE` only where non-obvious.
- All tables are InnoDB.
- Datetime columns are `DATETIME(6)` holding UTC.
- The default collation is case-insensitive, so unique indexes on email and slugs reject case-variant duplicates without extra work.

---

## 2. Identity and access

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

## 3. Evaluations

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

**`UNIQUE (slot_id)` is what prevents two tutors claiming the same time.** The foreign key alone would not — it happily allows many evaluations pointing at one slot. With the unique index MySQL rejects the second tutor's insert even if our code has a bug, and the API turns that rejection into "this time is no longer available".

The request is reached through the slot (`slot_id` → `request_slot.request_id`), so no separate `request_id` column is needed.

---

## 4. Notifications

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

### announcement
| Column | Type | Notes |
| --- | --- | --- |
| author_id | FK user.id |  |
| title | text | |
| body | text | |
| audience | enum | `public`, `students`, `tutors`, `sc_members`, `all_authenticated` — an enum, not an FK to `role`, because `public` and `all_authenticated` are not roles |
| published_at | datetime(6) NULL | NULL = draft |

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

### poll_vote
| Column | Type | Notes |
| --- | --- | --- |
| poll_id | FK poll.id | |
| user_id | FK user.id | |
| option_id | FK poll_option.id | |

`UNIQUE (poll_id, user_id)` — duplicate voting is impossible at the DB level.

---

## 6. Files

### file
| Column | Type | Notes |
| --- | --- | --- |
| id | BIGINT AUTO_INCREMENT| |
| owner_id | FK user.id | |
| kind | enum | `avatar`, `tutor_resource`, `announcement_attachment` |
| name | text | the original name, shown to the user |
| random_name | text | two users upload `image.png` and now we have two ambiguous files on the disk |
| visibility | enum | `owner`, `tutors`, `authenticated`, `public` — checked by Django before the file is served |

---
