# Meeting: First meeting

**Date:** 31.7.2026
**Participants:** mjusta, dkolarov, rkravche, lhusarov, lformank
**Note taker:** dkolarov

## 1. Agenda
 
The purpose of this meeting was to review progress on the project's foundational planning work and to reach consensus on the technical direction of the platform. Specifically, the agenda covered:
 
1. Roman's presentation of the proposed system architecture, API structure, and database schema.
2. Group discussion and validation of the proposed architecture against the project's functional requirements.
3. Final agreement on the division of work into clearly defined modules, along with ownership of each module going forward.
---
 
## 2. Discussion Summary
 
Roman presented the architecture proposal he had prepared ahead of the meeting, covering the overall system design, the planned API endpoints, the database schema, and an accompanying summary of technical risks. The presentation served as the basis for the team's discussion on how to structure the codebase and divide responsibilities across the group.
---
 
## 3. Decisions Made
 
Final division of responsibilities across the four core technical modules of the project:
 
| Module | Owner(s) | Scope of Responsibility |
|---|---|---|
| **Frontend (UI/UX)** | Diana | Overall frontend implementation: page layouts, components, user-facing views, and interaction design. |
| **Frontend–API Integration** | Lada | Wiring the frontend to backend services — connecting UI components to API endpoints, handling data flow and state on the client side. |
| **Backend / API Endpoints** | Martin & Lenka | Design and implementation of backend endpoints, request handling, business logic, and validation. |
| **Infrastructure & Database** | Roman | Docker containerization for the project, and database design/management via ORM (object-relational mapping). | 
---
 
## 4. Action Items
 
| Action | Owner | Deadline | Status |
|---|---|---|---|
| Prepare project vision and related supporting documents | mjusta | 24.7.2026 | ✅ Done |
| Prepare system architecture, API plan, database schema, and a summary of technical risks | rkravche | 31.7.2026 | ✅ Done |
| Break down the project into milestones and individual tasks, tracked via GitHub Issues | dkolarov | 07.8.2026 | ⏳ In Progress |
 
---
 
## 5. Next Meeting
 
**Proposed date:** August 10, 2026 *(to be confirmed)*
 
The next meeting is expected to focus on reviewing the milestone breakdown and task list once prepared, and confirming that each team member has a clear, actionable starting point for implementation within their assigned module.