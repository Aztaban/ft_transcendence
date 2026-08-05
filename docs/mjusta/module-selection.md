# Module Selection

**Status:** Draft for Architect feasibility review and team approval  
**Document owner:** mjusta, Product Owner  
**Last updated:** July 20, 2026

---

## 1. Purpose

This document records planned `ft_transcendence` modules, their product justification, priority and user-visible acceptance outcome.

---

## 2. Selection principles

A module should be selected when it:

- supports the evaluation or community vision,
- can be demonstrated through a complete journey,
- does not endanger mandatory scope,
- has a clear owner,
- and can be explained by the whole team.

A module should not be selected only because it appears easy.

---

## 3. Proposed modules

| Module or capability              | Type and points | Product justification                                                      | User-visible acceptance outcome                                                  |
| --------------------------------- | --------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Frontend and backend frameworks   | Major, 2        | Required for the web platform and team structure                           | Approved frameworks are used throughout the product                              |
| Real-time features                | Major, 2        | Claims, changes and notifications should update promptly                   | Relevant users receive live request, claim and notification changes              |
| Remote authentication with 42     | Minor, 1        | Connects the product to 42 identity                                        | User authenticates through 42 OAuth 2.0 and receives the correct local account   |
| Advanced permissions              | Major, 2        | Multiple roles require protected actions                                   | Student, Tutor, Head Tutor, SC Member and Administrator permissions are enforced |
| Complete notification system      | Minor, 1        | Evaluations and council communication depend on timely updates             | Notification center supports relevant types, read state and target links         |
| Advanced search                   | Minor, 1        | Users need to find tutors, requests, projects, resources and announcements | Search covers multiple entities, filtering and permission-safe results           |
| File upload and management        | Minor, 1        | Supports tutor resources and announcement attachments                      | Authorized users upload, access and remove validated files                       |
| Multiple languages                | Minor, 1        | Supports the international campus                                          | Interface supports English, Czech and Spanish, subject to exact module rules     |
| Prometheus and Grafana monitoring | Major, 2        | Supports operational visibility                                            | Meaningful service metrics and dashboards are available                          |
| GDPR-related controls             | Minor, 1        | Supports export, deletion and privacy expectations                         | Approved export, consent and deletion/anonymization behaviors work               |
| ORM for the database              | Minor, 1        | Supports consistent persistence                                            | Application uses an ORM according to the module wording                          |

---

## 4. Proposed stretch or backup modules

| Module or capability      | Type and points | Product justification                                   | User-visible acceptance outcome                             |
| ------------------------- | --------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| Standard user management  | Major - 2p      | Supports editable profiles, avatars, friends and status | Users manage the exact required profile and social features |
| Two-factor authentication | Minor - 1p      | Strengthens account security                            | Users can enroll, verify, recover and disable 2FA safely    |
| User interaction          | Major - 2p      | Supports basic chat, profiles and friends               | Users can perform the exact required interaction features   |

---

## 5. Acceptance expectations

### Real-time features

- New relevant requests appear promptly for tutors.
- Successful claims update the student and other tutors.
- Notifications update without full page reload.
- Disconnect and reconnect behavior is understandable.

### Advanced permissions

- Users may hold multiple roles.
- Role switching changes the workspace.
- Protected actions are enforced regardless of visible navigation.
- Search, notifications and analytics respect permissions.

### Notifications

Minimum categories:

- evaluation request,
- claim,
- schedule,
- cancellation,
- completion,
- announcement,
- poll,
- Student Council inbox,
- role or eligibility change.

Minimum behavior:

- unread/read state,
- event time,
- clear message,
- target link,
- and protected audience.

### Advanced search

Search should cover approved entities and provide meaningful filtering without revealing unauthorized content.

### File management

Possible use cases:

- tutor resources,
- announcement attachments,
- and avatars.

Required product controls:

- allowed type and size,
- ownership,
- access visibility,
- deletion behavior,
- and clear error feedback.

---

## 6. Dependencies

| Module               | Important product dependency                     |
| -------------------- | ------------------------------------------------ |
| Real-time features   | Stable evaluation state model and events         |
| Advanced permissions | Approved role matrix                             |
| Notifications        | Approved workflow triggers and audiences         |
| Search               | Approved entities and privacy rules              |
| File management      | Approved attachment and resource use cases       |
| Multiple languages   | Stable terminology and interface content         |
| GDPR controls        | Approved retention, export and deletion behavior |
| Monitoring           | Architect-defined services and metrics           |

---

## 7. Recommended product priority

1. Mandatory application and core evaluation workflow
2. Advanced permissions
3. Framework modules
4. Real-time evaluation updates
5. Notifications
6. 42 OAuth
7. Search
8. ORM
9. File management
10. GDPR controls
11. Multiple languages
12. Monitoring
13. Social/chat stretch modules
14. Two-factor authentication when capacity remains

The Architect may recommend a different technical sequence.

---
