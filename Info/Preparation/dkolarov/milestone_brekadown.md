# GitHub Milestone & Issue Breakdown — ft_transcendence

**Project:** ft_transcendence

**Purpose:** Development roadmap converted into GitHub milestones and properly structured issues.

**Goal:** Organize implementation into milestones following dependency order, where each GitHub issue represents one deliverable feature that can be assigned, reviewed, and closed through pull requests.

---

# Project Scope & Module Strategy

The project should reach at least **14 points** from available modules.

The chosen architecture focuses on building a complete evaluation management platform instead of a game-focused project.

---

# Planned Modules

| Category | Module | Points |
|---|---|---:|
| Web | Frontend & Backend Frameworks | 2 |
| Web | WebSockets / Real-Time Features | 2 |
| User Management | OAuth 2.0 Authentication | 1 |
| User Management | Advanced Permissions | 2 |
| Web | Complete Notification System | 1 |
| Web | File Upload & Management | 1 |
| Web | Advanced Search | 1 |
| Accessibility | Internationalization | 1 |
| DevOps | Prometheus + Grafana Monitoring | 2 |
| Data & Analytics | GDPR-related Controls | 1 |
| Web | ORM | 1 |

**Expected total:** 15 points

This provides a 1-point safety margin above the required 14 points.

---

# GitHub Structure Convention

The project uses the following GitHub structure:

Milestone
│
├── Issue
│ ├── Description
│ ├── Checklist
│ └── Acceptance Criteria
│
├── Issue
│
└── Issue


A milestone represents a complete development phase.

An issue represents one feature or technical task that can be assigned to one or more developers.

The checklist contains implementation steps.

Acceptance criteria define when the issue can be considered completed.

---

# GitHub Labels

Recommended labels:

| Label | Purpose |
|-|-|
| feature | New functionality |
| backend | Backend implementation |
| frontend | Frontend implementation |
| database | Database models and migrations |
| security | Security-related work |
| testing | Tests |
| documentation | Documentation |
| bug | Bug fixing |
| priority-high | Important functionality |
| priority-medium | Normal priority |

---

# GitHub Milestone Structure

The project is divided into **10 major milestones**.

The order follows dependencies:

1. Infrastructure first.
2. Authentication before user features.
3. Core evaluation workflow before secondary features.
4. Real-time features after the base system exists.
5. Quality, security, and deployment before final evaluation.

---

# Milestone 1 — Project Foundation & Infrastructure

## Goal

Create a complete development environment.

After this milestone:

- The complete stack starts successfully.
- Developers can work independently.
- Frontend, backend, and database communicate.

---

# Issues

---

# Issue: Create Repository Structure & Development Workflow

## Description

Prepare the repository structure and define development conventions used by the team.

## Checklist

- [ ] Define repository structure
- [ ] Create backend directory
- [ ] Create frontend directory
- [ ] Create documentation directory
- [ ] Define Git workflow
- [ ] Define branch naming strategy
- [ ] Define pull request workflow

## Acceptance Criteria

- Repository structure is documented.
- Team follows the same Git workflow.
- New developers can understand the project layout.

---

# Issue: Setup Nginx & HTTPS

## Checklist

- [ ] Configure Nginx reverse proxy
- [ ] Configure HTTPS
- [ ] Configure TLS certificates
- [ ] Configure WebSocket proxying
- [ ] Redirect HTTP to HTTPS
- [ ] Document local HTTPS setup

# Issues: Setup Background Task Processing

## Checklist

- [ ] Configure Celery
- [ ] Configure Redis broker
- [ ] Create worker service
- [ ] Create scheduled task service
- [ ] Verify background task execution

# Issue: Setup Docker Development Environment

## Description

Create a containerized development environment where all services can run together.

## Checklist

- [ ] Create Docker Compose configuration
- [ ] Setup backend container
- [ ] Setup frontend container
- [ ] Setup database container
- [ ] Setup Redis container
- [ ] Configure service communication
- [ ] Configure environment variables
- [ ] Create development documentation

## Acceptance Criteria

- All services start using Docker Compose.
- Backend can communicate with database.
- Frontend can communicate with backend API.

---

# Issue: Initialize Backend Application

## Description

Create the backend foundation required for future API development.

## Checklist

- [ ] Initialize Python backend framework
- [ ] Create application structure
- [ ] Configure project settings
- [ ] Configure database connection
- [ ] Setup ORM
- [ ] Setup migrations
- [ ] Create API base structure

## Acceptance Criteria

- Backend server starts successfully.
- Database connection works.
- Migration system is functional.
- API base route responds correctly.

---

# Issue: Initialize Frontend Application

## Description

Create the frontend foundation for the platform.

## Checklist

- [ ] Initialize React + TypeScript project
- [ ] Configure project structure
- [ ] Setup routing
- [ ] Create base layout
- [ ] Create reusable component structure
- [ ] Configure API communication layer

## Acceptance Criteria

- Frontend application runs.
- Routes are configured.
- Frontend can communicate with backend.

---

# Issue: Setup Development Tools

## Description

Configure tools that ensure consistent code quality.

## Checklist

- [ ] Setup code formatting
- [ ] Setup linting
- [ ] Setup testing framework
- [ ] Setup CI pipeline
- [ ] Setup API documentation workflow

## Acceptance Criteria

- Code style is automatically checked.
- Tests can run automatically.
- CI pipeline executes successfully.

---

# Milestone 1 Completion Criteria

Milestone is completed when:

- [ ] Development environment runs
- [ ] Backend runs
- [ ] Frontend runs
- [ ] Database is connected
- [ ] Team workflow is documented

---

# Milestone 2 — Authentication & User Management

## Goal

Allow users to securely access the platform and manage their profiles.

After this milestone:

- Users can register and authenticate.
- Users can connect their 42 account.
- User profiles exist.
- Roles and permissions foundation exists.

---

# Covered Modules

| Module | Points |
|-|-:|
| Frontend Framework | 1 |
| Backend Framework | 1 |
| ORM | 1 |
| OAuth 2.0 Authentication | 1 |
| User Management System | 2 |

---

# Issues

---

# Issue: Implement user profile data

## Description

Create the database structure required for storing platform users.

## Checklist

- [ ] Create user model
- [ ] Define required user fields
- [ ] Add unique username/login field
- [ ] Add email field
- [ ] Add account status field
- [ ] Create database migration
- [ ] Add user model tests
- [ ] Display assigned roles
- [ ] Display tutor project eligibility where permitted
- [ ] Enforce profile visibility rules

## Acceptance Criteria

- Users can be stored in the database.
- User records contain required information.
- Database migrations run successfully.

---

# Issue: Implement User Registration

## Description

Allow new users to create an account.

## Checklist

- [ ] Create registration endpoint
- [ ] Validate user input
- [ ] Validate unique username/email
- [ ] Hash passwords securely
- [ ] Create registration frontend form
- [ ] Add validation messages

## Acceptance Criteria

- New users can register.
- Invalid data is rejected.
- Passwords are never stored as plain text.

---

# Issue: Implement Authentication System

## Description

Create the login and session management system.

## Checklist

- [ ] Create login endpoint
- [ ] Create logout endpoint
- [ ] Implement session handling
- [ ] Create authentication middleware
- [ ] Protect private API routes
- [ ] Add frontend login page
- [ ] Add logout functionality

## Acceptance Criteria

- Users can log in.
- Users can log out.
- Protected endpoints require authentication.
- Sessions persist correctly.

---

# Issue: Implement 42 OAuth Authentication

## Description

Allow users to authenticate using their 42 account.

## Checklist

- [ ] Configure OAuth provider
- [ ] Create OAuth callback endpoint
- [ ] Implement OAuth login flow
- [ ] Retrieve 42 account information
- [ ] Store external identity data
- [ ] Link OAuth account with local user

## Acceptance Criteria

- Users can log in with 42 OAuth.
- User information is stored correctly.
- Existing users can connect their account.

---

# Issue: Create User Profile System

## Description

Create user profile functionality.

## Checklist

- [ ] Create profile database model
- [ ] Create profile API
- [ ] Create profile page
- [ ] Display user information
- [ ] Allow profile editing
- [ ] Add profile settings

## Acceptance Criteria

- Users can view their profile.
- Users can update allowed information.
- Profile data is saved correctly.

---

# Issue: Create Role System

## Description

Create the foundation for user roles.

Required roles:

Student
Tutor
Head Tutor
Student Council
Admin


## Checklist

- [ ] Create role model
- [ ] Create user-role relationship
- [ ] Add role assignment
- [ ] Add role API
- [ ] Create role permissions structure

## Acceptance Criteria

- Users can have assigned roles.
- Roles are stored correctly.
- Backend can identify user permissions.

---

# Issue: Implement Permission Middleware

## Description

Create backend protection based on user roles.

## Checklist

- [ ] Create permission middleware
- [ ] Define permission rules
- [ ] Protect restricted endpoints
- [ ] Add permission tests

## Acceptance Criteria

- Unauthorized users cannot access restricted features.
- Authorized users can access allowed features.
- Permission checks work consistently.

---

# Issue: Create Role-Based Frontend Navigation

## Description

Display frontend features depending on user permissions.

## Checklist

- [ ] Hide unavailable navigation items
- [ ] Create role-based dashboard views
- [ ] Add permission checks
- [ ] Handle unauthorized pages

## Acceptance Criteria

- Users see only available features.
- Restricted pages cannot be accessed.

---

# Milestone 2 Completion Criteria

Milestone is completed when:

- [ ] Users can register
- [ ] Users can login/logout
- [ ] 42 OAuth works
- [ ] Profiles exist
- [ ] Roles exist
- [ ] Permission system foundation exists

---

# Milestone 3 — Core Evaluation System

## Goal

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

---

# Issues

---

# Issue: Create Project Management System

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

# Issue: Implement Hitchhiker Project Eligibility Request

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

# Issue: Create Evaluation Request System

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

# Issue: Implement Slot Picking by Hitchhiker

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

# Issue: Implement Student Confirmation of Picked Slot

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

# Issue: Implement Evaluation Cancellation

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

# Issue: Create Student Dashboard

## Description

Create the student interface for managing evaluations.

## Checklist

- [ ] Create dashboard layout
- [ ] Display the student's open Requests
- [ ] Display the student's Pending Evaluations (confirmed)
- [ ] Highlight requests awaiting the student's confirmation
- [ ] Add evaluation history

## Acceptance Criteria

- Students can view their evaluation activity.
- Requests awaiting confirmation are clearly highlighted.

---

# Milestone 3 Completion Criteria

Milestone is completed when:

- [ ] Projects exist
- [ ] Students can request evaluations
- [ ] Hitchhikers can request project eligibility and Head Tutors can approve/decline the whole request
- [ ] Eligible Hitchhikers can pick slots for open requests
- [ ] Students can confirm or decline a picked slot
- [ ] Either side can cancel an evaluation at any time

---

# Milestone 4 — Real-Time System

## Goal

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

---

# Covered Modules

| Module | Points |
|-|-:|
| WebSockets / Real-Time Features | 2 |

---

# Issues

---

# Issue: Setup WebSocket Infrastructure

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

# Issue: Implement User Presence System

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

# Issue: Implement Evaluation Real-Time Events

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

# Issue: Create Frontend WebSocket Client

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

# Issue: Real-Time UI Integration

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

# Milestone 4 Completion Criteria

Milestone is completed when:

- [ ] WebSocket server works
- [ ] Users can connect
- [ ] Events are broadcast
- [ ] Evaluation changes appear live
- [ ] Frontend updates automatically


---

# Milestone 5 — Communication & Notifications

## Goal

Allow communication between users and provide a notification system.

After this milestone:

- Users receive important platform notifications.
- Students can contact Student Council.

---

# Covered Modules

| Module | Points |
|-|-:|
| Notification System | 1 |

---

# Issues

---

# Issue: Create Notification System

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

# Issue: Integrate Real-Time Notifications

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

# Issue: Create Student Council Anonymous Messaging System

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

# Milestone 5 Completion Criteria

Milestone is completed when:

- [ ] Notification system works
- [ ] Real-time notifications work
- [ ] Student Council inbox exists

---

# Milestone 6 — Search & Discovery System

## Goal

Allow authenticated users to discover Hitchhikers and Student Council members through a people-focused search.

The search system focuses on discovering:

- Hitchhikers (Tutors)
- Student Council members

The goal is to provide a simple people discovery experience.

After this milestone:

- Students can find available tutors.
- Students can find Student Council members.
- Search results display relevant role information.

---

# Covered Modules

| Module | Points |
|-|-:|
| Advanced Search | 1 |

---

# Issues

---

# Issue: Create People Search API

## Description

Create a backend search endpoint for finding Hitchhikers and Student Council members.

The search should only include users with relevant roles.

Supported roles:

```
HITCHHIKER
STUDENT_COUNCIL
```

Example:

```
GET /api/search/people?q=diana
```

---

## Checklist

- [ ] Create people search endpoint
- [ ] Filter users by role
- [ ] Search by display name (42 login may be used internally as a match field, but is not exposed in results)
- [ ] Add role information to results
- [ ] Add avatar/photo to results
- [ ] Add short bio to results
- [ ] Add pagination support
- [ ] Add search tests

---

## Example Response

```json
{
  "users": [
    {
      "display_name": "Diana Nováková",
      "avatar_url": "/media/avatars/diana.jpg",
      "role": "hitchhiker",
      "bio": "Frontend enthusiast and peer tutor..."
    },
    {
      "display_name": "Martin Novák",
      "avatar_url": "/media/avatars/martin.jpg",
      "role": "student_council",
      "bio": "Working on student community..."
    }
  ]
}
```

Note: 42 login is not included in the public search response. Public/authenticated profile results should only expose display name, avatar, role, and bio.

---

## Acceptance Criteria

- Users can search for Hitchhikers.
- Users can search for Student Council members.
- Regular students do not appear in results.
- Roles are displayed correctly.

---

# Issue: Create People Search Interface

## Description

Create the frontend search experience for finding Hitchhikers and Student Council members.

---

## Checklist

- [ ] Create search component
- [ ] Add search input
- [ ] Display user results
- [ ] Display avatar/photo per result
- [ ] Display display name per result
- [ ] Display role badges
- [ ] Display short bio per result
- [ ] Add empty state
- [ ] Add loading state
- [ ] Add error handling

---

## Acceptance Criteria

- Users can search from the interface.
- Results clearly show whether the person is a Hitchhiker or Student Council member.
- Empty results are handled correctly.

---

# Issue: Create User Discovery Profile View

## Description

Allow users to view basic information about discovered Hitchhikers and Student Council members.

---

## Checklist

- [ ] Create public profile view
- [ ] Display display name
- [ ] Display role
- [ ] Display avatar/photo
- [ ] Display short bio
- [ ] Restrict private information (42 login and other non-public fields are not exposed)

---

## Acceptance Criteria

- Users can open a discovered person's profile.
- Only public information is displayed.
- Private user data is protected.

# Milestone 7 — Accessibility & Internationalization

## Goal

Make the platform accessible and available in multiple languages.

The application should support different users regardless of language or accessibility needs.

After this milestone:

- Users can switch application language.
- Main workflows are translated.
- Interface follows accessibility standards.
- Evaluation workflow is usable with accessibility tools.

---

## Covered Modules

| Module | Points |
|-|-:|
| Internationalization | 1 |
| WCAG Accessibility | 2 |

---

# Issues

---

# Issue: Setup Internationalization Framework

## Description

Create the translation system used across the application.

## Checklist

- [ ] Install i18n framework
- [ ] Configure language files
- [ ] Create translation structure
- [ ] Add language selector
- [ ] Store user language preference
- [ ] Detect default user language

## Acceptance Criteria

- Application supports multiple languages.
- Users can switch languages.
- Language preference is saved.

---

# Issue: Add Application Translations

## Description

Translate all user-facing content.

Supported languages:

- English
- Czech
- Spanish

## Checklist

- [ ] Translate navigation
- [ ] Translate authentication pages
- [ ] Translate dashboards
- [ ] Translate evaluation workflow
- [ ] Translate notifications
- [ ] Translate search interface
- [ ] Translate error messages

## Acceptance Criteria

- All important UI text is translated.
- No important user-facing text remains untranslated.

---

# Issue: Implement WCAG Accessibility Improvements

## Description

Improve usability for users with accessibility requirements.

## Checklist

- [ ] Add keyboard navigation
- [ ] Add ARIA labels
- [ ] Improve focus management
- [ ] Improve screen reader support
- [ ] Check color contrast
- [ ] Test accessibility

## Acceptance Criteria

- Application can be navigated by keyboard.
- Important elements are accessible.
- WCAG requirements are tested.


---

# Milestone 8 — Security & Administration

## Goal

Create a secure role-based platform.

The system must correctly separate permissions between:

- Student
- Hitchhiker / Tutor
- Head Tutor
- Student Council
- Admin

---

## Covered Modules

| Module | Points |
|-|-:|
| Advanced Permissions | 2 |

---

# Issues

---

# Issue: Complete Role & Permission System

## Description

Finalize role-based access control.

## Checklist

- [ ] Define all application roles
- [ ] Create permission matrix
- [ ] Implement backend permission checks
- [ ] Protect API endpoints
- [ ] Protect frontend routes
- [ ] Add permission tests

## Acceptance Criteria

- Users can only access allowed features.
- Roles behave correctly.

---

# Issue: Implement Administration Permissions

## Description

Create administrative controls.

## Checklist

- [ ] Admin dashboard permissions
- [ ] Manage users
- [ ] Manage roles
- [ ] Manage evaluations
- [ ] Review reports
- [ ] Handle conflicts

## Acceptance Criteria

- Administrators can manage the platform.
- Restricted actions are protected.

---

# Issue: Improve API Security

## Description

Protect the application from common security problems.

## Checklist

- [ ] Validate user input
- [ ] Add rate limiting
- [ ] Configure security headers
- [ ] Protect sensitive endpoints
- [ ] Secure sessions
- [ ] Manage secrets securely
- [ ] Review authentication security

## Acceptance Criteria

- API follows security best practices.
- Sensitive information is protected.

---

# Issue: Create Audit Logging System

## Description

Track important administrative actions.

## Checklist

- [ ] Create audit log model
- [ ] Store important actions
- [ ] Track permission changes
- [ ] Add admin log view
- [ ] Add filtering

## Acceptance Criteria

- Important actions can be reviewed.
- Logs contain enough information.


---

# Milestone 9 — Testing & Deployment

## Goal

Prepare a stable version for final evaluation.

---

# Issues

---

# Issue: Create Backend Testing Suite

## Description

Test backend functionality and business logic.

## Checklist

- [ ] Create unit tests
- [ ] Create API tests
- [ ] Test authentication
- [ ] Test OAuth login
- [ ] Test permissions
- [ ] Test evaluation workflow
- [ ] Test search functionality
- [ ] Test notifications

## Acceptance Criteria

- Backend features are covered by tests.
- Critical workflows pass automatically.

---

# Issue: Create Frontend Testing Suite

## Description

Test important user interactions.

## Checklist

- [ ] Component tests
- [ ] User flow tests
- [ ] Form validation tests
- [ ] Accessibility tests
- [ ] Dashboard tests
- [ ] Search interface tests

## Acceptance Criteria

- Frontend functionality is tested.
- Main user flows work correctly.

---

# Issue: Setup Production Deployment

## Description

Prepare the application for deployment.

## Checklist

- [ ] Create production Docker setup
- [ ] Configure production variables
- [ ] Setup database migration process
- [ ] Configure backups
- [ ] Setup logging
- [ ] Setup monitoring
- [ ] Test deployment process

## Acceptance Criteria

- Application can be deployed reliably.
- Production environment is documented.


---

# Milestone 10 — Final Polish & Demo

## Goal

Prepare the final evaluation version.

The platform should demonstrate the complete workflow.

---

# Issues

---

# Issue: Improve Final User Experience

## Description

Polish the application before evaluation.

## Checklist

- [ ] Add loading states
- [ ] Add empty states
- [ ] Improve error handling
- [ ] Improve responsive design
- [ ] Fix UI inconsistencies
- [ ] Improve navigation

## Acceptance Criteria

- Application feels complete and polished.

---

# Issue: Complete Documentation

## Description

Prepare project documentation.

## Checklist

- [ ] Update README
- [ ] Document architecture
- [ ] Document API
- [ ] Document setup process
- [ ] Document environment variables
- [ ] Document development workflow
- [ ] Document the manual evaluation-result recording process for the team

## Acceptance Criteria

- New developers can understand and run the project.
- The team's manual process for recording evaluation results is written down.

---

# Issue: Prepare Evaluation Demo

## Description

Create a complete evaluator workflow.

## Checklist

- [ ] Verify implemented modules
- [ ] Prepare student workflow demo
- [ ] Prepare Hitchhiker workflow demo
- [ ] Prepare Student Council demo
- [ ] Test evaluator permissions
- [ ] Fix final bugs
- [ ] Prepare presentation

## Acceptance Criteria

The evaluator can:

- Create/login as a user
- Request an evaluation
- Pick a slot as a Hitchhiker and have the student confirm it
- Cancel an evaluation as either party
- Receive notifications
- Search Hitchhikers and Student Council members
- Test permissions

---

# Final Project Estimate

| Item | Amount |
|-|-:|
| GitHub Milestones | 10 |
| GitHub Issues | ~60 |
| Checklist Tasks | ~150–200 |
| Expected Points | 16–17 |
| Required Points | 14 |

---

# Recommended GitHub Milestones Summary

| # | Milestone |
|-|-|
| M1 | Project Foundation & Infrastructure |
| M2 | Authentication & User Management |
| M3 | Core Evaluation System |
| M4 | Real-Time System |
| M5 | Communication & Notifications |
| M6 | Search & Discovery System |
| M7 | Accessibility & Internationalization |
| M8 | Security & Administration |
| M9 | Testing & Deployment |
| M10 | Final Polish & Demo |