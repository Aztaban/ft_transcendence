# Roles and Permissions

**Status:** Draft for team review  
**Document owner:** Product Owner  
**Version:** 0.1  
**Last updated:** July 20, 2026

---

## 1. Purpose

This document defines product roles, role relationships, visibility rules and allowed actions.

It defines **who may see and do what**. It does not define tokens, middleware, database tables or other implementation details.

---

## 2. Roles

- **Public visitor:** Unauthenticated person with access to approved public information.
- **Student:** Authenticated user who manages their own evaluation requests and community interactions.
- **Tutor:** User permitted to evaluate selected projects and claim requests.
- **Head Tutor:** Tutor with oversight and management responsibilities.
- **Student Council member:** User permitted to manage council content, polls and inbox messages.
- **Administrator:** User permitted to manage platform-level accounts, roles and exceptional cases.

---

## 3. Multiple roles

- One account represents one person.
- A user may have multiple assigned roles.
- The role switcher changes the visible workspace and navigation.
- Switching the workspace does not replace backend permission enforcement.
- Shared capabilities may remain accessible without switching when appropriate.

---

## 4. Recommended role relationships

- Head Tutor includes normal Tutor capabilities.
- Administrator does not automatically act as Tutor or Student Council member unless explicitly assigned or using a defined override.
- Student Council membership does not grant Tutor permissions.
- All authenticated users retain Student capabilities unless the team approves a different account model.

Administrative overrides should be limited, attributable and used only for a defined support or moderation purpose.

---

## 5. Permission matrix

Legend: **Own** = only the user’s item; **Eligible** = only approved projects; **Manage** = role-area management; **Override** = exceptional administrative action.

| Capability                       | Public | Student |    Tutor | Head Tutor | SC Member | Administrator |
| -------------------------------- | -----: | ------: | -------: | ---------: | --------: | ------------: |
| View public pages                |    Yes |     Yes |      Yes |        Yes |       Yes |           Yes |
| View authenticated announcements |     No |     Yes |      Yes |        Yes |       Yes |           Yes |
| Manage own profile               |     No |     Own |      Own |        Own |       Own |           Own |
| Create evaluation request        |     No |     Own |      Own |        Own |       Own |           Own |
| Edit open request                |     No |     Own |      Own |        Own |       Own |      Override |
| Cancel own request               |     No |     Own |      Own |        Own |       Own |      Override |
| View tutor queue                 |     No |      No | Eligible |   Eligible |        No |      Override |
| Claim evaluation time            |     No |      No | Eligible |   Eligible |        No |      Override |
| Release own claim                |     No |      No |      Own |        Own |        No |      Override |
| View own evaluation history      |     No |     Own |      Own |        Own |       Own |      Override |
| Manage tutor project eligibility |     No |      No |       No |     Manage |        No |      Override |
| Resolve evaluation exception     |     No |      No |       No |     Manage |        No |      Override |
| View tutor workload overview     |     No |      No | Own only |     Manage |        No |      Override |
| Create or manage SC announcement |     No |      No |       No |         No |    Manage |      Override |
| Create or manage poll            |     No |      No |       No |         No |    Manage |      Override |
| Vote in eligible poll            |     No |     Yes |      Yes |        Yes |       Yes |           Yes |
| Send message to SC               |     No |     Yes |      Yes |        Yes |       Yes |           Yes |
| Read SC inbox                    |     No |      No |       No |         No |    Manage |      Override |
| Manage SC member list            |     No |      No |       No |         No |    Manage |      Override |
| Upload tutor resource            |     No |      No |       No |     Manage |        No |      Override |
| View personal notifications      |     No |     Own |      Own |        Own |       Own |           Own |
| Assign Tutor role                |     No |      No |       No |        Yes |        No |        Manage |
| Assign Head Tutor role           |     No |      No |       No |         No |        No |        Manage |
| Assign SC Member role            |     No |      No |       No |         No |       Yes |        Manage |
| Assign Administrator role        |     No |      No |       No |         No |        No |    Restricted |
| Suspend account                  |     No |      No |       No |         No |        No |        Manage |
| Access platform configuration    |     No |      No |       No |         No |        No |        Manage |

---

## 6. Student permissions

A student may:

- manage their profile,
- create and manage their own open requests,
- view their scheduled evaluations and history,
- receive notifications,
- read permitted announcements,
- vote in eligible polls,
- contact the Student Council,

A student may not claim tutor requests, manage roles, access another user’s private history or publish council content without another role.

---

## 7. Tutor permissions

A tutor may:

- access the tutor workspace,
- view requests for eligible projects,
- claim an available time,
- view and release their own claims,
- manage applicable tutor profile information,
- access or contribute tutor resources,
- receive tutor notifications,

---

## 8. Head Tutor permissions

A Head Tutor may:

- perform Tutor actions,
- manage project eligibility,
- review tutor workload and evaluation demand,
- manage tutor resources,
- resolve approved evaluation exceptions,
- and access aggregate tutor analytics.

---

## 9. Student Council permissions

A Student Council member may:

- manage approved council profile information,
- create, edit, publish, archive and delete announcements,
- select announcement audiences,
- create and manage polls,
- manage inbox messages,

Safeguards:

- destructive actions require confirmation,
- published content records author and time,
- poll rules are fixed after voting begins except for closing,
- and inbox messages remain role-restricted.

---

## 10. Administrator permissions

An Administrator may:

- manage users and roles,
- resolve account and permission issues,
- manage platform configuration,
- resolve exceptional evaluation states,
- and access authorized aggregate information.

---

## 11. Proposed role assignment

- Student is assigned after successful authentication and account creation.
- Tutor is assigned by an Head Tutor orAdministrator after approval.
- Head Tutor is assigned by an Administrator.
- Student Council member is assigned by an Administrator from an approved council list.
- Administrator is assigned through a restricted process.

Role changes notify the affected user.

---

## 12. Tutor eligibility

Tutor role does not automatically permit evaluation of every project.

A Head Tutor or Administrator manages:

- activation date,
- and removal of eligibility.

Removing eligibility affects future claims but must not silently cancel existing schedules.

---

## 13. Content visibility

### Announcement audiences

- Public
- All authenticated users
- Students
- Tutors
- Student Council members
- Administrators
- Approved combinations

### Profile visibility

Public fields must be explicitly approved. Private data must not become visible through search or direct links.

---

## 14. Permission-denied behavior

When access is forbidden, the product should:

- avoid exposing sensitive details,
- explain that permission is missing,
- preserve current data,
- and provide a safe navigation path.

Unavailable actions may be hidden in the interface, but protected actions must always be enforced by the system.

---
