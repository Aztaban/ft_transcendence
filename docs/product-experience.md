# Product Experience

**Status:** Draft for team and design review  
**Document owner:** mjusta, Product Owner  
**Last updated:** July 20, 2026

---

## 1. Purpose

This document defines the user-facing structure of 42 Prague Evaluations: public and authenticated areas, page inventory, shared layout, role-based navigation, notifications, search, common states and accessibility expectations.

It does not define exact styling, component implementation, routes, API behavior or CSS dimensions.

---

## 2. Experience principles

- The core evaluation action should be easy to find.
- The active role and working context should always be clear.
- Users should understand the current status of every evaluation.
- Important changes should be visible through notifications.
- Private information should never appear publicly or in unauthorized search results.
- Empty and error states should explain what the user can do next.
- Secondary Student Council tools should not overwhelm the evaluation workflow.

---

## 3. Public and authenticated model

### Public area

- Landing page
- How evaluations work
- About tutors
- About the Student Council
- Current council members, with approved fields and consent
- Public announcements
- Privacy Policy
- Terms of Service
- Login entry point

### Authenticated area

Authentication is required for:

- evaluation requests,
- tutor queue,
- evaluation schedules and history,
- notifications,
- poll voting,
- internal announcements,
- Student Council inbox,
- profile settings,
- and administration.

---

## 4. Shared application shell

### 4.1 Top bar

The top bar contains:

- product logo,
- global search,
- notification icon with unread indicator,
- profile icon,
- profile settings,
- and logout.

### 4.2 Left navigation

The left navigation contains:

- current active role,
- role switcher when multiple roles are assigned,
- role-specific navigation,
- and common authenticated navigation.

The active page and active role should be visually clear.

### 4.3 Main content area

The main area displays:

- page title,
- short context where useful,
- primary action,
- content,
- status and feedback,
- and secondary actions.

### 4.4 Footer

A compact footer may contain:

- Privacy Policy,
- Terms of Service,
- product/version information,
- and support or contact link.

---

## 5. Public page inventory

| Page                 | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| Landing              | Explain the product and provide login access                   |
| How evaluations work | Explain the student and tutor process                          |
| Tutors               | Explain tutor responsibilities and approved public information |
| Student Council      | Explain the council and list current members                   |
| Public announcements | Display announcements explicitly marked public                 |
| Privacy Policy       | Explain personal-data behavior                                 |
| Terms of Service     | Explain platform rules                                         |
| Login                | Start authentication                                           |

---

## 6. Common authenticated pages

| Page             | Purpose                                        |
| ---------------- | ---------------------------------------------- |
| Dashboard        | Show role-relevant summary and next actions    |
| Notifications    | Show relevant events, read state and links     |
| Search           | Find permitted content                         |
| Profile          | Show approved user information                 |
| Profile settings | Update permitted profile and preference fields |
| Role switcher    | Change active workspace                        |

---

## 7. Student workspace

Recommended navigation:

- Dashboard
- Evaluations
- Tutors
- Student Council
- Hitchhikers

### Student dashboard

May show:

- open requests,
- next scheduled evaluation,
- recent notifications,

---

## 8. Tutor workspace

Recommended navigation:

- Dashboard
- Evaluations
- Evaluation history
- Tutor resources
- Student council

### Tutor dashboard

May show:

- relevant open requests,
- next scheduled evaluation,
- recent claim or cancellation notifications,
- project eligibility,
- and personal tutor metrics.

---

## 9. Head Tutor workspace

Recommended navigation:

- Dashboard
- Evaluation demand
- Tutor overview
- Tutor eligibility
- Tutor resources
- Aggregate analytics

Head Tutors should retain normal Tutor capabilities.

---

## 10. Student Council workspace

Recommended navigation:

- Dashboard
- Announcements
- Polls
- Inbox
- Council members

### Council dashboard

May show:

- draft and published announcements,
- active polls,
- new inbox messages,

---

## 11. Administrator workspace

Recommended navigation:

- Dashboard
- Users
- Roles
- Evaluation administration
- Content moderation
- Platform settings
- Administrative history
- Operational links

Administrative navigation should be clearly separated from everyday user work.

---

## 12. Evaluation request experience

### Request form

- Project selector
- Time-slot input
- Optional note
- Validation
- Submit action
- Cancel or back action

### Request detail

- Project
- Student
- Proposed times
- Current status
- Creation and modification times
- Allowed actions
- Relevant history

### Tutor queue

- Project filtering
- Date/time filtering
- Clear request status
- Available times
- Request detail
- Claim confirmation

---

## 13. Notifications

The notification center should support:

- unread and read items,
- event category,
- time,
- concise explanation,
- target link,
- mark as read,
- and mark all as read.

Categories may include:

- Evaluation
- Tutor
- Student Council announcement
- Poll
- Message
- Role or permission
- Administration

Users receive only notifications intended for them.

---

## 14. Search

Global search may include:

- tutors,
- evaluation requests,
- projects,
- tutor resources,
- announcements,
- and Student Council information.

Search should provide entity labels, filters, loading and empty states, and permission-safe results.

A user should not infer that a private item exists when they lack access.

---

## 15. Announcements

Announcement cards should show:

- title,
- summary,
- author or council attribution,
- publication time,
- and poll indicator when applicable.

---

## 16. Polls

A poll should show:

- question,
- options,
- eligibility,
- closing time,
- anonymity rule,
- whether the user already voted,
- and result visibility.

After submission, the product clearly confirms the vote.

Rules affecting fairness should not silently change after voting begins.

---

## 17. Student Council inbox

The inbox should support:

- new, open and resolved status,
- sender identity or anonymous status,
- subject or category,
- message content,
- response or resolution notes,
- and notification of new messages.

---

## 18. Common states

### Loading

Show that data is being retrieved without presenting stale actions as available.

### Empty

Explain why the page is empty and provide a relevant next action.

### Error

Explain what failed and whether retrying is safe.

### Permission denied

Explain that access is unavailable without exposing private details.

### Conflict

Explain that another user changed the item and show the latest state.

### Success

Confirm the action and explain what happens next.

---

## 19. Responsive behavior

The product should remain usable on common desktop and tablet sizes.

Mobile support should prioritize reading announcements, notifications, schedules and simple actions. Complex administration may be desktop-first unless the subject requires otherwise.

---

## 20. Accessibility expectations

- Keyboard-accessible navigation and controls
- Visible focus state
- Proper labels for icons and forms
- Sufficient contrast
- Status not communicated by color alone
- Clear validation messages
- Logical heading order
- Accessible tables and charts
- Reduced-motion consideration
- Correct language metadata

---

## 21. Terminology

Use consistent terms:

- Evaluation request
- Proposed time
- Evaluation queue
- Scheduled evaluation
- Tutor
- Head Tutor
- Student Council
- Announcement
- Poll
- Notification

Avoid switching between “slot,” “appointment,” “booking” and “evaluation” unless each term has a defined meaning.

---
