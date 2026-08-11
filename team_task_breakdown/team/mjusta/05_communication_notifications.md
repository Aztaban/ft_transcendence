# Milestone 5 — Communication & Notifications

**Assigned to:** Martin (mjusta)

## Milestone Goal (context)

Allow communication between users and provide a notification system.

After this milestone:

- Users receive important platform notifications.
- Students can contact Student Council.

## Martin's issues in this milestone, in build order

### 1. Create Notification System

**Your role:** Backend

**Also touches this issue:** Lenka (Backend)

## Description

Create a general notification system for important platform events.

## Checklist

- [ ] Create notification database model
- [ ] Define notification types
- [ ] Create notification API
- [ ] Create notification service
- [ ] Add read/unread status
- [ ] Add notification history
- [ ] Add notification preferences
- [ ] Send "new eligibility request" notification to Head Tutors, listing requester and selected projects
- [ ] Send "eligibility approved/declined" notification to the requesting Hitchhiker
- [ ] Send "slot picked, please confirm" notification to the student
- [ ] Send "confirmed/declined" notification to the Hitchhiker
- [ ] Send "evaluation cancelled" notification to the other party

Example notification types:

slot_picked
evaluation_confirmed
evaluation_declined
evaluation_cancelled
eligibility_requested
eligibility_decided
system_message


## Acceptance Criteria

- Notifications are stored.
- Users can view notifications.
- Users can mark notifications as read.

---

### 2. Integrate Real-Time Notifications

**Your role:** Backend push

**Also touches this issue:** Lada (Integration), Lenka (Backend push)

## Description

Connect notifications with the WebSocket system.

## Checklist

- [ ] Send notifications through WebSocket
- [ ] Display notification popup
- [ ] Update notification counter
- [ ] Synchronize unread status

## Acceptance Criteria

- Users receive notifications instantly.
- Notification state stays synchronized.

---

### 3. Create Student Council Anonymous Messaging System

**Your role:** Backend

**Also touches this issue:** Lenka (Backend), Diana (UI), Lada (Integration)

## Description

Create a communication channel between students and Student Council.

Messages should allow students to communicate without exposing their identity.

## Checklist

- [ ] Create anonymous message model
- [ ] Create message submission form
- [ ] Create Student Council inbox
- [ ] Add message status
- [ ] Add message history
- [ ] Add moderation options

Message statuses:

NEW
OPENED
ANSWERED
ARCHIVED


## Acceptance Criteria

- Students can send anonymous messages.
- Student Council can manage messages.
- Message history is stored.

---

---

# Milestone 5 Completion Criteria

Milestone is completed when:

- [ ] Notification system works
- [ ] Real-time notifications work
- [ ] Student Council inbox exists
