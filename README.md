*This project has been created as part of the 42 curriculum by mjusta, rkravche, dkolarov, lhusraov, lformankov.*

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

<!-- ✍️ Diana (#375). Subject: a clear presentation of the project, its goal and a brief overview; a clear name for the project and its key features. -->

### Key features

<!-- ✍️ Diana (#375). -->

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

<!-- ✍️ Diana (#375); each member checks their own row. Subject: for each member, the assigned role(s) (PO, PM, Tech Lead, Developers…) and a brief description of their responsibilities. -->

## Project Management

<!-- ✍️ Diana (#375). Subject: how the team organised the work (task distribution, meetings…), the tools used for project management, the communication channels used. -->

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

### Lenka (lhusraov)

### Lada (lformankov)

## Resources

### References

<!-- ✍️ EVERYONE adds the documentation, articles and tutorials they used. -->

### How AI was used

<!-- ✍️ EVERYONE writes their own lines. Subject: how AI was used, for which tasks and which parts of the project. -->

## Known limitations

<!-- Optional (the subject welcomes it). Anyone can add here. -->
