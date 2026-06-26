# MVP

Status: draft  
Owner: TBD  
Last updated: TBD

## MVP goal

Create the smallest complete version of the Tutor & Counsellor Hub that proves the product idea and validates the main ft_transcendence requirements.

## MVP feature list

### Public pages

- Home page with project description
- Tutors / Hitchhikers description
- Public tutor list
- Counsellor description/list
- Student Council description
- Student Council member list
- Student Council announcement board
- Suggestion box:
  - anonymous public suggestion
  - logged-in suggestion with optional intra login visibility

### Authentication

- Basic email/password authentication if required by subject validation
- 42 OAuth login
- Session/token handling
- Logout
- Protected routes

### User roles

Roles are not mutually exclusive.

Initial roles:

- student
- tutor
- head_tutor
- counsellor
- student_council
- admin

### Tutor/counsellor profiles

- name / intra login
- avatar/photo
- short bio
- role badges
- projects/resources assigned
- online/available status
- location/computer text, e.g. `c2r2s2`

### Evaluation request system

Student side:

- choose project
- create availability slot
- write optional note
- see status of own requests

Tutor side:

- see open slots
- claim slot
- cancel/release claim if needed
- see claimed slots

Admin/head tutor side:

- view all requests
- manage projects/resources
- manage roles
- resolve/cancel problematic slots

### Notifications

Minimum:

- student notified when slot is claimed
- tutor/head tutor notified about new slot
- admin/head tutor can see important system events

### Admin/head tutor management

- assign roles
- manage public content
- manage tutor/counsellor/student council profiles
- manage project resources
- manage announcements

## MVP acceptance criteria

- App runs locally with one command.
- Frontend, backend, database, and required services start successfully.
- Latest stable Chrome has no console errors during normal demo.
- HTTPS is used for browser/backend communication.
- Privacy Policy and Terms of Service are accessible and non-empty.
- Multiple users can use the app at the same time without corrupting evaluation slots.
- A tutor cannot claim the same slot twice.
- Two tutors cannot claim the same slot at the same time.
- Unauthorized users cannot access admin/head tutor actions.

## Things deliberately postponed

- Real Intra evaluation creation
- Slack integration
- Email integration
- Advanced analytics
- Grafana dashboards
- GDPR export/delete flow
- Advanced search
- i18n
- PWA
