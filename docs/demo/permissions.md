# Permissions demo (#386)

Let the evaluators try to do what they should not. 3–5 minutes. Setup: [README.md](README.md). Full matrix: [docs/permissions.md](../permissions.md).

The point to make first: **the backend checks every request.** Hiding a menu item is only convenience; the API refuses on its own.

Open the API URLs below in the browser's address bar: a GET sends the session cookie, and the answer is the JSON error envelope `{"error": {"code", "message"}}`.

## The checks

| # | Who | Try | Expected |
|---|---|---|---|
| 1 | Logged out (private window) | `https://localhost/` | redirected to the login page |
| 2 | Logged out | `https://localhost/api/v1/users/me/` | 401 `not_authenticated` |
| 3 | Student | the role switcher | only **STUDENT**: the workspaces come from the real roles |
| 4 | Student | `https://localhost/council/inbox` | the "not allowed" page |
| 5 | Student | `https://localhost/api/v1/sc-messages/` | 403 `permission_denied` |
| 6 | Student | `https://localhost/manage/users` and `https://localhost/api/v1/admin/users/` | "not allowed" page; 403 `permission_denied` |
| 7 | Student | `https://localhost/api/v1/evaluation-requests/?scope=all` | 403 `permission_denied` (only Head Tutors and Admins) |
| 8 | Student | `https://localhost/api/v1/evaluation-requests/<id>/` with another student's request id | 404 `not_found`: a private object you may not see does not exist for you |
| 9 | Student | another person's profile | no **Manage roles** |
| 10 | Hitchhiker | **Requests** | only requests for approved projects; a request for another project is a 404 |
| 11 | Head Tutor | their own eligibility request | no Approve; the API gives 403 `cannot_review_own_request` |
| 12 | Admin | **Manage roles** on a profile | `admin` and `student` are never offered (403 `role_not_assignable` through the API) |
| 13 | Admin | own profile → **Manage roles** | 409 `cannot_modify_self`: an Admin cannot remove their own roles or suspend themselves |
| 14 | Admin | **Users** → the student → **Suspend** → the student's window | the student is logged out on the next request and cannot log in (401 `invalid_credentials`); **Reactivate** restores it. Both are in the **Audit log**. |
| 15 | Anyone | the browser console (F12) during all of this | no errors or warnings |

To show a refused write as well (CSRF is enforced), the browser console of a student window:

```js
fetch("/api/v1/users/1/roles/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "admin" }) }).then((r) => r.json()).then(console.log)
```

It is refused with 403 `csrf_failed`: without the CSRF header, no write goes through. (The app sends it through `apiRequest`.)

## Where it is in the code

| Layer | Where |
|---|---|
| API permission classes | `backend/apps/accounts/permissions.py` (roles read from the database on every request), app `permissions.py` files |
| Hidden objects → 404 | `apps/evaluations/visibility.py`, council and eligibility querysets |
| Error envelope | `apps/core/exceptions.py` |
| Frontend guards (UI only) | `components/auth/RoleGuard.tsx`, `utils/permissions.ts`, `store/RoleContext.tsx` |
| Tests | every endpoint has 401, 403/404 and 409 cases in `backend/apps/*/tests/` |

Contract: `docs/api-plan.md` §5.5 (401/403/404), §5.6 (error codes), §5.8 (roles); `docs/permissions.md`.

## Likely questions

- **Why 404 and not 403 for someone else's request?** A 403 would confirm the object exists. For private objects we answer as if it did not.
- **Can someone switch to the Admin workspace by editing the frontend?** The workspace is UI state; every API call checks the real roles, so they would only see error responses.
- **Does `is_staff` / superuser give app rights?** No. Django admin access and application roles are separate.
