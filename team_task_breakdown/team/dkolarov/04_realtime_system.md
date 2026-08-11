# Milestone 4 — Real-Time System

**Assigned to:** Diana (dkolarov)

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

## Diana's issues in this milestone, in build order

### 1. Real-Time UI Integration

**Your role:** UI updates

**Also touches this issue:** Lada (Integration)

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
