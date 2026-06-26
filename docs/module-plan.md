# ft_transcendence Module Plan

Project working name: **42 Prague Tutor & Counsellor Hub**

This document maps the planned application features to the ft_transcendence module system. It is meant to help the team agree on scope before implementation and avoid claiming modules that are not demonstrable during evaluation.

---

## 1. Target

The subject requires **14 points** to validate the project. Extra points can count toward bonus, but only fully functional modules should be claimed.

Our target:

| Target | Points |
| --- | ---: |
| Core validation target | 14 |
| Full-bonus target | 19 |
| Safety/stretch target | 21-22 |

Recommended strategy:

- Build the **14-point core** first.
- Add the **5-point full-bonus package** after the core is stable.
- Keep 2-3 backup modules ready in case one module is not accepted during evaluation.

---

## 2. Application idea

The project is a web platform for **42 Prague Tutors, Counsellors, Student Council, and students**.

Main goals:

- Public information about tutors, counsellors, and Student Council.
- Tutor/counsellor profiles with online status and current location/computer when available.
- Student Council announcement board.
- Anonymous or logged-in suggestion box.
- Login through 42 OAuth, plus safe fallback email/password authentication if required by evaluation.
- Evaluation request system where students open available evaluation slots and tutors can claim them.
- Role-based access for students, tutors, counsellors, head tutors, Student Council, and admins.
- Project resources for tutors/counsellors/admins.
- Notifications and optional Slack/email alerts.
- Analytics for evaluation demand, tutor activity, and system usage.
- Prometheus/Grafana monitoring for backend and infrastructure health.

---

## 3. Mandatory non-module requirements

These are not optional modules. They must exist regardless of the selected point plan.

| Requirement | Planned implementation |
| --- | --- |
| Web application | React + TypeScript frontend, Python backend, SQL database |
| Frontend | React + TypeScript, responsive UI, Chrome-compatible |
| Backend | Python framework, REST API, WebSocket support |
| Database | PostgreSQL with clear relational schema |
| Containerization | Docker Compose, single command startup |
| Secrets | `.env` ignored by Git and `.env.example` committed |
| HTTPS | Nginx reverse proxy with HTTPS for browser/backend communication |
| User management | Email/password auth plus 42 OAuth if possible |
| Input validation | Frontend and backend validation for all forms |
| Multi-user support | Concurrent users, safe slot claiming, live updates |
| Privacy Policy / Terms | Real pages linked from footer, not placeholders |
| Git usage | Meaningful commits from all team members |
| Console quality | No browser console errors/warnings during evaluation |

Important auth note:

The project idea is centered around **42 OAuth**, but the subject also expects a basic secure sign-up/login system. The safest interpretation is to implement **email/password authentication** and add **42 OAuth** as a module.

---

## 4. Core 14-point module plan

This is the main validation target. Do not start bonus modules until these are stable.

| # | Module | Category | Points | Project implementation |
| ---: | --- | --- | ---: | --- |
| 1 | Frontend + backend frameworks | Web | 2 | React + TypeScript frontend and Python backend framework |
| 2 | ORM | Web | 1 | Django ORM or SQLAlchemy with migrations |
| 3 | OAuth 2.0 remote authentication | User Management | 1 | Login with 42 account through OAuth |
| 4 | Advanced permissions system | User Management | 2 | Roles: student, tutor, counsellor, head tutor, Student Council, admin |
| 5 | Organization system | User Management | 2 | Organizations/groups: Tutors, Counsellors, Student Council, project groups |
| 6 | Real-time features | Web | 2 | WebSockets for online tutor status, evaluation slot updates, notifications |
| 7 | Complete notification system | Web | 1 | In-app notifications for create/update/delete actions and evaluation events |
| 8 | File upload and management | Web | 1 | Tutor photos, avatars, project resources, secure upload/delete/preview |
| 9 | Advanced analytics dashboard | Data and Analytics | 2 | Evaluation stats, tutor activity, demand by project, charts, filters, export |
|   | **Core total** |   | **14** |   |

---

## 5. Full-bonus package: +5 points

This package brings the project from 14 points to 19 points.

| # | Module | Category | Points | Project implementation |
| ---: | --- | --- | ---: | --- |
| 10 | Standard user management and authentication | User Management | 2 | Editable profiles, avatars, profile pages, friend/contact system, online status |
| 11 | Prometheus + Grafana monitoring | DevOps | 2 | Backend metrics, Prometheus scraping, Grafana dashboards, alerts, secured access |
| 12 | GDPR compliance features | Data and Analytics | 1 | Export my data, request/delete my data, confirmation flow |
|   | **Bonus total** |   | **5** |   |

Full target:

| Part | Points |
| --- | ---: |
| Core modules | 14 |
| Bonus package | 5 |
| **Total** | **19** |

---

## 6. Safety/stretch modules

These are good backup modules if the team has time or if one planned module becomes risky.

| Module | Category | Points | Why it fits | Priority |
| --- | --- | ---: | --- | --- |
| Advanced search | Web | 1 | Search tutors, projects, resources, announcements, evaluation requests | High backup |
| Data export/import | Data and Analytics | 1 | Export evaluations/resources/polls as CSV/JSON, import resources with validation | High backup |
| i18n: 3 languages | Accessibility and Internationalization | 1 | English, Czech, French; useful for 42 Prague | Medium |
| PWA | Web | 1 | Installable app, offline public pages, offline status | Medium |
| 2FA | User Management | 1 | Extra security for admins/head tutors | Medium |
| Accessibility WCAG 2.1 AA | Accessibility and Internationalization | 2 | Valuable, but harder to validate fully | Medium/high effort |
| Public API | Web | 2 | Secured API key, rate limiting, docs, at least 5 endpoints | Medium/high effort |
| ELK log management | DevOps | 2 | Proper centralized logs; heavier than Grafana monitoring | High effort |
| Custom design system | Web | 1 | 10 reusable components, palette, typography, icons | Medium |
| User activity analytics | User Management | 1 | User activity dashboard; only claim if clearly separate from general analytics | Medium |

Recommended backup order:

1. **Advanced search** (+1)
2. **Data export/import** (+1)
3. **i18n** (+1)
4. **2FA** (+1)
5. **Accessibility** (+2), only if the team wants to take it seriously from the start

---

## 7. Module acceptance criteria

### 7.1 Frontend + backend frameworks — 2 pts

Claim when:

- Frontend uses React + TypeScript with clear structure.
- Backend uses a Python framework such as Django, FastAPI, or Flask.
- Frontend and backend communicate through documented API endpoints.
- App is responsive and usable in latest stable Chrome.

Possible tech choice:

- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS or Material UI
- Backend: Django REST Framework or FastAPI

Recommended choice:

- **Django REST Framework** if we want built-in admin, ORM, auth, permissions, and migrations.
- **FastAPI** if we want a lighter API-first backend and are comfortable building more structure ourselves.

---

### 7.2 ORM — 1 pt

Claim when:

- All main entities are modeled through ORM models.
- Database migrations are used.
- Relations are clear and documented.
- No raw SQL is used for normal application logic unless justified.

Core models likely needed:

- User
- Role
- Organization
- OrganizationMembership
- TutorProfile
- CounsellorProfile
- StudentCouncilProfile
- EvaluationRequest
- EvaluationSlot
- ProjectResource
- Notification
- Announcement
- Suggestion
- UploadedFile
- AuditLog

---

### 7.3 OAuth 2.0 with 42 — 1 pt

Claim when:

- User can log in with 42 account.
- OAuth callback is handled securely.
- Backend creates or links a local user account.
- User identity from 42 is stored safely.
- Access tokens are never exposed to the frontend unnecessarily.
- Tokens/secrets are not committed to Git.

Open questions:

- Which 42 API endpoints can we use with student app scopes?
- Can we read project evaluation status reliably?
- Can we read current location/computer from 42 API?
- Are write actions to Intra evaluation possible or restricted?

MVP assumption:

- Use 42 OAuth for login and identity.
- Treat Intra write actions as optional research, not MVP.

---

### 7.4 Advanced permissions system — 2 pts

Claim when:

- Users can have multiple roles.
- Admin/head tutor can assign and remove roles.
- Different roles see different views and actions.
- Sensitive actions are protected on the backend, not only hidden in frontend.
- User CRUD exists where required.

Planned roles:

- Student
- Tutor
- Counsellor
- Head Tutor
- Student Council
- Admin

Examples:

| Action | Student | Tutor | Counsellor | Head Tutor | Admin |
| --- | --- | --- | --- | --- | --- |
| View public pages | Yes | Yes | Yes | Yes | Yes |
| Create evaluation request | Yes | Yes | Yes | Yes | Yes |
| Claim evaluation slot | No | Yes | Optional | Yes | Yes |
| Manage tutor resources | No | Limited | Limited | Yes | Yes |
| Manage roles | No | No | No | Limited | Yes |
| Publish announcements | No | No | Student Council/counsellor depending on role | Yes | Yes |

---

### 7.5 Organization system — 2 pts

Claim when:

- Organizations can be created, edited, deleted.
- Users can be added and removed from organizations.
- Organization membership affects access/actions.
- Users can view organizations and perform specific actions inside them.

Planned organizations:

- Tutors
- Counsellors
- Student Council
- Head Tutors
- Project-specific tutor groups, for example `webserv-evaluators`

Useful implementation:

```txt
Organization
OrganizationMembership
OrganizationRole
```

This lets us model real 42 Prague groups without hardcoding everything.

---

### 7.6 Real-time features — 2 pts

Claim when:

- WebSocket or similar real-time technology is implemented.
- Multiple connected users receive updates without page refresh.
- Connection/disconnection is handled gracefully.
- Backend broadcasts efficiently.

Best real-time features for our app:

- Tutor online/offline status.
- Current tutor location/computer when available.
- Evaluation slot opened/claimed/cancelled.
- New announcement published.
- New notification delivered.
- Suggestion/poll update for admins.

Demo scenario:

1. Open app in two browser windows.
2. Student creates evaluation slot.
3. Tutor sees it appear live.
4. Tutor claims it.
5. Student sees claimed status live.
6. Admin dashboard updates live count.

---

### 7.7 Complete notification system — 1 pt

Claim when:

- Notifications exist in the database.
- Users have unread/read states.
- Notifications are created for important create/update/delete actions.
- Notifications appear in the UI.
- Real-time delivery is connected if possible.

Notification examples:

- Evaluation slot created.
- Evaluation slot claimed.
- Evaluation slot cancelled.
- Project resource uploaded/updated/deleted.
- Role assigned/removed.
- Announcement created/updated/deleted.
- Poll created/closed.

Optional external channels:

- Email notification.
- Slack message to selected channel.

Do not make Slack/email mandatory for MVP. In-app notifications are safer.

---

### 7.8 File upload and management — 1 pt

Claim when:

- Users can upload allowed file types.
- Client-side and backend validation exist.
- File size/type checks are enforced.
- Files have secure access control.
- Users can preview files where appropriate.
- Users can delete uploaded files when allowed.
- Upload progress is shown where practical.

Planned file types:

- Tutor/counsellor profile photos.
- User avatars.
- Project resource PDFs/Markdown/images.
- Student Council attachment files.

Security rules:

- Do not allow executable files.
- Validate MIME type and extension.
- Store files outside backend source code.
- Use per-file permissions.
- Avoid leaking private resources through public URLs.

---

### 7.9 Advanced analytics dashboard — 2 pts

Claim when:

- Dashboard contains real data visualization.
- Charts are interactive.
- Data can update in real time or near-real time.
- Date range filters are available.
- Export functionality exists, such as CSV/PDF.

Planned analytics:

- Number of evaluation requests by project.
- Open vs claimed vs cancelled evaluation slots.
- Average waiting time for evaluation.
- Most requested projects.
- Tutor activity counts.
- Resource usage/downloads.
- Suggestion box trends.
- Student Council poll results.

Important distinction:

- This is **product analytics inside our application**.
- Grafana is **infrastructure/backend monitoring**.
- Keep them separate so both modules are easier to defend.

---

### 7.10 Standard user management and authentication — 2 pts

Claim when:

- Users can update their profile information.
- Users can upload an avatar.
- A default avatar exists.
- Users can add/remove friends or contacts.
- Users can see online status.
- Users have public/profile pages.

Project adaptation:

- “Friends” can be implemented as a simple contact/follow system.
- Users can add tutors/counsellors/students as contacts.
- Online status supports tutor availability.

Do not claim this module only for login. It needs the profile/avatar/friends/online-status features.

---

### 7.11 Prometheus + Grafana monitoring — 2 pts

Claim when:

- Prometheus collects metrics.
- Backend exposes metrics endpoint.
- Exporters/integrations are configured.
- Grafana has custom dashboards.
- Alerting rules exist.
- Grafana access is secured.

Metrics to collect:

- HTTP request count.
- HTTP response duration.
- HTTP status codes.
- Backend error count.
- Failed login attempts.
- Active WebSocket connections.
- Evaluation slots created/claimed/cancelled.
- 42 API sync success/failure count.
- 42 API latency.
- Database health.
- Container CPU/memory usage if practical.

Grafana dashboards:

1. **Backend Health**
   - requests per minute
   - p95 response time
   - 4xx/5xx errors
   - active WebSocket connections

2. **Evaluation System**
   - open evaluation slots
   - claimed slots
   - cancelled slots
   - evaluation requests by project

3. **42 API Sync**
   - successful syncs
   - failed syncs
   - API latency
   - rate-limit/auth errors

4. **Infrastructure**
   - CPU/RAM/container health
   - database availability
   - Redis availability if used

Demo scenario:

1. Open Grafana dashboard.
2. Create several evaluation requests.
3. Claim/cancel one slot.
4. Trigger one failed login.
5. Show metrics changing in Grafana.
6. Show alert rule configuration.

Important:

- Grafana should not be part of the public website UI.
- It should be a secured internal/admin service.

---

### 7.12 GDPR compliance features — 1 pt

Claim when:

- User can request/export their own data.
- User can request deletion of their data.
- Deletion requires confirmation.
- Exported data is readable.
- Confirmation email or in-app confirmation exists.

Planned features:

- `/profile/privacy`
- `Export my data` button
- `Request account deletion` button
- JSON export of profile, suggestions, evaluation requests, notifications, uploaded files metadata
- Confirmation step before destructive action
- Admin review if full deletion conflicts with audit/evaluation history

Important privacy rules:

- Do not log OAuth tokens.
- Do not expose private 42 API data publicly.
- Anonymous suggestions must stay anonymous unless user explicitly chooses to display intra/login.
- Privacy Policy must explain what data is stored and why.

---

## 8. Suggested implementation phases

### Phase 0 — Team and repository setup

Goal: everyone can run the project.

Tasks:

- Create monorepo.
- Add Docker Compose.
- Add frontend skeleton.
- Add backend skeleton.
- Add PostgreSQL.
- Add `.env.example`.
- Add README draft.
- Agree branch/PR rules.
- Agree roles: PO, PM/Scrum, Tech Lead, Developers.

Deliverable:

- `docker compose up` starts the basic app.

---

### Phase 1 — Auth, users, roles, organizations

Goal: identity and permissions are solid.

Tasks:

- Email/password auth.
- 42 OAuth.
- User model.
- Role model.
- Organization model.
- Membership model.
- Admin role assignment.
- Profile page.
- Avatar upload.

Modules touched:

- OAuth
- Advanced permissions
- Organization system
- Standard user management
- ORM

---

### Phase 2 — Public pages and profiles

Goal: the public website is useful even before the evaluation system is complete.

Tasks:

- Public homepage.
- Tutor/Hitchhiker description.
- Tutor list.
- Counsellor pages.
- Student Council description.
- Student Council member list.
- Announcement board.
- Suggestion box.
- Terms of Service.
- Privacy Policy.

Modules touched:

- Standard user management
- File upload
- Advanced permissions

---

### Phase 3 — Evaluation request system

Goal: the main unique feature works.

Tasks:

- Student creates evaluation availability slot.
- Tutor claims slot.
- Slot statuses: open, claimed, cancelled, done, expired.
- Basic conflict prevention.
- Permission checks.
- In-app notification on slot changes.
- Real-time update between student and tutor.

Modules touched:

- Real-time features
- Notification system
- Advanced permissions
- Analytics dashboard

---

### Phase 4 — Resources and admin/head tutor tools

Goal: tutors/counsellors/admins can manage useful content.

Tasks:

- Project resource CRUD.
- File upload/preview/delete.
- Resource visibility rules.
- Poll creation if chosen.
- Announcement management.
- Admin dashboard.

Modules touched:

- File upload
- Advanced permissions
- Organization system
- Notification system

---

### Phase 5 — Analytics and monitoring

Goal: make the project impressive and demonstrable.

Tasks:

- Product analytics dashboard.
- Evaluation charts.
- Date filters.
- CSV/PDF export.
- Metrics endpoint.
- Prometheus container.
- Grafana container.
- Dashboards.
- Alert rules.

Modules touched:

- Advanced analytics dashboard
- Prometheus + Grafana monitoring

---

### Phase 6 — GDPR and polish

Goal: full-bonus readiness.

Tasks:

- Export my data.
- Delete/request deletion.
- Confirmation flow.
- UI polish.
- Testing.
- Evaluation demo script.
- README finalization.

Modules touched:

- GDPR compliance
- Standard user management
- All modules final validation

---

## 9. Suggested repository documentation

Recommended docs folder:

```txt
docs/
├── module-plan.md
├── project-vision.md
├── mvp.md
├── architecture.md
├── api-plan.md
├── database-schema.md
├── auth-and-permissions.md
├── evaluation-system.md
├── monitoring-plan.md
├── privacy-and-gdpr.md
├── risks.md
└── team-roles.md
```

Recommended infra folders:

```txt
infra/
├── nginx/
├── prometheus/
└── grafana/
```

Recommended app folders:

```txt
frontend/
backend/
database/
docs/
infra/
scripts/
```

---

## 10. Risks and decisions to resolve early

### 10.1 42 API availability

Risk:

- Some desired data may not be available through the API with normal scopes.
- Creating real Intra evaluations from our app may not be possible.

Decision:

- MVP must not depend on writing to Intra.
- Use our own evaluation request system first.
- Treat Slack/email/Intra automation as optional stretch.

---

### 10.2 Authentication requirement

Risk:

- Subject may require email/password login even if 42 OAuth exists.

Decision:

- Implement email/password auth for safety.
- Add 42 OAuth as module.

---

### 10.3 Too many roles

Risk:

- Student, tutor, counsellor, head tutor, council, admin can become complicated.

Decision:

- Use flexible roles and organizations instead of hardcoding everything.
- Users can have multiple roles.

---

### 10.4 Evaluation slot race conditions

Risk:

- Two tutors could claim the same slot at the same time.

Decision:

- Backend must enforce atomic claim logic.
- Database constraints/transactions should protect slot claiming.

---

### 10.5 Grafana overengineering

Risk:

- DevOps monitoring can consume too much time.

Decision:

- Start with a small but complete monitoring scope:
  - backend metrics endpoint
  - Prometheus scrape
  - 2-3 Grafana dashboards
  - 1-2 alerts
  - secured access

---

## 11. Evaluation demo plan

During evaluation, we should be able to demonstrate:

1. Start everything with one command.
2. Open the app in Chrome with no console errors.
3. Register/login with normal account.
4. Login with 42 OAuth.
5. Show roles and permissions.
6. Show organizations and membership.
7. Edit a profile and upload avatar.
8. Add/remove contact/friend and show online status.
9. Create evaluation availability as a student.
10. Claim it as tutor in another browser.
11. Show real-time update.
12. Show notification created and delivered.
13. Upload project resource and delete it.
14. Show analytics dashboard with charts and filters.
15. Export analytics data.
16. Open Grafana and show backend metrics changing.
17. Show Prometheus target status.
18. Show alert rule configuration.
19. Export user data.
20. Show deletion/confirmation flow.
21. Show Privacy Policy and Terms of Service.
22. Explain team roles, work split, and contributions.

---

## 12. Final recommendation

Primary target:

```txt
Core app:                         14 points
Standard user management:         +2
Prometheus + Grafana monitoring:  +2
GDPR/privacy features:            +1
------------------------------------
Full-bonus target:                19 points
```

Safety target:

```txt
Add advanced search:              +1
Add data export/import:           +1
------------------------------------
Safety target:                    21 points
```

Best practical plan:

1. Build the 14-point core first.
2. Add standard user management while building profiles.
3. Add Grafana monitoring after backend metrics exist.
4. Add GDPR once user data models are stable.
5. Keep advanced search and data export/import as backup modules.

Do not claim a module unless the team has a clear demo for it.
