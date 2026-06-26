# Monitoring Plan

Status: placeholder / bonus module target  
Owner: TBD  
Last updated: TBD

## Goal

Implement Prometheus + Grafana monitoring as a DevOps bonus module.

The monitoring system should be useful during development and demonstrable during evaluation.

## Services to monitor

```txt
backend
frontend/nginx
postgres
redis
docker containers
```

Optional:

```txt
42 API integration
WebSocket connections
background workers
```

## Proposed monitoring architecture

```txt
Backend /metrics ──────┐
Postgres exporter ─────┤
Redis exporter ────────┤
Node/container exporter ┤
                       ▼
                  Prometheus
                       │
                       ▼
                    Grafana
                       │
                       ▼
              Dashboards + alerts
```

## Backend metrics draft

### HTTP metrics

- total requests
- requests by method/path/status
- request duration
- 4xx errors
- 5xx errors

### Auth metrics

- successful logins
- failed logins
- 42 OAuth failures
- permission denied count

### Evaluation system metrics

- open evaluation slots
- claimed evaluation slots
- cancelled evaluation slots
- created slots per day
- claim attempts
- failed claim attempts due to race/slot already claimed
- average time from slot creation to claim

### 42 API metrics

- API request count
- API error count
- API latency
- rate limit errors
- sync failures

### Realtime metrics

- active WebSocket/SSE connections
- notification events sent
- disconnected clients

## Grafana dashboard ideas

### Dashboard 1: Backend Health

Panels:

- requests per minute
- p95 response time
- status code distribution
- 5xx errors
- CPU/memory if available
- database connection health

### Dashboard 2: Evaluation System

Panels:

- open vs claimed slots
- slots by project
- claim success/failure
- average claim time
- most requested projects

### Dashboard 3: Auth and 42 API

Panels:

- logins
- failed logins
- OAuth errors
- 42 API latency
- 42 API failed requests

## Demo plan

During evaluation:

1. Open Grafana dashboard.
2. Log in as student.
3. Create evaluation slot.
4. Log in as tutor.
5. Claim the slot.
6. Trigger one failed login.
7. Refresh dashboard / wait for scrape.
8. Show changed metrics.

## Security

- Grafana must not be publicly open without authentication.
- Prometheus/Grafana credentials should come from `.env`.
- Metrics must not expose personal data.
- Do not include tokens, emails, or private suggestion text in metric labels.

Bad metric label example:

```txt
evaluation_slot_created{student_email="..."}
```

Good metric label example:

```txt
evaluation_slot_created_total{project="webserv"}
```

## Open decisions

- Which Python metrics library?
- Which exporters are realistic for MVP?
- Is Grafana exposed through Nginx or only local/internal?
- Do we need alerting for the module validation?
