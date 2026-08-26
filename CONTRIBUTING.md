# Contributing to ft_transcendence

This document defines the repository structure and development conventions used by the team. It exists so every teammate works the same way without needing to ask.

**Team:** Diana (dkolarova, Scrum Master), Martin (Aztaban, Product Owner), Roman (webxxcom, IT Architect), Lada (lformank, Developer), Lenka (Lenka1234, Developer).

---

## 1. Repository Structure

Monorepo — one repo, backend and frontend live side by side, deployed together via Docker Compose.

```
ft_transcendence/
├── backend/                # Django 5 + DRF + Channels
│   ├── config/              # Django project settings
│   ├── apps/                 # Django apps (users, evaluations, notifications, sc_inbox, ...)
│   ├── requirements.txt
│   └── manage.py
├── frontend/                # React 18 + TypeScript
│   ├── src/
│   ├── public/
│   └── package.json
├── docs/                    # All planning & reference docs
│   ├── architecture.md
│   ├── api-plan.md
│   ├── database-schema.md
│   ├── decisions.md
│   ├── risks.md
│   └── team-roles.md
├── .github/
│   └── workflows/           # CI pipelines
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── README.md
└── CONTRIBUTING.md          # This file
```

**Rules:**
- Nothing backend-specific lives outside `backend/`; nothing frontend-specific lives outside `frontend/`.
- Planning docs (already in `Planing/`, `team_task_breakdown/`, `Timeline.md` etc.) move into `docs/` as the single source of truth once the repo structure is finalized, so there's one place to look instead of scattered folders.
- Every new Django app gets its own subfolder under `backend/apps/`.

---

## 2. Git Workflow

**Trunk-based development.** `main` is always deployable. No long-lived `develop` branch — with a 5-person team and a 2.5-month timeline, a second long-lived branch just adds merge overhead without buying safety.

- All work happens on short-lived feature branches off `main`.
- Branches should live **days, not weeks** — if a branch is getting stale, either merge behind a checklist item that's still unchecked, or split the work into a smaller PR.
- `main` is protected: no direct pushes, all changes go through a PR.
- Merge via **squash and merge** — keeps `main`'s history to one commit per feature/fix, easy to scan and easy to revert.
- Delete the branch after merge (GitHub can do this automatically — enable "Automatically delete head branches" in repo settings).

---

## 3. Branch Naming

```
<type>/<milestone>-<short-description>
```

**Types:**
| Type | Use for |
|---|---|
| `feature` | New functionality |
| `fix` | Bug fixes |
| `chore` | Tooling, config, dependency bumps |
| `docs` | Documentation only |
| `refactor` | Code change with no behavior change |
| `test` | Adding or fixing tests |

**Examples:**
- `feature/m2-oauth-login`
- `feature/m3-slot-picking`
- `fix/m4-websocket-reconnect`
- `chore/m1-docker-setup`
- `docs/m10-api-docs`

Milestone tag (`m1`–`m10`) keeps branches traceable back to the GitHub milestone/issue they belong to, and makes it obvious at a glance what phase a branch belongs to.

---

## 4. Pull Request Workflow

1. **Open the PR against `main`**, as a draft if the work isn't ready for review yet.
2. **Link the related issue** in the description: `Closes #12` (this auto-closes the issue when the PR merges, keeping the Issues tab accurate without manual bookkeeping).
3. **Keep PRs scoped to one issue** where possible — easier to review, easier to revert if something breaks.
4. **CI must pass** before merge (see `.github/workflows/`) — linting, tests, build.
5. **At least 1 approval required** from a teammate who isn't the author. With a 5-person team, cross-review is realistic without becoming a bottleneck.
6. **Squash and merge**, then delete the branch.

**PR description template** (put this in `.github/pull_request_template.md` once the repo structure exists):
```markdown
## What
Brief description of the change.

## Why
Closes #<issue number>

## How to test
Steps to verify this works.
```

---

## 5. Commit Messages

Not strictly enforced, but prefer:
```
<type>: <short summary>

<optional longer description>
```
e.g. `feature: add 42 OAuth callback endpoint`

---

## 6. Definition of Done (per issue)

An issue is done when:
- [ ] All checklist items in the issue are checked off
- [ ] All acceptance criteria in the issue are met
- [ ] PR is merged into `main`
- [ ] CI passes on `main` after merge
