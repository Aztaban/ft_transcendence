# Minimum Viable Product

**Status:** Draft for team review  
**Document owner:** mjusta, Product Owner  
**Last updated:** July 20, 2026

---

## 1. Purpose

This document defines the smallest complete version of 42 Prague Evaluations that delivers the primary product value and can serve as a strict scope baseline for architecture and delivery planning.

The MVP must replace the essential manual or Slack-based evaluation coordination workflow.

---

## 2. MVP statement

The MVP allows an authenticated student to request an evaluation for a project and provide available times. An eligible tutor can discover the request, claim one available time, and create a scheduled evaluation. Both participants can see the current state and receive important notifications. The product prevents conflicting claims and enforces role-based access.

---

## 3. Required roles

The MVP requires:

- Student
- Tutor
- Head Tutor
- Administrator

A minimal Student Council announcement capability may be included only when it does not delay the core workflow. Full council tooling is not required to prove the primary product value.

---

## 4. Required capabilities

### 4.1 Authentication

- Login and logout
- Protected authenticated area
- Persistent local user identity
- 42 OAuth 2.0 when included in the approved module set
- Safe session behavior

### 4.2 Roles and permissions

- Multiple roles per user
- Role-aware navigation
- Tutor-only queue and claim actions
- Head Tutor eligibility management
- Basic Administrator role management
- Server-side enforcement of protected actions

### 4.3 Student evaluation requests

- Select a project
- Provide one or more future times
- Add an optional note
- Submit the request
- View current status
- Edit while open
- Cancel while open
- View scheduled and historical evaluations

### 4.4 Tutor evaluation queue

- View open requests for eligible projects
- Filter by project
- View available times
- Claim one time
- View own scheduled evaluations
- Release a claim when permitted

### 4.5 Conflict protection

- Only one tutor may successfully claim a particular time.
- Stale or conflicting actions fail safely.
- The user sees the latest state after a conflict.

### 4.6 Evaluation lifecycle

Required MVP statuses:

- Open
- Scheduled
- Cancelled
- Expired
- Completed

`Claimed` and `Changed` may be included if required by the final confirmation or rescheduling model.

### 4.7 Notifications

Required in-app notifications:

- request claimed,
- evaluation scheduled,
- evaluation cancelled,
- tutor released evaluation,
- request expired,
- evaluation completed,
- and role or eligibility changed.

External email or push notifications are not required unless selected as part of another module.

### 4.8 Profiles

- Basic name and avatar
- Assigned roles
- Tutor project eligibility
- Profile settings required by selected modules

### 4.9 Basic administration

- View users
- Assign or remove approved roles
- Resolve an invalid evaluation state
- Moderate approved content where required

---

## 5. Optional MVP-supporting capability

A minimal Student Council announcement board may be included:

- Authorized member creates an announcement.
- Authenticated users can read it.
- Intended users receive an in-app notification.

Polls, inbox workflows, public announcements, attachments and council analytics are post-MVP unless required by final module selection.

---

## 6. Explicitly post-MVP

- Public informational pages
- Full Student Council directory
- Voting polls
- Student Council inbox
- Anonymous suggestions
- File attachments
- Advanced search
- Multiple languages
- User activity analytics dashboard
- Prometheus and Grafana dashboards
- GDPR export and deletion interface
- Friends system
- General chat
- Two-factor authentication
- Complex rescheduling negotiation
- Email or push notifications
- Native mobile application

Some post-MVP capabilities may still be required before defense because they belong to approved modules.

---

## 7. MVP journeys

### Student creates a request

1. Student authenticates.
2. Student selects a project.
3. Student enters future availability.
4. Student submits.
5. Request appears in the eligible tutor queue.

### Tutor claims a request

1. Tutor opens the queue.
2. Tutor selects an eligible request.
3. Tutor chooses an available time.
4. Tutor claims it.
5. Evaluation becomes scheduled.
6. Both users receive confirmation.

### Conflict is handled

1. Two tutors view the same request.
2. Both attempt to claim the same time.
3. Only one succeeds.
4. The other sees that the time is unavailable.

### Tutor releases the evaluation

1. Tutor opens a scheduled evaluation.
2. Tutor releases it with a reason.
3. Student is notified.
4. Request returns to open availability when a valid time remains.

### Evaluation is completed

1. Scheduled time passes.
2. Authorized participant marks completion.
3. Evaluation appears in both participants’ history.

---

## 8. MVP acceptance criteria

The MVP is accepted when:

- a new authenticated user reaches the correct workspace,
- an Administrator can assign Tutor permission,
- a Head Tutor or Administrator can define project eligibility,
- a student can create a valid request,
- an ineligible tutor cannot claim it,
- an eligible tutor can claim one time,
- conflicting claims are prevented,
- both participants see the schedule,
- required notifications appear,
- open requests can be cancelled,
- tutor releases are handled safely,
- expired requests leave the active queue,
- completed evaluations remain in history,
- unauthorized direct actions are rejected,
- and the workflow can be demonstrated without manual database changes.

---

## 9. Quality bar

The MVP must:

- run through the required deployment command,
- use real persisted data,
- display understandable errors,
- avoid unhandled browser failures,
- protect private information,
- support agreed browsers,
- and be understandable to a first-time user.

---

## 10. Scope change rule

A capability may be added to MVP only when:

- required by the subject,
- necessary for a complete evaluation workflow,
- or necessary for safety or usability.

Every addition should state its product reason, schedule impact, dependencies and what will be delayed if necessary.

---

## 11. Definition of done

A feature is complete only when:

- user-visible behavior works,
- permissions are enforced,
- failure states are handled,
- required notifications exist,
- critical tests pass,
- documentation is updated,
- and the team can demonstrate and explain it.

---
