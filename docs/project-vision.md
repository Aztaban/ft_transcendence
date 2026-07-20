# Project Vision

**Working title:** 42 Prague Evaluations  
**Status:** Draft for team review  
**Document owner:** mjusta, Product Owner  
**Last updated:** July 20, 2026

---

## 1. Purpose of this document

This document defines the product vision, target users, product goals, high-level scope, user experience direction, success criteria, and current module direction for 42 Prague Evaluations.

---

## 2. Product summary

42 Prague Evaluations is a web platform for coordinating student evaluations and providing additional tools for tutors and the Student Council.

The primary purpose of the platform is to replace the current fragmented process of arranging evaluations manually or through a Slack bot.

Students should be able to request an evaluation and provide their availability. Eligible tutors should be able to find those requests, claim a suitable time, and coordinate the evaluation through one clear workflow.

The platform should also provide supporting tools for tutors and Student Council members, including profiles, announcements, notifications, resources, polls and role-specific administration.

The product should be useful to the 42 Prague community beyond the completion of the `ft_transcendence` project.

---

## 3. Vision statement

We want to create a single, reliable platform where 42 Prague students can arrange evaluations without depending on manual coordination or scattered Slack conversations.

The platform should make it clear:

- which students are looking for an evaluation,
- which tutors are eligible and available,
- whether an evaluation has been claimed,
- when an evaluation is scheduled,
- what actions are required from each participant,
- and where relevant community information can be found.

In addition to evaluation coordination, the platform should give tutors and the Student Council practical tools for communicating with students and managing information relevant to their responsibilities.

The final product should feel like one coherent community platform rather than a collection of unrelated module demonstrations.

---

## 4. Problem statement

The current evaluation coordination process may require students and tutors to use manual communication, Slack messages, or a Slack bot.

This can create several problems:

- Evaluation requests can be difficult to discover.
- Tutors may need to search through messages to find students who need evaluations.
- Multiple tutors may attempt to respond to the same request.
- Scheduling changes may not reach everyone clearly.
- Important information may be spread across several channels.
- Students may not know which tutors can evaluate a particular project.
- Tutor resources and Student Council information may not have one consistent location.
- Important announcements may be missed in busy communication channels.

The Student Council may also lack a dedicated place for:

- publishing announcements,
- presenting current council members,
- collecting student feedback,
- creating polls,
- and receiving messages intended for the council.

---

## 5. Product opportunity

The project creates an opportunity to centralize several related community activities in one application.

The platform can provide:

1. A clear evaluation-request workflow for students and tutors.
2. A structured notification system for important actions and changes.
3. A central place for tutor information and resources.
4. A communication space for the Student Council.
5. Role-based tools appropriate to each user.
6. Public information that helps users understand the platform before logging in.
7. A product that can continue to provide value after the school project is evaluated.

The evaluation workflow remains the primary product capability. Tutor and Student Council tools support the platform but should not delay delivery of the core evaluation workflow.

---

## 6. Target users

### 6.1 Public visitor

A public visitor may want to understand:

- what the platform is,
- how evaluations are coordinated,
- what tutors do,
- what the Student Council does,
- who the current Student Council members are,
- and how to access the authenticated platform.

### 6.2 Student

A student needs to:

- authenticate securely,
- request an evaluation,
- identify the project for which an evaluation is needed,
- provide one or more available time slots,
- see whether a tutor has accepted the request,
- receive notifications about changes,
- cancel or update a request when permitted,
- access tutor information and relevant resources,
- read Student Council announcements,
- participate in eligible polls,
- and contact the Student Council where appropriate.

### 6.3 Tutor

A tutor needs to:

- maintain relevant profile information,
- identify which projects they can evaluate,
- find students currently looking for evaluations,
- filter requests by project or availability,
- claim an available evaluation slot,
- avoid conflicts with requests already claimed by another tutor,
- release or cancel a claim when permitted,
- receive notifications about relevant requests and changes,
- and access or manage tutor resources according to their permissions.

### 6.4 Head Tutor

A Head Tutor may need to:

- oversee the evaluation workflow,
- manage tutor-related information,
- manage tutor eligibility for projects,
- review evaluation demand,
- manage tutor resources,
- resolve exceptional situations,
- and access relevant administrative information.

The exact difference between Tutor and Head Tutor permissions must be defined in the roles and permissions document.

### 6.5 Student Council member

A Student Council member needs to:

- maintain Student Council information,
- publish announcements,
- create and manage polls,
- receive messages intended for the Student Council,
- manage their public council profile where appropriate,
- and receive notifications about new messages or relevant platform activity.

### 6.6 Administrator

An administrator needs to:

- manage users and assigned roles,
- manage platform-level content,
- resolve permission or account problems,
- moderate information where necessary,
- and maintain appropriate administrative control over the application.

### 6.7 Multiple-role users

A single person may hold more than one role.

For example, a user may be both:

- a student and tutor,
- a student and Student Council member,
- a tutor and Head Tutor,
- or a Student Council member and administrator.

The product must therefore support users with multiple assigned roles without requiring separate accounts.

---

## 7. Product goals

### Goal 1: Simplify evaluation coordination

Students should be able to request evaluations without manually searching for tutors or coordinating through disconnected messages.

### Goal 2: Give tutors a clear evaluation queue

Tutors should be able to see relevant evaluation requests, understand student availability, and claim requests through a structured process.

### Goal 3: Prevent ambiguous scheduling

The product should clearly show whether an evaluation request is open, claimed, scheduled, changed, cancelled, or completed.

Only one tutor should be able to claim a particular evaluation slot successfully.

### Goal 4: Provide timely information

Users should receive clear notifications about events that require their attention.

### Goal 5: Support role-specific work

Students, tutors, Head Tutors, Student Council members, and administrators should see tools and navigation relevant to their responsibilities.

### Goal 6: Improve community communication

The Student Council should have a clear way to publish information, create polls, and receive student messages.

### Goal 7: Remain useful after project completion

The platform should be designed as a usable community product, not only as a demonstration created to satisfy module requirements.

---

## 8. Product principles

### 8.1 Evaluation workflow first

The complete evaluation-request and scheduling workflow has priority over secondary features.

### 8.2 One clear source of information

A user should not need to search through multiple channels to understand the current state of an evaluation request.

### 8.3 Role-based, not account-based

Users should receive capabilities based on their assigned roles. A user with multiple roles should not need multiple accounts.

### 8.4 Important changes must be visible

Requests, claims, cancellations, schedule changes, announcements, polls, and messages should produce appropriate visible feedback or notifications.

### 8.5 Privacy by default

Private evaluation details, personal notifications, messages, voting participation, and administrative functions should not be publicly exposed.

### 8.6 Public information should have a clear purpose

Information should be public only when public visibility provides a clear benefit and does not create an unnecessary privacy concern.

### 8.7 Selected modules must support the product

Modules should be selected because they strengthen the intended product experience. They should not appear as disconnected technical demonstrations.

### 8.8 The product should handle failure clearly

Conflicting claims, cancelled evaluations, invalid actions, expired requests, unavailable users, and permission problems should result in understandable feedback.

---

## 9. Core product scope

### 9.1 Authentication and user access

The product will provide secure authentication.

After authentication, users will access features according to their assigned roles and permissions.

Authentication-related product requirements include:

- secure login and logout,
- persistent user identity,
- profile access,
- role-based permissions,
- support for multiple roles,
- and protection of private or role-restricted content.

The exact authentication method is an architectural and subject-compliance decision. The product should support authentication through 42 OAuth 2.0 in addition to any mandatory authentication method required by the applicable subject.

---

### 9.2 Evaluation requests

A student should be able to create an evaluation request containing information such as:

- the project requiring evaluation,
- relevant availability,
- optional explanatory information,
- and the current request status.

The precise required fields will be defined in the evaluation workflow requirements.

A student should be able to:

- create a request,
- review its status,
- update it when permitted,
- cancel it when permitted,
- and see which tutor accepted it.

---

### 9.3 Tutor evaluation queue

Eligible tutors should be able to view relevant open requests.

Tutors should be able to:

- search or filter available requests,
- open request details,
- select an available time,
- claim the evaluation,
- see their scheduled evaluations,
- and cancel or release a claim when permitted.

The product must prevent two tutors from successfully claiming the same evaluation slot.

---

### 9.4 Evaluation status

The evaluation workflow should use clear statuses.

High-level statuses include:

- Open
- Claimed
- Scheduled
- Changed
- Cancelled
- Completed

---

### 9.5 Tutor tools

The platform may provide tutors with:

- tutor profiles,
- project eligibility information,
- current availability or status,
- evaluation-request filters,
- scheduled evaluation overview,
- notifications,
- project resources,
- and relevant administrative tools.

Tutor tools must directly support the work of tutors and should not become a general-purpose project-management system.

---

### 9.6 Student Council tools

The platform may provide the Student Council with:

- a description of the Student Council,
- a list of current Student Council members,
- member information,
- an announcement board,
- audience controls for announcements,
- voting polls,
- a Student Council inbox,
- a suggestion or feedback channel,
- and notifications about new messages or relevant activity.

Polls should require authentication so the product can determine eligibility and prevent duplicate voting.

The exact rules for anonymous voting, result visibility, poll eligibility, and vote retention remain open product decisions.

---

### 9.7 Announcements

Announcements may support different audiences.

Possible visibility options include:

- Students
- Tutors
- Student Council members

---

### 9.8 Notifications

The platform should include a notification centre.

Possible notifications include:

| Event                             | Primary recipient                |
| --------------------------------- | -------------------------------- |
| New relevant evaluation request   | Eligible tutors                  |
| Evaluation request claimed        | Requesting student               |
| Evaluation scheduled              | Student and tutor                |
| Evaluation changed                | Student and tutor                |
| Evaluation cancelled              | Student and tutor                |
| New Student Council announcement  | Intended announcement audience   |
| New voting poll                   | Eligible voters                  |
| New Student Council inbox message | Student Council members          |
| Role or permission changed        | Affected user                    |
| Relevant administrative action    | Affected users or administrators |

Notifications should show enough information for the user to understand what happened and navigate to the relevant item.

The final notification list will be defined in a separate product requirements document.

---

### 9.9 Search

The authenticated application should provide search appropriate to the product.

Search may include:

- tutors,
- evaluation requests,
- projects,
- announcements,
- and Student Council information.

Search results must respect the user’s permissions. Users should not discover private content through search.

---

## 10. Product experience direction

### 10.1 Public experience

The recommended direction is to provide a limited public area that explains the purpose of the platform.

Proposed public content:

- product introduction,
- explanation of the evaluation process,
- description of tutors,
- description of the Student Council,
- current Student Council member list, subject to consent,
- selected public announcements,
- privacy information,
- and terms of service.

Private, personal, and interactive functions should require authentication.

---

### 10.2 Authenticated application

After authentication, the user should enter a role-aware application workspace.

The shared application layout is expected to include:

#### Top bar

- platform logo,
- global search,
- notifications,
- user profile access,
- profile settings,
- and logout.

#### Left navigation

- active role,
- role switcher when the user has multiple roles,
- and navigation appropriate to the active role.

#### Main content area

The main content area should display pages and actions relevant to the selected role.

Switching roles should change the available navigation and working context without requiring the user to log out.

The exact visual design and component structure will be prepared separately.

---

## 11. Key user journeys

### 11.1 Student requests an evaluation

1. The student logs in.
2. The student opens the evaluation-request area.
3. The student selects the relevant project.
4. The student provides one or more available times.
5. The student submits the request.
6. Eligible tutors can discover the request.
7. The student can see the current status.

### 11.2 Tutor claims an evaluation

1. The tutor logs in or switches to the Tutor role.
2. The tutor opens the evaluation queue.
3. The tutor filters requests by project or availability.
4. The tutor opens a suitable request.
5. The tutor selects an available time.
6. The tutor claims the evaluation.
7. The request is no longer available for another tutor to claim for the same slot.
8. The student and tutor receive confirmation.

### 11.3 Evaluation changes

1. A student or tutor requests a permitted change.
2. The product updates the evaluation status.
3. The other participant receives a notification.
4. The product clearly shows the updated information.
5. If necessary, the request returns to the open evaluation queue.

Detailed cancellation and rescheduling rules remain to be defined.

### 11.4 Student Council publishes an announcement

1. A Student Council member opens the announcement area.
2. The member creates an announcement.
3. The member selects the intended audience.
4. The announcement is published.
5. Relevant users receive a notification.
6. The announcement appears in the appropriate announcement area.

### 11.5 Student participates in a poll

1. An authenticated student opens an eligible poll.
2. The student reviews the question and available choices.
3. The student submits one vote.
4. The system prevents duplicate voting.
5. Results are displayed according to the poll’s visibility rules.

### 11.6 User switches roles

1. A user with multiple roles opens the role switcher.
2. The user selects another assigned role.
3. Navigation and available actions update.
4. The user continues within the same account.

---

## 12. Public versus authenticated content

### Proposed product decision

The recommended approach is a hybrid model:

#### Public

- General product information
- Explanation of evaluations
- Description of tutors
- Description of the Student Council
- Public Student Council member information, with appropriate consent
- Announcements explicitly marked as public
- Privacy Policy
- Terms of Service

#### Authentication required

- Evaluation requests
- Evaluation schedules
- Personal notifications
- Tutor evaluation queue
- Poll participation
- Internal announcements
- Student Council inbox
- User profiles containing non-public information
- Role-specific tools
- Administration

---

## 13. High-level scope priorities

### Priority 1: Essential product

- Authentication
- User roles and permissions
- Student evaluation requests
- Tutor evaluation queue
- Safe evaluation claiming
- Evaluation status
- Evaluation notifications
- Basic user profiles
- Role-aware navigation
- Basic administration

### Priority 2: Supporting product capabilities

- Tutor profiles and project eligibility
- Tutor resources
- Student Council member information
- Student Council announcements
- Student Council inbox
- Search
- Additional notification types

### Priority 3: Extended capabilities

- Voting polls
- Public pages
- Audience-specific announcements
- Anonymous or signed suggestions
- Advanced reporting
- Data export and account deletion
- Additional languages
- Operational dashboards

The final MVP boundary will be defined in `mvp.md`.

---

## 14. Current module direction

The final selected `ft_transcendence` modules must be confirmed before the Architect finalizes the architecture.

The current product suggests a need for capabilities related to:

| Capability                      | Product reason                                                      | Module     |
| ------------------------------- | ------------------------------------------------------------------- | ---------- |
| Frontend and backend frameworks | Required for the web platform                                       | Major - 2p |
| Real-time features              | Requests, claims, changes, and notifications should update promptly | Major - 2p |
| Remote authentication with 42   | Implement remote authentication with OAuth 2.0                      | Minor - 1p |
| Advanced permissions            | Multiple roles require protected role-specific actions              | Major - 2p |
| Complete notifications          | Central to evaluations and council communication                    | Minor - 1p |
| Advanced search                 | Helps users find tutors, requests and announcements                 | Minor - 1p |
| File upload and management      | Supports tutor resources and announcement attachments               | Minor - 1p |
| Multiple languages              | Could support the international campus community (EN, CZ, ES)       | Minor - 1p |
| Monitoring and dashboards       | Monitoring system with Prometheus and Grafana                       | Major - 2p |
| GDPR-related controls           | Supports export, deletion, and privacy expectations                 | Minor - 1p |
| Use an ORM for the database     | Supports consistent persistence through an ORM                      | Minor - 1p |

| Bonus                    | Product reason                                                   | Module                |
| ------------------------ | ---------------------------------------------------------------- | --------------------- |
| Standard user management | Update user info, avatar, friends and their status, profile page | Major - 2p            |
| 2FA                      | Increased account security                                       | Major - verify points |
| User interaction         | basic chat, profile system, friends system                       | Major - 2p            |

The Product Owner is responsible for confirming:

- which modules are committed,
- which are stretch goals,
- why they support the product,
- and which user-visible outcome proves each module.

The Architect is responsible for assessing feasibility, dependencies, risks, and architectural impact.

The Scrum Master is responsible for incorporating the approved modules into milestones and delivery planning.

---

## 15. Success criteria

The product will be considered successful when:

1. A student can create an evaluation request without using Slack or manually contacting multiple tutors.
2. Eligible tutors can discover relevant evaluation requests.
3. A tutor can claim an available evaluation time.
4. Two tutors cannot successfully claim the same evaluation slot.
5. The student and tutor can clearly see the evaluation’s current state.
6. Important evaluation changes produce appropriate notifications.
7. Users can have multiple roles and switch between role-specific contexts.
8. Unauthorized users cannot access protected actions or information.
9. Student Council members can publish announcements to an intended audience.
10. Eligible users can participate in polls if polls are included in the approved scope.
11. The application provides a consistent and understandable navigation experience.
12. The product can be demonstrated through complete user journeys rather than isolated features.
13. Every selected module has a clear product purpose and demonstrable outcome.
14. The product satisfies the mandatory requirements of the applicable `ft_transcendence` subject.
15. The team can explain the product goals, chosen scope, and major decisions consistently.

---

## 16. Product constraints

- The product must satisfy the applicable `ft_transcendence` subject.
- The evaluation workflow is the highest product priority.
- Private information must be protected by authentication and permissions.
- Users may have multiple roles.
- Selected modules must be confirmed before the architecture is finalized.
- The platform must remain understandable to users unfamiliar with its internal implementation.
- Product requirements should describe expected behaviour rather than prescribe technical solutions.
- Features that introduce significant complexity must not endanger completion of the essential evaluation workflow.
- Public information involving identifiable people must respect privacy and consent.

---

## 17. Related Product Owner documents

This vision should be supported by the following Product Owner documents:

- `mvp.md`
- `module-selection.md`
- `evaluation-workflow.md`
- `roles-and-permissions.md`
- `product-experience.md`
- `privacy-requirements.md`

The documents should answer different questions:

| Document                   | Main question                                              |
| -------------------------- | ---------------------------------------------------------- |
| `project-vision.md`        | What are we building and why?                              |
| `mvp.md`                   | What is the smallest complete version?                     |
| `module-selection.md`      | Which modules are committed and why?                       |
| `evaluation-workflow.md`   | How should the evaluation process behave?                  |
| `roles-and-permissions.md` | Who may see and do what?                                   |
| `product-experience.md`    | Which pages, navigation, and user-facing areas are needed? |
| `privacy-requirements.md`  | What privacy behaviour must the product provide?           |

---

## 18. Handover to the IT Architect

The IT Architect should use this vision together with the supporting Product Owner documents to design a solution that supports:

- multiple roles per user,
- protected role-specific actions,
- evaluation requests and availability,
- safe tutor claiming,
- notifications,
- announcements,
- polls if approved,
- search,
- public and authenticated content if approved,
- and the final selected modules.

The Architect should identify:

- technical risks,
- missing product decisions,
- architectural consequences of selected modules,
- security and privacy concerns,
- external service dependencies,
- and capabilities that may need to be reduced or postponed.

Technical design decisions should not silently change the product scope. Any required product compromise should be returned to the Product Owner for an explicit decision.

---

## 19. Handover to the Scrum Master

The Scrum Master should use the approved vision, MVP, module selection, and architectural plan to prepare:

- product milestones,
- delivery phases,
- issue structure,
- dependencies,
- team coordination,
- decision tracking,
- risk tracking,
- and progress reporting.

The Scrum Master should ensure that the essential evaluation workflow is planned before secondary Student Council or bonus capabilities.

Changes to product priorities should be agreed with the Product Owner. Changes to technical sequencing should be coordinated with the IT Architect.

---

## 20. Vision summary

The 42 Prague Evaluations will provide one structured place for coordinating student evaluations and supporting the work of tutors and the Student Council.

Its primary value is replacing a fragmented manual or Slack-based evaluation process with a clear workflow that connects students and tutors.

The product should make requests discoverable, prevent conflicting claims, communicate schedule changes, and give every user a clear understanding of what happens next.

Tutor resources, Student Council announcements, polls, messages, public information, and other supporting tools should strengthen this core purpose without putting successful delivery of the evaluation workflow at risk.
