# Database Schema

Status: placeholder / waiting for final feature decisions  
Owner: TBD  
Last updated: TBD

## Purpose

This document will describe database tables, relations, and constraints.

For now, this is a draft schema to guide discussion.

## Main entities draft

```txt
User
Role
UserRole
Profile
Organization
OrganizationMember
Project
ProjectResource
EvaluationSlot
Notification
Suggestion
Announcement
AuditEvent
```

## Relationship mockup

```txt
User 1 ─── 1 Profile

User 1 ─── * UserRole * ─── 1 Role

User 1 ─── * OrganizationMember * ─── 1 Organization

Project 1 ─── * ProjectResource

User 1 ─── * EvaluationSlot           as student
User 1 ─── * EvaluationSlot           as claimed tutor

User 1 ─── * Notification

User 1 ─── * Suggestion               nullable user for anonymous suggestions

User 1 ─── * Announcement             as author
```

## Tables draft

### users

| Column | Type | Notes |
|---|---|---|
| id | uuid/int | Primary key |
| email | string | Unique if email auth used |
| password_hash | string/null | Nullable if OAuth-only user |
| intra_id | string/null | 42 user id |
| intra_login | string/null | 42 login |
| is_active | bool | Account status |
| created_at | timestamp | |
| updated_at | timestamp | |

### roles

| Column | Type | Notes |
|---|---|---|
| id | uuid/int | Primary key |
| name | string | student/tutor/head_tutor/etc. |

### user_roles

| Column | Type | Notes |
|---|---|---|
| user_id | FK | |
| role_id | FK | |
| created_at | timestamp | |
| created_by_id | FK/null | admin who assigned it |

Constraint:

```txt
unique(user_id, role_id)
```

### profiles

| Column | Type | Notes |
|---|---|---|
| user_id | FK | One profile per user |
| display_name | string | |
| bio | text | |
| avatar_url | string/null | |
| public_visible | bool | |
| location_label | string/null | e.g. c2r2s2 |
| online_status | string | offline/online/available/busy |
| updated_at | timestamp | |

### projects

| Column | Type | Notes |
|---|---|---|
| id | uuid/int | Primary key |
| name | string | e.g. webserv |
| slug | string | |
| cursus | string/null | |
| is_active | bool | |
| intra_project_id | string/null | 42 API mapping |

### evaluation_slots

| Column | Type | Notes |
|---|---|---|
| id | uuid/int | Primary key |
| student_id | FK users | creator/evaluatee |
| project_id | FK projects | |
| starts_at | timestamp | |
| ends_at | timestamp | |
| status | enum/string | open/claimed/cancelled/expired/completed |
| claimed_by_id | FK users/null | tutor |
| student_note | text/null | |
| tutor_note | text/null | |
| created_at | timestamp | |
| updated_at | timestamp | |

Important:

- claim operation must be atomic
- query by project/date/status
- index `status`, `starts_at`, `project_id`

### suggestions

| Column | Type | Notes |
|---|---|---|
| id | uuid/int | |
| user_id | FK/null | null for anonymous |
| display_intra_name | bool | for logged-in suggestions |
| message | text | |
| status | string | new/reviewed/archived |
| created_at | timestamp | |

## Open decisions

- UUID or integer primary keys?
- Soft delete or hard delete?
- How much 42 API data should be stored?
- Store user online status in DB or Redis?
- Store notifications in DB only, or DB + realtime push?
