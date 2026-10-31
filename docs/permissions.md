# Permission matrix

**Status:** Draft for team review
**Owner:** rkravche, IT Architect
**Last updated:** October 23, 2026

---

Who may call each endpoint, by role. It is a view of the contract: the rules come from `docs/api-plan.md` (§5.8 and the Auth column of every §10 table). If the two ever disagree, the api-plan wins and this file is fixed.

## How to read it

- A user can hold several roles and may do everything any of their roles allows. Every account holds `student`, so the Student column applies to everyone.
- **Hitchhiker** is `tutor`. **Head Tutor** (`head_tutor`) has every Hitchhiker permission too (schema §2.3). **Admin** does not imply any other role.
- ✓ allowed · **own** only on the caller's own data · **—** refused: 403 when the whole endpoint is role-gated, 404 when the object is hidden from the caller (§5.5).
- The authentication endpoints (§10.1) are public and left out.
- The backend enforces every cell. Hiding a button in the frontend is a convenience, not a protection.

## Users and roles (§10.2)

| Endpoint | Student | Hitchhiker | Head Tutor | SC Member | Admin |
|---|---|---|---|---|---|
| `GET`, `PATCH /users/me/`; `PUT`, `DELETE /users/me/avatar/` | own | own | own | own | own |
| `GET /users/{id}/` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /users/{id}/roles/` | — | — | `tutor` | `sc_member` | `tutor`, `head_tutor`, `sc_member` |
| `DELETE /users/{id}/roles/{role_id}/` | — | — | — | — | `tutor`, `head_tutor`, `sc_member` |
| `/admin/users/…` (list, detail, edit, suspend, reactivate, delete) | — | — | — | — | ✓ |

`student` and `admin` are never assigned or revoked through the API (§5.8). An admin cannot suspend, delete or revoke a role from themselves (409 `cannot_modify_self`).

## Projects and tutor eligibility (§10.3)

| Endpoint | Student | Hitchhiker | Head Tutor | SC Member | Admin |
|---|---|---|---|---|---|
| `GET /projects/`, `GET /projects/{slug}/` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /tutors/{id}/eligibility/` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /tutor-eligibility-requests/` | — | ✓ | ✓ | — | — |
| `GET /tutor-eligibility-requests/` | own | own | all | own | all |
| `GET /tutor-eligibility-requests/{id}/` | own | own | all | own | all |
| `POST /tutor-eligibility-requests/{id}/review/` | — | — | ✓, not own | — | ✓ |
| `DELETE /projects/{slug}/eligibility/{tutor_id}/` | — | — | ✓ | — | ✓ |

## Evaluation requests (§7.1, §8.7, §10.4)

| Endpoint | Student | Hitchhiker | Head Tutor | SC Member | Admin |
|---|---|---|---|---|---|
| `POST /evaluation-requests/` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET …?scope=mine` | own | own | own | own | own |
| `GET …?scope=open` | — | eligible projects | eligible projects | — | — |
| `GET …?scope=picked` | — | own picks | own picks | — | — |
| `GET …?scope=all` | — | — | ✓ | — | ✓ |
| `GET /evaluation-requests/{id}/` | own | own, picked, or `pending` and eligible | all | own | all |
| `PATCH /evaluation-requests/{id}/` (note) | own, `pending` | own, `pending` | own, `pending` | own, `pending` | own, `pending` |
| `POST …/pick-slot/` | — | eligible, not own | eligible, not own | — | — |
| `POST …/confirm/`, `POST …/decline/` | own | own | own | own | own |
| `POST …/release/` | — | own pick | own pick, or override | — | override |
| `POST …/cancel/` | own | own | own, or override | own | own, or override |

An override needs a `reason` and writes an audit entry (§5.8). Eligible Hitchhikers never see who asked while a request is `pending` (R15, §8.7). Evaluation results are entered in the Django admin (`/admin/`) by team members, not through the API (§7.1).

## Notifications (§10.5)

| Endpoint | Student | Hitchhiker | Head Tutor | SC Member | Admin |
|---|---|---|---|---|---|
| All `/notifications/…` endpoints | own | own | own | own | own |

## Student Council inbox (§10.6)

| Endpoint | Student | Hitchhiker | Head Tutor | SC Member | Admin |
|---|---|---|---|---|---|
| `POST /sc-messages/` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /sc-messages/`, `GET`, `PATCH /sc-messages/{id}/` | — | — | — | ✓ | ✓ |
| `DELETE /sc-messages/{id}/` | — | — | — | — | ✓ |
| `POST /sc-messages/{id}/reveal-sender/` | — | — | — | — | ✓ |

The sender never gets their message back and cannot list what they sent.

## Files (§10.7)

| Endpoint | Student | Hitchhiker | Head Tutor | SC Member | Admin |
|---|---|---|---|---|---|
| `POST /files/` | — | ✓ | ✓ | — | ✓ |
| `GET /files/`, `GET /files/{id}/`, `…/download/`: visibility `authenticated` | ✓ | ✓ | ✓ | ✓ | ✓ |
| The same: visibility `tutors` | — | ✓ | ✓ | — | ✓ |
| `PATCH`, `DELETE /files/{id}/` | own | own | all | own | all |

Avatars are always `authenticated` and change only through `/users/me/avatar/`.

## Search and administration (§10.8, §10.9)

| Endpoint | Student | Hitchhiker | Head Tutor | SC Member | Admin |
|---|---|---|---|---|---|
| `GET /search/people/` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /admin/evaluation-requests/exceptions/` | — | — | ✓ | — | ✓ |
| `GET /admin/audit-log/` | — | — | — | — | ✓ |

## Frontend workspaces

The role switcher shows one workspace per group of roles. It is UI state only: it never changes what the backend allows.

| Workspace | Opened by |
|---|---|
| Student | every account |
| Hitchhiker | `tutor` or `head_tutor` |
| Student Council | `sc_member` |

Head Tutor and Admin features appear inside these workspaces when the user holds the role (for example the eligibility review table). The Admin endpoints of §10.2 and §10.9 have no pages yet.

## Administrative permission implementation (#330)

Administrative API views use `IsAuthenticated` and the shared `IsAdminRole` from
`apps.accounts.permissions`. The exceptions endpoint allows Head Tutors too, as
specified in §10.9. Each endpoint declares its permissions; there is no separate
dashboard API or role selected by the frontend that grants access.

The application `admin` role is independent of Django's `is_staff` and
`is_superuser` flags (schema §2.1). An application Admin can use administrative
APIs without access to `/admin/`; an active staff user can open Django's dashboard
without holding the application `admin` role. Django model permissions still
control which models that staff user can manage.

Permission checks use current database membership. Assigning or revoking a role
changes access on the next request without a new login (§5.8); an inactive
account is not authenticated (§5.3). The audit-log endpoint exercises these
administrative API rules; admin user management and evaluation exceptions are
implemented in their respective #51 sub-issues.
