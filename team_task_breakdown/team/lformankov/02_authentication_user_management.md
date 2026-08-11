# Milestone 2 — Authentication & User Management

**Assigned to:** Lada (lformankov)

## Milestone Goal (context)

Allow users to securely access the platform and manage their profiles.

After this milestone:

- Users can register and authenticate.
- Users can connect their 42 account.
- User profiles exist.
- Roles and permissions foundation exists.

## Lada's issues in this milestone, in build order

### 1. Implement User Registration

**Your role:** Form-to-API integration

**Also touches this issue:** Martin (Backend endpoint), Lenka (Backend endpoint), Diana (Registration form UI)

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

### 2. Implement Authentication System

**Your role:** Integration

**Also touches this issue:** Martin (Backend session/login), Lenka (Backend session/login), Diana (Login page UI)

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

### 3. Create User Profile System

**Your role:** Integration

**Also touches this issue:** Martin (Backend), Lenka (Backend), Diana (Profile page UI)

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

### 4. Create Role-Based Frontend Navigation

**Your role:** Integration with permission API

**Also touches this issue:** Diana (Frontend)

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

---

# Milestone 2 Completion Criteria

Milestone is completed when:

- [ ] Users can register
- [ ] Users can login/logout
- [ ] 42 OAuth works
- [ ] Profiles exist
- [ ] Avatars work
- [ ] Roles exist
- [ ] Permission system foundation exists
