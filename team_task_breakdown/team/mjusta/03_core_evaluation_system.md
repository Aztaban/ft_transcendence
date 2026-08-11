# Milestone 3 — Core Evaluation System

**Assigned to:** Martin (mjusta)

## Milestone Goal (context)

Implement the main functionality of the platform.

The system should support the complete evaluation workflow:

Student creates an evaluation request
↓
Request appears on the Requests page
↓
Eligible Hitchhiker picks a slot for the request
↓
Student is notified and confirms or declines the slot
↓
Confirmed evaluation appears on the Pending Evaluations page
↓
Either the student or the Hitchhiker can cancel at any time before it happens
↓
After the evaluation takes place, the result is recorded manually by the team directly in the database (no 42 API access to grades, so this is not an automated step)


After this milestone:

- Students can request evaluations.
- Hitchhikers can pick slots for open requests.
- Students can confirm or decline a picked slot.
- Either side can cancel an evaluation at any point.
- Administrators can manage evaluation processes.

## Martin's issues in this milestone, in build order

### 1. Create Project Management System

**Your role:** Backend

**Also touches this issue:** Lenka (Backend), Diana (Project list/detail UI), Lada (Integration)

## Description

Create the project structure required for evaluations.

Projects represent subjects that students can request evaluation for.

## Checklist

- [ ] Create project database model
- [ ] Define project fields
- [ ] Create project migration
- [ ] Create project API endpoints
- [ ] Add project listing endpoint
- [ ] Add project detail endpoint
- [ ] Create frontend project list
- [ ] Create frontend project details page

## Acceptance Criteria

- Projects can be stored in the database.
- Users can retrieve available projects.
- Project details are displayed correctly.

---

### 2. Implement Hitchhiker Project Eligibility Request

**Your role:** Backend

**Also touches this issue:** Lenka (Backend), Diana (Selection form & Head Tutor review table UI), Lada (Integration)

## Description

When a user switches to the Hitchhiker role for the first time, they fill in a single form listing all projects and select every project they want to be eligible to evaluate.

The submission is sent as one eligibility request to the Head Tutor for approval. The Head Tutor reviews requests in a table showing the requester's name and their full list of selected projects, and makes one accept or decline decision for the whole request — there is no per-project review.

Once approved, the Hitchhiker is eligible for every project in that request and can pick any open evaluation slot for those projects without needing any further authorization from anyone.

## Checklist

- [ ] Detect first-time Hitchhiker activation
- [ ] Display all active projects in a selectable list/box
- [ ] Allow selecting multiple projects
- [ ] Allow submitting the eligibility request
- [ ] Store selected projects with the request
- [ ] Notify Head Tutors of the new request
- [ ] Show a table of pending requests with requester name and selected projects
- [ ] Allow Head Tutor to accept the whole request
- [ ] Allow Head Tutor to decline the whole request
- [ ] Store the request's approval/decline result
- [ ] Notify Hitchhiker of the decision
- [ ] Allow approved Hitchhiker to pick any slot for the approved projects without further approval
- [ ] Prevent picking slots for projects that were not part of an approved request
- [ ] Add permission/lifecycle tests

Request status:

PENDING
APPROVED
DECLINED


## Acceptance Criteria

- A Hitchhiker submits one request covering all the projects they selected.
- The Head Tutor makes a single accept/decline decision per request, reviewing all requests in one table.
- On approval, the Hitchhiker is immediately eligible for every project in that request, with no further per-evaluation authorization needed.
- On decline, none of the projects in that request grant eligibility.

---

### 3. Create Evaluation Request System

**Your role:** Backend

**Also touches this issue:** Lenka (Backend), Diana (Request form & Requests page UI), Lada (Integration)

## Description

Allow students to create evaluation requests for projects. Requests start on the Requests page and stay there until a Hitchhiker picks a slot for them.

## Checklist

- [ ] Create evaluation request model
- [ ] Define evaluation statuses
- [ ] Create request API
- [ ] Create student request form
- [ ] Add project selection
- [ ] Display open requests on the Requests page
- [ ] Add request history

Statuses:

PENDING
AWAITING_CONFIRMATION
CONFIRMED
CANCELLED


A request starts as PENDING. When a Hitchhiker picks a slot it moves to AWAITING_CONFIRMATION. If the student confirms, it becomes CONFIRMED (and moves to the Pending Evaluations page); if the student declines, it returns to PENDING and is open for any eligible Hitchhiker to pick again. A request can move to CANCELLED from any state, by either the student or the Hitchhiker.

## Acceptance Criteria

- Students can create evaluation requests.
- Open requests appear on the Requests page.
- Requests are stored correctly and reflect the current state.

---

### 4. Implement Slot Picking by Hitchhiker

**Your role:** Backend

**Also touches this issue:** Lenka (Backend), Lada (Integration into Hitchhiker dashboard)

## Description

Allow an eligible Hitchhiker to pick an available time slot for an open (PENDING) evaluation request.

## Checklist

- [ ] Create slot-picking endpoint
- [ ] Validate the Hitchhiker's eligibility for the request's project
- [ ] Prevent two Hitchhikers picking the same request at once
- [ ] Add transaction protection
- [ ] Move request to AWAITING_CONFIRMATION
- [ ] Notify the student that a slot was picked and needs confirmation

## Acceptance Criteria

- Only eligible Hitchhikers can pick a slot for a request.
- A request cannot be picked by two Hitchhikers at once.
- The student is notified as soon as a slot is picked.

---

### 5. Implement Student Confirmation of Picked Slot

**Your role:** Backend

**Also touches this issue:** Lenka (Backend), Lada (Integration into Student dashboard)

## Description

Let the student confirm or decline the slot a Hitchhiker picked for their request.

## Checklist

- [ ] Create confirm endpoint
- [ ] Create decline endpoint
- [ ] On confirm, move request to CONFIRMED and show it on the Pending Evaluations page
- [ ] On decline, return request to PENDING so it can be picked again
- [ ] Notify the Hitchhiker of the student's decision

## Acceptance Criteria

- Students can confirm or decline a picked slot.
- Confirmed evaluations appear on the Pending Evaluations page.
- Declined evaluations return to the open Requests page.

---

### 6. Implement Evaluation Cancellation

**Your role:** Backend

**Also touches this issue:** Lenka (Backend), Lada (Integration)

## Description

Allow either the student or the Hitchhiker to cancel an evaluation at any point before it happens, regardless of its current status.

## Checklist

- [ ] Allow students to cancel their own request at any stage
- [ ] Allow Hitchhikers to cancel a slot they picked, at any stage
- [ ] Update request status to CANCELLED
- [ ] Notify the other party when a cancellation happens
- [ ] Prevent cancelling a request that belongs to someone else
- [ ] Add permission tests

## Acceptance Criteria

- Students can cancel their own evaluation requests at any time.
- Hitchhikers can cancel evaluations they picked at any time.
- The other party is notified when a cancellation happens.
- Unauthorized users cannot cancel someone else's evaluation.

---

### 7. Create Evaluation History System

**Your role:** Backend

**Also touches this issue:** Lenka (Backend), Diana (UI)

## Description

Store and display evaluation history, including results that are recorded manually by the team after an evaluation takes place (the platform has no automated way to pull results from 42, so this is a manual database entry, not an app-driven step).

## Checklist

- [ ] Create history API
- [ ] Add student history view
- [ ] Add Hitchhiker history view
- [ ] Display manually recorded results where present
- [ ] Add filtering options
- [ ] Add pagination

## Acceptance Criteria

- Users can view previous evaluations, including cancelled ones.
- Manually recorded results are displayed once entered by the team.

---

### 8. Create Administration Tools

**Your role:** Backend

**Also touches this issue:** Lenka (Backend), Diana (Admin UI)

## Description

Provide management tools for administrators.

## Checklist

- [ ] Create admin evaluation view
- [ ] View all evaluations
- [ ] Search evaluations
- [ ] Resolve conflicts (e.g. two Hitchhikers acting on the same request at once)
- [ ] Manage evaluation statuses
- [ ] View system history

## Acceptance Criteria

- Administrators can manage evaluation processes.
- Conflicts can be resolved.

---

---

# Milestone 3 Completion Criteria

Milestone is completed when:

- [ ] Projects exist
- [ ] Students can request evaluations
- [ ] Hitchhikers can request project eligibility and Head Tutors can approve/decline the whole request
- [ ] Eligible Hitchhikers can pick slots for open requests
- [ ] Students can confirm or decline a picked slot
- [ ] Either side can cancel an evaluation at any time
- [ ] Administration tools exist
