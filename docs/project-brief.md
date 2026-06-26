# ft_transcendence Project Brief — 42 Prague Tutor & Counsellor Hub

---

## 1. Executive Summary

We want to build a real-world web application for **42 Prague tutors, counsellors, Student Council members, and students**.

The application should make it easier to:

- see who the tutors / hitchhikers are,
- see which tutors are currently online and where they are sitting,
- find Student Council information and announcements,
- send anonymous or signed suggestions,
- request tutor-based evaluations,
- allow tutors to claim evaluation slots,
- manage roles, resources, polls, announcements, and project materials.

The project is **not a Pong clone**. The new subject allows the team to choose a creative web application, as long as it satisfies the mandatory requirements and reaches at least **14 module points**. Our planning target is now **19+ validated points** for full bonus, with a safer planned scope of around **21–22 points** so that one rejected minor module does not destroy the bonus target.

The product direction fits the subject well because it is a multi-user web platform with authentication, permissions, real-time status, notifications, admin tooling, file/resource management, monitoring/observability, privacy/GDPR features, analytics, accessibility backup work, and possible integration with the 42 API.

---

## 2. Subject Fit — High-Level Check

### Does this project idea fit the new subject?

The subject requires a full web application with:

- frontend,
- backend,
- database,
- containerized deployment,
- multi-user support,
- user management,
- clear README,
- privacy policy,
- terms of service,
- at least 14 module points.

Our concept satisfies the spirit of the subject because it is a real collaborative/productivity platform for a real 42 Prague use case.

### Important subject issue: authentication

The subject requires a basic user management system where users can sign up and log in securely. It explicitly says the minimum is **email + password authentication** with proper password security.

Our current idea is **42 OAuth login only**.

To be safe, we should implement:

1. **Email/password auth** as the mandatory baseline.
2. **42 OAuth2 login** as an additional module.
3. Link both methods to the same internal user model when possible.

Alternative: ask staff/tutors whether 42 OAuth can replace email/password for this project. Until confirmed, assume **email/password is required**.

---

## 3. Product Vision

### Problem

At 42 Prague, it can be unclear:

- who is currently available as a tutor/hitchhiker,
- where a tutor is sitting,
- who belongs to Student Council,
- where students should send suggestions,
- how tutor-specific resources are organized,
- how students can request tutor-led evaluations when they are ready,
- how tutors can discover and claim those requests.

### Goal

Create a single web platform that centralizes tutor/counsellor visibility, student requests, Student Council communication, and evaluation-related workflows.

### Users

- Public visitor
- Logged-in student
- Tutor / Hitchhiker
- Head Tutor
- Counsellor
- Student Council member
- Admin

Roles are **not mutually exclusive**. One user may be a student, tutor, council member, and admin at the same time.

---

## 4. Recommended Tech Stack

### Frontend

- **React + TypeScript**
- Vite
- React Router
- TanStack Query or RTK Query
- Tailwind CSS, MUI, or another CSS framework/styling solution
- WebSocket client for real-time updates

### Backend

Recommended option:

- **Python + Django + Django REST Framework**
- Django Channels for WebSockets
- Django ORM
- PostgreSQL
- Redis for WebSocket/channel layer, caching, and background jobs
- Celery or Django-Q for async jobs if needed

Why Django is a strong fit:

- built-in user model/auth foundations,
- admin panel helps with role/resource management,
- ORM gives us the ORM module naturally,
- DRF is good for REST APIs,
- Channels handles WebSockets,
- good fit for SQL-backed management systems.

Alternative backend:

- Python + FastAPI + SQLAlchemy + Alembic + PostgreSQL + Redis

FastAPI is also valid, especially if the team prefers lightweight API design. Django is probably safer if we want fast admin tooling and built-in auth.

### Database

- PostgreSQL

Why:

- relational data fits users, roles, projects, resources, evaluation requests, claims, polls, suggestions, and audit logs,
- good transaction support for claiming evaluation slots without race conditions,
- mature tooling.

### Infrastructure

- Docker / Docker Compose
- Nginx reverse proxy
- HTTPS termination at Nginx
- Prometheus for metrics collection
- Grafana for dashboards and alerting
- `.env` ignored by Git
- `.env.example` committed
- single-command startup, for example:

```bash
make up
# or
docker compose up --build
```

---

## 5. Mandatory Requirements Checklist

| Requirement | Our plan | Status |
|---|---|---|
| Web application | React frontend + Python backend | Fits |
| Frontend | React + TypeScript | Fits |
| Backend | Django/DRF or FastAPI | Fits |
| Database | PostgreSQL | Fits |
| Git history from all members | Use branches, PRs, meaningful commits | Must enforce |
| Containerized deployment | Docker Compose | Fits |
| Single command run | `make up` or `docker compose up --build` | Must implement |
| Chrome compatibility | Test on latest stable Chrome | Must verify |
| No browser console warnings/errors | CI/manual checklist | Must verify |
| Privacy Policy | Footer link + real content | Must implement |
| Terms of Service | Footer link + real content | Must implement |
| Multi-user support | WebSockets + DB transactions + locking | Fits |
| Responsive frontend | mobile/tablet/desktop layout | Must implement |
| CSS framework/styling solution | Tailwind/MUI/etc. | Fits |
| `.env` and `.env.example` | Secrets in `.env`, example committed | Must implement |
| Clear DB schema | ERD + migrations | Must document |
| Secure auth | Email/password + 42 OAuth | Must implement |
| Input validation FE + BE | zod/yup frontend, DRF/FastAPI serializers backend | Must implement |
| HTTPS for browser/backend/API | Nginx HTTPS | Must implement |
| README requirements | Root README with all required sections | Must implement |

---

## 6. Feature Scope

### 6.1 Public Area

Accessible without login.

#### Public pages

- Home page
- About Tutors / Hitchhikers
- Tutor list
- Student Council description
- Student Council member list
- Student Council announcement board
- Suggestion box
- Privacy Policy
- Terms of Service

#### Tutor/Hitchhiker public list

Tutor cards should show:

- display name,
- intra login,
- role badges,
- short bio,
- projects they can evaluate/help with,
- current online/offline status,
- current workstation/location if available from 42 API,
- optional avatar/photo.

Online tutors should appear at the top.

Example location format:

```txt
c2r2s2
```

This should be mapped from available 42 location data if possible.

#### Student Council section

Should show:

- what the Student Council is,
- current members,
- member roles,
- short info/contact preference,
- announcement board.

#### Suggestion box

Public users can send anonymous suggestions.

Logged-in users can choose:

- anonymous suggestion,
- suggestion signed with intra login.

Suggestion fields:

- category,
- message,
- optional contact permission,
- optional display name/intra login if logged in and user agrees.

Admin/Council view:

- list suggestions,
- filter by category/status,
- mark as new/reviewed/resolved/archived,
- optional internal notes.

---

### 6.2 Authentication and User Accounts

#### Required baseline

- Email/password registration and login
- Password hashing
- Sessions or JWT with secure handling
- Password reset if scope allows

#### 42 OAuth2 login

- Login via 42 account
- Store 42 ID and intra login
- Sync basic profile data where allowed
- Keep OAuth tokens secure and server-side
- Use refresh strategy carefully if needed

#### User profile

Users can edit:

- display name,
- avatar/photo,
- bio,
- preferred contact method,
- visibility settings.

---

### 6.3 Roles and Permissions

Roles are internal application roles.

Possible roles:

- `student`
- `tutor`
- `head_tutor`
- `counsellor`
- `student_council`
- `admin`

Roles are many-to-many.

Examples:

- A tutor may also be a student.
- A Student Council member may also be a tutor.
- A head tutor also has tutor permissions.
- Admin can assign/remove roles.

#### Permission examples

| Feature | Public | Student | Tutor | Head Tutor | Council | Admin |
|---|---:|---:|---:|---:|---:|---:|
| View public tutor list | yes | yes | yes | yes | yes | yes |
| Submit anonymous suggestion | yes | yes | yes | yes | yes | yes |
| Submit signed suggestion | no | yes | yes | yes | yes | yes |
| Create evaluation request | no | yes | yes | yes | yes | yes |
| Claim evaluation request | no | no | yes | yes | no | yes |
| Manage tutor resources | no | no | limited | yes | no | yes |
| Create council announcement | no | no | no | no | yes | yes |
| Assign roles | no | no | no | limited | no | yes |
| Manage polls | no | no | no | yes | yes | yes |

---

## 7. Evaluation Request System

### Core idea

Normal 42 evaluation flow is usually evaluator-first: the evaluator opens availability and someone books it.

Our idea reverses the discovery logic:

1. Student finishes a project.
2. Student opens a request saying: “I am available for evaluation during these times.”
3. Eligible tutor sees the request.
4. Tutor claims one of the slots.
5. Both sides receive confirmation/notification.

### Student flow

1. Login.
2. Open “Request evaluation”.
3. System shows projects that are eligible for requesting evaluation.
4. Student chooses project.
5. Student chooses availability windows.
6. Student writes optional notes.
7. Request is published to eligible tutors.
8. Student can cancel/modify until claimed.

### Tutor flow

1. Login as tutor.
2. Open evaluation dashboard.
3. Filter by project, time, student, status.
4. See open requests.
5. Claim a slot.
6. System locks the request to prevent race conditions.
7. Student and tutor receive notifications.

### Status lifecycle

```txt
DRAFT
OPEN
CLAIMED
CONFIRMED
COMPLETED
CANCELLED
EXPIRED
```

### Race condition prevention

When a tutor claims a request:

- use a DB transaction,
- lock the request/slot row,
- verify status is still `OPEN`,
- set status to `CLAIMED`,
- create notification events,
- broadcast real-time update.

This is important for the subject's multi-user requirement.

---

## 8. 42 API Integration Plan

### What we want from 42 API

Potential data:

- login via OAuth2,
- user profile/intra login,
- campus info,
- currently logged-in location/workstation,
- projects of a user,
- project status / whether a project is ready for evaluation,
- slots / scale teams / evaluations if accessible,
- maybe roles/groups if useful.

### Known useful API areas to research

- OAuth2 web application flow
- Users endpoints
- Locations endpoints
- Projects / projects_users endpoints
- Slots endpoints
- Scale teams endpoints
- Evaluations endpoints

### Important uncertainty

Some endpoints may require special permissions, specific OAuth scopes, account ownership, or staff-level access.

Therefore, we should split integration into two levels:

#### Level 1 — Safe integration

Must-have and likely realistic:

- 42 OAuth login,
- fetch own profile,
- fetch current user's project data if accessible,
- fetch locations/online status if accessible,
- cache/snapshot data in our DB.

#### Level 2 — Research / optional integration

Only after confirmation:

- create evaluation/scale team in Intra,
- create or modify 42 slots,
- send official Intra-side actions,
- fetch sensitive campus-wide data.

### Rule

Do not build the project around an API action until we confirm it is allowed and accessible.

The application should still work even if advanced 42 API integration is unavailable.

Fallback:

- use our own internal evaluation request system,
- show “Intra sync unavailable” where needed,
- send Slack/email/site notifications instead of creating Intra evaluations.

---

## 9. Notifications and Alerts

### In-app notifications

Examples:

- new evaluation request created,
- tutor claimed your request,
- request cancelled,
- new Student Council announcement,
- poll created,
- resource updated,
- role changed.

### Delivery channels

MVP:

- in-app notification bell,
- real-time WebSocket updates.

Later:

- email notification,
- Slack webhook notification,
- digest notifications.

### Slack/email risk

Slack/email requires credentials and permission from the school/workspace. Treat it as optional until approved.

---

## 10. Tutor and Project Resources

Tutors should have access to resources for projects they are allowed to evaluate.

Resource examples:

- links,
- PDFs,
- notes,
- checklists,
- common pitfalls,
- evaluation preparation notes,
- project-specific tutor guidelines.

Resource permissions:

- public resource,
- logged-in students only,
- tutors only,
- specific project tutors only,
- head tutor/admin only.

File upload module can be claimed if implemented fully with validation, secure storage, preview, deletion, and access control.

---

## 11. Polls

Admins, head tutors, counsellors, or Student Council members may create polls.

Poll examples:

- Which workshop should we organize next?
- Which evaluation times work best?
- Feedback about tutor availability.
- Student Council decisions.

Poll features:

- single-choice / multiple-choice,
- anonymous or signed,
- start/end date,
- visibility settings,
- result visibility settings,
- role-based restrictions.

---

## 12. Proposed Module Plan — Full Bonus Target

The project needs **14 validated points** minimum. For full bonus we should aim for **19+ validated points**. Because evaluators only count fully working modules, the team should plan around **21–22 points**, but build them in priority order.

### Strategy

Do not start by building 22 points at once. The correct approach is:

1. Build a coherent 14-point core first.
2. Add the 5-point full-bonus package.
3. Keep 2–3 extra minor modules as backup if time allows.

This avoids the most common ft_transcendence failure mode: a big feature list where nothing is fully demonstrable.

---

### 12.1 Core target — 14 points

These are the modules that best match the product and should be treated as the main evaluation target.

| Category | Module | Type | Points | Product implementation |
|---|---|---:|---:|---|
| Web | Use a framework for both frontend and backend | Major | 2 | React + TypeScript frontend, Django/DRF or FastAPI backend |
| Web | Real-time features using WebSockets | Major | 2 | online tutor status, live evaluation request updates, in-app notification updates |
| Web | ORM | Minor | 1 | Django ORM or SQLAlchemy with PostgreSQL |
| Web | Notification system | Minor | 1 | notifications for evaluation requests, claims, announcements, role changes, resource updates |
| Web | File upload and management | Minor | 1 | avatars, tutor photos, project resources with validation, preview, deletion, access control |
| User Management | OAuth2 remote authentication | Minor | 1 | 42 OAuth login linked to internal user account |
| User Management | Advanced permissions system | Major | 2 | student, tutor, head tutor, counsellor, Student Council, admin roles |
| User Management | Organization system | Major | 2 | tutor organization, Student Council, counsellor group, project/resource ownership |
| Data and Analytics | Advanced analytics dashboard | Major | 2 | evaluation demand, tutor activity, project stats, suggestion/poll summaries |

Total: **14 points**

### Why this 14-point core is coherent

This module set directly supports the main product. It avoids forced game/blockchain modules and gives the team a strong story during evaluation:

> We built a real multi-user school utility with authentication, role-based permissions, real-time state, notifications, file/resource management, and analytics.

---

### 12.2 Full-bonus package — +5 points

These modules bring the project to **19 points** and are strongly aligned with the Tutor & Counsellor Hub idea.

Updated decision: **Prometheus + Grafana monitoring replaces accessibility as the primary full-bonus major module.** Accessibility remains valuable, but it is moved to backup/stretch scope because complete WCAG 2.1 AA compliance can be time-consuming and subjective to validate.

| Category | Module | Type | Points | Product implementation |
|---|---|---:|---:|---|
| User Management | Standard user management and authentication | Major | 2 | profile pages, editable profile info, avatars, friends/contact system, online status |
| DevOps | Prometheus + Grafana monitoring | Major | 2 | metrics collection, backend/container dashboards, secured Grafana, alerting rules |
| Data and Analytics | GDPR compliance features | Minor | 1 | export my data, delete/request deletion, confirmation flow, privacy controls |

Core + full-bonus package: **19 points**

### Why these bonus modules are good choices

#### Standard user management

This is natural because the app already needs tutor/counsellor/student profiles. To claim the module safely, we should implement the full requirement, not only profiles:

- editable user profile,
- avatar upload,
- profile page,
- online status,
- simple friends/contact system.

For our product, the friends system can be interpreted as a simple contact/follow/request system:

- students can save tutors/counsellors as contacts,
- tutors can see relevant contacts,
- users can manage their contact/friend list.

#### Prometheus + Grafana monitoring

This is a strong full-bonus module because the app is a real multi-user service. Tutors and students depend on evaluation slots, online status, notifications, and 42 API syncs working reliably. Monitoring also gives a clean evaluation demo: open Grafana, trigger actions in the app, and show metrics changing.

Implementation checklist:

- Prometheus service in Docker Compose,
- backend `/metrics` endpoint,
- metrics for request count, response time, status codes, and errors,
- metrics for WebSocket connections,
- metrics for evaluation slot creation/claim/cancel actions,
- metrics for 42 API sync success/failure/rate-limit errors,
- database/container health metrics where practical,
- at least one custom Grafana dashboard,
- secured Grafana access,
- at least a few alerting rules or clearly documented alert conditions,
- README section explaining what is monitored and how to demonstrate it.

#### GDPR compliance

This is a strong fit because the app stores user accounts, roles, profile data, suggestions, evaluation requests, and possibly cached 42 API data.

Implementation checklist:

- Privacy page explains stored data,
- user can export their own data,
- user can request/delete account data where appropriate,
- confirmation step before destructive privacy actions,
- admin/audit trail for privacy operations,
- do not expose private suggestions or sensitive data.

---

### 12.3 Backup / safety modules

These should be prepared only after the core is stable. They are useful because they can save the full-bonus target if one planned module is rejected.

| Category | Module | Type | Points | Product implementation |
|---|---|---:|---:|---|
| Accessibility and Internationalization | Complete accessibility compliance | Major | 2 | WCAG 2.1 AA, keyboard navigation, semantic HTML, screen reader support, accessible forms/modals |
| Web | Advanced search | Minor | 1 | filter/search tutors, resources, projects, requests, suggestions, announcements |
| Data and Analytics | Data export/import | Minor | 1 | CSV/JSON export for tutor list, evaluation requests, poll results; import project resources |
| Accessibility and Internationalization | i18n | Minor | 1 | English, Czech, French UI translations |
| Web | PWA | Minor | 1 | installable app, cached public pages, offline fallback |

Accessibility remains a good module, but now it is a **backup major module**, not the primary 19-point path. It should only be claimed if we have enough time to test keyboard navigation, screen-reader behavior, forms, modals, contrast, focus states, and the WCAG 2.1 AA checklist properly.

Recommended safety target:

```txt
Core modules:             14 points
Full-bonus package:       +5 points
Backup modules:           +2 or +3 points
-----------------------------------
Planned scope:            21–22 points
Needed for full bonus:    19 points
```

---

### 12.4 Additional DevOps stretch modules

Prometheus + Grafana is now part of the primary 19-point target. The remaining DevOps stretch is log management.

| Category | Module | Type | Points | Notes |
|---|---|---:|---:|---|
| DevOps | ELK log management | Major | 2 | useful but heavier; only claim if Elasticsearch/Logstash/Kibana are fully implemented |

Backend logs should still exist even without claiming ELK, but for module validation we should only claim the DevOps log-management module if we implement the stack required by the subject and can demonstrate searching/filtering logs, retention/archiving, and secured access.

---

### 12.5 Modules to avoid unless the team intentionally commits to them

#### User interaction module

The Web “Allow users to interact with other users” module is a major module, but it requires all of the following:

- basic chat system,
- profile system,
- friends system.

We should **not claim this module** unless we really build chat + profiles + friends. Our standard user management module already requires profiles/friends/online status, but the Web interaction module adds chat as well.

#### Game-related modules

Avoid unless the team decides to add an actual game. Gaming modules require a functional game first.

#### AI modules

Possible later, but risky unless one teammate is excited about AI. A RAG system over tutor/project resources could fit the product, but it would be a large module and should not be part of the first target.

#### Blockchain modules

Not relevant to this project.

#### Custom module

A possible custom major module could be:

**Evaluation Request Workflow integrated with 42 API**

Possible justification:

- substantial business logic,
- concurrency-safe slot claiming,
- role-based eligibility,
- 42 API synchronization,
- notifications,
- real-world value for 42 Prague.

Risk:

- custom modules need evaluator acceptance,
- 42 API capabilities may be limited,
- should be used as a backup/story point, not the only path to 14 or 19 points.

---

### 12.6 Recommended final module claim order

During evaluation preparation, claim modules in this order:

1. Mandatory project requirements.
2. The 14-point core modules that are fully working.
3. Standard user management.
4. Prometheus + Grafana monitoring.
5. GDPR compliance.
6. Backup minor modules only if demonstrably complete.
7. DevOps/custom modules only if fully demonstrable.

## 13. Draft Database Schema

This is only an early proposal.

### Core users

#### `users`

- `id`
- `email`
- `password_hash`
- `display_name`
- `intra_login`
- `intra_id`
- `avatar_url`
- `bio`
- `is_active`
- `created_at`
- `updated_at`

#### `roles`

- `id`
- `name`
- `description`

#### `user_roles`

- `user_id`
- `role_id`

### Organizations

#### `organizations`

- `id`
- `name`
- `type` (`tutor_group`, `student_council`, `counselling`, etc.)
- `description`
- `created_at`
- `updated_at`

#### `organization_members`

- `organization_id`
- `user_id`
- `role_in_organization`

### Tutor profiles

#### `tutor_profiles`

- `id`
- `user_id`
- `public_title`
- `description`
- `is_visible`
- `is_available_for_help`
- `current_location`
- `last_seen_at`
- `photo_url`

### Projects and tutor resources

#### `projects`

- `id`
- `intra_project_id`
- `name`
- `slug`
- `description`
- `is_active`

#### `tutor_project_permissions`

- `id`
- `user_id`
- `project_id`
- `can_evaluate`
- `can_manage_resources`

#### `resources`

- `id`
- `project_id`
- `title`
- `description`
- `type` (`link`, `file`, `note`, `checklist`)
- `url`
- `file_path`
- `visibility`
- `created_by_id`
- `created_at`
- `updated_at`

### Evaluation requests

#### `evaluation_requests`

- `id`
- `student_id`
- `project_id`
- `status`
- `notes`
- `source` (`manual`, `intra_synced`)
- `intra_project_user_id`
- `created_at`
- `updated_at`
- `expires_at`

#### `evaluation_availability_slots`

- `id`
- `request_id`
- `start_at`
- `end_at`
- `status` (`open`, `claimed`, `cancelled`, `expired`)
- `claimed_by_tutor_id`
- `claimed_at`

### Student Council / announcements / suggestions

#### `announcements`

- `id`
- `title`
- `body`
- `visibility`
- `author_id`
- `published_at`
- `created_at`
- `updated_at`

#### `suggestions`

- `id`
- `category`
- `message`
- `is_anonymous`
- `author_id` nullable
- `status`
- `internal_note`
- `created_at`
- `updated_at`

### Polls

#### `polls`

- `id`
- `title`
- `description`
- `created_by_id`
- `is_anonymous`
- `starts_at`
- `ends_at`
- `visibility`

#### `poll_options`

- `id`
- `poll_id`
- `label`

#### `poll_votes`

- `id`
- `poll_id`
- `option_id`
- `user_id` nullable if anonymous
- `created_at`

### Notifications

#### `notifications`

- `id`
- `recipient_id`
- `type`
- `title`
- `body`
- `link_url`
- `is_read`
- `created_at`

### Audit log

#### `audit_logs`

- `id`
- `actor_id`
- `action`
- `entity_type`
- `entity_id`
- `metadata_json`
- `created_at`

### Standard user management and privacy

#### `friendships` / `user_contacts`

- `id`
- `requester_id`
- `receiver_id`
- `status` (`pending`, `accepted`, `blocked`, `removed`)
- `created_at`
- `updated_at`

This table supports the standard user management module. If we do not want a social-network style feature, we can present this as a lightweight contact/favorite tutor system.

#### `privacy_requests`

- `id`
- `user_id`
- `type` (`data_export`, `data_deletion`, `account_deletion`)
- `status` (`requested`, `processing`, `completed`, `rejected`, `cancelled`)
- `requested_at`
- `processed_at`
- `processed_by_id` nullable
- `notes`

This table supports the GDPR/privacy module.

#### `data_exports`

- `id`
- `user_id`
- `file_path`
- `format` (`json`, `csv`)
- `created_at`
- `expires_at`

This table supports user data export and possible admin export features.

---

## 14. Suggested Repository Structure

```txt
ft_transcendence/
├── README.md
├── docker-compose.yml
├── Makefile
├── .env.example
├── docs/
│   ├── project-brief.md
│   ├── subject-compliance.md
│   ├── module-plan.md
│   ├── api-research-42.md
│   ├── database-schema.md
│   ├── user-flows.md
│   ├── permissions.md
│   ├── monitoring-plan.md
│   ├── privacy-gdpr-plan.md
│   ├── analytics-plan.md
│   ├── accessibility-plan.md
│   ├── evaluation-demo-script.md
│   ├── risks.md
│   └── meeting-notes/
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
├── backend/
│   ├── Dockerfile
│   ├── manage.py
│   ├── pyproject.toml
│   ├── requirements.txt
│   └── app/
├── infra/
│   ├── nginx/
│   ├── prometheus/
│   ├── grafana/
│   └── scripts/
└── scripts/
    ├── dev.sh
    ├── lint.sh
    └── test.sh
```

---

## 15. Initial Repo Creation Commands

```bash
mkdir ft_transcendence
cd ft_transcendence

git init

mkdir -p docs/meeting-notes frontend/src backend/app infra/nginx infra/prometheus infra/grafana infra/scripts scripts

touch README.md docker-compose.yml Makefile .env.example

touch docs/project-brief.md \
      docs/subject-compliance.md \
      docs/module-plan.md \
      docs/api-research-42.md \
      docs/database-schema.md \
      docs/user-flows.md \
      docs/permissions.md \
      docs/monitoring-plan.md \
      docs/privacy-gdpr-plan.md \
      docs/analytics-plan.md \
      docs/accessibility-plan.md \
      docs/evaluation-demo-script.md \
      docs/risks.md

git add .
git commit -m "chore: initialize ft_transcendence planning repository"
```

---

## 16. Development Phases

### Phase 0 — Team alignment

Goal: decide scope before coding.

Tasks:

- choose final project name,
- confirm stack,
- assign team roles,
- choose target modules,
- confirm whether 42 OAuth alone is acceptable or email/password is required,
- ask tutors/staff about 42 API permissions and what data/actions are allowed,
- create GitHub repo,
- create GitHub Issues backlog,
- agree that the main target is **14 core points first**, then **19+ full-bonus target**.

### Phase 1 — Skeleton

Goal: app runs in Docker with frontend/backend/database.

Tasks:

- Docker Compose,
- PostgreSQL container,
- Redis container,
- backend hello endpoint,
- frontend hello page,
- HTTPS local setup or documented local dev fallback,
- `.env.example`,
- README first version.

### Phase 2 — Auth and users

Goal: secure user system.

Tasks:

- email/password auth,
- 42 OAuth login,
- user model,
- roles model,
- profile page,
- avatar upload,
- simple contact/friend/favorite tutor system,
- online status foundation,
- admin can assign roles.

Relevant modules:

- OAuth2 remote authentication,
- Advanced permissions,
- Standard user management.

### Phase 3 — Public site

Goal: usable public pages.

Tasks:

- home page,
- tutor description,
- tutor list,
- Student Council description,
- council member list,
- announcement board,
- suggestion box,
- privacy policy,
- terms of service.

### Phase 4 — Tutor/council management

Goal: real content management.

Tasks:

- editable tutor profiles,
- online status display,
- project resource management,
- council announcement management,
- suggestion moderation,
- polls,
- file upload/preview/delete/access control.

Relevant modules:

- File upload,
- Organization system,
- Notification system.

### Phase 5 — Evaluation request workflow

Goal: main advanced feature.

Tasks:

- create request,
- add availability windows,
- filter requests,
- tutor claims request,
- transactional locking,
- notifications,
- real-time updates.

Relevant modules:

- Real-time features,
- Notifications,
- Advanced permissions,
- Analytics dashboard.

### Phase 6 — 42 API integration

Goal: connect real data where possible.

Tasks:

- OAuth profile sync,
- location sync,
- project status sync,
- investigate slots/scale team/evaluation endpoints,
- decide what stays internal vs what syncs to Intra.

### Phase 7 — Analytics, search, and exports

Goal: make the app useful for tutors/admins and add safe backup modules.

Tasks:

- analytics dashboard,
- evaluation demand by project,
- average waiting time,
- tutor activity overview,
- suggestion/poll summaries,
- advanced search filters,
- CSV/JSON exports,
- optional import for project resources.

Relevant modules:

- Advanced analytics dashboard,
- Advanced search,
- Data export/import.

### Phase 8 — Monitoring and GDPR

Goal: full-bonus readiness and production-style reliability.

Tasks:

- Prometheus service,
- backend `/metrics` endpoint,
- request/latency/error metrics,
- WebSocket connection metrics,
- evaluation slot action metrics,
- 42 API sync/error metrics,
- Grafana dashboards,
- secured Grafana access,
- basic alerting rules or documented alert conditions,
- GDPR data export,
- deletion/request deletion flow,
- privacy settings,
- final Privacy Policy and Terms of Service review.

Relevant modules:

- Prometheus + Grafana monitoring,
- GDPR compliance.

Accessibility tasks should still be done at a basic quality level for mandatory frontend quality, but complete WCAG 2.1 AA compliance is now a backup/stretch module.

### Phase 9 — Hardening and evaluation readiness

Goal: make it evaluable.

Tasks:

- tests,
- responsive design pass,
- no console warnings,
- seed data/demo users,
- module demonstration script,
- README finalization,
- individual contribution documentation,
- module claim checklist,
- backup module decision.

## 17. Team Roles Required by Subject

The subject requires documented roles.

Suggested role split:

### Product Owner

Responsibilities:

- product vision,
- feature priorities,
- backlog decisions,
- stakeholder communication,
- validation of completed features.

### Project Manager / Scrum Master

Responsibilities:

- meetings,
- task tracking,
- deadlines,
- blockers,
- coordination.

### Technical Lead / Architect

Responsibilities:

- architecture,
- stack choices,
- code quality,
- review of critical changes,
- API/database design.

### Developers

Responsibilities:

- implement assigned features,
- test own code,
- review PRs,
- document work.

One person can have multiple roles if the team has 4 members.

---

## 18. Suggested Team Split

This is only a proposal.

### Frontend lead

- React app structure,
- routing,
- UI components,
- tutor list,
- dashboards,
- forms,
- WebSocket integration.

### Backend/API lead

- Django/DRF or FastAPI setup,
- auth,
- REST API,
- validation,
- permissions,
- database models.

### Integration/DevOps lead

- Docker,
- Nginx,
- HTTPS,
- PostgreSQL,
- Redis,
- 42 API client,
- deployment scripts.

### Product/data/features lead

- module plan,
- docs,
- DB schema,
- user flows,
- evaluation workflow,
- README and evaluation demo plan.

Everyone should still contribute code and understand the full project.

---

## 19. Questions for Team / Tutors / Staff

### Subject questions

- Can 42 OAuth replace mandatory email/password auth, or must we implement both?
- Are custom modules accepted easily, and what proof is expected?
- Is this type of school-internal utility acceptable for ft_transcendence?

### 42 API questions

- Which API scopes can a normal student app get?
- Can we fetch current campus locations for users?
- Can we fetch project status / marked-for-evaluation status?
- Can we create or modify 42 slots?
- Can we create scale teams/evaluations, or is this restricted?
- Are there rate limits we need to design around?
- Are we allowed to store cached 42 data?
- Are there privacy restrictions around showing location/workstation publicly?

### Product questions

- What exactly is the tutor/hitchhiker role now?
- Who decides who is a tutor?
- Who decides who is Student Council?
- Should public users see real names/photos or only intra logins?
- Should online status be public or logged-in only?
- Should suggestions be truly anonymous, even to admins?
- Should counsellor features be separate from tutor features?

### Scope questions

- Is evaluation request workflow MVP or later phase?
- Do we need chat?
- Do we need email/Slack notifications, or are in-app notifications enough?
- Which modules are we definitely claiming?
- Which modules are backup/bonus only?

---

## 20. README Checklist

The final root `README.md` must include:

- first line in the required italicized format with all team logins,
- project description,
- project name and key features,
- instructions to run the project,
- prerequisites,
- `.env` setup,
- team information,
- assigned roles,
- project management method,
- communication channel,
- technical stack,
- justification for stack choices,
- database schema,
- features list,
- modules list,
- point calculation,
- module justification,
- who worked on each feature/module,
- individual contributions,
- resources,
- AI usage explanation,
- known limitations if any,
- privacy policy and terms links.

README must be in English.

---

## 21. Main Risks

### Scope creep

This idea can become too big.

Mitigation:

- build public pages + auth + roles first,
- keep evaluation workflow as the main advanced feature,
- make Slack/Intra write actions optional.

### 42 API permissions

Some endpoints may be restricted.

Mitigation:

- research early,
- build fallback internal workflow,
- avoid relying on restricted API actions.

### Privacy

Displaying location, online status, photos, and suggestions may be sensitive.

Mitigation:

- user visibility settings,
- role-based access,
- privacy policy,
- do not display sensitive data publicly without approval,
- make anonymous suggestions carefully designed.

### Authentication requirement

42 OAuth alone may not satisfy the mandatory auth requirement.

Mitigation:

- implement email/password baseline,
- implement 42 OAuth as module,
- ask staff for confirmation.

### Race conditions in evaluation claims

Multiple tutors may claim the same request.

Mitigation:

- database transactions,
- row locking,
- clear status lifecycle,
- WebSocket updates.

### Uneven team contributions

The subject requires all members to contribute and explain the project.

Mitigation:

- GitHub Issues assigned to members,
- PR reviews,
- weekly sync,
- contribution log,
- each member owns at least one visible feature and one technical area.

---

## 22. MVP Recommendation

The first version should not try to do everything. The team should treat the project as three layers:

1. **MVP product** — the site is usable.
2. **14-point core** — the project is safe to pass.
3. **19+ full-bonus layer** — the project is strong and bonus-ready.

---

### MVP should include

- Dockerized app,
- React frontend,
- Python backend,
- PostgreSQL database,
- Redis,
- email/password auth,
- 42 OAuth login,
- roles and permissions,
- public tutor list,
- public Student Council page,
- announcements,
- suggestion box,
- editable tutor profiles,
- avatar/photo upload,
- admin role assignment,
- evaluation request workflow,
- in-app notifications,
- basic real-time status updates,
- privacy policy,
- terms of service.

---

### 14-point core should additionally prove

- WebSocket updates work with multiple users,
- ORM-backed DB schema is clear,
- notification system works for create/update/delete events,
- file upload validates type/size and has preview/delete/access control,
- advanced permissions are enforced on backend, not only frontend,
- organization system exists and affects access/actions,
- analytics dashboard shows real data from the DB.

---

### Full-bonus 19-point layer should add

- full standard user management:
  - editable profile,
  - avatar,
  - profile page,
  - online status,
  - friend/contact/favorite tutor system,
- Prometheus + Grafana monitoring:
  - backend `/metrics` endpoint,
  - request count/latency/error dashboards,
  - WebSocket connection metrics,
  - evaluation slot metrics,
  - 42 API sync/error metrics,
  - secured Grafana dashboard,
  - documented alert conditions,
- GDPR/privacy tooling:
  - export my data,
  - delete/request deletion,
  - confirmation step,
  - documented privacy behavior.

---

### Backup extras if time allows

- advanced search,
- data export/import,
- i18n with English/Czech/French,
- PWA,
- Prometheus + Grafana monitoring,
- ELK logging.

---

### Later / optional product ideas

- Slack notifications,
- email notifications,
- advanced 42 API write actions,
- creating real Intra evaluations,
- full public API,
- PWA,
- multilingual support.

## 23. Immediate Next Steps

1. Create repository.
2. Add this document to `docs/project-brief.md`.
3. Add `docs/module-plan.md` with the 14-point core, 19-point full-bonus target, and 21–22 point backup plan.
4. Add `docs/api-research-42.md` with 42 API questions and confirmed endpoints.
5. Add `docs/monitoring-plan.md` with Prometheus/Grafana metrics, dashboards, and demo plan.
6. Add `docs/privacy-gdpr-plan.md` with data export/delete/privacy flows.
7. Add `docs/analytics-plan.md` with dashboard metrics and data sources.
8. Ask team to review scope.
9. Ask tutors/staff about OAuth/auth and API restrictions.
10. Decide Django vs FastAPI.
11. Create GitHub Issues for Phase 0 and Phase 1.
12. Prepare first README draft.
13. Prepare a module demonstration checklist early, not at the end.

---

## 24. Recommended Position for Team Discussion

The safest message to the team:

> We are building a 42 Prague Tutor & Counsellor Hub. It is a real web application for tutor visibility, Student Council communication, suggestions, role management, resources, and evaluation requests. We will use React + TypeScript, Python backend, PostgreSQL, Redis, and Docker. We will implement mandatory auth safely, add 42 OAuth, and design the app to still work even if advanced 42 API write actions are not available. Our module plan is: first build a coherent 14-point core, then add standard user management, Prometheus + Grafana monitoring, and GDPR compliance to reach 19 points for full bonus. We will keep accessibility, advanced search, data export/import, i18n, PWA, and ELK logging as backup/stretch modules if time allows.

