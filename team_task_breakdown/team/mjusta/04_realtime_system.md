# Milestone 4 — Real-Time System

**Assigned to:** Martin (mjusta)

## Milestone Goal (context)

Add live communication between users and provide instant updates without requiring page refreshes.

## Real-Time Architecture Rule

WebSocket events are notifications only.

HTTP/REST responses remain the source of truth.
After receiving a WebSocket event, the frontend fetches the current state
from the API when necessary.

After this milestone:

- Users receive real-time updates.
- Evaluation changes are immediately visible.
- The platform supports WebSocket communication.

## Martin's issues in this milestone, in build order

### 1. Setup WebSocket Infrastructure

**Your role:** Django Channels backend

**Also touches this issue:** Roman (Infra (Nginx WS proxy, Redis channel layer)), Lenka (Django Channels backend)

## Description

Create the backend WebSocket system required for real-time communication.

## Checklist

- [ ] Configure WebSocket server
- [ ] Configure WebSocket routing
- [ ] Create connection handling
- [ ] Create authentication for WebSocket connections
- [ ] Manage active connections
- [ ] Handle disconnect events
- [ ] Add connection tests

## Acceptance Criteria

- Users can establish WebSocket connections.
- Connections are authenticated.
- Server handles connect/disconnect correctly.

---

### 2. Implement User Presence System

**Your role:** Backend

**Also touches this issue:** Lenka (Backend), Lada (Frontend indicators)

## Description

Track active users and their availability.

## Checklist

- [ ] Create presence model/state
- [ ] Track online users
- [ ] Broadcast presence changes
- [ ] Update frontend status indicators
- [ ] Handle inactive connections

## Acceptance Criteria

- System knows connected users.
- Presence updates are delivered in real time.

---

### 3. Implement Evaluation Real-Time Events

**Your role:** Backend

**Also touches this issue:** Lenka (Backend)

## Description

Send live updates related to evaluation workflows.

## Checklist

- [ ] Create evaluation event system
- [ ] Send evaluation slot-picked event
- [ ] Send evaluation confirmed event
- [ ] Send evaluation declined event
- [ ] Send evaluation cancelled event
- [ ] Notify affected users
- [ ] Connect events with frontend updates

Events:

evaluation.slot_picked
evaluation.confirmed
evaluation.declined
evaluation.cancelled


## Acceptance Criteria

- Users receive evaluation updates immediately.
- Events contain correct information.
- Frontend updates automatically.

---

---

# Milestone 4 Completion Criteria

Milestone is completed when:

- [ ] WebSocket server works
- [ ] Users can connect
- [ ] Events are broadcast
- [ ] Evaluation changes appear live
- [ ] Frontend updates automatically
