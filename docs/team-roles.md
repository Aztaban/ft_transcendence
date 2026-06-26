# Team Roles

Status: draft  
Owner: TBD  
Last updated: TBD

## Purpose

This document defines team roles required by the subject and how the team plans to organize work.

Names should be filled after the team agrees.

## Required roles

### Product Owner

Assigned to: TBD

Responsibilities:

- Own product vision
- Prioritize features
- Keep MVP realistic
- Collect feedback from tutors/counsellors/students
- Validate that completed work matches project goals
- Keep module plan aligned with project scope

### Project Manager / Scrum Master

Assigned to: TBD

Responsibilities:

- Organize meetings
- Track blockers
- Keep GitHub Issues / project board clean
- Help split work into small tasks
- Watch deadlines
- Make sure all members contribute

### Technical Lead / Architect

Assigned to: TBD

Responsibilities:

- Own architecture decisions
- Lead stack decisions
- Keep code structure consistent
- Review critical pull requests
- Define API/database patterns
- Watch security and deployment quality

### Developers

Assigned to: all team members

Responsibilities:

- Implement assigned features
- Write tests
- Review code
- Document important decisions
- Understand the full project enough to explain it during evaluation

## Possible technical ownership areas

These are not final roles yet. One person may own multiple areas.

| Area | Owner | Notes |
|---|---|---|
| Frontend / React | TBD | Pages, components, UI state, accessibility basics. |
| Backend / Python API | TBD | REST API, business logic, validation. |
| Database / ORM | TBD | Models, migrations, relations, constraints. |
| Auth / 42 OAuth | TBD | Login, sessions, permissions, token safety. |
| Real-time / notifications | TBD | WebSockets/SSE, online status, alerts. |
| Evaluation system | TBD | Slot creation, claiming, race-condition handling. |
| DevOps / Docker / HTTPS | TBD | Compose, reverse proxy, environment setup. |
| Monitoring / Grafana | TBD | Prometheus metrics, dashboards, alerts. |
| Docs / Evaluation prep | TBD | README, diagrams, demo script, module proof. |

## Team rules draft

- All meaningful work should be done through branches and pull requests.
- Important pull requests should be reviewed by at least one teammate.
- No secrets in Git.
- `.env.example` must be kept up to date.
- Everyone should be able to run the project locally.
- Everyone must understand the mandatory part, not only their own feature.
