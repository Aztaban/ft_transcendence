# ft_transcendence

## Getting started (dev environment)

Requires Docker and Docker Compose.

```bash
make env   # creates .env from .env.example with a random DJANGO_SECRET_KEY and MySQL passwords
make up    # docker compose up --build (runs `make env` first if .env is missing)
```

The backend refuses to start with an empty `DJANGO_SECRET_KEY` or the example
value `change-me-in-dev`. If your `.env` predates this, replace the key with
`openssl rand -hex 32`.

This starts seven services:

| Service  | URL                                            | Notes |
|----------|-------------------------------------------------|-------|
| frontend | http://localhost:5173                           | Vite dev server, live reload |
| backend  | http://localhost:8000                           | Django dev server, live reload |
| nginx    | https://localhost                               | TLS reverse proxy; use this one |
| db       | 127.0.0.1:3306 (this machine only)              | MySQL 8.4 |
| redis    | internal only (`redis:6379`)                    | |
| celery_worker, celery_beat | internal only                 | Background jobs |

Check `http://localhost:8000/health/` — it verifies both the MySQL and Redis
connections and returns `{"status": "ok", "db": "ok", "redis": "ok"}` once
everything is wired up correctly. The frontend's landing page calls this
same endpoint on load.

Nginx fronts everything on `https://localhost` (self-signed cert, auto-generated on first run — browser will warn, that's expected in dev). Port 80 redirects to 443. Direct ports 8000/5173 stay open on this machine only (127.0.0.1) for quick debugging, but use `https://localhost` to log in: the session and CSRF cookies are `Secure`, so browsers drop them over plain HTTP.

Other commands: `make down`, `make build`, `make logs`.

## Backend ASGI server

The backend image starts Daphne on port 8000 with `config.asgi:application`.
Development Compose overrides that command with Daphne's Django `runserver`,
which retains auto-reload. The Channels Redis layer shares `REDIS_URL` with
Celery; Redis holds transient messages, while application state stays in MySQL.
Rebuild the backend image after dependency changes: `docker compose build backend`.

## Production profile

```bash
make prod        # docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
make prod-down
```

`docker-compose.prod.yml` layers on the dev file and needs Docker Compose 2.24
or newer. Compared with `make up`:

- Django runs with `config.settings.prod` (DEBUG off) under Daphne, without
  auto-reload. The code comes from the images, not from bind mounts.
- The backend applies migrations and runs `collectstatic` on every start;
  Celery and nginx wait until it is healthy.
- The `frontend` container builds the bundle once and exits. nginx serves it
  and Django's static files from `https://localhost`; there is no Vite server.

`scripts/smoke-test.sh` checks a running stack (`scripts/smoke-test.sh prod`
for this profile); CI runs it against both.
