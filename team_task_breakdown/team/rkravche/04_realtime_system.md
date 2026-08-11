# Milestone 4 — Real-Time System

**Assigned to:** Roman (rkravche)

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

## Roman's issues in this milestone, in build order

### 1. Setup WebSocket Infrastructure

**Your role:** Infra (Nginx WS proxy, Redis channel layer)

**Also touches this issue:** Martin (Django Channels backend), Lenka (Django Channels backend)

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

---

# Milestone 4 Completion Criteria

Milestone is completed when:

- [ ] WebSocket server works
- [ ] Users can connect
- [ ] Events are broadcast
- [ ] Evaluation changes appear live
- [ ] Frontend updates automatically
