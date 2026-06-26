# Auth and Permissions

Status: draft  
Owner: TBD  
Last updated: TBD

## Goal

Define how login, users, roles, and permissions should work.

The platform has multiple user types and roles are not mutually exclusive. A user can be both tutor and student council member, or tutor and head tutor, etc.

## Authentication methods

### Required / safe baseline

- Email + password authentication
- Password hashing
- Backend validation
- Secure session/token handling

### 42 OAuth

- Login with 42 account
- Sync basic 42 profile data
- Store 42 user id / intra login
- Use 42 avatar if available
- Use 42 email if available and allowed

### Open question

Can the project rely only on 42 OAuth, or must email/password auth exist because of the subject?

Decision: TBD after tutor/staff confirmation.

## Role model

Roles are additive.

Initial roles:

| Role | Description |
|---|---|
| student | Default logged-in user. |
| tutor | Can manage tutor profile and claim evaluation slots. |
| head_tutor | Can manage tutors, project resources, evaluation flow. |
| counsellor | Can manage counsellor profile/content. |
| student_council | Can manage council profile/announcements. |
| admin | Full platform management. |

## Permission examples

| Action | Public | Student | Tutor | Head tutor | Counsellor | Student council | Admin |
|---|---:|---:|---:|---:|---:|---:|---:|
| View public pages | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Submit anonymous suggestion | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Submit identified suggestion | No | Yes | Yes | Yes | Yes | Yes | Yes |
| Create evaluation availability slot | No | Yes | Yes | Yes | No | Maybe | Yes |
| Claim evaluation slot | No | No | Yes | Yes | No | No | Yes |
| Manage tutor profile | No | No | Own | All | No | No | Yes |
| Manage project resources | No | No | Limited | Yes | No | No | Yes |
| Manage council announcements | No | No | No | No | No | Yes | Yes |
| Assign roles | No | No | No | Maybe | No | No | Yes |

## Permission implementation idea

Backend should enforce permissions. Frontend can hide UI, but backend is the source of truth.

Possible pattern:

```txt
User
└── UserRole[]
    ├── student
    ├── tutor
    ├── head_tutor
    └── admin
```

Backend helpers:

```txt
require_authenticated()
require_role("admin")
require_any_role(["admin", "head_tutor"])
can_manage_profile(request_user, target_user)
can_claim_evaluation_slot(request_user, slot)
```

## Security notes

Never store:

- raw passwords
- 42 OAuth client secret in Git
- OAuth access tokens in frontend localStorage
- private suggestion identity in public responses

Must protect:

- role assignment endpoints
- admin content management
- resource upload/delete
- evaluation slot claiming
- personal data export/delete
