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
- Projects and eligibility rules
- Evaluation requests and scheduled evaluations
- Notifications and audit logs
- Student Council messages
- Uploaded file metadata

The database is accessed exclusively through the backend API never directly by the frontend.

### WebSocket Layer

Provides real time updates for:

- Live notification pushes
- Evaluation status changes (claims, releases, completions)
- Role updates

**Important rule:** HTTP responses are always the source of truth. WebSocket events only inform the frontend that something changed after receiving an event, the frontend must re fetch the updated data via REST.

## 3. Open Architecture Decisions

These must be agreed upon by the team before (or early in) implementation. Agreed answers should be recorded as short ADRs in `docs/adr/`.

### Q1. Automate tutor eligibility from the 42 Intra API?

Instead of Head Tutors hand maintaining who can evaluate what, the Intra `projects_users` data tells us which projects a user validated.?

**Proposed model:** opt in per tutor sync only runs for tutors who linked 42 OAuth and granted an `eligibility_sync` consent. Everyone else stays manual. Head Tutor override always wins. Sync never deletes.

To discuss:

- Do we want this automation at all, or is manual only acceptable for the product scope?
- Rate limit budget: default app limits are ~2 req/s and 1200 req/h — enough for our campus size?

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
| Projects & Tutor Eligibility | YES |
| Evaluation Requests | YES |
| Evaluations & Claiming | YES |
| Notifications | YES |
| Student Council Inbox | YES |
| Tutor Resources & Files | YES |
| Search | YES |
| Administration | YES |
| Announcements | ? |
| Polls | ? |

## 5. API Design Principles & Conventions

- **Base URL:** all endpoints are prefixed with `/api/v1/`. Versioning allows future API changes without breaking existing clients (e.g. a future `/api/v2/users/`).
- **JSON communication:** all payloads use `Content-Type: application/json`.
- **Authentication model:** session-cookie based. After successful login (password or 42 OAuth), a session cookie is set (`HttpOnly`; `SameSite=Lax`). The browser sends it automatically on future requests.
- **Pagination:** large collections use `?page=1&page_size=20` to avoid returning thousands of records at once.
- **Authorization:** authentication verifies who the user is; authorization verifies what they're allowed to do (e.g. a student can create their own evaluation request; a tutor can claim eligible slots; an admin manages users).
- **Server-side business rules are authoritative:** preventing duplicate slot claims, checking permissions, validating eligibility, and protecting private data are always enforced backend-side. The frontend is never trusted for security decisions.

### Error Format

All errors return a standard HTTP status code plus a structured payload:

```json
{
  "error": {
    "code": "slot_taken",
    "message": "Requested slot is already taken."
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
| 409 | Conflict | Action conflicts with system state (e.g. slot already claimed). |
| 500 | Internal Error | Unexpected backend error. |

### Role Legend

| Role | Description |
|---|---|
| Public | Unauthenticated user / no login required. |
| Authenticated | Logged-in user with standard session. |
| Own | Logged-in user accessing their own resources. |
| Student | Standard student user role. |
| Tutor | Registered tutor. |
| Eligible Tutor | Tutor explicitly permitted to evaluate a given project. |
| Head Tutor | Tutor management permissions. |
| SC Member | Student Council representative. |
| Administrator | Full administrative rights. |

## 6. Endpoint Summary Table

| Module | Endpoints | Status |
|---|---|---|
| Authentication | 6 | YES |
| Users | 7 | YES |
| Projects | 5 | YES |
| Evaluation Requests | 5 | YES |
| Evaluations | 4 | YES |
| Notifications | 3 | YES |
| Student Council | 6 | YES |
| Files | 3 | YES |
| Search | 1 | YES |
| Administration | 3 | YES |
| Announcements | 5 | ? |
| Polls | 5 | ? |

## 7. Workflows & Lifecycle Diagrams

### Evaluation Lifecycle

```
Student
   │
   ▼
Create Request
   │
   ▼
OPEN
   │
   ▼
Tutor Claims Slot
   │
   ▼
SCHEDULED
   │
   ▼
Evaluation takes place
   │
   ▼
Tutor Marks Done
   │
   ▼
COMPLETED
```

| Status | Meaning |
|---|---|
| OPEN | Student created a request and tutors can claim available slots. |
| SCHEDULED | A tutor claimed the request; the evaluation is planned. |
| COMPLETED | The tutor finished the evaluation and submitted feedback. |
| CANCELLED | The request was cancelled before completion. |

### Claim-Slot Concurrent Race Condition Flow

```
Student creates evaluation request
              │
              ▼
Request becomes OPEN
              │
              ▼
Eligible tutors see available slot
              │
              ▼
Tutor sends claim request
              │
              ▼
Backend checks DB availability
              │
        ┌─────┴─────┐
        │           │
   Available    Already Taken
        │           │
        ▼           ▼
   SCHEDULED    409 Conflict Error
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
| status | State: open, scheduled, completed, cancelled. |
| note | Optional message from the student. |
| slots | List of requested evaluation time windows. |
| created_at | Creation timestamp. |
| updated_at | Modification timestamp. |

### Evaluation

| Field | Description |
|---|---|
| id | Unique evaluation ID. |
| student | Foreign Key to Student. |
| tutor | Foreign Key to evaluating Tutor. |
| request | Foreign Key to original request. |
| status | State: scheduled, completed, cancelled. |
| feedback | Tutor notes and score. |
| completed_at | Timestamp of completion. |

### Notification

| Field | Description |
|---|---|
| id | Unique Notification ID. |
| user | Foreign Key to recipient user. |
| type | Category (e.g. evaluation.claimed, role.changed). |
| message | Content text. |
| read_at | Timestamp when read by user. |
| created_at | Creation timestamp. |

Notifications are created internally by backend actions only — clients cannot create them directly.

## 9. Real-Time WebSocket Events

| Event Name | Trigger Condition |
|---|---|
| evaluation.claimed | A tutor successfully claims an evaluation slot. |
| evaluation.completed | A tutor marks an evaluation completed. |
| evaluation.released | A tutor releases a scheduled evaluation back to open. |
| notification.created | System issues a new notification to a user. |
| role.changed | Admin or system alters a user's permissions/role. |

**Reminder:** WebSockets only signal that something changed. On receipt, the frontend must call the matching REST endpoint (e.g. `GET /api/v1/evaluations/{id}/`) to get the authoritative data.

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
| GET | `/api/v1/users/{id}/` | Authenticated | Public profile information. |
| GET | `/api/v1/users/` | Administrator | Paginated list of registered users. |
| POST | `/api/v1/users/{id}/roles/` | Administrator / Head Tutor | Assigns role to target user (Head Tutor limited to Tutor role). |
| DELETE | `/api/v1/users/{id}/roles/{role_id}/` | Administrator | Revokes target role; fires role.changed event. |
| POST | `/api/v1/users/{id}/suspend/` | Administrator | Suspends account activity. |

### 10.3 Projects & Tutor Eligibility (YES)

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| GET | `/api/v1/projects/` | Authenticated | Returns project list available for evaluations. |
| GET | `/api/v1/projects/{slug}/eligible-tutors/` | Head Tutor, Admin | Lists tutors qualified to evaluate given project. |
| POST | `/api/v1/projects/{slug}/eligibility/` | Head Tutor, Admin | Grants tutor permission to evaluate project. |
| DELETE | `/api/v1/projects/{slug}/eligibility/{tutor_id}/` | Head Tutor, Admin | Revokes evaluation permission without cancelling existing slots. |
| GET | `/api/v1/tutors/{id}/eligibility/` | Authenticated | Returns public listing of projects tutor is allowed to evaluate. |

### 10.4 Evaluation Requests — Student Side (YES)

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| POST | `/api/v1/evaluation-requests/` | Student (own) | Creates request with selected time slots. |
| GET | `/api/v1/evaluation-requests/` | Own / Eligible Tutor | Students see own requests; tutors see open requests for eligible projects. |
| GET | `/api/v1/evaluation-requests/{id}/` | Own, Eligible Tutor, Admin | Detailed view of request. |
| PATCH | `/api/v1/evaluation-requests/{id}/` | Own | Edit request details while still in open state. |
| DELETE | `/api/v1/evaluation-requests/{id}/` | Own, Administrator | Soft-deletes / cancels request. |

### 10.5 Claiming & Evaluations — Tutor Side (YES) [WS]

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| POST | `/api/v1/request-slots/{slot_id}/claim/` | Eligible Tutor | Claims slot. Protected by DB constraint against double claims. |
| GET | `/api/v1/evaluations/` | Participant, Admin | Filtered evaluations list. |
| GET | `/api/v1/evaluations/{id}/` | Participant, Admin | Detailed evaluation view. |
| POST | `/api/v1/evaluations/{id}/release/` | Tutor, Head Tutor | Releases evaluation back to open (requires reason). |
| POST | `/api/v1/evaluations/{id}/complete/` | Tutor, Head Tutor | Submits feedback and marks evaluation completed. |

### 10.6 Notifications (YES) [WS]

Created automatically by backend actions — clients cannot create notifications directly.

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| GET | `/api/v1/notifications/` | Own | Fetch user notifications (supports `?unread=true`). |
| POST | `/api/v1/notifications/{id}/read/` | Own | Marks single notification read. |
| POST | `/api/v1/notifications/read-all/` | Own | Marks all user notifications read. |

### 10.7 Student Council Inbox (YES)

Anonymous communication channel between students and the Student Council.

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| POST | `/api/v1/sc-messages/` | Authenticated | Submits anonymous message; sender_id stored internally but never returned. |
| GET | `/api/v1/sc-messages/` | SC Member | Lists inbox without revealing sender identity. |
| GET | `/api/v1/sc-messages/{id}/` | SC Member | Reads message details anonymously. |
| POST | `/api/v1/sc-messages/{id}/read/` | SC Member | Sets read status. |
| PATCH | `/api/v1/sc-messages/{id}/discussion-note/` | SC Member | Internal SC notes (never visible to sender). |
| GET | `/api/v1/sc-messages/{id}/sender/` | Admin only | Emergency unmasking endpoint for abuse investigation (access must be logged). |

### 10.8 Tutor Resources & Files (YES)

Files are never exposed via direct public paths; the backend checks permissions on every request, validating file type, size, permissions, and visibility.

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| POST | `/api/v1/files/` | Context Dependent | Uploads file asset; checks dynamic file types and permissions. |
| GET | `/api/v1/files/{id}/` | Context Dependent | Streams file through auth check (no direct static serving). |
| DELETE | `/api/v1/files/{id}/` | Owner, Administrator | Deletes file record and storage asset. |

### 10.9 Search (YES)

Search results are always filtered according to the requester's visibility permissions; private information is stripped and hidden resources cannot be discovered.

| Method | Path | Auth Required | Notes |
|---|---|---|---|
| GET | `/api/v1/search/?q=...&type=tutor,project,resource,request` | Authenticated | Multi-category search respecting user permissions. |

## 11. Payload Examples

### Create Evaluation Request

**Request**

```
POST /api/v1/evaluation-requests/
```

```json
{
  "project_id": 4,
  "note": "Need help with parsing.",
  "slots": [
    {
      "starts_at": "2026-08-01T15:00:00",
      "ends_at": "2026-08-01T16:00:00"
    }
  ]
}
```

**Response — 201 Created**

```json
{
  "id": 17,
  "status": "open"
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