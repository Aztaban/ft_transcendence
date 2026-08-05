# GitHub Milestone & Issue Breakdown — ft_transcendence

**Project:** ft_transcendence

**Purpose:** Development roadmap converted into GitHub milestones and issues.

**Goal:** Organize implementation into clear milestones following dependency order and ensuring enough completed modules for evaluation.



---



# Project Scope & Module Strategy



The project should reach at least **14 points** from available modules.

The chosen architecture focuses on building a complete evaluation management platform instead of a game-focused project.



## Planned Modules



| Category | Module | Points |
|---|---|---:|
| Web | Frontend Framework | 1 |
| Web | Backend Framework | 1 |
| Web | ORM | 1 |
| Web | WebSockets / Real-Time Features | 2 |
| User Management | User Management System | 2 |
| User Management | Advanced Permissions | 2 |
| User Management | OAuth 2.0 Authentication | 1 |
| Web | Notification System | 1 |
| Web | File Upload & Management | 1 |
| Web | Advanced Search | 1 |
| Accessibility | Internationalization | 1 |
| Accessibility | WCAG Accessibility | 2 |



**Expected total:** ~16–17 points



This provides a safety margin above the required 14 points.



---



# GitHub Milestone Structure



The project is divided into **10 major milestones**.

Each milestone contains multiple GitHub issues.

The order follows dependencies:

1. Infrastructure first.
2. Authentication before user features.
3. Core evaluation workflow before secondary features.
4. Real-time features after the base system exists.
5. Quality, security, and deployment before final evaluation.



---



# Milestone 1 — Project Foundation & Infrastructure



## Goal



Create a running development environment.

After this milestone:

- The complete stack starts successfully.
- Developers can work independently.
- Frontend, backend, and database communicate.



## Issues



### Development Environment

- [ ] Create repository structure
- [ ] Setup Git workflow
- [ ] Define branch strategy
- [ ] Create Docker Compose environment
- [ ] Setup backend container
- [ ] Setup frontend container
- [ ] Setup database container
- [ ] Setup Redis container
- [ ] Configure environment variables



### Backend Foundation

- [ ] Initialize backend framework
- [ ] Create application structure
- [ ] Configure database connection
- [ ] Configure ORM
- [ ] Setup migrations
- [ ] Create API base structure



### Frontend Foundation

- [ ] Initialize React + TypeScript project
- [ ] Setup routing
- [ ] Create base layout
- [ ] Create reusable component structure
- [ ] Configure API communication



### Development Tools

- [ ] Setup code formatting
- [ ] Setup linting
- [ ] Setup testing framework
- [ ] Setup CI pipeline
- [ ] Create API documentation workflow



---



# Milestone 2 — Authentication & User Management



## Goal



Allow users to access the platform and manage their profiles.



## Covered Modules



| Module | Points |
|-|-:|
| Frontend Framework | 1 |
| Backend Framework | 1 |
| ORM | 1 |
| OAuth 2.0 | 1 |
| User Management | 2 |



## Issues



### Authentication

- [ ] Create user database model
- [ ] Implement registration
- [ ] Implement login
- [ ] Implement logout
- [ ] Implement session management
- [ ] Password security
- [ ] Authentication middleware



### 42 OAuth

- [ ] Configure OAuth provider
- [ ] Implement OAuth login flow
- [ ] Connect 42 account
- [ ] Store external identity information



### User Profiles

- [ ] Create profile model
- [ ] Profile page
- [ ] Update profile information
- [ ] Avatar upload
- [ ] Default avatar system



### Roles

- [ ] Create role model
- [ ] Implement role assignment
- [ ] Create permission middleware
- [ ] Role-based frontend navigation



---



# Milestone 3 — Core Evaluation System



## Goal



Implement the main product functionality.



The complete workflow:

Student requests evaluation
↓
Tutor becomes eligible
↓
Tutor claims evaluation
↓
Evaluation happens
↓
Result is stored




## Issues



### Projects

- [ ] Create project model
- [ ] Create project management API
- [ ] Project listing
- [ ] Project details page



### Tutor Eligibility

- [ ] Create tutor eligibility model
- [ ] Tutor self-nomination
- [ ] Head Tutor approval system
- [ ] Eligibility status management


Statuses:

requested
confirmed
rejected



### Evaluation Requests

- [ ] Create evaluation request model
- [ ] Create available slots
- [ ] Student request form
- [ ] Student dashboard
- [ ] Request status tracking



### Tutor Workflow

- [ ] Tutor dashboard
- [ ] Available evaluations list
- [ ] Claim evaluation
- [ ] Prevent double claiming
- [ ] Complete evaluation
- [ ] Evaluation history



### Administration

- [ ] Manage evaluations
- [ ] Resolve conflicts
- [ ] View evaluation history



---



# Milestone 4 — Real-Time System



## Goal



Add live updates between users.



## Covered Module



| Module | Points |
|-|-:|
| WebSockets | 2 |



## Issues



### Backend

- [ ] Setup WebSocket server
- [ ] Connection management
- [ ] User presence handling
- [ ] Event broadcasting



### Events (Evaluation)

- [ ] Evaluation claimed event
- [ ] Evaluation completed event
- [ ] Evaluation cancelled event
- [ ] Notification event



### Frontend

- [ ] WebSocket client
- [ ] Automatic refresh system
- [ ] Connection recovery
- [ ] Real-time UI updates



---



# Milestone 5 — Communication & Notifications



## Goal



Allow communication between users and provide system notifications.



## Covered Modules



| Module | Points |
|-|-:|
| Notifications | 1 |
| User Interaction (optional) | 2 |



## Issues



### Notifications

- [ ] Create notification model
- [ ] Notification API
- [ ] Read/unread status
- [ ] Notification center
- [ ] Notification preferences
- [ ] Real-time notifications



### Student Council Inbox

- [ ] Anonymous message model
- [ ] Student message form
- [ ] Council inbox
- [ ] Message status
- [ ] Message history



### Optional Chat Extension

- [ ] Private messages
- [ ] Chat history
- [ ] Online status
- [ ] User blocking
- [ ] Read receipts



---



# Milestone 6 — Search & Discovery System



## Goal



Allow users to quickly find relevant information inside the platform.



The search system helps users discover:



- Projects and subjects

- Hitchhikers 

- Student Council members


The goal is to provide a simple global search experience across the platform.



---



## Covered Module



| Module | Points |
|-|-:|
| Advanced Search | 1 |



---



## Issues



## Search Backend



- [ ] Create global search API endpoint



Example: GET /api/search?q=


The endpoint should search across supported entities:


- Users

- Projects

- Student Council members



---



## Project / Subject Search



- [ ] Implement project search



Users can search for project subjects.



Example: GET /api/search?q=webserv

Example response:

```json
{
"projects": [
	{
	"name": "webserv",
	"subject": "en.subject.pdf"
	}
	],
"users": [],
"council": []
}
```

## People Search (Hitchhikers & Student Council)



- [ ] Implement user search



Users can search for people on the platform using their 42 Intra login.



The search should support finding:



- Hitchhikers

- Student Council members



Example: GET /api/search?q=dkolarov

Example response:
```json
{
"projects": [],
"users": [
	{
	"login": "diana",
	"role": "hitchhiker"
	},
	{
	"login": "mjusta",
	"role": "student_council"
	}
],
"council": []
}
```



# Milestone 7 — Accessibility & Internationalization



## Goal



Make the application accessible and multilingual.



## Covered Modules



| Module | Points |
|-|-:|
| Internationalization | 1 |
| WCAG Accessibility | 2 |



## Issues



### Internationalization

- [ ] Setup i18n framework
- [ ] Language selector
- [ ] English translation
- [ ] Czech translation
- [ ] Spanish translation
- [ ] Translate all user-facing content



### Accessibility

- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] ARIA labels
- [ ] Focus management
- [ ] Contrast improvements
- [ ] WCAG testing



---



# Milestone 8 — Security & Administration



## Goal



Prepare the application for secure usage.



## Covered Modules



| Module | Points |
|-|-:|
| Advanced Permissions | 2 |



## Issues



### Permissions

- [ ] Complete role system
- [ ] Admin permissions
- [ ] Moderator permissions
- [ ] Protected routes
- [ ] Permission testing



### Security

- [ ] API security
- [ ] Rate limiting
- [ ] Input validation
- [ ] Security headers
- [ ] Secret management
- [ ] Audit logs



---



# Milestone 9 — Testing & Deployment



## Goal



Prepare a stable version for evaluation.



## Issues



### Testing

- [ ] Backend unit tests
- [ ] Frontend tests
- [ ] API integration tests
- [ ] Permission tests
- [ ] Security tests
- [ ] Performance tests



### Deployment

- [ ] Production Docker setup
- [ ] Production environment variables
- [ ] Database migration strategy
- [ ] Backup strategy
- [ ] Logging system
- [ ] Monitoring



---



# Milestone 10 — Final Polish & Demo



## Goal



Prepare the final evaluation version.



## Issues



### UI Polish

- [ ] Loading states
- [ ] Empty states
- [ ] Error handling
- [ ] Responsive design
- [ ] Final UX improvements



### Documentation

- [ ] Update README
- [ ] Update architecture documentation
- [ ] Update API documentation
- [ ] Create demo scenario



### Evaluation Preparation

- [ ] Verify every claimed module
- [ ] Prepare presentation
- [ ] Prepare evaluator workflow
- [ ] Final bug fixing



---



# Final Project Estimate



| Item | Amount |
|-|-:|
| GitHub Milestones | 10 |
| Estimated Issues | 100–140 |
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
| M6 | Search |
| M7 | Accessibility & Internationalization |
| M8 | Security & Administration |
| M9 | Testing & Deployment |
| M10 | Final Polish & Demo |