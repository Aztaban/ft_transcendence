# Student workflow demo (#383)

A student requests an evaluation, accepts or declines the proposed slot, and cancels. 4–5 minutes. Setup: [README.md](README.md). The Hitchhiker must already be approved for a project ([hitchhiker-workflow.md](hitchhiker-workflow.md) steps 1–5).

Windows: **C** Student, **B** Hitchhiker, side by side.

## The story

| # | What you do | What you say |
|---|---|---|
| 1 | C: register or log in → **Home** | Every account is a student. The Home page shows your requests and upcoming evaluations. |
| 2 | **Request** → choose an approved project (**Details** shows its topics) → note "Free after 18:00 on Friday" → confirm → "Your request is live and waiting for a HITCHHIKER!" | The student does not offer slots; they write when they are free. One active request per project: a second one is refused (409 `active_request_exists`). |
| 3 | B: the request appears in **Requests** live → picks a slot ([hitchhiker-workflow.md](hitchhiker-workflow.md) step 8) | |
| 4 | C: bell "A Hitchhiker picked a slot … Please confirm it" → open it → **Decline this time** → **Yes, decline** | Declining puts the request back in the queue; another Hitchhiker can propose a time. The student still does not know who proposed. |
| 5 | B picks again → C: **Accept** | Now it is confirmed: both see each other's name and the time, in their own time zone. |
| 6 | C: **Pending** → the evaluation → **Preview** (when, starts in) | Upcoming evaluations, soonest first. |
| 7 | C: **Cancel** → **Cancel evaluation** → "Done. Your slot has been released!"; B gets "… cancelled the evaluation" | A student can cancel any time before the start. Cancelled is final; it stays in **History** for both. |
| 8 | C: **History** | Cancelled, expired and finished evaluations, with the result once the team records it. |
| 9 | C: **Hitchhikers** → search by name → the Hitchhiker's profile (projects they can evaluate) | Search finds people by name, filtered by role. |

Also worth one sentence: requests expire by themselves (14 days without a pick, or the slot start passes unconfirmed), run by a Celery job.

## Where it is in the code

| Step | Frontend | API | Backend |
|---|---|---|---|
| Register / login | `pages/RegisterPage.tsx`, `pages/LoginPage.tsx`, `store/AuthContext.tsx` | `POST /auth/register/`, `/auth/login/`, 42 OAuth | `apps/accounts/views/authentication.py`, `services/oauth.py`; new accounts get `student` |
| Create | `pages/CreateRequestPage.tsx`, `api/evaluationRequests.ts` | `POST /api/v1/evaluation-requests/` | `apps/evaluations/views/requests.py`; one active request per project under a lock; notifies eligible Hitchhikers on commit |
| Accept / decline | `pages/EvaluationPage.tsx` (`/evaluations/:id`) | `POST …/{id}/confirm/`, `POST …/{id}/decline/` | `filter(pk, status=awaiting_confirmation).update(...)`; 409 `evaluation_already_started` after the start |
| Pending / cancel | `pages/PendingPage.tsx`, `features/pending/CancelDialog.tsx`, `PreviewDialog.tsx` | `GET …?scope=mine`, `POST …/{id}/cancel/` | conditional update to `cancelled`, keeps the slot for history |
| History | `pages/HistoryPage.tsx` | `GET …?scope=mine&history=true` | `apps/evaluations/visibility.py` |
| Live updates | `websocket/`, `store/NotificationCountContext.tsx` | WebSocket `/ws/`, `GET /notifications/` | `transaction.on_commit` → event; the page re-fetches over REST |
| Search | `pages/HitchhikersPage.tsx`, top bar search | `GET /api/v1/search/people/` | people search, throttled 60/min |

Contract: `docs/api-plan.md` §7.1 (lifecycle and rules), §8.7 (EvaluationRequest), §10.4.

## Likely questions

- **Why does the student not pick the time?** The Hitchhiker knows their availability; the student says when they are free in the note (R16).
- **Who sees what?** Hitchhikers don't see the student while the request is open; the student doesn't see the Hitchhiker until they accept, nor on a cancelled request (R15, R18).
- **What happens after the evaluation?** The team records passed/failed and feedback in the Django admin; both get a notification and History shows it.
