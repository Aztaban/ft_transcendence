# API Plan — Transcendence

**Status:** Approved for implementation (features marked "?" excepted)
**Owner:** rkravche, IT Architect
**Last updated:** October 6, 2026

## 1. Purpose

This document is the contract between the React frontend and the Django backend: every endpoint, who may call it, what it accepts, what it returns and which errors it produces. The tables behind it are described in `docs/database-schema.md`.

How to use it:

- **Implement exactly what is written here.** Field names, status values, error codes and status codes are part of the contract.
- **If something you need is not specified, stop and ask the IT Architect.** Do not invent a field, an endpoint or an error code. A guess that works locally becomes a mismatch on the other side.
- **A change to the contract is a PR to this file**, reviewed before or together with the code that implements it.
- Documents in `Info/Preparation/` are early planning material. Where they disagree with this file or the schema, this file wins.

## 2. Architecture overview

```
Browser (React SPA)
   │  HTTPS: REST /api/v1/…   WSS: /ws/
   ▼
Nginx (TLS, reverse proxy)
   ├── /api/, /ws/, /health/, /admin/, /static/ → Django (DRF + Channels)
   └── /                     → Frontend
Django ── MySQL (all state)
       ── Redis (Channels layer, Celery broker)
       ── Celery worker + beat (expiry, cleanup)
```

- **Frontend:** renders UI, calls REST endpoints, listens to WebSocket events. It holds no business rules and makes no security decisions; hiding a button is a convenience, not a protection.
- **Backend:** validates input, enforces permissions and business rules, writes to MySQL, creates notifications, pushes WebSocket events.
- **HTTP is the source of truth.** A WebSocket event only tells the frontend that something changed. The frontend then re-fetches the affected data over REST (§9).
- **MySQL is never reached by the frontend.** Evaluation results are the one thing written outside the API: the team enters them in the Django admin (§7.1), which is why Nginx routes `/admin/` and its `/static/` assets to Django.
- **Nginx accepts request bodies up to 11 MB** (`client_max_body_size 11m`), so uploads up to the limits in §10.7 reach Django's validation.

## 3. Decisions

### 3.1 Resolved

| # | Decision | Source |
|---|---|---|
| R1 | Tutor eligibility is fully manual. No sync with the 42 Intra API. | Team, July 2026 |
| R2 | One `evaluation_request` resource covers the whole lifecycle. There are no separate slot or evaluation resources. | Architect, Oct 2026 |
| R3 | Concurrent state changes are protected by atomic conditional updates, not by a unique index (schema §4.2). | Architect, Oct 2026 |
| R4 | The `tutor` role is assigned by a Head Tutor or Administrator. Only users holding it can request project eligibility. | `roles-and-permissions.md` §11 |
| R5 | Every account receives the `student` role when it is created. | `roles-and-permissions.md` §11 |
| R6 | When a Hitchhiker gives up a slot (release), the request returns to `pending`. Only the student or an override cancels a request for good. | Team, Oct 2026 |
| R7 | Requests expire automatically: `pending` after 14 days, `awaiting_confirmation` once the proposed start time passes. | Team, Oct 2026 |
| R8 | Evaluation results (`result`, `feedback`, `completed_at`) are columns on the request, entered manually in the Django admin. | Team, Oct 2026 |
| R9 | The Student Council inbox has read/unread and an internal note. No statuses, no archive, no replies. | Team, Oct 2026 |
| R10 | Users have no `bio`. Profiles show display name, avatar and roles. | Team, Oct 2026 |
| R11 | Search is people-only: Hitchhikers, Head Tutors and Student Council members. | Team, Oct 2026 |
| R12 | The GDPR module is out of scope: no data export, no self-service deletion, no email. | Team, Oct 2026 |
| R13 | All errors use one envelope (§5.5). A missing or expired session is 401 everywhere except `GET /auth/session/`, which answers 200 with `authenticated: false` so loading the app never logs a failed request in the browser console (a mandatory subject rule). | Architect, Oct 2026 |
| R14 | Backend messages (`message` and `fields`) are returned in the user's language, because the i18n module requires all user-facing text to be translatable (§5.5). | Architect, Oct 2026 |

### 3.2 Open (not to be built until decided)

- **Announcements** and **Polls** (schema §6.2–6.3). Endpoints are not specified here until the team approves the features.
- **Poll anonymity model** (schema §6.3).

## 4. Scope

| Area | Status | Spec | Subject module |
|---|---|---|---|
| Authentication, session, 42 OAuth | YES | §10.1 | Mandatory user management; Remote authentication (minor) |
| Users, roles, profile, admin user management | YES | §10.2 | Advanced permissions (major) |
| Projects and tutor eligibility | YES | §10.3 | Advanced permissions (major) |
| Evaluation requests | YES | §10.4 | Core product; Real-time (major) |
| Notifications | YES | §10.5, §8.8 | Notification system (minor) |
| Student Council inbox | YES | §10.6 | Core product |
| Files: avatars, tutor resources | YES | §10.7 | File upload and management (minor) |
| People search | YES | §10.8 | Advanced search (minor) |
| Administration: exceptions, audit log | YES | §10.9 | Advanced permissions (major) |
| Real-time events | YES | §9 | Real-time (major) |
| Announcements | ? | — | — |
| Polls | ? | — | — |

## 5. Conventions

These rules apply to every endpoint unless the endpoint says otherwise.

### 5.1 URLs

- All endpoints live under `/api/v1/` and end with a trailing slash: `/api/v1/users/me/`, not `/api/v1/users/me`.
- Path parameters are integer ids, except projects, which use their `slug`.
- Outside `/api/v1/`: `GET /health/` (service health for Docker), `/api/schema/` and `/api/docs/` (generated OpenAPI schema and Swagger UI), `/admin/` (Django admin, team members only), `/ws/` (WebSocket, §9).

### 5.2 Request and response bodies

- JSON (`Content-Type: application/json`) both ways. File uploads use `multipart/form-data`.
- Field names are `snake_case`. Enum values are lowercase `snake_case` strings (`"awaiting_confirmation"`, `"head_tutor"`). The UI translates them into labels; it never displays them raw.
- **Datetimes** are ISO 8601 in UTC with `Z`, e.g. `"2026-10-12T15:00:00Z"`. Responses may include fractional seconds (`"2026-10-12T15:00:00.123456Z"`). Inputs must include a timezone (`Z` or an offset); a datetime without one is rejected with 400.
- **References to other objects** are embedded objects, never bare ids: a user is a `UserRef` (§8.1), a project a `ProjectRef` (§8.6). Inputs refer to objects by id with an `_id` suffix (`"project_id": 4`).
- Nullable fields are always present with `null`. Lists are always present, possibly empty.
- `PATCH` is a partial update: send only the fields being changed. Fields that are not writable, or unknown, are ignored.
- Successful `POST` that creates something returns **201** with the full representation, except where the endpoint says otherwise (register, `POST /sc-messages/`). Action endpoints (`/pick-slot/`, `/confirm/`, …) return **200** with the full, updated representation. `DELETE` returns **204** with no body. `PATCH /users/me/` returns **204** (§10.2).

### 5.3 Authentication

- Session cookie based. A successful login (password or 42 OAuth) sets the `sessionid` cookie (`HttpOnly`, `SameSite=Lax`, and `Secure` in production). The browser sends it automatically. The frontend never sees or stores a token.
- On startup the frontend calls `GET /api/v1/auth/session/`. It always answers 200, and `authenticated` says whether the user is logged in. It is the only endpoint that reports a missing session without 401, so opening the app never logs a failed request in the browser console. The frontend calls other endpoints only after it knows the user is logged in.
- Only users with `status = "active"` are authenticated. Suspending or deleting a user ends all their sessions immediately; their next request gets 401.
- Every endpoint requires authentication unless marked **Public**.

### 5.4 CSRF

- Every `POST`, `PUT`, `PATCH` and `DELETE` must send the header `X-CSRFToken` with the current value of the `csrftoken` cookie. Without it the request fails with 403 `csrf_failed`. This includes `login` and `logout`.
- The `csrftoken` cookie is set by `GET /api/v1/` and by `GET /api/v1/auth/session/`. The frontend calls the latter on startup, so the cookie exists before any form is submitted.
- **Read the cookie on every request; never cache the value.** Django issues a new token at login.
- The frontend's `apiRequest` adds the header to every unsafe method. Individual API functions do not handle CSRF.

### 5.5 Errors

Every error response has this body:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Please correct the highlighted fields.",
    "fields": {
      "display_name": ["Ensure this field has no more than 64 characters."]
    }
  }
}
```

- `code` is stable and machine-readable. The frontend branches on `code`, never on `message`.
- `message` and the texts in `fields` are in the user's language. The frontend sends `Accept-Language` with the user's chosen language (`en`, `cs` or `es`) on every request, and Django's `LocaleMiddleware` activates it (`LANGUAGES` limited to those three). Django and DRF ship Czech and Spanish translations of their built-in messages; the project's own messages are wrapped in `gettext` and translated in `backend/locale/`. The frontend may show `message` as it is, or its own text for a known `code`.
- `fields` is present only for `validation_error`. Keys are input field names; errors that are not tied to one field use the key `non_field_errors`. Each value is a list of messages.
- DRF's default formats (`{"detail": "..."}`, a bare field dict) must never reach the client. They are converted by a project-wide exception handler in `apps.core`.
- **Hiding private objects:** when a user asks for a specific object they are not allowed to see (someone else's evaluation request, a council message), the response is 404 `not_found`, not 403, so its existence is not revealed. Endpoints that are entirely role-gated (e.g. the review table) return 403 `permission_denied`.

### 5.6 Error codes

| Status | Code | When |
|---|---|---|
| 400 | `validation_error` | Input is missing, malformed or breaks a field rule. Comes with `fields`. |
| 401 | `not_authenticated` | No valid session. |
| 401 | `invalid_credentials` | Login with a wrong email or password, or for a suspended or deleted account. |
| 403 | `csrf_failed` | Unsafe method without a valid `X-CSRFToken`. |
| 403 | `permission_denied` | Logged in, but the role or ownership does not allow this action. |
| 403 | `not_eligible` | Picking a slot without the Hitchhiker role or without eligibility for the project. |
| 403 | `cannot_pick_own_request` | A Hitchhiker picking their own request. |
| 403 | `cannot_review_own_request` | Reviewing your own eligibility request. |
| 403 | `role_not_assignable` | The caller may not assign this role, or the role is never assigned through the API (`student`, `admin`). Rules in §5.8. |
| 404 | `not_found` | The object does not exist or is hidden from the caller. |
| 405 | `method_not_allowed` | The endpoint does not support this HTTP method. |
| 409 | `email_already_exists` | Registration or admin edit with an email already in use. |
| 409 | `active_request_exists` | The student already has an active request for this project. |
| 409 | `request_not_pending` | Pick on a request that is no longer `pending` (someone else was faster). |
| 409 | `invalid_state_transition` | Any other action not allowed in the request's current status. |
| 409 | `evaluation_already_started` | Confirm, release or cancel after `starts_at`. |
| 409 | `slot_overlaps` | The Hitchhiker already has an evaluation overlapping this time, as evaluator or as student. |
| 409 | `student_unavailable` | The student already has an evaluation overlapping this time, as student or as evaluator. |
| 409 | `eligibility_request_pending` | The Hitchhiker already has a pending eligibility request. |
| 409 | `eligibility_request_already_reviewed` | Review of a request that is no longer pending. |
| 409 | `role_not_revocable` | Revoking `student`, or `admin` through the API. |
| 409 | `cannot_modify_self` | An admin suspending, deleting or revoking a role from themselves. |
| 409 | `edit_conflict` | Someone else saved the same text since you loaded it (§10.6). Re-fetch and try again. |
| 409 | `invalid_user_status` | Admin action not allowed in the user's current status (e.g. suspending a suspended user, editing a deleted one). |
| 429 | `throttled` | Rate limit hit (§5.9). The `Retry-After` header gives the wait in seconds. |
| 500 | `server_error` | Unexpected failure. The message never contains internal details. |

New codes are added to this table before they are used.

### 5.7 Lists: pagination, filtering, sorting

- Lists are paginated unless the endpoint says otherwise: `?page=1&page_size=20`. Default page size 20, maximum 100.
- Paginated response:
  ```json
  { "count": 57, "next": "https://localhost/api/v1/notifications/?page=2", "previous": null, "results": [ ... ] }
  ```
- Filters are query parameters named after the field (`?status=pending`). Multiple values are comma-separated (`?status=pending,awaiting_confirmation`). Unknown filter values give 400 `validation_error`.
- Sorting: `?ordering=field` ascending, `?ordering=-field` descending. Each endpoint lists its allowed fields and its default.

### 5.8 Roles and permissions

Role names on the wire: `student`, `tutor`, `head_tutor`, `sc_member`, `admin`. The UI calls `tutor` "Hitchhiker" and `sc_member` "Student Council".

| Term used in endpoint tables | Meaning |
|---|---|
| Public | No login required. |
| Authenticated | Any active logged-in user. Every account holds `student`, so "Student" actions are open to all authenticated users. |
| Own | The authenticated user acting on their own data. |
| Hitchhiker | Holds `tutor` or `head_tutor`. |
| Eligible Hitchhiker | Hitchhiker with a `tutor_eligibility` row for the request's project. |
| Head Tutor | Holds `head_tutor`. |
| SC Member | Holds `sc_member`. |
| Admin | Holds `admin`. Does not imply any other role. |
| Override | Head Tutor or Admin acting on someone else's evaluation request. Requires a `reason` and writes an audit log entry. |

Role assignment rules:

| Role | Assigned by | Revoked by |
|---|---|---|
| `student` | Automatically at account creation | Never |
| `tutor` | Head Tutor, Admin | Admin |
| `head_tutor` | Admin | Admin |
| `sc_member` | SC Member, Admin | Admin |
| `admin` | Django admin only (`/admin/`), never the API | Django admin only |

`student` and `admin` are never assigned through the API: asking for them returns 403 `role_not_assignable`.

Role changes take effect on the user's next request, because permissions are read from the database every time.

### 5.9 Rate limits

| Scope | Limit |
|---|---|
| `POST /auth/login/`, `POST /auth/register/` | 10 per minute per IP |
| `POST /sc-messages/` | 10 per hour per user |
| File uploads | 30 per hour per user |
| `GET /search/people/` | 60 per minute per user |
| Everything else | 1000 per hour per user |

Exceeding a limit returns 429 `throttled`. Per-IP limits use the client address Nginx puts in `X-Forwarded-For` (DRF `NUM_PROXIES = 1`); otherwise every request would appear to come from Nginx.

### 5.10 OpenAPI schema and frontend types

The backend publishes its OpenAPI schema at `/api/schema/` (drf-spectacular). Serializers must describe their output exactly, including `SerializerMethodField`s (annotate them with `@extend_schema_field`), so the schema matches §8.

The frontend's TypeScript types for API data must match §8 field for field. The target is to generate them from the schema (`openapi-typescript` → `frontend/src/api/schema.d.ts`) and fail CI when the generated file is out of date. Until that is in place, the hand-written types in `frontend/src/types/` are checked against this document in review.

## 6. Endpoint summary

| Module | Endpoints | Section |
|---|---|---|
| Authentication | 7 | §10.1 |
| Users, roles, admin user management | 13 | §10.2 |
| Projects and eligibility | 8 | §10.3 |
| Evaluation requests | 9 | §10.4 |
| Notifications | 5 | §10.5 |
| Student Council inbox | 6 | §10.6 |
| Files | 6 | §10.7 |
| Search | 1 | §10.8 |
| Administration | 2 | §10.9 |

## 7. Workflows

### 7.1 Evaluation request lifecycle

```
          ┌──────── decline (student) / release (Hitchhiker) ─────────┐
          ▼                                                            │
create ─► pending ─── pick ───► awaiting_confirmation ─── confirm ───► confirmed
          │                          │                                   │
          │ 14 days without a pick   │ starts_at passed, unconfirmed     │ ends_at passed
          ▼                          ▼                                   ▼
       expired                    expired                     history (result entered later)

pending, awaiting_confirmation, or confirmed before starts_at ── cancel ──► cancelled
```

Decline goes back from `awaiting_confirmation`; release goes back from `awaiting_confirmation` or `confirmed`.

| Status | Meaning |
|---|---|
| `pending` | Open. Visible to eligible Hitchhikers. No slot yet. |
| `awaiting_confirmation` | A Hitchhiker proposed a slot. The student must confirm or decline. |
| `confirmed` | The student accepted the slot. Before `starts_at` it is upcoming; after `ends_at` it is history. |
| `cancelled` | Ended for good by the student or by an override. Final. |
| `expired` | Ended automatically (schema §4.3). Final. |

**Transitions.** Every transition is an atomic conditional update on the expected current status (schema §4.2).

| Action | Endpoint | Allowed from | To | Who | Extra conditions |
|---|---|---|---|---|---|
| create | `POST /evaluation-requests/` | — | `pending` | Authenticated | Project active; no active request for the same project |
| edit note | `PATCH /evaluation-requests/{id}/` | `pending` | `pending` | Own student | |
| pick | `POST …/{id}/pick-slot/` | `pending` | `awaiting_confirmation` | Eligible Hitchhiker | Not own request; slot rules below; no overlaps |
| confirm | `POST …/{id}/confirm/` | `awaiting_confirmation` | `confirmed` | Own student | Before `starts_at` |
| decline | `POST …/{id}/decline/` | `awaiting_confirmation` | `pending` | Own student | |
| release | `POST …/{id}/release/` | `awaiting_confirmation`, `confirmed` | `pending` | The picking Hitchhiker, or override | Before `starts_at` |
| cancel | `POST …/{id}/cancel/` | `pending`, `awaiting_confirmation`, `confirmed` | `cancelled` | Own student, or override | Before `starts_at`; an override any time, unless a result is recorded |
| expire | Celery job | `pending` (14 days old), `awaiting_confirmation` (`starts_at` passed) | `expired` | System | |

Decline, release, cancel and expire clear `picked_by`, `starts_at` and `ends_at`.

**Rules:**

- **Active request:** a request is active while it is `pending`, `awaiting_confirmation`, or `confirmed` with `ends_at` in the future. A student can have at most one active request per project (409 `active_request_exists`, enforced under a lock: schema §4.1).
- **Slot rules for pick-slot** (400 `validation_error` on the field):
  - `starts_at` and `ends_at` fall on 15-minute boundaries (`:00`, `:15`, `:30`, `:45`, zero seconds)
  - duration between 15 and 120 minutes
  - `starts_at` at least 30 minutes and at most 14 days in the future
- **Overlaps:** a person cannot be in two evaluations at once. Neither the Hitchhiker nor the student may already be in an `awaiting_confirmation` or `confirmed` request overlapping the proposed time, whether as student or as Hitchhiker (409 `slot_overlaps` for the Hitchhiker, 409 `student_unavailable` for the student).
- **History:** a request is history when it is `cancelled` or `expired`, or `confirmed` with `ends_at` in the past. Everything else is active.
- **Results:** after the evaluation the team enters `result` (`passed` / `failed`), `feedback` and `completed_at` in the Django admin. The API only reads them. They can only be set on a `confirmed` request whose `ends_at` has passed.
- **Losing eligibility or the Hitchhiker role** does not change requests already picked. They show up in the exceptions list (§10.9) for a Head Tutor or Admin to resolve.

The numeric limits are settings (`EVALUATION_SLOT_*`, `EVALUATION_REQUEST_TTL_DAYS`) so they can be tuned without code changes.

### 7.2 Becoming a Hitchhiker and requesting eligibility

```
Head Tutor or Admin assigns the `tutor` role (POST /users/{id}/roles/)
   │
   ▼
User switches to the Hitchhiker workspace for the first time
   │  (frontend: user holds `tutor`/`head_tutor` and has no eligibility and no pending request)
   ▼
Selects every project they want to evaluate → one eligibility request (pending)
   │
   ▼
Head Tutors are notified; they review requests in a table (requester + full project list)
   │
   ├── approved → eligible for every listed project (one tutor_eligibility row each)
   └── declined → eligible for none; the Hitchhiker may submit a new request
```

- One `pending` request per Hitchhiker at a time. After a decision they may submit another, e.g. to add projects later.
- The decision covers the whole request. There is no per-project outcome.
- A Head Tutor cannot review their own request; another Head Tutor or an Admin does.
- A Head Tutor or Admin can revoke a single project's eligibility later (§10.3). Revocation affects future picks only.

### 7.3 Student Council inbox

```
Any user ──POST /sc-messages/──► stored with sender_id (hidden)
                                  │
                                  ▼
            SC members notified; read the inbox (no sender), mark read/unread, keep a discussion note
                                  │
                                  ▼
          Only in case of abuse: Admin reveals the sender with a written reason (audit-logged)
```

The sender gets no copy and cannot list sent messages. The submission form tells the user that their identity is stored for abuse investigation only.

## 8. Representations

Each representation is what the API returns. Endpoints refer to them by name.

### 8.1 UserRef

The short form used whenever another user is referenced.

```json
{ "id": 42, "display_name": "Alice", "avatar_url": null }
```

### 8.2 Me

Returned by `GET /users/me/`. The only representation with private fields of the caller.

| Field | Type | Writable via PATCH /users/me/ | Notes |
|---|---|---|---|
| id | integer | no | |
| email | string | no | Login identifier. |
| display_name | string, 1–64 chars | yes | Leading and trailing spaces are trimmed. Not unique. |
| avatar_url | string or null | no | Relative URL of the avatar download (§10.7). `null` means use the default avatar. Changed through `/users/me/avatar/`. |
| language | `"en"`, `"cs"`, `"es"` | yes | `cs` is the language code; `cz` is invalid. |
| roles | Role[] | no | Always present, sorted by name. Every account has at least `student`. |
| intra_login | string or null | no | 42 login when the account came from 42 OAuth. |

```json
{
  "id": 7,
  "email": "alice@example.com",
  "display_name": "Alice",
  "avatar_url": "/api/v1/files/31/download/",
  "language": "en",
  "roles": [{ "id": 1, "name": "student" }, { "id": 2, "name": "tutor" }],
  "intra_login": "alice42"
}
```

### 8.3 PublicUser

Returned by `GET /users/{id}/` and role assignment. Never contains `email`, `intra_login`, `language` or `status`.

```json
{ "id": 7, "display_name": "Alice", "avatar_url": null, "roles": [{ "id": 1, "name": "student" }] }
```

### 8.4 AdminUser

Returned by the admin user endpoints only. `Me` plus:

| Field | Type | Notes |
|---|---|---|
| status | `"active"`, `"suspended"`, `"deleted"` | |
| created_at | datetime | |
| last_login | datetime or null | |

### 8.5 Role

```json
{ "id": 2, "name": "tutor" }
```

### 8.6 ProjectRef and Project

`ProjectRef`, used everywhere a project is referenced:

```json
{ "id": 4, "slug": "libft", "name": "Libft" }
```

`Project` (detail endpoint only) is `ProjectRef` plus `eligible_tutors`: a `UserRef[]` of active Hitchhikers eligible for it, sorted by display name.

### 8.7 EvaluationRequest

| Field | Type | Notes |
|---|---|---|
| id | integer | |
| student | UserRef | |
| project | ProjectRef | |
| note | string | Up to 500 chars. Empty string when none. |
| status | `pending`, `awaiting_confirmation`, `confirmed`, `cancelled`, `expired` | |
| picked_by | UserRef or null | Set only in `awaiting_confirmation` and `confirmed`. |
| starts_at | datetime or null | Same as `picked_by`. |
| ends_at | datetime or null | Same as `picked_by`. |
| cancelled_by | UserRef or null | |
| cancelled_at | datetime or null | |
| expired_at | datetime or null | |
| result | `"passed"`, `"failed"` or null | Manual entry by the team. |
| feedback | string | Manual entry. Empty string when none. |
| completed_at | datetime or null | Manual entry. |
| is_history | boolean | Derived, §7.1. |
| created_at | datetime | |
| updated_at | datetime | |

```json
{
  "id": 17,
  "student": { "id": 7, "display_name": "Alice", "avatar_url": null },
  "project": { "id": 4, "slug": "libft", "name": "Libft" },
  "note": "Need help with parsing.",
  "status": "awaiting_confirmation",
  "picked_by": { "id": 42, "display_name": "Bob", "avatar_url": null },
  "starts_at": "2026-10-12T15:00:00Z",
  "ends_at": "2026-10-12T15:45:00Z",
  "cancelled_by": null,
  "cancelled_at": null,
  "expired_at": null,
  "result": null,
  "feedback": "",
  "completed_at": null,
  "is_history": false,
  "created_at": "2026-10-10T09:12:44Z",
  "updated_at": "2026-10-11T18:03:10Z"
}
```

**Who can see a request** (anyone else gets 404):

- the student who created it
- the Hitchhiker in `picked_by`
- while `pending`: every eligible Hitchhiker except the student themselves
- Head Tutors and Admins

### 8.8 Notification

| Field | Type | Notes |
|---|---|---|
| id | integer | |
| type | string | One of the types below. |
| payload | object | Shape depends on `type`. |
| target_url | string | Frontend route to open; empty when the notification has no target. |
| read_at | datetime or null | `null` = unread. |
| created_at | datetime | |

The frontend builds the displayed sentence from `type` and `payload` in the current language. The backend never sends sentences. `target_url` values are routes the frontend must provide.

Every create, update or delete action that affects another user notifies that user, as listed below. Actions that affect only the person performing them notify no one.

**Types**, with recipients and payload. `user` objects in payloads are `{id, display_name}`; `project` objects are `ProjectRef`.

| type | Recipients | payload | target_url |
|---|---|---|---|
| `evaluation.created` | Eligible Hitchhikers of the project (except the student) | `{request_id, project, student}` | `/evaluations/{id}` |
| `evaluation.slot_picked` | Student | `{request_id, project, tutor, starts_at, ends_at}` | `/evaluations/{id}` |
| `evaluation.confirmed` | Picking Hitchhiker | `{request_id, project, student, starts_at, ends_at}` | `/evaluations/{id}` |
| `evaluation.declined` | Picking Hitchhiker | `{request_id, project, student}` | `/evaluations/{id}` |
| `evaluation.released` | Student | `{request_id, project, tutor}` | `/evaluations/{id}` |
| `evaluation.cancelled` | Picking Hitchhiker if any; the student if cancelled by override | `{request_id, project, cancelled_by}` | `/evaluations/{id}` |
| `evaluation.expired` | Student; also the Hitchhiker if it was `awaiting_confirmation` | `{request_id, project, previous_status}` | `/evaluations/{id}` |
| `evaluation.result_recorded` | Student and Hitchhiker | `{request_id, project, result}` | `/evaluations/{id}` |
| `eligibility.requested` | All Head Tutors except the requester | `{request_id, requester, projects}` | `/eligibility-requests/{id}` |
| `eligibility.decided` | Requester | `{request_id, decision, review_note}` | `/eligibility-requests/{id}` |
| `eligibility.revoked` | The Hitchhiker | `{project}` | `/profile` |
| `role.changed` | The user | `{role, action}`: `role` is the role name, `action` is `"assigned"` or `"revoked"` | `/profile` |
| `account.updated` | The user | `{fields}`: names of fields an admin changed | `/profile` |
| `sc_message.created` | All SC Members | `{message_id}` | `/council/inbox/{id}` |
| `resource.created` | All Hitchhikers (except the uploader) | `{file_id, title, project, owner}` | `/resources/{id}` |
| `resource.updated` | Owner, when edited by someone else | `{file_id, title}` | `/resources/{id}` |
| `resource.deleted` | Owner, when deleted by someone else | `{title}` | empty |

`evaluation.result_recorded` is created by a Django admin save hook when `result` changes from `null`.

### 8.9 EligibilityRequest

```json
{
  "id": 9,
  "requester": { "id": 42, "display_name": "Bob", "avatar_url": null },
  "projects": [{ "id": 4, "slug": "libft", "name": "Libft" }, { "id": 7, "slug": "get_next_line", "name": "get_next_line" }],
  "status": "pending",
  "reviewed_by": null,
  "reviewed_at": null,
  "review_note": "",
  "created_at": "2026-10-09T08:00:00Z"
}
```

`status` is `pending`, `approved` or `declined`. `projects` is sorted by name.

### 8.10 SCMessage

Never contains anything that identifies the sender.

```json
{ "id": 3, "body": "The 3rd floor fridge is broken again.", "read_at": null, "discussion_note": "", "discussion_note_version": 0, "created_at": "2026-10-08T12:00:00Z" }
```

### 8.11 File

```json
{
  "id": 31,
  "kind": "tutor_resource",
  "title": "Libft evaluation checklist",
  "description": "",
  "project": { "id": 4, "slug": "libft", "name": "Libft" },
  "owner": { "id": 42, "display_name": "Bob", "avatar_url": null },
  "original_name": "libft-checklist.pdf",
  "content_type": "application/pdf",
  "size_bytes": 183204,
  "visibility": "tutors",
  "download_url": "/api/v1/files/31/download/",
  "created_at": "2026-10-09T08:00:00Z",
  "updated_at": "2026-10-09T08:00:00Z"
}
```

`kind` is `avatar` or `tutor_resource`. `visibility` is `authenticated` or `tutors`.

## 9. Real-time (WebSocket)

### 9.1 Connection

- URL: `wss://<host>/ws/`. One connection per browser tab, opened after login.
- Authentication: the same session cookie (Channels `AuthMiddlewareStack`). Origin is checked against `ALLOWED_HOSTS`.
- A connection without a valid session is accepted and immediately closed with code **4401**. The frontend then treats the user as logged out.
- The server pushes; the client sends nothing. Messages from the client are ignored.
- Each connection joins two groups: `user_<id>` and `session_<session key>`. Events are sent to `user_<id>`, except `session.ended` on logout, which goes only to the logged-out session's group (the user may still be logged in on another device).

### 9.2 Message format

```json
{ "event": "evaluation.slot_picked", "data": { "id": 17, "status": "awaiting_confirmation" } }
```

Events carry ids, never full objects. On receipt the frontend re-fetches what it shows (e.g. `GET /evaluation-requests/17/`, or the list it is displaying).

### 9.3 Events

| event | data | Sent to |
|---|---|---|
| `evaluation.created` | `{id, status}` | Eligible Hitchhikers of the project |
| `evaluation.updated` | `{id, status}` | Student, the Hitchhiker if any, and eligible Hitchhikers while `pending`. Sent when the note is edited or a result is recorded. |
| `evaluation.slot_picked` | `{id, status}` | Student, the picking Hitchhiker, all eligible Hitchhikers (it left the open queue) |
| `evaluation.confirmed` | `{id, status}` | Student, Hitchhiker |
| `evaluation.declined` | `{id, status}` | Student, Hitchhiker, all eligible Hitchhikers (back in the queue) |
| `evaluation.released` | `{id, status}` | Student, Hitchhiker, all eligible Hitchhikers (back in the queue) |
| `evaluation.cancelled` | `{id, status}` | Student, Hitchhiker if any, all eligible Hitchhikers if it was `pending` |
| `evaluation.expired` | `{id, status}` | Student, Hitchhiker if any, all eligible Hitchhikers if it was `pending` |
| `eligibility.requested` | `{id}` | All Head Tutors |
| `eligibility.decided` | `{id, status}` | Requester |
| `eligibility.revoked` | `{project_id}` | The Hitchhiker |
| `role.changed` | `{}` | The user. The frontend re-fetches `/users/me/` and rebuilds navigation. |
| `notification.created` | `{id}` | Recipient. The frontend refreshes the unread count. |
| `session.ended` | `{}` | On logout: the connections of that session. On suspension or deletion: all of the user's connections. The server closes them with 4401 right after. |

Events are sent with `transaction.on_commit`, so a client never re-fetches before the change is visible.

### 9.4 Disconnects

- Events missed while disconnected are not replayed. After reconnecting, the frontend re-fetches everything it displays.
- Reconnect with backoff: 1 s, 2 s, 4 s, … up to 30 s, with jitter. Do not reconnect after 4401.
- The UI shows a small "reconnecting" indicator while disconnected. It keeps working over HTTP.

## 10. Endpoints

### 10.1 Authentication

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/` | Public | `{"status": "ok", "version": "v1"}`. Sets the `csrftoken` cookie. |
| POST | `/api/v1/auth/register/` | Public | Creates an account. Does not log in. |
| POST | `/api/v1/auth/login/` | Public | Email and password login. Sets the session cookie. |
| POST | `/api/v1/auth/logout/` | Public | Ends the session. Always 204, also when not logged in. |
| GET | `/api/v1/auth/session/` | Public | Always 200: the user, or `authenticated: false`. Sets the `csrftoken` cookie. |
| GET | `/api/v1/auth/42/redirect/` | Public | Browser navigation (not `fetch`). Redirects to 42 OAuth. |
| GET | `/api/v1/auth/42/callback/` | Public | Called by 42. Redirects the browser back to the frontend. |

**Register.** `POST /auth/register/`

```json
{ "email": "alice@example.com", "display_name": "Alice", "password": "correct horse battery" }
```

- `email`: valid email, max 254. Stored lowercase.
- `display_name`: 1–64 chars.
- `password`: Django's validators: at least 8 characters, not too similar to email or display name, not a common password, not entirely numeric.

201:

```json
{ "id": 7, "email": "alice@example.com", "display_name": "Alice", "message": "Account created successfully." }
```

Errors: 400 `validation_error`, 409 `email_already_exists`. The new account holds `student`.

**Login.** `POST /auth/login/` with `{"email", "password"}`.

200:

```json
{ "id": 7, "email": "alice@example.com", "display_name": "Alice", "message": "Logged in successfully." }
```

Errors: 400 `validation_error`, 401 `invalid_credentials` (also for suspended and deleted accounts, so account status is not revealed), 403 `csrf_failed`. After login the frontend reads the new `csrftoken` cookie value.

**Session.** `GET /auth/session/`

200:

```json
{ "authenticated": true, "user": { "id": 7, "email": "alice@example.com", "display_name": "Alice" } }
```

When nobody is logged in, also 200:

```json
{ "authenticated": false, "user": null }
```

This endpoint never answers 401, so the startup check never shows up as a failed request in the browser console (§5.3). Roles and preferences come from `GET /users/me/`.

**42 OAuth.**

- The Login page links (full navigation) to `/api/v1/auth/42/redirect/`. The backend stores a random `state` in the session and redirects to 42.
- On the callback the backend checks `state`, exchanges the code, reads the 42 profile, then:
  - a user with this `intra_id` exists → refreshes `intra_login`, logs in
  - otherwise, no user with this email → creates an account (email from 42, `display_name` = 42 login, unusable password, role `student`), logs in
  - otherwise (an email/password account already uses this email) → error `oauth_account_exists`. Accounts are never linked automatically by email.
- Success redirects to `/`. Failure redirects to `/login?oauth=<code>`, where the Login page shows a message for the code.
- The 42 access token, the code and the client secret never reach the browser.

| `oauth` code | Meaning |
|---|---|
| `oauth_not_configured` | Server has no 42 credentials. |
| `oauth_invalid_state` | `state` missing or wrong (expired session or forged request). |
| `oauth_access_denied` | User refused access at 42. |
| `oauth_provider_error` | 42 returned another error. |
| `oauth_missing_code` | No code on the callback. |
| `oauth_token_exchange_failed` | 42 rejected the code exchange. |
| `oauth_profile_retrieval_failed` | Could not read the 42 profile. |
| `oauth_account_suspended` | The linked account is suspended or deleted. |
| `oauth_account_exists` | A password account already uses this email. |
| `oauth_identity_conflict`, `oauth_account_conflict` | The 42 identity clashes with another account's stored data. |

### 10.2 Users, roles, admin user management

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/users/me/` | Own | `Me`. |
| PATCH | `/api/v1/users/me/` | Own | `display_name`, `language`. 204. |
| PUT | `/api/v1/users/me/avatar/` | Own | Upload or replace the avatar. |
| DELETE | `/api/v1/users/me/avatar/` | Own | Back to the default avatar. 204. |
| GET | `/api/v1/users/{id}/` | Authenticated | `PublicUser`. 404 for deleted users. |
| POST | `/api/v1/users/{id}/roles/` | Head Tutor, SC Member, Admin | Assign a role (rules in §5.8). |
| DELETE | `/api/v1/users/{id}/roles/{role_id}/` | Admin | Revoke a role. |
| GET | `/api/v1/admin/users/` | Admin | Paginated `AdminUser` list. |
| GET | `/api/v1/admin/users/{id}/` | Admin | `AdminUser`. |
| PATCH | `/api/v1/admin/users/{id}/` | Admin | Edit `display_name`, `email`, `language`. |
| POST | `/api/v1/admin/users/{id}/suspend/` | Admin | Suspend. |
| POST | `/api/v1/admin/users/{id}/reactivate/` | Admin | Undo a suspension. |
| DELETE | `/api/v1/admin/users/{id}/` | Admin | Delete (anonymize). |

**Update own profile.** `PATCH /users/me/`

```json
{ "display_name": "Alice B.", "language": "cs" }
```

204 with no body; the frontend re-fetches `GET /users/me/`. 400:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Please correct the profile fields.",
    "fields": { "display_name": ["Ensure this field has no more than 64 characters."] }
  }
}
```

**Avatar.** `PUT /users/me/avatar/`, `multipart/form-data` with field `file`.

- PNG, JPEG or WebP, max 2 MB. The type is detected from the content and the image must decode (Pillow). Anything else: 400 `validation_error` on `file`.
- Replaces the previous avatar file, which is deleted.
- 200: `{"avatar_url": "/api/v1/files/31/download/"}`.

**Assign a role.** `POST /users/{id}/roles/` with `{"role": "tutor"}`.

- 200 with the target's `PublicUser`. Assigning a role the user already has is a no-op 200.
- 403 `role_not_assignable` when the caller may not assign that role, and always for `student` and `admin` (§5.8); 400 `validation_error` for an unknown role name; 404 for unknown or deleted users.
- Creates a `role.changed` notification and an audit log entry `role.assigned`.

**Revoke a role.** `DELETE /users/{id}/roles/{role_id}/`

- 204, also when the user did not hold the role. 409 `role_not_revocable` for `student` and `admin`. 409 `cannot_modify_self`.
- Revoking `tutor` keeps eligibility rows (schema §3.4) and does not touch picked requests.
- Notification `role.changed`, audit `role.revoked`.

**Admin user list.** `GET /admin/users/`

- Filters: `q` (case-insensitive match on email, display name or 42 login), `role`, `status`.
- Ordering: `display_name` (default), `email`, `created_at`, `last_login`.

**Admin edit.** `PATCH /admin/users/{id}/` with any of `display_name`, `email`, `language`. 200 `AdminUser`. 409 `email_already_exists`. 409 `invalid_user_status` for deleted users. Notification `account.updated`, audit `user.updated` with old and new values.

**Suspend / reactivate.** `POST /admin/users/{id}/suspend/` and `/reactivate/` with `{"reason": "..."}` (required, 1–500 chars).

- 200 `AdminUser`. 409 `invalid_user_status` when the user is not in the expected status. 409 `cannot_modify_self`.
- Suspension ends all the user's sessions and sends `session.ended`. Their requests and picks are left alone and appear in the exceptions list (§10.9).
- Audit `user.suspended` / `user.reactivated`.

**Delete.** `DELETE /admin/users/{id}/` with `{"reason": "..."}`.

- Anonymizes the account as described in schema §2.4. Irreversible. 204.
- 409 `cannot_modify_self`. 409 `invalid_user_status` if the account is already deleted. Audit `user.deleted`.

### 10.3 Projects and tutor eligibility

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/projects/` | Authenticated | `ProjectRef[]` of active projects, sorted by name. Not paginated. |
| GET | `/api/v1/projects/{slug}/` | Authenticated | `Project`. 404 for inactive projects. |
| GET | `/api/v1/tutors/{id}/eligibility/` | Authenticated | `ProjectRef[]` the user is eligible for, sorted by name. Not paginated. Empty for non-Hitchhikers. 404 for unknown or deleted users. |
| POST | `/api/v1/tutor-eligibility-requests/` | Hitchhiker | Submit one request. |
| GET | `/api/v1/tutor-eligibility-requests/` | Authenticated | Head Tutors and Admins see all; others see their own. |
| GET | `/api/v1/tutor-eligibility-requests/{id}/` | Requester, Head Tutor, Admin | `EligibilityRequest`. Others get 404. |
| POST | `/api/v1/tutor-eligibility-requests/{id}/review/` | Head Tutor, Admin | Approve or decline the whole request. |
| DELETE | `/api/v1/projects/{slug}/eligibility/{tutor_id}/` | Head Tutor, Admin | Revoke one project's eligibility. |

**Submit.** `POST /tutor-eligibility-requests/` with `{"project_ids": [4, 7, 12]}`.

- `project_ids`: 1–50 distinct ids of active projects. Projects the user is already eligible for are rejected: 400 `validation_error` on `project_ids` naming them.
- 201 `EligibilityRequest` with `status: "pending"`.
- 403 `permission_denied` without the Hitchhiker role. 409 `eligibility_request_pending` if one is already pending.
- Notifications `eligibility.requested`, event `eligibility.requested`.

**List.** Filters: `status`. Ordering: `created_at` (default; oldest first, which is the review order) or `-created_at`. Paginated.

**Review.** `POST /tutor-eligibility-requests/{id}/review/`

```json
{ "decision": "approved", "review_note": "" }
```

- `decision`: `approved` or `declined`. `review_note`: optional, up to 500 chars, shown to the requester.
- 200 `EligibilityRequest` with `status`, `reviewed_by`, `reviewed_at` set. On approval the eligibility rows are created in the same transaction (schema §3.4).
- 403 `cannot_review_own_request`. 409 `eligibility_request_already_reviewed`.
- Notification `eligibility.decided`, event `eligibility.decided`, audit `eligibility.reviewed`.

**Revoke.** `DELETE /projects/{slug}/eligibility/{tutor_id}/` with optional `{"reason": "..."}`.

- 204. 404 if the user is not eligible for the project.
- Existing picks stay; new picks are refused. Notification and event `eligibility.revoked`, audit `eligibility.revoked`.

### 10.4 Evaluation requests

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/evaluation-requests/` | Authenticated | Create. |
| GET | `/api/v1/evaluation-requests/` | Authenticated | List, scoped by `scope`. |
| GET | `/api/v1/evaluation-requests/{id}/` | See §8.7 | `EvaluationRequest`. |
| PATCH | `/api/v1/evaluation-requests/{id}/` | Own student | Edit `note` while `pending`. |
| POST | `/api/v1/evaluation-requests/{id}/pick-slot/` | Eligible Hitchhiker | Propose a slot. |
| POST | `/api/v1/evaluation-requests/{id}/confirm/` | Own student | Accept the slot. |
| POST | `/api/v1/evaluation-requests/{id}/decline/` | Own student | Reject the slot; back to `pending`. |
| POST | `/api/v1/evaluation-requests/{id}/release/` | Picking Hitchhiker, Override | Give up the slot; back to `pending`. |
| POST | `/api/v1/evaluation-requests/{id}/cancel/` | Own student, Override | End the request. |

All transitions follow §7.1. Every response is the updated `EvaluationRequest`. A request that cannot make the transition from its current status returns 409 `invalid_state_transition` (`request_not_pending` for pick-slot).

**Create.** `POST /evaluation-requests/`

```json
{ "project_id": 4, "note": "Need help with parsing." }
```

- `project_id` must be an active project (else 400 on `project_id`). `note` optional, up to 500 chars.
- 201 `EvaluationRequest` with `status: "pending"`. 409 `active_request_exists`.
- Notification `evaluation.created` to eligible Hitchhikers, event `evaluation.created`.

**List.** `GET /evaluation-requests/`

| Parameter | Values | Meaning |
|---|---|---|
| `scope` | `mine` (default) | Requests I created. |
| | `open` | `pending` requests for projects I'm eligible for, excluding my own. Hitchhikers only (else 403). |
| | `picked` | Requests where I am `picked_by`. Hitchhikers only. |
| | `all` | Every request. Head Tutor and Admin only. |
| `status` | comma-separated statuses | |
| `history` | `true` / `false` | Only history / only active (§7.1). |
| `project` | project slug | |
| `ordering` | `created_at`, `-created_at` (default), `starts_at`, `-starts_at` | |

How the pages map: a student's Requests page is `scope=mine&history=false`; a Hitchhiker's queue is `scope=open`; Pending Evaluations is `scope=picked&history=false` (Hitchhiker) or `scope=mine&status=confirmed&history=false` (student); History is `history=true` with `mine` or `picked`.

**Edit note.** `PATCH /evaluation-requests/{id}/` with `{"note": "..."}`. Only while `pending`. Event `evaluation.updated`.

**Pick a slot.** `POST /evaluation-requests/{id}/pick-slot/`

```json
{ "starts_at": "2026-10-12T15:00:00Z", "ends_at": "2026-10-12T15:45:00Z" }
```

- Slot rules and overlaps: §7.1.
- Errors: 403 `not_eligible`, 403 `cannot_pick_own_request`, 400 `validation_error`, 409 `request_not_pending`, 409 `slot_overlaps`, 409 `student_unavailable`.
- 200 with `status: "awaiting_confirmation"`. Notification `evaluation.slot_picked` to the student; event `evaluation.slot_picked`.

**Confirm.** `POST …/{id}/confirm/`, no body. 200 with `status: "confirmed"`. 409 `evaluation_already_started` if `starts_at` has passed. Notification and event `evaluation.confirmed`.

**Decline.** `POST …/{id}/decline/`, no body. 200 with `status: "pending"`, pick cleared. Notification and event `evaluation.declined`.

**Release.** `POST …/{id}/release/`. The picking Hitchhiker sends no body; an override sends `{"reason": "..."}`.

- 200 with `status: "pending"`, pick cleared. 409 `evaluation_already_started` once `starts_at` has passed, overrides included: releasing a slot in the past makes no sense.
- Notification and event `evaluation.released`. Overrides also write audit `evaluation.released_by_override`.

**Cancel.** `POST …/{id}/cancel/`. The student sends no body; an override sends `{"reason": "..."}`.

- 200 with `status: "cancelled"`, `cancelled_by` and `cancelled_at` set. 409 `evaluation_already_started` for the student once `starts_at` has passed. An override can cancel at any time, except a request whose result is recorded (409 `invalid_state_transition`).
- Notification and event `evaluation.cancelled`. Overrides also write audit `evaluation.cancelled_by_override`.

### 10.5 Notifications

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/notifications/` | Own | Paginated `Notification` list, newest first. Filter `unread=true`. |
| GET | `/api/v1/notifications/unread-count/` | Own | `{"count": 3}`. For the badge. |
| POST | `/api/v1/notifications/{id}/read/` | Own | Marks one as read. 200 `Notification`. Idempotent. |
| POST | `/api/v1/notifications/read-all/` | Own | Marks all as read. 204. |
| DELETE | `/api/v1/notifications/{id}/` | Own | Deletes one. 204. |

Notifications are created only by the backend. Other users' notifications return 404.

### 10.6 Student Council inbox

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/sc-messages/` | Authenticated | Send an anonymous message. |
| GET | `/api/v1/sc-messages/` | SC Member, Admin | Paginated `SCMessage` list, newest first. Filter `unread=true`. |
| GET | `/api/v1/sc-messages/{id}/` | SC Member, Admin | `SCMessage`. Does not change read state. |
| PATCH | `/api/v1/sc-messages/{id}/` | SC Member, Admin | `is_read`, and/or `discussion_note` with `discussion_note_version`. 200 `SCMessage`. |
| DELETE | `/api/v1/sc-messages/{id}/` | Admin | Remove abusive content. Body `{"reason": "..."}`. 204. Audit `sc_message.deleted`. |
| POST | `/api/v1/sc-messages/{id}/reveal-sender/` | Admin | Abuse investigation only. |

**Send.** `POST /sc-messages/` with `{"body": "..."}` (1–5000 chars). 201 `{"id": 3, "created_at": "..."}`. Deliberately nothing more: the sender never gets the message back. Notification `sc_message.created` to all SC Members.

**Read state.** `is_read: true` sets `read_at` to now if it was null; `false` clears it.

**Discussion note.** Free text up to 5000 chars, shared by all council members. Send it together with the `discussion_note_version` you last read:

```json
{ "discussion_note": "Forwarded to the building manager.", "discussion_note_version": 4 }
```

The note is saved only if the version still matches, and the version goes up by one. If another member saved in between: 409 `edit_conflict` and nothing changes; re-fetch, merge, retry. `is_read` alone needs no version.

**Reveal sender.** `POST /sc-messages/{id}/reveal-sender/` with `{"reason": "..."}` (required, 10–500 chars).

- 200 `{"sender": {"id": 7, "display_name": "Alice", "email": "alice@example.com"}}`, or `{"sender": null}` if the account was deleted.
- Always writes audit `sc_message.sender_revealed` with the reason. There is no way to look up a sender without this record.

### 10.7 Files

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/files/` | Hitchhiker, Admin | Upload a tutor resource. |
| GET | `/api/v1/files/` | Authenticated | Paginated tutor resources the caller may see. |
| GET | `/api/v1/files/{id}/` | By visibility | `File` metadata. |
| GET | `/api/v1/files/{id}/download/` | By visibility | The bytes. |
| PATCH | `/api/v1/files/{id}/` | Owner, Head Tutor, Admin | Edit `title`, `description`, `project_id`, `visibility`. 200 `File`. |
| DELETE | `/api/v1/files/{id}/` | Owner, Head Tutor, Admin | 204. |

Avatars are uploaded through `/users/me/avatar/` (§10.2), never through `POST /files/`, and cannot be edited or deleted here.

**Upload.** `POST /files/`, `multipart/form-data`:

| Field | Required | Notes |
|---|---|---|
| file | yes | PDF, PNG, JPEG, WebP, plain text or Markdown. Max 10 MB. |
| title | no | Up to 200 chars. Defaults to the file name. |
| description | no | Up to 1000 chars. |
| project_id | no | Active project the resource belongs to. |
| visibility | no | `tutors` (default) or `authenticated`. |

- The type is detected from the file contents; the extension and the browser's `Content-Type` are not trusted. Rejected types and sizes: 400 `validation_error` on `file`. The frontend validates type and size before uploading too, and shows upload progress (XHR `upload.onprogress`).
- 201 `File`. Notification `resource.created`.
- Nginx rejects bodies over 11 MB with 413 before Django sees them, so the frontend must check the size before uploading.

**List.** Filters: `project` (slug), `owner` (user id), `q` (title). Ordering: `-created_at` (default), `title`.

**Visibility.** `authenticated`: any logged-in user. `tutors`: Hitchhikers and Admins. A file the caller may not see returns 404.

**Download.** `GET /files/{id}/download/`

- Sent with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.
- `?inline=true` serves PNG, JPEG, WebP and PDF with `Content-Disposition: inline` for preview. Other types ignore it.

**Edit.** When a Head Tutor or Admin edits someone else's file: notification `resource.updated` to the owner and audit `file.updated_by_moderator`.

**Delete.** When a Head Tutor or Admin deletes someone else's file: notification `resource.deleted` to the owner and audit `file.deleted_by_moderator`.

### 10.8 People search

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/search/people/` | Authenticated | Find Hitchhikers, Head Tutors and SC Members. |

| Parameter | Notes |
|---|---|
| `q` | Optional, 2–64 chars. Case-insensitive match on display name or 42 login. The 42 login is never returned. |
| `role` | Optional: `tutor`, `head_tutor` or `sc_member`. `tutor` also matches Head Tutors. |
| `project` | Optional project slug: only Hitchhikers eligible for it. |
| `ordering` | `display_name` (default), `-display_name`. |

Only active users holding `tutor`, `head_tutor` or `sc_member` appear; students without those roles never do. Paginated. Each result is a `PublicUser` plus `eligible_projects` (`ProjectRef[]`, empty for non-Hitchhikers):

```json
{
  "count": 1, "next": null, "previous": null,
  "results": [
    {
      "id": 42, "display_name": "Bob", "avatar_url": null,
      "roles": [{ "id": 1, "name": "student" }, { "id": 2, "name": "tutor" }],
      "eligible_projects": [{ "id": 4, "slug": "libft", "name": "Libft" }]
    }
  ]
}
```

### 10.9 Administration

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/admin/evaluation-requests/exceptions/` | Head Tutor, Admin | Requests that need a human decision. |
| GET | `/api/v1/admin/audit-log/` | Admin | Paginated audit entries. |

**Exceptions.** Paginated `EvaluationRequest`s with an extra `problem` field:

| problem | Condition |
|---|---|
| `tutor_lost_eligibility` | `awaiting_confirmation` or upcoming `confirmed`, and `picked_by` no longer holds the Hitchhiker role or eligibility for the project. |
| `participant_inactive` | Active request whose student or Hitchhiker is suspended. |
| `result_missing` | `confirmed`, `ends_at` more than 7 days ago, `result` still null. |

Resolution uses the normal endpoints with an override (`release`, `cancel` with a `reason`). Results are entered in the Django admin.

**Audit log.** Filters: `actor` (user id), `action`, `target_type`, `target_id`, `from` and `to` (datetimes). Ordering: `-created_at` (default). Each entry:

```json
{
  "id": 120,
  "actor": { "id": 1, "display_name": "Admin", "avatar_url": null },
  "action": "role.assigned",
  "target_type": "user",
  "target_id": 42,
  "reason": "",
  "metadata": { "role": "tutor" },
  "created_at": "2026-10-09T08:00:00Z"
}
```

Audited actions: `role.assigned`, `role.revoked`, `user.updated`, `user.suspended`, `user.reactivated`, `user.deleted`, `eligibility.reviewed`, `eligibility.revoked`, `evaluation.released_by_override`, `evaluation.cancelled_by_override`, `sc_message.sender_revealed`, `sc_message.deleted`, `file.updated_by_moderator`, `file.deleted_by_moderator`.

## 11. Changing this contract

1. Open a PR that edits this file (and `database-schema.md` if tables change). Tag the IT Architect.
2. If the change breaks existing clients, update the frontend in the same PR or a PR merged together with it.
3. Add new error codes to §5.6 and new notification types to §8.8 before using them.
