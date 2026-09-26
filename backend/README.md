# Backend (Django 5 + DRF + Celery)

The backend now uses the standard Django project entrypoints instead of the old
`app.py` bootstrap.

## Local development

```bash
python -m pip install -r requirements-dev.txt
python manage.py check
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Run Celery in separate processes:

```bash
celery -A config worker -l info
celery -A config beat -l info
```

## Settings

Development defaults to `config.settings.dev`. Production should set:

```bash
DJANGO_SETTINGS_MODULE=config.settings.prod
DJANGO_SECRET_KEY=...
DJANGO_ALLOWED_HOSTS=example.com,api.example.com
```

Database configuration uses `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`,
`MYSQL_HOST`, and `MYSQL_PORT`.

Redis/Celery use `REDIS_URL` by default. `CELERY_BROKER_URL` and
`CELERY_RESULT_BACKEND` can override it independently.

## Endpoints

- `GET /health/` — MySQL, Redis, and Celery heartbeat status
- `GET /api/schema/` — OpenAPI schema
- `GET /api/docs/` — Swagger UI
- `GET /api/v1/users/me/` — own profile (includes email, status, roles, eligibility)
- `GET /api/v1/users/{id}/` — community profile (no email / intra_login / status)
- `GET /api/v1/tutors/{id}/eligibility/` — approved projects for a tutor
