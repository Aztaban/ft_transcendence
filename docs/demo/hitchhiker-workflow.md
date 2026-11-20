# Hitchhiker workflow demo (#384)

How a student becomes a Hitchhiker, gets approved for projects, and picks a slot. 4–5 minutes. Setup: [README.md](README.md) (Admin, Student and Hitchhiker accounts).

Windows: **A** Admin, **B** Hitchhiker (still a plain student at the start), **C** Student.

## The story

| # | What you do | What you say |
|---|---|---|
| 1 | A (STUDENT workspace): **Hitchhikers** or the top bar search → find `Hitchhiker` → open the profile → **Manage roles** → add **Hitchhiker** | Roles are given by people, not by the user: a Head Tutor can give `tutor`, an Admin also `head_tutor` and `sc_member`. `admin` itself only in the Django admin. |
| 2 | B: the bell shows "You now have the role Hitchhiker"; the role switcher now offers **HITCHHIKER** | The role change is live (WebSocket) and also stays in the notification center. Permissions are read from the database on every request, so the role works at once. |
| 3 | B: switch to **HITCHHIKER** → the **Welcome Hitchhiker** popup → tick 2–3 projects → **Submit** → "Your request was sent to the HEAD TUTORS!" | A new Hitchhiker cannot evaluate anything yet. They ask for the projects they know; a Head Tutor approves or declines the whole request. |
| 4 | A: switch to **HITCHHIKER** → **Eligibility** → the pending request → **Approve** | The Head Tutors were notified. A Head Tutor cannot approve their own request; another Head Tutor or an Admin does. Every decision goes to the audit log. |
| 5 | B: notification "Your eligibility request was approved"; **Requests** → *Your projects* lists them | From now on this Hitchhiker sees open requests for exactly these projects, and nothing else. |
| 6 | C (student) creates a request for one of the approved projects ([student-workflow.md](student-workflow.md) steps 1–2) | |
| 7 | B: **Requests** → the request appears without reloading → **Review** | Real time: eligible Hitchhikers get the new request live. The student is anonymous while the request is open: the Hitchhiker sees the project and the note, not who asked. |
| 8 | **Pick a slot**: a day and a start time → **Submit** → "The request has been picked! The student has to accept." | Slot rules: starts on :00/:15/:30/:45, 15–120 minutes, at least 30 minutes and at most 14 days ahead. The server refuses overlaps for both people. If two Hitchhikers pick at once, only one wins (atomic update). |
| 9 | C confirms ([student-workflow.md](student-workflow.md) step 4); B: notification "… confirmed the evaluation", **Pending** lists it | After confirmation both see each other's name and the evaluation is scheduled. |
| 10 | B: **Pending** → **Cancel** on the evaluation → **Cancel evaluation** → the slot is released | A Hitchhiker cannot cancel the student's request, only release their own slot. The request returns to the queue and the student is told. |

Optional: A (Admin) on the Hitchhiker's profile → remove the project's eligibility, or **Exceptions** to show evaluations whose Hitchhiker lost eligibility.

## Where it is in the code

| Step | Frontend | API | Backend |
|---|---|---|---|
| Give a role | `features/people/RoleManager.tsx` on `pages/PersonProfilePage.tsx` | `POST /api/v1/users/{id}/roles/`, `DELETE …/roles/{role_id}/` | `apps/accounts/views/roles.py`; `role.changed` notification; audit row |
| Workspaces | `store/RoleContext.tsx` (from the real roles), `components/layout/Sidebar.tsx` | `GET /users/me/` | the UI workspace is only UI state; the backend checks real roles every time |
| Eligibility request | `features/hitchhiker/WelcomeHitchhikerDialog.tsx`, `HitchhikerOnboarding.tsx`, `ProjectMultiSelect.tsx` | `POST /tutor-eligibility-requests/` | `apps/evaluations/views/eligibility.py`; one pending request per Hitchhiker (409 `eligibility_request_pending`) |
| Review | `pages/EligibilityReviewPage.tsx`, `features/headTutor/ReviewDialog.tsx` | `POST /tutor-eligibility-requests/{id}/review/` | conditional update on `status=pending`; creates `tutor_eligibility` rows; 403 `cannot_review_own_request` |
| Open requests | `pages/HitchhikerRequestsPage.tsx`, `features/hitchhiker/OpenRequestQueue.tsx` | `GET /evaluation-requests/?scope=open` | `apps/evaluations/visibility.py`: only `pending` requests for eligible projects, without the student |
| Pick | `pages/PickSlotPage.tsx`, `features/hitchhiker/SlotPicker.tsx`, `slotRules.ts` | `POST /evaluation-requests/{id}/pick-slot/` | lock on the eligibility row, overlap checks, `filter(pk, status=pending).update(...)`; `EVALUATION_SLOT_*` settings |
| Release | `pages/PendingPage.tsx`, `features/pending/CancelDialog.tsx` | `POST /evaluation-requests/{id}/release/` | back to `pending`, clears the slot, notifies the student |

Contract: `docs/api-plan.md` §5.8 (roles), §7.1 (lifecycle), §7.2 (eligibility), §10.2–§10.4.

## Likely questions

- **Why can't the Hitchhiker see who asked?** Anonymity while the request is open (R15): Hitchhikers pick by project, not by person. The name appears after the student confirms.
- **What if two Hitchhikers pick the same request?** The pick is a conditional update on `status = pending`; the second gets "Another Hitchhiker has just picked this request".
- **What if the Hitchhiker loses eligibility after picking?** The evaluation stays; it shows up in **Exceptions** for a Head Tutor or Admin to release or cancel with a reason.
