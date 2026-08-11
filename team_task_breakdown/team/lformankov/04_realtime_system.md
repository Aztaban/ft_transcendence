# Milestone 4 — Real-Time System

**Assigned to:** Lada (lformankov)

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

## Lada's issues in this milestone, in build order

### 1. Implement User Presence System

**Your role:** Frontend indicators

**Also touches this issue:** Martin (Backend), Lenka (Backend)

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

### 2. Create Frontend WebSocket Client

**Your role:** Frontend-API/WebSocket integration

## Description

Implement frontend communication with the WebSocket server.

## Checklist

- [ ] Create WebSocket service
- [ ] Manage connection lifecycle
- [ ] Handle reconnect attempts
- [ ] Handle incoming events
- [ ] Update application state
- [ ] Display connection status

## Acceptance Criteria

- Frontend connects successfully.
- Lost connections recover automatically.
- Real-time updates appear without refreshing.

---

### 3. Real-Time UI Integration

**Your role:** Integration

**Also touches this issue:** Diana (UI updates)

## Description

Connect WebSocket events with user interfaces.

## Checklist

- [ ] Update dashboards automatically
- [ ] Refresh evaluation lists
- [ ] Update notifications instantly
- [ ] Display live status changes
- [ ] Handle loading states

## Acceptance Criteria

- Users see changes immediately.
- UI stays synchronized with backend state.

---

---

# Milestone 4 Completion Criteria

Milestone is completed when:

- [ ] WebSocket server works
- [ ] Users can connect
- [ ] Events are broadcast
- [ ] Evaluation changes appear live
- [ ] Frontend updates automatically
