*This project has been created as part of the 42 curriculum by *

## Desccription

- The “Description” section should also contain a clear name for the project and its
key features.

## Instruction

- The “Instructions” section should mention all the needed prerequisites (software,
tools, versions, configuration like .env setup, etc.), and step-by-step instructions to
run the project.

## Resources

## Team information

- Assigned role(s): PO, PM, Tech Lead, Developers, etc.
- Brief description of their responsibilities.

## Project Managmement

◦ How the team organized the work (task distribution, meetings, etc.).
◦ Tools used for project management (GitHub Issues, Trello, etc.).
◦ Communication channels used (Discord, Slack, etc.).

## Technical stack

◦ Frontend technologies and frameworks used.
◦ Backend technologies and frameworks used.
◦ Database system and why it was chosen.
◦ Any other significant technologies or libraries.
◦ Justification for major technical choices.

## Database schema

◦ Visual representation or description of the database structure.
◦ Tables/collections and their relationships.
◦ Key fields and data types.

## Features List

◦ Complete list of implemented features.
◦ Which team member(s) worked on each feature.
◦ Brief description of each feature’s functionality

## Modules

The subject asks for **14 points**. A major module is 2 points, a minor module is 1 point. An incomplete module counts as **0**. The plan keeps modules that are already built, the administration branch, and four modules still to finish. That is 18, four above the minimum. Health, status page and backups can add one more.

**Claimed on this branch: 11. Administration branch brings that to 13. Finishing the four open modules makes 18. Health, status page and backups is a possible 19th point.**


| Module                              | Subject     | Pts    | Status                                                                |
| ----------------------------------- | ----------- | ------ | --------------------------------------------------------------------- |
| Frontend and backend frameworks     | IV.1 major  | 2      | Claim                                                                 |
| Real-time features (WebSockets)     | IV.1 major  | 2      | Claim                                                                 |
| ORM                                 | IV.1 minor  | 1      | Claim                                                                 |
| Advanced search                     | IV.1 minor  | 1      | Claim                                                                 |
| Remote authentication (OAuth 2.0)   | IV.3 minor  | 1      | Claim                                                                 |
| Additional browsers                 | IV.2 minor  | 1      | Check than claim, should be fine                                      |
| Custom major: evaluation scheduling | IV.10 major | 2      | Claim                                                                 |
| Custom minor: append-only audit log | IV.10 minor | 1      | Claim                                                                 |
| Advanced permissions                | IV.3 major  | 2      | On `issue-51-implement-administration-permissions`, claim when merged |
| Multiple languages (EN, CS, ES)     | IV.2 minor  | 1      | Almost: project topics still English                                  |
| Notification system                 | IV.1 minor  | 1      | Finish, then claim                                                    |
| WCAG 2.1 AA                         | IV.2 major  | 2      | Finish, then claim                                                    |
| Design system                       | IV.1 minor  | 1      | Finish, then claim                                                    |
| Health, status page and backups     | IV.7 minor  | 1      | Possible                                                              |
| **Planned total**                   |             | **18** | 19 if the health module is finished                                   |


Contributors for each module are filled in by the team. Names are not guessed here.

### Frontend and backend frameworks (major, 2)

React on the frontend and Django on the backend. The subject lists both by name, and a framework on each side is the major rather than two separate minors. Django also provides sessions, password hashing and the admin. The frontend is React 18, TypeScript, Vite and React Router. The backend is Django 5.1 and Django REST Framework.

### Real-time features (major, 2)

One WebSocket per browser tab (`wss://<host>/ws/`), authenticated with the session cookie. The server pushes an event; the client never sends application data over the socket. The database stays the source of truth: on each event the page re-fetches the affected data over REST, and a dropped connection does the same after it comes back.

Disconnects are handled on purpose. Close code `4401` means the session is gone and the user is logged out. Any other drop reconnects with backoff from 1 s up to 30 s, with jitter so many tabs do not reconnect at once. Logout closes the socket. Redis (Django Channels) fans events out to the right users.

### ORM (minor, 1)

Django ORM against MySQL 8.4. Models, constraints and migrations live under `backend/apps/`. Shared rows that several people can change at once (a slot pick, an eligibility decision) are updated with a conditional `UPDATE` inside a transaction, not read-modify-save.

### Advanced search (minor, 1)

People search (`GET /api/v1/users/`) filters by name, role and project, sorts by an allow-list of fields, and paginates (default 20, maximum 100). The Hitchhiker directory is this endpoint. Evaluation and eligibility lists use the same pagination and ordering rules.

### Remote authentication, OAuth 2.0 (minor, 1)

Login with a 42 account. The browser is sent to 42, 42 calls the callback, and the backend exchanges the code. The access token, the code and the client secret never reach the browser. A known 42 account is logged in; an unknown one is created as a student. The session cookie is `HttpOnly`, `SameSite=Lax` and `Secure`.

### Additional browsers (minor, 1)

Developed in Chrome. Also tested, and fixed where needed, in **Firefox** and **Edge**. The UI and the flows behave the same in all three. No browser-specific product limitation is left open.

### Custom major: evaluation scheduling (2)

**Why this module.** The product is a booking desk for 42 Prague evaluations: a student asks for a project, an eligible Hitchhiker takes a slot, the student confirms it. That workflow is not a listed module, and it is the part of the system with the hardest rules.

**Technical challenge.** Two Hitchhikers can press "pick" on the same request at the same moment. The pick is a single conditional update that succeeds only while the request is still `pending`. Exactly one of them wins; the other gets a conflict. The same pattern guards confirm, decline, cancel and eligibility decisions. A Celery beat task expires requests that nobody confirmed in time. Each transition notifies the other person and pushes a WebSocket event after the transaction commits.

**Why it is worth 2 points.** It is a multi-step state machine (`pending`, `awaiting_confirmation`, `confirmed`, `cancelled`, `expired`) with role rules, a race that must not double-book a student, background expiry, and a separate eligibility review before a Hitchhiker may pick a project. A short form would not qualify. This one is the core of the product.

**How it is implemented.** `EvaluationRequest` and `TutorEligibility` in `backend/apps/evaluations/`. Slot length, expiry and the one-pending-request rule are settings and database constraints, not scattered literals. The student, Hitchhiker and Head Tutor pages are the frontend for the same states.

### Custom minor: append-only audit log (1)

**Why this module.** Head Tutors and Admins can change someone else's standing: assign a role, grant or revoke eligibility, delete a Student Council message, or reveal who sent an anonymous council message. Those actions have to leave a record that the actor cannot edit afterwards.

**Technical challenge.** Rows are insert-only. `save()` refuses an update, `QuerySet.update()`, `bulk_update()` and `delete()` raise, and `bulk_create()` refuses `ON DUPLICATE KEY UPDATE`. The row is written inside the same transaction as the action, so a failed action does not leave a log line and a committed action cannot lose one. There is no update API.

**Why it is worth 1 point.** It is smaller than the scheduling workflow: one table, one write service, one admin read endpoint. It is not a log of ordinary page views. It covers the privileged mutations the product actually performs.

**How it is implemented.** `backend/apps/audit/`. A line is written when a role is assigned or revoked, when eligibility is granted or revoked, when a council message is deleted, and when its sender is revealed. Admins read the log at `GET /api/v1/admin/audit-log/`. The administration branch adds lines for an admin editing, suspending, reactivating or deleting an account. File moderation is not part of this module.

### Multiple languages (minor, 1) — one gap left

English, Czech and Spanish, with a language switcher. The login, register, eligibility, dashboard, evaluation, search and profile pages read their copy from `frontend/src/i18n/locales/{en,cs,es}.json`. Czech and Spanish contain every English key. Backend messages are wrapped in `gettext`, and the compiled catalogs are committed: `backend/locale/cs` and `backend/locale/es`, both `.po` and `.mo`. The API picks the language from `Accept-Language`.

The subject wants every user-facing string to go through i18n. The page chrome does. What does not: the topic names and the "what will be tested" lines on a project page. They are English literals in `frontend/src/features/projects/projectContent.ts` and are rendered as-is in the pie chart and the tested list. Moving those strings into the three locale files is the remaining work. The wordmark "EVALS" and the place name "42 Prague" stay as they are.

### Notification system (minor, 1) — not claimed yet

A notification is stored as facts (`type` + `payload`), not as an English sentence. The text is built on screen in the user's language. The center lists, marks read and deletes notifications. Creating one also pushes a WebSocket event after commit. Old rows are deleted by a Celery task.

Covered today: the evaluation transitions, eligibility request / decision / revocation, `role.changed`, and a new Student Council message. Deleting a council message removes the notification that announced it.

Not claimed yet, because the subject wants a notification for every create, update and delete that affects another person. `account.updated` is sent by the admin edit endpoint on `issue-51-implement-administration-permissions`, so that gap closes when the branch is merged. `resource.created`, `resource.updated` and `resource.deleted` belong to the Files API, which this project will not ship. Those three types have to be removed from `docs/api-plan.md` and the notification model in the same change, otherwise the module is incomplete.

### WCAG 2.1 AA (major, 2) — not claimed yet

The pages already use semantic headings, `aria-*` where the role is not obvious, a visible focus style, and a language switcher that is keyboard reachable. On main, every page sets the browser-tab title, and the role menu has a skip link and keyboard support.

Still open: re-check the pages added after the accessibility pass, and run a real screen-reader pass. Until that pass is done, this module stays off the claimed list.

### Design system (minor, 1) — not claimed yet

Design tokens (color, type, spacing, radius, shadows) live in `frontend/src/styles/tokens.css`. Five reusable components exist: `Button`, `Input`, `Checkbox`, `Card`, `Badge`.

The subject asks for **10** reusable components, plus a palette, typography and icons. Five is not enough, so this stays with the frontend team.

### Advanced permissions (major, 2) — on the administration branch

An admin can list users, open one, edit the account, suspend it, reactivate it and delete it. Assigning and revoking roles is already on this branch, with rules for who may grant which role. Each of those actions writes an audit row. Editing someone else's account sends `account.updated`. Suspending an account ends that user's sessions.

The same product already shows a different navigation and different actions to a student, a Hitchhiker, a Head Tutor, a Student Council member and an admin. The server checks the role on every request; the role switcher in the header is only a view.

This lives on `issue-51-implement-administration-permissions` (issues #665 and the admin-user issues after it). It is not on this branch yet. The branch has the API and no admin users page, so the evaluation still needs a screen, or a prepared API walkthrough, before the module is demonstrated.

### Health, status page and backups (minor, 1) — possible

`GET /health/` already reports MySQL, Redis and the Celery heartbeat, and Docker waits on that check before starting the rest of the stack. The subject also wants a status page, an automated backup, and a written way to restore.

The remaining work is small: a page that shows the health payload, a scheduled database dump, and a short restore procedure. It is an extra point on top of the 18, not one the plan depends on.

### Modules we will not claim

Incomplete modules score 0, and these are not worth finishing for the points they return.

- **File upload and management (1).** No files app. Previews, upload progress, validation and delete are still to build. Avatars stay at the default. `resource.`* notifications go away with it.
- **Standard user management (2).** Profiles exist. Friends, online status and avatar upload do not.
- **User interaction (2).** No chat and no friends list. The Student Council inbox is anonymous and one-way; it is not this module.

## Individual Contributions

◦ Detailed breakdown of what each team member contributed.
◦ Specific features, modules, or components implemented by each person.
◦ Any challenges faced and how they were overcome.