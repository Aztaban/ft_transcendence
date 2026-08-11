# Milestone 5 — Communication & Notifications

**Assigned to:** Lada (lformankov)

## Milestone Goal (context)

Allow communication between users and provide a notification system.

After this milestone:

- Users receive important platform notifications.
- Students can contact Student Council.

## Lada's issues in this milestone, in build order

### 1. Integrate Real-Time Notifications

**Your role:** Integration

**Also touches this issue:** Martin (Backend push), Lenka (Backend push)

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

### 2. Create Student Council Anonymous Messaging System

**Your role:** Integration

**Also touches this issue:** Martin (Backend), Lenka (Backend), Diana (UI)

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
