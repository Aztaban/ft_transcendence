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

**Two-tier branching, matching GitHub sub-issues.** Since checklists are now real linked sub-issues, branches mirror that hierarchy: one branch per **parent issue** ("big issue"), and one branch per **sub-issue** underneath it. This gives two levels of review instead of one.

```
main
 └─ issue-14/repo-structure-workflow          <- big issue branch (parent #14)
     ├─ issue-14/101-define-repo-structure    <- sub-issue branch
     ├─ issue-14/102-create-backend-dir       <- sub-issue branch
     └─ issue-14/103-define-git-workflow      <- sub-issue branch
```

**Two levels of review:**

| Level | Branch | PR target | Reviewed by |
|---|---|---|---|
| 1 — peer review | sub-issue branch | the parent big-issue branch | your dev **buddy** (see pairs below) |
| 2 — architecture review | big issue branch | `main` | Roman (IT Architect) |

**Buddy pairs for level-1 review:**
- Martin ↔ Lenka (backend)
- Diana ↔ Lada (frontend)
- Roman's own big-issue PRs into `main` are reviewed by someone else on the team (rotate, or default to Martin) — he can't be both author and architecture-reviewer of his own work.

**Why two levels:** small sub-issue PRs get fast peer feedback without waiting on Roman for every commit. Roman then reviews the *integrated* big-issue branch once, checking the feature as a whole against architecture decisions — not 5-10 tiny diffs one at a time.

**Rules:**
- `main` is always deployable. No direct pushes — everything comes through a big-issue branch PR.
- A big-issue branch stays open until every one of its sub-issue branches has merged into it.
- Once a big-issue branch's PR into `main` is approved by Roman (or by the designated reviewer, if Roman is the author), squash-merge into `main` and close the parent issue.
- Delete branches after merge (both levels).

---

## 3. Branch Naming

```
issue-<parent-number>/<short-description>            <- big issue branch
issue-<parent-number>/<sub-issue-number>-<short-description>   <- sub-issue branch
```

**Examples (using #14 "Create Repository Structure & Development Workflow"):**
- Big issue branch: `issue-14/repo-structure-workflow`
- Sub-issue branches off it: `issue-14/101-define-repo-structure`, `issue-14/102-create-backend-dir`, `issue-14/103-create-frontend-dir`

The parent issue number ties every sub-branch back to its big-issue branch and GitHub issue at a glance, without needing a separate `type/` prefix — the GitHub issue itself already carries the type (label) and milestone.

---

## 4. Pull Request Workflow

**Sub-issue PR (level 1):**
1. Branch off the big-issue branch: `issue-14/101-define-repo-structure`.
2. Open the PR **against the big-issue branch**, not `main`. Link the sub-issue: `Closes #101`.
3. Your buddy reviews and approves.
4. Squash-merge into the big-issue branch, delete the sub-issue branch.

**Big-issue PR (level 2):**
1. Once all its sub-issues are merged into the big-issue branch, open a PR from the big-issue branch **into `main`**. Link the parent: `Closes #14`.
2. Roman reviews against architecture decisions (or the designated reviewer, if Roman authored it).
3. CI must pass.
4. Squash-merge into `main`, delete the big-issue branch. This closes the parent issue and, via GitHub's sub-issue tracking, reflects that all its sub-issues are done too.

**PR description template** (put this in `.github/pull_request_template.md`):
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