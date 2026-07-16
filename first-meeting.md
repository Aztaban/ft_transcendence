# ft_transcendence - First Team Meeting Proposal

Status: **personal proposal for discussion, not an agreed specification**

## 1. Project idea

Build a web platform for 42 Prague students, tutors/hitchhikers, counsellors, and the Student Council.

The platform should centralize information that is currently spread across different places and provide a useful workflow for requesting tutor-led project evaluations.

The project should remain useful after the ft_transcendence evaluation, rather than becoming only a technical demonstration.

## 2. Main users

- Public visitor
- Student
- Tutor / Hitchhiker
- Head Tutor
- Counsellor
- Student Council member or president
- Administrator

A person may have more than one role at the same time.

## 3. Proposed product scope

### Public area

- Description of tutors/hitchhikers and counsellors
- Public list of tutors and counsellors
- Tutor availability or online status, if feasible
- Student Council description and member list
- Student Council announcement board
- Anonymous suggestion box

### Logged-in student area

- Login with a 42 account in addition to the mandatory email/password login
- View and edit a basic profile
- Create an evaluation request with one or more availability slots
- View the status of their evaluation requests
- Receive a notification when a tutor accepts or changes a request
- Optionally submit a suggestion signed with their intra login

### Tutor area

- View evaluation requests relevant to projects they can evaluate
- Filter and search requests
- Claim an available evaluation slot
- Release or cancel a claim when permitted
- Receive live notifications about new or changed requests
- Access tutor resources uploaded by authorized users

### Head Tutor / Student Council / Admin area

- Manage users and application roles according to permissions
- Manage tutor or Student Council membership where permitted
- Manage public profiles and announcements
- Upload, update, preview, and delete resources
- Review suggestion-box messages
- View basic operational information

## 4. Proposed technical direction

- **Frontend:** React + TypeScript
- **Backend:** Django + Django REST Framework
- **Database:** PostgreSQL through Django ORM
- **Real-time:** Django Channels and WebSockets
- **Supporting service:** Redis for the Channels layer and possibly caching/background work
- **Infrastructure:** Docker Compose and Nginx with HTTPS
- **Monitoring:** Prometheus and Grafana
- **Authentication:** mandatory email/password authentication plus 42 OAuth

This is only a proposed direction. The team should agree on the stack before detailed architecture or database documents are treated as final.

## 5. Recommended module plan

The subject requires **14 points**. We should target at least **15 points** so that one disputed minor module does not immediately block validation.

### Recommended primary modules

| Module | Points | How it fits the project | Recommendation |
|---|---:|---|---|
| Framework for frontend and backend | 2 | React frontend and Django backend | Strong choice |
| Real-time features | 2 | Evaluation requests, claims, and notifications update live across connected users | Strong choice |
| Remote authentication with OAuth 2.0 | 1 | Login with 42 OAuth 2.0 | Strong choice |
| Advanced permissions system | 2 | Admin, head tutor, tutor, council, counsellor, and student actions are enforced by the backend | Strong choice |
| File upload and management | 1 | Tutor resources, council attachments, and profile images with validation, preview, access control, progress, and deletion | Good choice |
| Multiple languages | 1 | Complete English, Czech, and Spanish translations with an i18n system | Good choice if started early |
| ORM | 1 | Django ORM, relational models, and migrations | Very natural choice |
| Complete notification system | 1 | Persistent read/unread notifications for relevant create, update, and delete actions | Natural companion to real-time features |
| Advanced search | 1 | Search, filtering, sorting, and pagination for tutors, resources, announcements, and evaluation requests | Useful and relatively safe |
| Prometheus and Grafana monitoring | 2 | Backend metrics, integrations/exporters, custom dashboards, alert rules, and secured Grafana access | Good, but implement after the core workflow |
| **Total** | **14** |  |  |

A sensible first stretch module is **GDPR compliance** for a total target of **15 points**.

## 6. Assessment of the originally proposed modules

### Standard user management - valid but larger than basic login

This module requires more than authentication. It includes:

- editable profiles,
- avatar upload and a default avatar,
- profile pages,
- friends,
- online status.

It fits only if the team genuinely wants the social/contact features. Basic profile editing or OAuth login alone is not enough.

### Two-factor authentication - valid optional module

The app must implement its own complete 2FA flow. Existing 2FA on a user's 42 account does not count as the application's 2FA module.

This is useful for admin accounts but should come after the main authentication flow is stable.

### GDPR compliance - useful, but not free points

The mandatory Privacy Policy is not enough for this module. The application must support:

- requesting/exporting the user's data,
- deletion with confirmation,
- a readable export,
- confirmation emails for data operations.

This fits the project well and is a reasonable 15th point after the user models are stable.

## 7. Suggested bonus candidates

Do not commit to all bonus modules during the first meeting. Decide after the 14-point plan and MVP are accepted.

Good candidates:

1. GDPR compliance - 1 point
2. Standard user management - 2 points, only if friends/profile features are wanted
3. 2FA - 1 point
4. Organization system - 2 points, if Tutors and Student Council are modeled as real organizations with membership CRUD and organization-specific actions

The subject allows a maximum of five bonus points beyond the required fourteen.

## 8. Important implementation notes

### Real-time module

Do not demonstrate only a notification toast. A stronger demonstration is:

1. A student creates an evaluation request in one browser.
2. A tutor sees it appear without refreshing.
3. The tutor claims it.
4. The student immediately sees the updated state.
5. Two tutors cannot claim the same slot.

The database transaction prevents the race condition; WebSockets distribute the result to clients.

### Monitoring module

Grafana should monitor the backend and infrastructure, not replace an application analytics page.

Possible metrics:

- request count and latency,
- HTTP error rate,
- failed logins,
- active WebSocket connections,
- evaluation requests created and claimed,
- 42 API success/failure and latency,
- PostgreSQL and Redis availability,
- container CPU and memory.

The module also requires custom dashboards, alert rules, integrations/exporters, and secured Grafana access.

### File management module

Uploading one avatar is not enough. The complete flow should include multiple supported file types, frontend and backend validation, secure storage/access control, preview where applicable, upload progress, and deletion.

### Multiple languages module

All user-facing text must be translatable and all three languages must be complete. English, Czech, and Spanish are acceptable choices. Adding i18n late would be expensive, so the translation structure should exist from the beginning even if translations are completed later.

## 9. Decisions needed at the first team meeting

1. Do we all agree with the Tutor, Counsellor, and Student Council Hub idea?
2. Is the evaluation-request workflow the main feature of the MVP?
3. What can realistically be read from the 42 API, and what should remain internal to our app?
4. Do we agree on React, Django REST Framework, PostgreSQL, Redis, and Docker Compose?
5. Do we accept mandatory email/password authentication in addition to 42 OAuth?
6. Which exact modules form our protected 14-point plan?
7. Do we want a 15th safety point, preferably GDPR?
8. Who takes each coordination role and technical responsibility area?
9. What is explicitly outside the MVP?

## 10. Proposed team roles

These roles are for coordination. Everyone remains a developer and contributes to implementation.

### Product Owner

**Selected person:** `[add name]`

Responsibilities:

- maintain the product vision,
- decide feature priorities with the team,
- communicate with possible users or stakeholders,
- confirm that completed features match the agreed goal.

### Project Manager / Scrum Master

**Selected person:** `[add name]`

Responsibilities:

- organize meetings,
- track progress and deadlines,
- identify blockers,
- keep GitHub issues and milestones organized after the project plan is agreed.

### Technical Lead / Architect

**Selected person:** `[add name]`

Responsibilities:

- coordinate architecture and stack decisions,
- help define shared frontend/backend contracts,
- maintain code-quality expectations,
- review important technical changes with the relevant developers.

## 11. Initial technical responsibility split

This is only a starting point for discussion. Detailed milestones, tasks, and GitHub issues should be created later after the team agrees on the project.

| Main responsibility | Selected person | General focus |
|---|---|---|
| Frontend developer 1 | `[add name]` | React structure, routing, authentication/profile UI, shared components, responsive layout, design system, and overall visual consistency |
| Frontend developer 2 | `[add name]` | Evaluation workflow UI, notifications, real-time updates, search, translations, file-management UI, accessibility, and backend API integration |
| Backend developer 1 | `[add name]` | Django/DRF structure, database models, evaluation-request APIs, business rules, and transaction safety |
| Backend developer 2 | `[add name]` | Authentication, 42 OAuth, permissions, WebSockets, notifications, files, and related APIs |
| Infrastructure and monitoring | `[add name]` | Docker Compose, Nginx, HTTPS, PostgreSQL/Redis configuration, Prometheus, Grafana, CI, and integration support |

The split does not mean that only one person may understand or modify an area. Important systems should be reviewed or worked on by more than one person. Milestones, GitHub issues, pull requests, and code reviews should help distribute knowledge across the team.

## 12. Proposed MVP boundary

The MVP should prove one complete workflow:

1. A user registers or logs in.
2. An admin assigns the required tutor/student roles.
3. A student creates an evaluation request with availability.
4. Eligible tutors see it live.
5. One tutor claims it safely.
6. Both users receive persistent notifications.
7. Authorized users can manage one resource and one announcement.
8. Permissions prevent unauthorized actions.
9. The application runs through Docker Compose over HTTPS.

Postpone until the core works:

- direct creation of evaluations inside Intra,
- Slack or email integrations unrelated to required modules,
- complex analytics,
- social features and friends,
- 2FA,
- extensive visual polish.