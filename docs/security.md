# Security review

What the application does to stay secure, and what it deliberately leaves out. Written for issue #52 and for the evaluation; the contract sections are in `api-plan.md`.

## Transport

- Nginx is the only public entry point: TLS 1.2/1.3 on 443, port 80 redirects to HTTPS. The self-signed development certificate is generated on first start. Traffic between containers is plain HTTP, which the subject allows.
- Every response carries `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a restrictive `Permissions-Policy`; `server_tokens` is off.
- API views answer with JSON only; the exceptions are listed under Information exposure.

## Authentication

- Email and password through Django's auth: Argon2 hashes, the standard password validators (length, similarity, common passwords, numeric only), email normalised to lowercase.
- 42 OAuth: the `state` is random, stored in the session and accepted once; the authorization code, the access token and the client secret never reach the browser. Accounts are never linked by email automatically (10.1).
- A wrong password, a suspended or a deleted account all answer `invalid_credentials`, so the account status is not revealed.
- Login and registration are limited to 10 attempts per minute per client IP (5.9).

## Sessions

- Server-side sessions in the database. The cookie is `HttpOnly`, `Secure` and `SameSite=Lax` in every environment; the session key rotates at login; a password change invalidates existing sessions.
- Logout ends the session and closes its WebSocket connections with code 4401 (9.3). Only `active` users authenticate.
- Pending (#63): suspending or deleting a user ends all their sessions.

## CSRF

- Double-submit cookie: every `POST`, `PUT`, `PATCH` and `DELETE` must send `X-CSRFToken`, including anonymous login and logout (registration too). A failure is the JSON envelope `csrf_failed` (5.4). The frontend adds the header centrally in `apiRequest`.

## Authorization

- Every endpoint requires a session unless marked public (5.3). Roles are read from the database on every request; the role switcher in the UI is presentation only.
- Objects a user may not see answer 404, not 403, so their existence is not revealed (5.5). State changes are atomic conditional updates under row locks (schema 4.2), so two users cannot pick or review the same thing twice.
- The Django admin is limited to staff accounts. WebSocket connections reuse the session cookie and are accepted only from origins in `ALLOWED_HOSTS` (9.1).

## Input validation

- Every request body and query parameter goes through a DRF serializer with explicit fields; unknown values give `validation_error` with per-field messages. The frontend validates the same rules before sending. Limits (lengths, slot sizes, page sizes) are settings, not literals.

## Rate limiting

- 1000 requests per hour per user for the API as a whole, 10 per minute per IP for login and registration; `429 throttled` with `Retry-After`. The client IP is taken from the last `X-Forwarded-For` entry, which Nginx writes, so a forged header cannot choose its own address. Counters live in Redis, shared by all backend processes.

## Secrets and configuration

- `.env` is git-ignored; `make env` creates it from `.env.example` with a random `DJANGO_SECRET_KEY` and random MySQL passwords; MySQL listens on 127.0.0.1 only. The backend refuses to start with the example key or an empty one. The 42 client secret and the database passwords exist only in `.env`.
- `DJANGO_SETTINGS_MODULE` in `.env` selects `config.settings.dev` (debug on, for development) or `config.settings.prod`. Nothing in the images depends on the settings; they are read at start.

## Information exposure

- API views never answer with HTML: unknown paths under `/api/` give the JSON `not_found` envelope, and `Accept: text/html` gives `406`. Errors raised before a request reaches DRF still use the default HTML pages: Django's `400` for a Host header not in `ALLOWED_HOSTS` and its `500` for a crash in middleware, and Nginx's own pages such as `502` when the backend is down or `413` for an oversized body. These pages carry no stack trace or settings while `DEBUG` is off. `/health/` reports `ok` or `error` per service, never the exception. The OpenAPI schema at `/api/docs/` is public by design; it contains no secrets.

## Not done, and why

| Item | Reason |
|---|---|
| Two-factor authentication | Module not claimed. |
| Audit log of administrative actions | #53, milestone M8. |
| Ending sessions on suspension or deletion | Comes with the admin user management, #63. |
| GDPR tooling (export, self-service deletion) | Out of scope, decision R12. |
| Account lockout after failed logins | The per-IP limit covers brute force; a lockout would let anyone block another user's account. |
