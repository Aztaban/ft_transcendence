# Milestone 8 — Security & Administration

**Assigned to:** Roman (rkravche)

## Milestone Goal (context)

Create a secure role-based platform.

The system must correctly separate permissions between:

- Student
- Hitchhiker / Tutor
- Head Tutor
- Student Council
- Admin

## Roman's issues in this milestone, in build order

### 1. Improve API Security

**Your role:** Infra/secrets management

**Also touches this issue:** Martin (Backend), Lenka (Backend)

## Description

Protect the application from common security problems.

## Checklist

- [ ] Validate user input
- [ ] Add rate limiting
- [ ] Configure security headers
- [ ] Protect sensitive endpoints
- [ ] Secure sessions
- [ ] Manage secrets securely
- [ ] Review authentication security

## Acceptance Criteria

- API follows security best practices.
- Sensitive information is protected.

---

### 2. Create Audit Logging System

**Your role:** Log storage infra

**Also touches this issue:** Martin (Backend), Lenka (Backend)

## Description

Track important administrative actions.

## Checklist

- [ ] Create audit log model
- [ ] Store important actions
- [ ] Track permission changes
- [ ] Add admin log view
- [ ] Add filtering

## Acceptance Criteria

- Important actions can be reviewed.
- Logs contain enough information.


---
