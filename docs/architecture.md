# Architecture

**Status:** Draft for team review
**Owner:** rkravche, IT Architect
**Last updated:** October 23, 2026

---

## 1. Purpose

This document defines the technical architecture of 42 Prague Evaluations. The API contract is `docs/api-plan.md` and the tables are `docs/database-schema.md`; where this document disagrees with them, they win.

---

## 2. Technology stack

| Layer | Technology | Why |
| --- | --- | --- |
| Frontend | React 18 + TypeScript, Vite | |
| Styling | Plain CSS (`frontend/src/styles/`) | |
| Backend | Django 5 + Django REST Framework (DRF) + Django Channels | ORM, salted+hashed password auth, permission framework, i18n, admin panel. |
| Real-time | Django Channels | Real-time features major module. |
| Database | MySQL 8.4 (LTS), InnoDB | IT lead knows it better than anything else |
| ORM | Django ORM | Satisfies the ORM minor module with a technology built into the chosen framework. |
| Cache | Redis | |
| Background jobs | Celery | A common choice for Python |
| Reverse proxy | Nginx | |
| Deployment | Docker Compose | |

---

## 3. Repository structure (monorepo)

```txt
/frontend        React + TS app (Vite)
/backend         Django project
  /apps/accounts       users, roles, auth, 42 OAuth
  /apps/evaluations    projects, tutor eligibility, evaluation requests and their lifecycle
  /apps/council        Student Council inbox
  /apps/core           shared base model, error envelope, WebSocket consumer, helpers
/nginx           reverse proxy with TLS
/docs            this documentation
docker-compose.yml
Makefile         make up = the single deployment command
.env.example
```

Notifications and files get their own apps when they are built. `AGENTS.md` keeps the detailed map.

---

## 4. Architecture diagram

The request flow is drawn in api-plan §2.

---

## 5. Authentication

1. **Email + password (mandatory baseline).** Django's auth with Argon2 hasher (salted, memory-hard).
2. **42 OAuth 2.0 (minor module).** Authorization-code flow against the 42 Intra API. Returning 42 users are recognized by their `intra_id`; a new 42 user gets a new account, and an existing email/password account is never linked automatically by email (api-plan §10.1).

---

## 6. Authorization

- Roles (Student, Tutor, Head Tutor, SC Member, Administrator) are rows in a `roles` table with a `user_roles` join.
- We do not simply hide buttons as it was stated but enforce the proper filtering on database level.

---

## 7. Environments and configuration

- All secrets and environment-specific values via environment variables; `.env` is git-ignored, `.env.example` committed (subject requirement).
- Self-signed TLS certificate generated at first `make up` for evaluation.
