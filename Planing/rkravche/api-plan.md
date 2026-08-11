# API Plan — Transcendence

**Status:** Draft for Team Review
**Owner:** Backend/API Architecture Team
**Last Updated:** July 28, 2026

## 1. Purpose

This document defines the REST API contract used by the Transcendence platform. It is the shared communication contract between the frontend and backend teams, and the main reference point when implementing new features or connecting the React frontend with the Python backend.

It covers:

- Available API endpoints
- Authentication requirements
- User permissions
- Request/response formats
- Backend responsibilities
- Real-time communication rules
- Confirmed vs. proposed features

### Main Goals

- Keep frontend and backend synchronized
- Provide a single API reference
- Document authentication and authorization rules
- Define how data is sent and received
- Help new developers understand the system architecture
- Clearly separate confirmed features (YES) from features still under discussion (?)

## 2. Architecture Overview

The platform follows a client-server architecture. The frontend sends HTTP API requests; the backend applies business rules, talks to the database, and returns a response. A WebSocket layer pushes real-time change notifications.

### React Frontend

Responsible for:

- UI and layout rendering
- Displaying data from the backend
- Sending HTTP API requests
- Handling user interactions
- Receiving real time WebSocket notifications

The frontend holds no critical business logic. Validation and permissions are always enforced by the backend.

### Python Backend API

Responsible for:

- Receiving and validating REST API requests
- Applying business rules and authorization checks
- Communicating with MySQL
- Returning consistent HTTP responses / JSON payloads
- Managing session authentication
- File handling and real-time events

Backend structure:

```
Python Backend
├── API Layer
│   ├── Routes
│   ├── Request validation
│   └── Response handling
│
├── Business Logic
│   ├── Services
│   ├── Permissions
│   └── Application rules
│
├── Database Layer
│   ├── Models
│   └── Queries
│
└── Real Time Layer
    └── WebSocket Events
```

### MySQL Database

Stores all permanent application state:

- Users, roles, and profiles
- Projects and eligibility requests
- Evaluation requests
- Notifications and audit logs
- Student Council messages
- Uploaded file metadata

Final evaluation results are recorded manually by the team directly in the database after an evaluation takes place — the platform has no access to the 42 Intra API for grades, so this is not an automated step and there is no API endpoint for it.

The database is accessed exclusively through the backend API never directly by the frontend.

### WebSocket Layer

Provides real time updates for:

- Live notification pushes
- Evaluation request status changes (slot picked, confirmed, declined, cancelled)
- Eligibility request status changes
- Role updates

**Important rule:** HTTP responses are always the source of truth. WebSocket events only inform the frontend that something changed after receiving an event, the frontend must re fetch the updated data via REST.

## 3. Open Architecture Decisions

These must be agreed upon by the team before (or early in) implementation. Agreed answers should be recorded as short ADRs in `docs/adr/`.

### Q1. Automate tutor eligibility from the 42 Intra API? — RESOLVED: not implemented

**Decision:** the team confirmed 42-Intra auto-sync for eligibility is not being implemented. Eligibility is fully manual: a Hitchhiker submits one eligibility request listing every project they want to evaluate, and a Head Tutor accepts or declines the whole request. See §10.3 and §10.4 for the confirmed endpoints. This question is closed and kept here only for record-keeping.

## Not yet important questions

### Q2. Poll anonymity

The current schema stores who voted for what, which is not anonymous, anyone with DB access could see individual votes, despite frontend promises. This violates privacy requirements. We need to decouple vote recording from user IDs, or implement cryptographic/blinded tokens.

### Q3. SMTP for GDPR confirmation emails

The GDPR minor module requires confirmation emails for data operations, but the MVP explicitly excludes general email notifications. This still forces an SMTP relay (or a local dev tool like Mailcatcher) into the Docker Compose stack.

### Q4. Tailwind CSS vs. standard CSS

Tailwind offers quick layout building and native dark-mode support (required by project spec), but standard CSS keeps the bundle footprint minimal.

## 4. Feature Status Legend

| Status | Meaning |
|---|---|
| YES | Confirmed feature. Approved and planned for implementation. |
| ? | Feature proposal. Requires team discussion and approval. |

### System Modules Summary

| Module | Status |
|---|---|
| Authentication & Session | YES |
| Users, Roles & Profile | YES |
| Projects & Tutor Eligibility Requests | YES |
| Evaluation Requests (create → pick slot → confirm → cancel) | YES |
| Notifications | YES |
| Student Council Inbox | YES |
| Tutor Resources & Files | YES |
| People Search | YES |
| Administration | YES |
| Announcements | ? |
| Polls | ? |

## 5. API Design Principles & Conventions

- **Base URL:** all endpoints are prefixed with `/api/v1/`. Versioning allows future API changes without breaking existing clients (e.g. a future `/api/v2/users/`).
- **JSON communication:** all payloads use `Content-Type: application/json`.
- **Authentication model:** session-cookie based. After successful login (password or 42 OAuth), a session cookie is set (`HttpOnly`; `SameSite=Lax`). The browser sends it automatically on future requests.
- **Pagination:** large collections use `?page=1&page_size=20` to avoid returning thousands of records at once.
- **Authorization:** authentication verifies who the user is; authorization verifies what they're allowed to do (e.g. a student can create their own evaluation request; a Hitchhiker can pick a slot for an eligible request; an admin manages users).
- **Server-side business rules are authoritative:** preventing duplicate slot picks, checking permissions, validating eligibility, and protecting private data are always enforced backend-side. The frontend is never trusted for security decisions.

### Error Format

All errors return a standard HTTP status code plus a structured payload:

```json
{
  "error": {
    "code": "request_already_picked",
    "message": "This evaluation request already has a slot picked."
  }
}
```

The `code` field lets the frontend handle specific cases programmatically.

### Common HTTP Responses

| Code | Meaning | Description |
|---|---|---|
| 200 | Success | Request completed successfully. |
| 201 | Created | Resource successfully created. |
| 204 | No Content | Request succeeded; no body returned. |
| 400 | Validation Error | Request data is invalid or missing fields. |
| 401 | Unauthorized | User is not authenticated. |
| 403 | Forbidden | User is authenticated but lacks required permission. |
| 404 | Not Found | Requested resource does not exist. |
| 409 | Conflict | Action conflicts with system state (e.g. request already picked by another Hitchhiker). |
| 500 | Internal Error | Unexpected backend error. |

### Role Legend

| Role | Description |
|---|---|
| Public | Unauthenticated user / no login required. |
| Authenticated | Logged-in user with standard session. |
| Own | Logged-in user accessing their own resources. |
| Student | Standard student user role. |
| Tutor (Hitchhiker) | Registered tutor, shown as "Hitchhiker" in the UI. |
| Eligible Tutor | Hitchhiker with an approved eligibility request covering the given project. |
| Head Tutor | Reviews and decides eligibility requests. |
| SC Member | Student Council representative. |
| Administrator | Full administrative rights. |

## 6. Endpoint Summary Table

| Module | Endpoints | Status |
|---|---|---|
| Authentication | 6 | YES |
| Users | 7 | YES |
| Projects | 2 | YES |
| Tutor Eligibility Requests | 4 | YES |
| Evaluation Requests | 7 | YES |
| Notifications | 3 | YES |
| Student Council | 6 | YES |
| Files | 3 | YES |
| Search | 1 | YES |
| Administration | 3 | YES |
| Announcements | 5 | ? |
| Polls | 5 | ? |

## 7. Workflows & Lifecycle Diagrams

### Evaluation Request Lifecycle

```
Student
   │
   ▼
Create Request
   │
   ▼
PENDING (on the Requests page)
   │
   ▼
Eligible Hitchhiker picks a slot
   │
   ▼
AWAITING_CONFIRMATION
   │
   ├── Student confirms ──▶ CONFIRMED (on the Pending Evaluations page)
   │
   └── Student declines ──▶ back to PENDING (open again)
   │
   ▼
Either party can cancel from any state
   │
   ▼
CANCELLED

(after the evaluation happens, the result is recorded manually
 by the team directly in the database — not through this API)
```

| Status | Meaning |
|---|---|
| PENDING | Request is open; no Hitchhiker has picked a slot yet (or a picked slot was declined). |
| AWAITING_CONFIRMATION | A Hitchhiker picked a slot; waiting on the student to confirm or decline. |
| CONFIRMED | Student confirmed the slot; evaluation is scheduled and shown on the Pending Evaluations page. |
| CANCELLED | Cancelled by the student or the Hitchhiker, from any prior state. |

### Slot-Pick Concurrent Race Condition Flow

```
Student creates evaluation request
              │
              ▼
Request becomes PENDING
              │
              ▼
Eligible Hitchhikers see the open request
              │
              ▼
Hitchhiker sends pick-slot request
              │
              ▼
Backend checks DB availability
              │
        ┌─────┴─────┐
        │           │
   Still PENDING   Already Picked
        │           │
        ▼           ▼
AWAITING_CONFIRMATION   409 Conflict Error
```

### Eligibility Request Flow

```
Hitchhiker (first activation)
   │
   ▼
Selects every project they want to evaluate
   │
   ▼
Submits one Eligibility Request
   │
   ▼
Head Tutor sees requester name + full project list in a review table
   │
   ▼
Head Tutor accepts or declines the WHOLE request (no per-project decision)
   │
        ┌─────┴─────┐
        │           │
   Accepted     Declined
        │           │
        ▼           ▼
Eligible for all      Not eligible for any
listed projects,      of the listed projects
no further approval
needed to pick slots
```

### Anonymous Student Council Flow

```
Student
   │
   ▼
Anonymous Message Created
   │
   ▼
Student Council Reviews Message
   │
   ▼
Internal Discussion Notes Added
   │
   ▼
Message Marked As Read
```

**Privacy rule:** the sender identity is stored internally but is never exposed to Student Council members.

## 8. Data Models

### Evaluation Request

| Field | Description |
|---|---|
| id | Unique ID of request. |
| student | Foreign Key to Student user. |
| project | Foreign Key to Project. |
| status | State: pending, awaiting_confirmation, confirmed, cancelled. |
| note | Optional message from the student. |
| picked_by | Foreign Key to the Hitchhiker who picked a slot; null until picked. |
| starts_at | Chosen evaluation start time; null until a Hitchhiker picks a slot. |
| ends_at | Chosen evaluation end time; null until a Hitchhiker picks a slot. |
| cancelled_by | Foreign Key to whoever cancelled the request (student or Hitchhiker); null unless cancelled. |
| created_at | Creation timestamp. |
| updated_at | Modification timestamp. |

The final result of a confirmed evaluation is not stored through this API — it is entered manually into the database by the team after the evaluation takes place, since there is no 42 API access to grades.

### Tutor Eligibility Request

| Field | Description |
|---|---|
| id | Unique ID of request. |
| hitchhiker | Foreign Key to the requesting user. |
| projects | List of Foreign Keys to the selected projects (all requested in one submission). |
| status | State: pending, approved, declined — one status for the whole request. |
| reviewed_by | Foreign Key to the Head Tutor who made the decision; null while pending. |
| reviewed_at | Timestamp of the decision; null while pending. |
| created_at | Creation timestamp. |

On approval, the Hitchhiker becomes eligible for every project listed in the request; there is no per-project outcome.

### Notification

| Field | Description |
|---|---|
| id | Unique Notification ID. |
| user | Foreign Key to recipient user. |
| type | Category (e.g. evaluation.slot_picked, eligibility.decided, role.changed). |
| message | Content text. |
| read_at | Timestamp when read by user. |
| created_at | Creation timestamp. |

Notifications are created internally by backend actions only — clients cannot create them directly.

## 9. Real-Time WebSocket Events

| Event Name | Trigger Condition |
|---|---|
| evaluation.slot_picked | A Hitchhiker picks a slot for an open request; student must confirm/decline. |
| evaluation.confirmed | The student confirms a picked slot. |
| evaluation.declined | The student declines a picked slot; request returns to PENDING. |
| evaluation.cancelled | The student or the Hitchhiker cancels the request. |
| eligibility.requested | A Hitchhiker submits a new eligibility request; sent to Head Tutors. |
| eligibility.decided | A Head Tutor accepts or declines an eligibility request; sent to the requester. |
| notification.created | System issues a new notification to a user. |
| role.changed | Admin or system alters a user's permissions/role. |

**Reminder:** WebSockets only signal that something changed. On receipt, the frontend must call the matching REST endpoint (e.g. `GET /api/v1/evaluation-requests/{id}/`) to get the authoritative data.

## 10. Detailed Module Endpoints

### 10.1 Authentication & Session (YES)

Manages user identity, sessions, and 42 Intra OAuth.

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| POST | `/api/v1/auth/register/` | Public | Email + password registration. Default role: Student. |
| POST | `/api/v1/auth/login/` | Public | Authenticates credentials and sets session cookie. |
| POST | `/api/v1/auth/logout/` | Any | Destroys active session cookie. |
| GET | `/api/v1/auth/session/` | Any | Returns active session state and user info, or 401. Frontend calls this on app startup. |
| GET | `/api/v1/auth/42/redirect/` | Public | Redirects browser to 42 Intra OAuth. |
| GET | `/api/v1/auth/42/callback/` | Public | Handles OAuth code exchange, creates/links account via intra_login. |

### 10.2 Users, Roles & Profile (YES)

Manages profiles, permissions, and role assignment.

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| GET | `/api/v1/users/me/` | Own | Retrieves full user profile including sensitive preferences. |
| PATCH | `/api/v1/users/me/` | Own | Updates avatar, display name, language, notification options. |
| GET | `/api/v1/users/{id}/` | Authenticated | Public profile information (display name, avatar, role, bio — never 42 login). |
| GET | `/api/v1/users/` | Administrator | Paginated list of registered users. |
| POST | `/api/v1/users/{id}/roles/` | Administrator / Head Tutor | Assigns role to target user (Head Tutor limited to Tutor role). |
| DELETE | `/api/v1/users/{id}/roles/{role_id}/` | Administrator | Revokes target role; fires role.changed event. |
| POST | `/api/v1/users/{id}/suspend/` | Administrator | Suspends account activity. |

### 10.3 Projects & Tutor Eligibility Requests (YES)

Eligibility is no longer granted directly. A Hitchhiker requests it for one or more projects in a single submission, and a Head Tutor accepts or declines the whole request.

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| GET | `/api/v1/projects/` | Authenticated | Returns project list available for evaluations. |
| GET | `/api/v1/tutors/{id}/eligibility/` | Authenticated | Returns public listing of projects this Hitchhiker is approved for. |
| POST | `/api/v1/tutor-eligibility-requests/` | Hitchhiker | Submits one request covering every selected project. |
| GET | `/api/v1/tutor-eligibility-requests/` | Head Tutor | Lists pending requests as a review table (requester + full project list). |
| GET | `/api/v1/tutor-eligibility-requests/{id}/` | Head Tutor, requester | Detail view of one request. |
| POST | `/api/v1/tutor-eligibility-requests/{id}/review/` | Head Tutor | Accepts or declines the entire request in one action. |
| DELETE | `/api/v1/projects/{slug}/eligibility/{tutor_id}/` | Head Tutor, Admin | Revokes a previously approved eligibility directly (outside the request/review flow), e.g. for corrections. |

### 10.4 Evaluation Requests (YES) [WS]

Covers the full lifecycle: student creates a request, an eligible Hitchhiker picks a slot, the student confirms or declines, and either side can cancel at any point. There is no separate "Evaluation" resource — everything happens on the request itself. Completion/results are recorded manually in the database by the team, not through this API.

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| POST | `/api/v1/evaluation-requests/` | Student (own) | Creates a request for a project. Starts as `pending`; no slot/time is set yet. |
| GET | `/api/v1/evaluation-requests/` | Own / Eligible Tutor | Students see their own requests; Hitchhikers see open (`pending`) requests for projects they're eligible for, plus their own picked/confirmed ones. |
| GET | `/api/v1/evaluation-requests/{id}/` | Own, Eligible Tutor, Admin | Detailed view of the request. |
| POST | `/api/v1/evaluation-requests/{id}/pick-slot/` | Eligible Tutor | Hitchhiker proposes a time (`starts_at`/`ends_at`). Moves request to `awaiting_confirmation`. Protected by a DB constraint so only one Hitchhiker can pick a given request. |
| POST | `/api/v1/evaluation-requests/{id}/confirm/` | Own (student) | Confirms the picked slot. Moves request to `confirmed`. |
| POST | `/api/v1/evaluation-requests/{id}/decline/` | Own (student) | Declines the picked slot. Clears `picked_by`/times and returns request to `pending`. |
| POST | `/api/v1/evaluation-requests/{id}/cancel/` | Own (student), picked Hitchhiker, Administrator | Cancels the request from any state. Requires no reason. |

### 10.5 Notifications (YES) [WS]

Created automatically by backend actions — clients cannot create notifications directly.

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| GET | `/api/v1/notifications/` | Own | Fetch user notifications (supports `?unread=true`). |
| POST | `/api/v1/notifications/{id}/read/` | Own | Marks single notification read. |
| POST | `/api/v1/notifications/read-all/` | Own | Marks all user notifications read. |

### 10.6 Student Council Inbox (YES)

Anonymous communication channel between students and the Student Council.

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| POST | `/api/v1/sc-messages/` | Authenticated | Submits anonymous message; sender_id stored internally but never returned. |
| GET | `/api/v1/sc-messages/` | SC Member | Lists inbox without revealing sender identity. |
| GET | `/api/v1/sc-messages/{id}/` | SC Member | Reads message details anonymously. |
| POST | `/api/v1/sc-messages/{id}/read/` | SC Member | Sets read status. |
| PATCH | `/api/v1/sc-messages/{id}/discussion-note/` | SC Member | Internal SC notes (never visible to sender). |
| GET | `/api/v1/sc-messages/{id}/sender/` | Admin only | Emergency unmasking endpoint for abuse investigation (access must be logged). |

### 10.7 Tutor Resources & Files (YES)

Files are never exposed via direct public paths; the backend checks permissions on every request, validating file type, size, permissions, and visibility.

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| POST | `/api/v1/files/` | Context Dependent | Uploads file asset; checks dynamic file types and permissions. |
| GET | `/api/v1/files/{id}/` | Context Dependent | Streams file through auth check (no direct static serving). |
| DELETE | `/api/v1/files/{id}/` | Owner, Administrator | Deletes file record and storage asset. |

### 10.8 People Search (YES)

Search is people-only: it discovers Hitchhikers and Student Council members, not projects, resources, or requests. Results never expose 42 login — only display name, avatar, role, and bio.

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| GET | `/api/v1/search/people/?q=...` | Authenticated | Searches Hitchhikers and Student Council members by display name. 42 login may be matched against internally but is never returned. |

## 11. Payload Examples

### Create Evaluation Request

**Request**

```
POST /api/v1/evaluation-requests/
```

```json
{
  "project_id": 4,
  "note": "Need help with parsing."
}
```

**Response — 201 Created**

```json
{
  "id": 17,
  "status": "pending"
}
```

### Hitchhiker Picks a Slot

**Request**

```
POST /api/v1/evaluation-requests/17/pick-slot/
```

```json
{
  "starts_at": "2026-08-01T15:00:00",
  "ends_at": "2026-08-01T16:00:00"
}
```

**Response — 200 OK**

```json
{
  "id": 17,
  "status": "awaiting_confirmation",
  "picked_by": 42,
  "starts_at": "2026-08-01T15:00:00",
  "ends_at": "2026-08-01T16:00:00"
}
```

### Submit Eligibility Request

**Request**

```
POST /api/v1/tutor-eligibility-requests/
```

```json
{
  "project_ids": [4, 7, 12]
}
```

**Response — 201 Created**

```json
{
  "id": 9,
  "status": "pending",
  "projects": [4, 7, 12]
}
```

### Head Tutor Reviews Eligibility Request

**Request**

```
POST /api/v1/tutor-eligibility-requests/9/review/
```

```json
{
  "decision": "approved"
}
```

**Response — 200 OK**

```json
{
  "id": 9,
  "status": "approved",
  "reviewed_by": 3,
  "reviewed_at": "2026-08-09T10:00:00"
}
```

### 13. Example communication types

For back and frontends to communicate correctly between one another we should define a contract of types between them. Meaning if user on database has fields like `username` and `real_name` the frontend should never try to access `nickname` due to the fact that it doesn't exist. 
To resolve this problem we define types on the frontend part and then this file must comply with the database scheme and, what's more important, the data backend sends over the HTTPS.

``` React

export type Language = "en" | "cz" | "es";

export interface UserRef {
    id : number;
    display_name : string,
    avatar_url : string | null
}

export interface Me {
    id : number;
    email : string;
    display_name : string;
    language : Language;
    roles : Role[];
}

export interface Project {
    id : number,
    slug : string,
    name : string;
}

```

This is only an example to understand how the frontend and backend would aggree with the data they get and send respectively.
During developing the library(package?) `drg-spectacular`  will be used which can automate the type generations so that they're never outdated

## 14. Final Notes

This document API contract plus underlying schema represents the full communication and data contract between the React frontend and Python backend.

- Confirmed features and tables marked **YES** can be implemented.
- Features and tables marked **?** require team discussion before development.