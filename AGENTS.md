# AGENTS.md

Instructions for AI coding agents working in this repository (Codex, Claude Code, Cursor, Copilot and others). They apply to human contributors as well. Git workflow details are in `CONTRIBUTING.md`.

## The project

42 Prague Evaluations, built for the 42 `ft_transcendence` subject. Students request an evaluation for a project, eligible Hitchhikers (tutors) pick a time slot, and the student confirms it. Around that: notifications, a Student Council inbox, tutor resources and people search.

Stack: Django 5.1 + Django REST Framework + drf-spectacular + Celery (Python 3.12), MySQL 8.4, Redis, React 18 + TypeScript + Vite + react-router 7, Nginx with TLS, Docker Compose.

## Source of truth

Before writing code, read the sections of these documents that your task touches. When they disagree, the higher one wins:

1. `docs/api-plan.md`: endpoints, request and response shapes, error codes, permissions, notifications, WebSocket events.
2. `docs/database-schema.md`: tables, columns, constraints, concurrency rules.
3. The GitHub issue you are working on.
4. Existing code on `main`.

`Info/Preparation/` is early planning material that has been superseded. Never implement from it.

## Hard rules

- **Never invent** a field, endpoint, status value, role name, error code, notification type or WebSocket event. If the contract does not cover what you need, stop and ask. If you cannot ask, leave a `TODO(contract)` comment and say so in the PR description.
- **Match the representations in api-plan §8 exactly.** Every listed field is present (nullable ones as `null`, lists as `[]`). No extra fields, no renamed fields.
- If code on `main` contradicts the docs, do not silently follow either one. Point it out.
- Changing the contract means editing `docs/api-plan.md` or `docs/database-schema.md` in the same PR as the code.
- Stay inside the scope of the issue: no unrelated refactoring, renaming, reformatting or moving of files.
- Never commit `.env`, secrets, credentials or generated folders (`node_modules/`, caches, build output).

## Repository map

```
backend/
  config/settings/   base.py, dev.py, prod.py, test.py
  api/urls.py        every /api/v1/ route, URL namespace "api"
  apps/<app>/        one Django app per domain: models, serializers, views, permissions, tests/
  apps/core/         shared base model (TimeStampedModel) and cross-app helpers
frontend/src/
  api/               client.ts (apiRequest) and one module per backend area
  types/             TypeScript types of API data, mirroring api-plan §8
  pages/  components/  features/<role>/  store/ (React contexts)  styles/  websocket/
docs/                contract and architecture documents
nginx/  docker-compose.yml  Makefile  .env.example
```

## Commands

Start everything: `make up` (needs a `.env`; copy `.env.example`).

Before opening a PR, run what CI runs and make it pass:

| Area | Commands |
| --- | --- |
| Backend lint and format | `cd backend && ruff check . && black --check . && isort --check .` |
| Backend tests | `make test` with the stack running (or `cd backend && pytest` against a reachable MySQL) |
| Frontend | `cd frontend && npm run format && npx tsc --noEmit && npm test` |
| Images | `docker compose build` |

Python is formatted by black and isort, line length 100: fix with `black . && isort .`. The frontend is formatted by Prettier: fix with `npx prettier --write .`.

## Backend rules

- Register routes in `backend/api/urls.py` under the `api` namespace; tests use `reverse("api:<name>")`. Every path ends with `/`.
- Every error response is the envelope `{"error": {"code", "message", "fields"}}` with a code from api-plan §5.6. Never return DRF's `{"detail": ...}` or a bare field dict.
- No session: 401 `not_authenticated`. Logged in but not allowed: 403. Asking for a private object you may not see: 404 (§5.5).
- Enforce permissions on the server with DRF permission classes. Role names are `student`, `tutor`, `head_tutor`, `sc_member` and `admin`; "Hitchhiker" means `tutor` or `head_tutor`.
- Serializers list their fields explicitly; never `fields = "__all__"`. Annotate every `SerializerMethodField` with `@extend_schema_field` so the OpenAPI schema stays exact.
- Change the state of shared rows (evaluation requests, eligibility reviews, council notes) with an atomic conditional update: `filter(pk=..., status=expected).update(...)`, then check the row count. Never read, modify, then `save()` (schema §4.2).
- Create notifications and WebSocket events exactly as listed in api-plan §8.8 and §9.3. Push events with `transaction.on_commit`.
- Wrap user-facing strings in `gettext`; responses are translated into the user's language (§5.5).
- Every model change comes with its migration, created with `python manage.py makemigrations` and committed.
- Limits such as slot lengths, expiry times and upload sizes are settings, not literals scattered through the code.

## Frontend rules

- Call the backend only through `apiRequest` in `frontend/src/api/client.ts`. It sends the CSRF header and `Accept-Language` (§5.4, §5.5). No raw `fetch` in components.
- Types in `frontend/src/types/` match api-plan §8 field for field.
- Enum values arrive in lowercase (`"awaiting_confirmation"`, `"head_tutor"`). Translate them into labels and never display them raw. `tutor` is shown as "Hitchhiker", `sc_member` as "Student Council".
- Decide what to show from the error `code`. Show `fields` messages next to their inputs.
- The active role in the role switcher is UI state only. The backend checks the user's real roles on every request.
- When a WebSocket event arrives, re-fetch the affected data over REST. Never build state from the event payload (§9).
- Send datetimes as UTC ISO 8601 strings; display them in the user's local time.
- All user-facing text goes through the i18n layer (`en`, `cs`, `es`).
- The browser console must stay free of errors and warnings; this is a mandatory subject rule. Call endpoints only when they apply (for example, `GET /users/me/` only after the session check says the user is logged in), and avoid React key warnings and missing assets.

## Tests

- Backend tests live in `backend/apps/<app>/tests/test_*.py` (pytest with pytest-django). Shared fixtures go in `backend/conftest.py`.
- Assert whole response bodies with `==` against literal expected values, so an extra or missing field fails the test. Do not compute the expected values with the code under test.
- Cover the failure cases: 401 when logged out, 403 or 404 for the wrong role or owner, 409 for forbidden state transitions, 400 for each validation rule.
- For every endpoint that changes data, at least one test logs in through a real session with CSRF enforced (`APIClient(enforce_csrf_checks=True)`), not only `force_authenticate`.
- Frontend tests are `*.test.ts` or `*.test.tsx` files next to the code they test (Vitest and Testing Library).

## Git and pull requests

Follow `CONTRIBUTING.md`. The essentials:

- Branch from an up-to-date `main` (or from the branch below you in a stack). Branch name: `issue-<parent>/<sub-issue>-<short-description>`.
- Commit messages: `<type>: <short summary>`, with `feat`, `fix`, `refactor`, `docs`, `test` or `chore`.
- One issue per branch and per PR. Put `Closes #<issue>` in the description.
- In the PR description, cite the api-plan and schema sections you implemented, and say which code and tests an AI agent wrote. The project README must describe how AI was used and for which parts, and every team member must be able to explain all submitted code.
- `main` is protected: changes reach it only through a reviewed, squash-merged PR. Never force-push a branch someone else works on.

## Keeping this file current

When a convention changes, update this file in the same PR. Maintainer: the IT Architect (rkravche).
