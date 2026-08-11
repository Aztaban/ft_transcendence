# Milestone 8 — Security & Administration

**Assigned to:** Lenka (lhusarov)

## Milestone Goal (context)

Create a secure role-based platform.

The system must correctly separate permissions between:

- Student
- Hitchhiker / Tutor
- Head Tutor
- Student Council
- Admin

## Lenka's issues in this milestone, in build order

### 1. Complete Role & Permission System

**Your role:** Backend

**Also touches this issue:** Martin (Backend), Diana (Frontend route protection)

## Description

Finalize role-based access control.

## Checklist

- [ ] Define all application roles
- [ ] Create permission matrix
- [ ] Implement backend permission checks
- [ ] Protect API endpoints
- [ ] Protect frontend routes
- [ ] Add permission tests

## Acceptance Criteria

- Users can only access allowed features.
- Roles behave correctly.

---

### 2. Implement Administration Permissions

**Your role:** Backend

**Also touches this issue:** Martin (Backend), Diana (Admin UI)

## Description

Create administrative controls.

## Checklist

- [ ] Admin dashboard permissions
- [ ] Manage users
- [ ] Manage roles
- [ ] Manage evaluations
- [ ] Review reports
- [ ] Handle conflicts

## Acceptance Criteria

- Administrators can manage the platform.
- Restricted actions are protected.

---

### 3. Improve API Security

**Your role:** Backend

**Also touches this issue:** Martin (Backend), Roman (Infra/secrets management)

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

### 4. Create Audit Logging System

**Your role:** Backend

**Also touches this issue:** Martin (Backend), Roman (Log storage infra)

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
