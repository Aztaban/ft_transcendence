# Risks

Status: draft  
Owner: TBD  
Last updated: TBD

## Purpose

Track important risks before they become blockers.

## High risks

### 42 API limitations

Risk:

- Required data may not be available.
- Some endpoints may require scopes/permissions we do not have.
- Creating real Intra evaluations may not be possible.

Mitigation:

- Research API early.
- Build MVP so it works without write access to Intra.
- Treat real Intra integration as optional/stretch.
- Ask tutors/staff before committing to this feature.

### Scope creep

Risk:

The app can become too large: tutors, counsellors, student council, evaluations, resources, notifications, analytics, monitoring, GDPR, etc.

Mitigation:

- Protect MVP.
- Do not start stretch modules before core flow works.
- Keep optional features clearly marked.

### Role complexity

Risk:

Roles are not mutually exclusive, so permission logic can become messy.

Mitigation:

- Use additive roles.
- Keep backend permission helpers centralized.
- Test critical permissions.

### Evaluation slot race conditions

Risk:

Two tutors may claim the same slot.

Mitigation:

- Use database constraints/transactions.
- Add tests for concurrent claiming.
- Do not rely only on frontend state.

### Authentication uncertainty

Risk:

Subject may require email/password auth even if 42 OAuth is implemented.

Mitigation:

- Confirm early.
- Implement basic email/password if needed.
- Keep 42 OAuth as additional auth module.

### Privacy and personal data

Risk:

The app stores 42 user data, roles, suggestions, possibly evaluation history.

Mitigation:

- Store minimum required data.
- Add privacy policy and terms.
- Implement data export/delete if claiming GDPR module.
- Do not log sensitive data.

## Medium risks

### Grafana/Prometheus setup takes longer than expected

Mitigation:

- Add monitoring after backend is stable.
- Start with simple metrics.
- Prepare clear demo dashboard.

### Team availability

Mitigation:

- Use small issues.
- Keep ownership clear.
- Avoid blocking each other.
- Weekly sync minimum.

### Frontend polish

Mitigation:

- Use a UI framework/design system.
- Define reusable components early.
- Test in Chrome regularly.

## Risk tracking table

| Risk | Severity | Owner | Status | Notes |
|---|---|---|---|---|
| 42 API project eligibility unknown | High | TBD | Open | Research first. |
| Real Intra evaluation creation unknown | High | TBD | Open | Stretch only. |
| Auth requirement unclear | High | TBD | Open | Ask evaluator/tutor. |
| Evaluation slot race condition | High | TBD | Planned | Use DB atomic claim. |
| Monitoring complexity | Medium | TBD | Open | Add after MVP. |
