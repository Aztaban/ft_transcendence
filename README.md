*This project has been created as part of the 42 curriculum by mjusta, rkravche, dkolarov, lhusarov, lformankov.*

<!--
HOW TO FILL THIS README (issue #375, plan in its first comment)
- Write ONLY in the sections marked with your name. Replace the TODO comment with your text.
- Edit on GitHub: this branch (issue-58/375-readme) → README.md → ✏️, or locally, then commit:
  docs: <your section> in the README (#375)
- Deadline: 18.11 at 16:00 (our meeting and pre-evaluation). Written in English, honest, and every one of us must be able to explain it.
- The subject's requirements for each section are quoted in its TODO.
-->

# 42 Prague Evaluations

## Description

**42 Prague Evaluations** is a web application for the 42 Prague campus that organises the evaluations students get from **Hitchhikers**, the campus tutors. A student asks for an evaluation of a project, an eligible Hitchhiker proposes a time slot, and the student confirms it. Around this workflow the application keeps everyone informed in real time, lets students write anonymously to the **Student Council**, and gives Head Tutors and Administrators the tools to manage who may evaluate what.

Students stay anonymous to Hitchhikers until a Hitchhiker picks their request, and the Hitchhiker stays anonymous to the student until the slot is confirmed, so nobody chooses an evaluator, or a student, by name.

### Key features

- **Evaluation requests:** a student requests an evaluation for one of the campus projects; an eligible Hitchhiker picks it and proposes a slot (15-minute steps, 15–120 minutes, 30 minutes to 14 days ahead); the student accepts or declines; either side can cancel before it starts. Requests nobody picks expire automatically.
- **Eligibility:** a Hitchhiker asks to evaluate a set of projects, and Head Tutors approve or decline the request.
- **Real-time updates and notifications:** a notification center and live updates over WebSockets for every step of a request, role changes and council messages, so pages refresh without reloading.
- **Student Council inbox:** students and Hitchhikers send anonymous messages; council members read them, mark them read or unread and share a discussion note; Administrators can reveal a sender or delete abusive content, with a reason that goes to the audit log.
- **People search:** find Hitchhikers and Student Council members by name, role and project, from the top bar or the Hitchhikers page, and open their public profiles.
- **Roles and workspaces:** Student, Hitchhiker, Head Tutor, Student Council and Administrator, each with its own workspace; the server checks the permissions on every request.
- **Administration:** user accounts (suspend, reactivate, delete), evaluation exceptions and an audit log of sensitive actions.
- **Accounts:** sign in with the 42 intranet (OAuth) or with email and password; a profile with display name and language.
- **Accessibility and languages:** WCAG 2.1 AA (keyboard, screen readers, contrast, reduced motion), English, Czech and Spanish, and support for Chrome, Firefox and Edge.

## Instructions

<!-- ✍️ Martin (#378, #379, #381). Subject: all prerequisites (software, tools, versions, configuration such as the .env setup) and step-by-step instructions to run the project. The text below is the current README, as a starting point: rewrite, complete or keep it. -->

### Prerequisites

<!-- ✍️ Martin -->

### Environment variables

<!-- ✍️ Martin (#379): how to create .env, what each variable is for, which ones are secrets, the 42 OAuth credentials. -->

### Running the project

```bash
make env   # creates .env from .env.example with a random DJANGO_SECRET_KEY and MySQL passwords
make up    # docker compose up --build (runs `make env` first if .env is missing)
```

The backend refuses to start with an empty `DJANGO_SECRET_KEY` or the example value `change-me-in-dev`. If your `.env` predates this, replace the key with `openssl rand -hex 32`.

This starts seven services:

| Service  | URL                                  | Notes |
|----------|--------------------------------------|-------|
| frontend | http://localhost:5173                | Vite dev server, live reload |
| backend  | http://localhost:8000                | Django dev server, live reload |
| nginx    | https://localhost                    | TLS reverse proxy; use this one |
| db       | 127.0.0.1:3306 (this machine only)   | MySQL 8.4 |
| redis    | internal only (`redis:6379`)         | |
| celery_worker, celery_beat | internal only      | Background jobs |

Check `http://localhost:8000/health/`: it verifies the MySQL and Redis connections. Nginx serves everything on `https://localhost` (self-signed certificate, generated on the first run; the browser warns once). Other commands: `make down`, `make build`, `make logs`.

### Production profile

```bash
make prod        # docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
make prod-down
```

`docker-compose.prod.yml` layers on the dev file and needs Docker Compose 2.24 or newer. Django runs with `config.settings.prod` (DEBUG off) under Daphne; the backend applies migrations and runs `collectstatic` on every start; nginx serves the built frontend. `scripts/smoke-test.sh` checks a running stack (`scripts/smoke-test.sh prod` for this profile); CI runs it against both.

### Recording evaluation results

<!-- ✍️ Martin (#381): how the team enters the result, the feedback and completed_at in the Django admin, step by step. -->

## Team Information

<!-- Each member: check your own row and add a line if your responsibilities differ. -->

| Member | 42 login | GitHub | Role |
|---|---|---|---|
| Martin | mjusta | @Aztaban | Product Owner, developer |
| Roman | rkravche | @webxxcom | IT Architect, developer |
| Diana | dkolarov | @dkolarova | Scrum Master, developer |
| Lenka | lhusarov | @Lenka1234 | Developer |
| Lada | lformankov | @lformank | Developer |

- **Product Owner (Martin):** the product vision and priorities, the MVP scope, the user workflows and their acceptance criteria, and the product justification of each module.
- **IT Architect (Roman):** the system architecture and technology choices, the data model, the API contract, authentication and authorization, the real-time design and security.
- **Scrum Master (Diana):** the delivery process: the milestones, organising the issues, the meetings, tracking blockers and risks, and keeping the team up to date on the progress.
- **Developers (all of us):** implementation, tests, code review and technical documentation, following the product and architecture decisions we agreed on.

## Project Management

**Organising the work.** We split the project into ten milestones, from the foundation to the final polish:

| Milestone | Scope |
|---|---|
| M1 | Project foundation and infrastructure |
| M2 | Authentication and user management |
| M3 | Core evaluation system |
| M4 | Real-time system |
| M5 | Communication and notifications |
| M6 | Search and discovery |
| M7 | Accessibility and internationalization |
| M8 | Security and administration |
| M9 | Testing and deployment |
| M10 | Final polish and demo |

Each milestone holds parent issues, broken down into small sub-issues with one owner each. Every sub-issue is built on its own branch (`issue-<parent>/<sub-issue>-<description>`) and reaches `main` through a pull request that at least one other member reviews; `main` is protected and only receives reviewed, squash merged pull requests. Over the project we closed more than 460 issues and merged more than 300 pull requests.

**The contract first.** Before a feature was built, its API (`docs/api-plan.md`) and its tables (`docs/database-schema.md`) were agreed and written down, so the frontend and the backend could be built in parallel against the same contract. Decisions are recorded in `docs/decisions.md`, risks in `docs/risks.md`, and the rules every contributor follows in `CONTRIBUTING.md` and `AGENTS.md`.

**Quality checks.** GitHub Actions runs on every pull request: the backend's lint, formatting and tests; the frontend's formatting, type checking and tests; and a Docker build with an end-to-end smoke test through nginx, for both the development and the production setup.

**Meetings.** We met about once a week: at school at the beginning, then online. In the meetings we planned the next milestone and split its issues, went through the progress and the open pull requests, solved blockers and made the decisions that needed the whole team.

**Tools and communication.**
- **GitHub:** issues and sub-issues, milestones, labels, pull requests and reviews, and GitHub Actions for CI.
- **Figma:** the design of the pages before they were built.
- **Slack:** day-to-day communication, questions and review requests.
- **Google Meet:** our online meetings.

## Technical Stack

<!-- ✍️ Roman (#376, #377). Subject: the frontend technologies and frameworks, the backend technologies and frameworks, the database system and why it was chosen, other significant technologies or libraries, and the justification of the major technical choices. -->

### Architecture

<!-- ✍️ Roman (#376): an overview, ideally with a diagram (docs/architecture.md). -->

### API

<!-- ✍️ Roman (#377): where the API is documented (docs/api-plan.md, the OpenAPI schema) and how to read it. -->

## Database Schema

<!-- ✍️ Lenka. Subject: a visual representation or description of the database structure, the tables/collections and their relationships, and the key fields and data types (docs/database-schema.md). A Mermaid erDiagram renders on GitHub. -->

## Features List

<!-- ✍️ Lada (#380). Subject: the complete list of implemented features, which member(s) worked on each, and a brief description of each feature's functionality. -->

### Development workflow

<!-- ✍️ Lada (#380): branches, pull requests and reviews, CI, how to run the tests. -->

## Modules

<!-- ✍️ Martin writes the justifications; EVERY module's owner adds 3–5 lines on how it was implemented. Subject: all chosen modules (Major and Minor), the point calculation (Major = 2 pts, Minor = 1 pt), the justification of each choice (especially the custom "Modules of choice"), how each module was implemented, and which member(s) worked on it. -->

## Individual Contributions

<!-- ✍️ EVERYONE writes their own subsection. Subject: a detailed breakdown of what each member contributed, the specific features, modules or components each implemented, and any challenges faced and how they were overcome. -->

### Martin (mjusta)

### Roman (rkravche)

### Diana (dkolarov)

Scrum Master and frontend developer. I set up the frontend and built most of its pages, from the first login form to the final polish (119 merged pull requests).

- **Frontend foundation:** the React + TypeScript + Vite project, routing, the base layout (sidebar, top bar, footer), the API client with the CSRF token, the role-based workspaces and the frontend permission checks, the Unauthorized and 404 pages.
- **Accounts:** registration and login (email and password, 42 OAuth), logout, the session check, the Profile page with editing and settings, and the public profile pages.
- **Evaluation workflow:** the Create Request flow, the student's requests and cancelling them, the Hitchhiker Requests page and slot picking, confirming or declining a proposed slot, the Pending page with preview and cancel, the History with filters and pagination, the evaluation and project detail pages.
- **Dashboards:** the Student and Hitchhiker Home pages with real data, and later the Home redesign with the pixel-art banner; the Profile banner with its own pixel scene.
- **Real time (module):** the WebSocket client with automatic reconnect, the "Reconnecting…" indicator and live refresh of the dashboards, lists and evaluation pages.
- **Eligibility:** the Hitchhiker's eligibility request with the welcome popup, the Head Tutor's review table and the eligibility request detail page.
- **Student Council:** sending an anonymous message, the council inbox, and the Admin's moderation (delete a message, reveal its sender).
- **Search (module):** the Hitchhikers people search page and the top-bar search.
- **Multiple languages (module):** i18next with English, Czech and Spanish, and the translation of every page.
- **Accessibility (module):** WCAG 2.1 AA: focus handling in popups, the skip link and keyboard support for the menus, page titles and headings, landmarks, text contrast; the automated axe-core scans of every page and every popup, and the accessibility report (`docs/accessibility.md`).
- **Design system (module):** the design tokens (palette, typography, icons), the shared components (Dialog, Notice, Avatar, StatusPill, Skeleton, EmptyState, Tabs, TextArea, ProgressBar) and the design system page.
- **Additional browsers (module):** the code audit, the fixes, and the test of the whole checklist in Firefox and Edge (`docs/browser-support.md`).
- **Administration:** the audit log page; responsive layout on phones and tablets, consistent headings and back navigation.
- **Process:** the milestones and issue structure, the repository's contribution workflow (`CONTRIBUTING.md`, CODEOWNERS), the weekly meetings and the team updates.

**Challenges and how I solved them.**
- *A clean browser console.* The subject allows no errors or warnings in the console. Some pages asked the API for things the user could no longer see and logged a 404, and some tests hid warnings. I changed the pages to call the API only when it applies, and the frontend tests now fail on any console error or warning.
- *Live updates without stale screens.* Building state from WebSocket messages risked showing outdated data, so every event only triggers a fresh request over REST, and the client reconnects on its own and shows when it is offline.
- *Big changes across many pull requests.* Translations and the design system touched almost every page. I split them into a stack of small pull requests, one per area, so they could be reviewed one at a time, and rebuilt the branches on `main` whenever a squash merge left them in conflict.
- *Accessibility I could not see myself.* Contrast, focus and screen-reader problems are easy to miss, so I combined automated scans (axe-core in the tests) with manual checks using only the keyboard and the Orca screen reader, and fixed what they found.

### Lenka (lhusarov)

### Lada (lformankov)

## Resources

### References

<!-- ✍️ EVERYONE adds the documentation, articles and tutorials they used. -->

### How AI was used

<!-- ✍️ EVERYONE writes their own lines. Subject: how AI was used, for which tasks and which parts of the project. -->

- **Diana:** I used Claude (Anthropic), through Claude Code in VS Code, as a coding assistant for my frontend work. From the issue and the API contract it drafted code, tests and pull request descriptions; it helped me review teammates' pull requests, find bugs, and run the accessibility and browser checks (axe-core scans, headless browser runs in Firefox and Edge).
## Known limitations

<!-- Optional (the subject welcomes it). Anyone can add here. -->
