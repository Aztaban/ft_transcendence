# API Plan

Status: placeholder / waiting for implementation decisions  
Owner: TBD  
Last updated: TBD

## Purpose

This document will describe backend API endpoints.

For now, endpoints are draft and may change after stack and database decisions.

## API rules draft

- All browser-to-backend communication must use HTTPS.
- Backend validates all input.
- Backend enforces permissions.
- Frontend hiding buttons is not enough.
- API returns consistent error format.
- Sensitive data is never returned to unauthorized users.

## Error response draft

```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You do not have permission to perform this action."
  }
}
```

## Auth endpoints draft

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | public | Email/password registration if required. |
| POST | `/api/auth/login` | public | Email/password login. |
| POST | `/api/auth/logout` | logged in | Logout. |
| GET | `/api/auth/me` | logged in | Current user profile/roles. |
| GET | `/api/auth/42/start` | public | Redirect to 42 OAuth. |
| GET | `/api/auth/42/callback` | public | Handle 42 OAuth callback. |

## Public content endpoints draft

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/public/tutors` | public | Public tutor list. |
| GET | `/api/public/counsellors` | public | Public counsellor list. |
| GET | `/api/public/student-council` | public | Student council members. |
| GET | `/api/public/announcements` | public | Public announcements. |
| POST | `/api/public/suggestions` | public | Submit anonymous/public suggestion. |

## Profile endpoints draft

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/users/:id` | logged in | View user profile. |
| PATCH | `/api/users/me` | logged in | Update own profile. |
| POST | `/api/users/me/avatar` | logged in | Upload avatar/photo. |
| DELETE | `/api/users/me/avatar` | logged in | Remove avatar/photo. |

## Evaluation endpoints draft

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/evaluations/projects` | logged in | List projects available for evaluation. |
| POST | `/api/evaluations/slots` | student | Create availability slot. |
| GET | `/api/evaluations/slots` | tutor/head tutor/admin | List/filter slots. |
| POST | `/api/evaluations/slots/:id/claim` | tutor | Claim slot atomically. |
| POST | `/api/evaluations/slots/:id/cancel` | owner/tutor/admin | Cancel slot. |
| POST | `/api/evaluations/slots/:id/complete` | tutor/admin | Mark completed. |

## Admin/head tutor endpoints draft

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/admin/users` | admin/head tutor | List users. |
| PATCH | `/api/admin/users/:id/roles` | admin | Assign/remove roles. |
| CRUD | `/api/admin/projects` | admin/head tutor | Manage project records. |
| CRUD | `/api/admin/resources` | admin/head tutor | Manage project resources. |
| CRUD | `/api/admin/announcements` | admin/council | Manage announcements. |

## Monitoring endpoints draft

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/metrics` | Prometheus/internal | Prometheus metrics scrape endpoint. |
| GET | `/api/health` | public/internal | Basic health check. |

## 42 API integration questions

- Which endpoints are needed for user profile?
- Which endpoints show project status?
- Can we determine if project is waiting for evaluation?
- Can we list available projects for a student?
- Can we create/modify evaluation slots in Intra?
- What scopes are required?
