# Architecture

Status: placeholder / waiting for team decision  
Owner: TBD  
Last updated: TBD

## Purpose

This document will describe the final technical architecture.

For now, it contains a proposed direction and questions to decide as a team.

## Proposed stack draft

| Layer | Proposed technology | Status |
|---|---|---|
| Frontend | React + TypeScript | Proposed |
| Styling | TBD: Tailwind / MUI / CSS modules | Waiting |
| Backend | Python: Django REST Framework or FastAPI | Waiting |
| Database | PostgreSQL | Proposed |
| Cache / realtime support | Redis | Proposed |
| Reverse proxy / HTTPS | Nginx | Proposed |
| Containers | Docker Compose | Proposed |
| Monitoring | Prometheus + Grafana | Bonus target |
| Auth | Email/password + 42 OAuth | Needs confirmation |
| Real-time | WebSockets or Server-Sent Events | Waiting |

## High-level architecture mockup

```txt
                        ┌────────────────────────┐
                        │        Browser          │
                        │ React + TypeScript FE   │
                        └───────────┬────────────┘
                                    │ HTTPS
                                    ▼
                        ┌────────────────────────┐
                        │         Nginx           │
                        │ reverse proxy + TLS     │
                        └───────────┬────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
┌────────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│      Frontend app       │ │     Python backend   │ │     Grafana          │
│ static build / Vite     │ │ REST API + realtime  │ │ monitoring UI        │
└────────────────────────┘ └──────────┬───────────┘ └──────────┬───────────┘
                                      │                         │
                     ┌────────────────┼───────────────┐         │
                     ▼                ▼               ▼         ▼
          ┌──────────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
          │   PostgreSQL      │ │    Redis    │ │  42 API     │ │ Prometheus  │
          │ relational DB     │ │ cache/pubsub│ │ OAuth/data  │ │ metrics     │
          └──────────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

## Frontend responsibilities

- Public pages
- Login flow
- Dashboards by role
- Evaluation slot UI
- Admin/head tutor management UI
- Notifications UI
- Form validation before API calls
- Responsive layout
- Chrome compatibility

## Backend responsibilities

- Auth/session handling
- 42 OAuth integration
- Business logic
- Permission checks
- Database access
- Evaluation slot race-condition safety
- File upload validation
- Notification creation
- Metrics endpoint for Prometheus
- External API communication with 42

## Database responsibilities

- Users
- Roles
- Profiles
- Organizations
- Projects
- Project resources
- Evaluation slots
- Notifications
- Suggestions
- Announcements
- Audit/system events if needed

## Open decisions

- Django REST Framework or FastAPI?
- WebSockets or Server-Sent Events?
- Tailwind, MUI, or another styling solution?
- JWT or server-side sessions?
- Store 42 OAuth tokens or only use them during login/sync?
- How much 42 API data can we legally/practically store?
- Is email/password auth required in addition to 42 OAuth?
