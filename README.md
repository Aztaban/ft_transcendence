# ft_transcendence

## Getting started (dev environment)

Requires Docker and Docker Compose.

```bash
cp .env.example .env   # fill in real dev values
make up                 # docker compose up --build
```

This starts four services:

| Service  | URL                                            | Notes |
|----------|-------------------------------------------------|-------|
| frontend | http://localhost:5173                           | Vite dev server, live reload |
| backend  | http://localhost:8000                           | Django dev server, live reload |
| db       | internal only (`db:3306`)                       | MySQL 8.4 |
| redis    | internal only (`redis:6379`)                    | |

Check `http://localhost:8000/health/` — it verifies both the MySQL and Redis
connections and returns `{"status": "ok", "db": "ok", "redis": "ok"}` once
everything is wired up correctly. The frontend's landing page calls this
same endpoint on load.

Other commands: `make down`, `make build`, `make logs`.

This is a minimal bootstrap of `backend/` and `frontend/` — just enough to
prove the Docker wiring works end to end. The real Django app structure and
React app structure land separately as the corresponding milestone issues
are completed.
