# Work Order — Who Starts, Who Follows

**Project:** ft_transcendence

This document sits on top of the per-person folders (`dkolarov/`, `lhusarov/`, `mjusta/`, `lformankov/`, `rkravche/`). Those show each person's own tasks in build order; this shows how the five tracks **interleave** who has to finish (or at least stabilize) something before someone else can start theirs.

## The general rule

Almost every shared issue in this project follows the same handoff order:

```
Roman (infra/database)  →  Martin & Lenka (backend/API)  →  Diana (frontend UI)  →  Lada (integration)
```

- **Roman** goes first because his layer (Docker, DB, Nginx, Redis/WebSocket infra) is what everyone else's work runs on top of.
- **Martin & Lenka** go next because the UI and integration need something real to build against, ideally the *API contract* from `api-plan.md`, not the finished implementation, so this doesn't have to be a hard wait.
- **Diana** can start UI work as soon as an endpoint's shape is agreed, even before Martin/Lenka finish implementing it — she doesn't need to wait for the backend to be "done," just settled.
- **Lada** is naturally last on any given feature, since integration means wiring a real UI to a real endpoint — both need to exist first.

---

## Milestone-by-milestone order

### M1 — Foundation & Infrastructure
```
Diana (repo structure & Git workflow)   ┐
                                         ├──▶  Roman (Docker, DB, Nginx, Redis, Celery)
                                         ┘            │
                                                       ▼
                                    Martin & Lenka (backend init)   Diana & Lada (frontend init)
                                                       │                       │
                                                       └───────────┬───────────┘
                                                                   ▼
                                                     Roman (CI / dev tools)
```
Diana and Roman kick off in parallel on day one, Diana's conventions don't block anyone, but Roman's Docker environment blocks everyone. Backend and frontend init can then run in parallel once Docker exists. CI/dev tooling trails slightly so there's something real to lint and test.

### M2 — Authentication & User Management
1. **Roman** — user DB model & migration
2. **Martin & Lenka** — registration, login/session, 42 OAuth, role system, permission middleware
3. **Diana** — registration/login/profile UI, avatar UI, role-based nav (starts once the relevant endpoint shapes are agreed, in parallel with #2 where possible)
4. **Lada** — wires the M2 forms/pages to the API (needs #2 and #3 far enough along)

### M3 — Core Evaluation System (the critical path)
Martin & Lenka's backend chain here is strictly sequential each piece depends on the state machine before it:
```
Martin & Lenka:  Project Mgmt → Eligibility Request → Evaluation Request → Slot Picking → Confirmation → Cancellation
```
Diana follows **feature by feature** rather than waiting for the whole milestone, she can start the project list UI as soon as that endpoint is settled, without waiting for slot picking to be built. Lada integrates each feature once its UI and backend are both ready. This milestone is the longest dependency chain in the project delays here push M4–M6 and the demo.

### M4 — Real-Time System
1. **Roman** — WebSocket infra (Nginx WS proxy + Redis channel layer) — hard blocker, must exist first
2. **Martin & Lenka** — Django Channels backend + evaluation events
3. **Lada** — frontend WebSocket client
4. **Diana** — real time UI updates (last needs Lada's client to hook into)

### M5 — Communication & Notifications
1. **Martin & Lenka** — notification system + Student Council messaging backend
2. **Lada** — real-time notification integration (needs M4's WebSocket client)
3. **Diana** — Student Council inbox UI

### M6 — Search & Discovery
1. **Martin & Lenka** — people search API
2. **Diana** — search interface + profile view UI
3. **Lada** — integration

### M7 — Accessibility & Internationalization
Mostly independent of M3–M6, so it can run **in parallel** with them rather than strictly after:
1. **Lada** — i18n framework setup
2. **Diana** — translations + accessibility pass (needs the rest of the UI to exist to translate/audit it, so in practice this trails the screens it covers)

### M8 — Security & Administration
1. **Martin & Lenka** — permission system, admin permissions, API hardening, audit logging (backend)
2. **Roman** — secrets management, audit log storage infra (parallel with #1)
3. **Diana** — admin UI, frontend route protection (last needs the permission rules to enforce)

### M9 — Testing & Deployment
1. **Martin & Lenka** — backend test suite
2. **Diana & Lada** — frontend test suite (parallel with #1)
3. **Roman** — production deployment (last needs a tested build)

### M10 — Final Polish & Demo
1. **Diana & Lada** — final UX polish
2. **Whole team** — documentation, each person writing their own module's section
3. **Whole team, coordinated by Diana** — demo prep (last, needs everything else done)

---

## At a glance

| Milestone | Starts with | Then | Then | Finishes with |
|---|---|---|---|---|
| M1 | Diana + Roman (parallel) | Roman | Martin/Lenka + Diana/Lada (parallel) | Roman |
| M2 | Roman | Martin & Lenka | Diana | Lada |
| M3 | Martin & Lenka | Martin & Lenka (chain) | Diana (per feature) | Lada (per feature) |
| M4 | Roman | Martin & Lenka | Lada | Diana |
| M5 | Martin & Lenka | Lada | Diana | — |
| M6 | Martin & Lenka | Diana | Lada | — |
| M7 | Lada | Diana | — | — |
| M8 | Martin & Lenka + Roman (parallel) | Martin & Lenka + Roman | Diana | — |
| M9 | Martin & Lenka + Diana/Lada (parallel) | — | Roman | — |
| M10 | Diana & Lada | Whole team (docs) | Whole team (demo) | — |

## Where the risk sits

- **Roman's M1 and M4 infra work are hard blockers** — nothing else in those milestones can start without them, so they should never slip.
- **Martin & Lenka's M3 backend chain is the critical path for the whole MVP** — it's the longest sequential dependency in the project, and M4–M6 all build on evaluation requests existing.
- Everything else (Diana's UI, Lada's integration) can shift earlier by working off the agreed `api-plan.md` contract instead of waiting for finished endpoints — worth doing deliberately, since it's the main lever the team has to compress the schedule.