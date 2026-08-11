# Privacy Requirements

**Status:** Draft for legal, security and architecture review  
**Document owner:** Product Owner  
**Last updated:** July 20, 2026

---

## 1. Purpose

This document defines product-level privacy expectations for 42 Prague Evaluations.

It defines what information should be collected, who should see it, what users should be told, and what export, deletion, consent and retention behavior the product should provide.

It does not provide legal advice or prescribe encryption, database, backup or security implementation.

---

## 2. Privacy principles

- Collect only information needed for an approved purpose.
- Keep personal and evaluation information private by default.
- Make public visibility explicit.
- Respect role-based access.
- Explain data use in understandable language.
- Do not reuse private data for unrelated purposes.
- Provide correction, export and deletion behavior when required.
- Avoid public rankings without explicit approval.
- Record sensitive administrative actions where appropriate.

---

## 3. Data categories

### Account and identity

- 42 identifier
- Login name
- Display name
- Avatar
- Email address when required
- Assigned roles
- Account status
- Authentication metadata

### Evaluation data

- Student identity
- Tutor identity
- Project
- Proposed and scheduled times
- Notes
- Status
- Cancellation reason
- Completion state
- Activity timestamps

### Tutor information

- Tutor role
- Project eligibility
- Tutor profile
- Resource contributions
- Evaluation activity

### Student Council information

- Council membership
- Approved public profile details
- Announcements
- Polls
- Inbox messages
- Suggestions or feedback
- Content-management history

### Analytics information

- Requests created
- Claims
- Completions
- Cancellations
- Waiting and response times
- Announcement engagement
- Poll participation
- Meaningful product events

The product should not record every click without a clear approved need.

### Operational information

- Security-relevant events
- Application errors
- Service metrics
- Administrative actions

Operational logs should minimize personal content.

---

## 4. Public information

Possible public content:

- Product information
- Evaluation-process explanation
- Tutor-role description
- Student Council description
- Approved council member name, role, photo and short profile
- Public announcements
- Privacy Policy
- Terms of Service

A public council member list requires:

- a defined purpose,
- an approved set of fields,
- a process for keeping it current,
- and an appropriate consent or legal basis.

Private contact details should remain authenticated unless explicitly approved.

---

## 5. Evaluation privacy

Evaluation requests and schedules should be visible only to:

- the requesting student,
- eligible tutors to the extent needed to discover and claim,
- the assigned tutor,
- Head Tutors when needed for oversight,
- and Administrators when needed for support.

Before a claim, show only information necessary for eligibility and scheduling.

The interface should warn users not to place unnecessary sensitive details in evaluation notes.

---

## 6. Profile privacy

Recommended visibility:

### Public

- approved display name,
- approved avatar,
- public Student Council role,
- approved public biography.

### Authenticated community

- display name,
- avatar,
- tutor status,
- approved project eligibility,
- approved profile information.

### Private

- email,
- authentication identifiers,
- account status details,
- personal evaluation history,
- notifications,
- private messages,
- administrative notes.

---

## 7. Student Council inbox

- Only authorized council members and approved Administrators may access messages.
- Search must not expose inbox content to other roles.
- Anonymous submission must explain what technical metadata may still exist.
- Internal resolution notes are not shown to the sender unless intended.
- Attachments require validation and protected access.

---

## 8. Poll privacy

Every poll should define:

- eligible voters,
- whether votes are anonymous,
- whether results are visible before closing,
- whether results are public or authenticated,
- whether users can change their vote,
- and how long voting data is retained.

Anonymous voting should prevent ordinary users and council members from connecting a choice to a person.

The system may still need to record that an eligible user voted to prevent duplicates. The Architect must support the approved anonymity level.

---

## 9. Notification privacy

- Notification previews avoid unnecessary sensitive details.
- Each notification is visible only to its intended recipient.
- Clicking still enforces permission.
- Removed permission also removes access to the target.
- Notification retention follows an approved period.

---

## 10. Search privacy

- Unauthorized items do not appear in results.
- Autocomplete does not reveal private users, requests, messages or content.
- Search indexes update when content visibility changes or content is deleted.
- Public and authenticated search follow separate visibility rules where needed.

---

## 11. Consent and preferences

Users should be informed about:

- what data is collected,
- why it is used,
- which fields may be public,
- and which preferences they control.

Possible preferences:

- public avatar visibility,
- public council profile,
- notification categories,
- email notifications,
- language,
- and optional analytics consent when legally required.

Necessary processing should not be presented as optional consent when it is required to provide the requested service.

---

## 12. Data correction

Users should be able to correct permitted profile information.

For data controlled by 42 OAuth, the product should explain whether updates must be made in the external source.

---

## 13. Data export

When the GDPR module is selected, an export may include:

- account and profile information,
- assigned roles,
- evaluation requests and history,
- notifications,
- council messages sent by the user,
- poll participation information compatible with anonymity,
- and other personal records.

The export should be understandable and machine-readable where required. It must not unnecessarily expose another user’s private data.

---

## 14. Account deletion and anonymization

Recommended behavior:

- remove or anonymize the user profile,
- revoke authentication access,
- remove optional profile content and avatar,
- anonymize shared historical evaluation records where full deletion would damage another participant’s legitimate history,
- delete notifications after the approved period,
- handle council authorship and administrative records according to retention needs,
- and preserve anonymous poll integrity without retaining an unnecessary identity link.

The final behavior requires Architect and team review.

---

## 15. Retention

The team must define retention periods for:

- inactive accounts,
- evaluation history,
- cancelled and expired requests,
- notifications,
- council inbox messages,
- poll ballots and eligibility records,
- uploaded files,
- audit records,
- and operational logs.

The product should not promise indefinite storage before these periods are approved.

---

## 16. Uploaded files

- Only approved roles may upload.
- Type and size are restricted.
- Access follows the parent resource’s visibility.
- Deleting a resource defines what happens to its file.
- Sensitive documents are not accepted unless required.
- Public attachments require explicit public visibility.

Malware scanning and storage design belong to the Architect.

---

## 17. Administrative access

Administrators should access private content only to:

- resolve a support problem,
- investigate a security issue,
- moderate approved content,
- or perform another defined task.

Where appropriate, record actor, action, target, time and reason.

---

## 18. Privacy notices

The product should provide:

- Privacy Policy,
- Terms of Service,
- explanation of public profile fields,
- poll anonymity explanation,
- file upload warning,
- evaluation note warning,
- account deletion consequences,
- and external authentication explanation.

---
