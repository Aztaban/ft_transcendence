# Milestone 2 — Authentication & User Management

**Assigned to:** Lenka (lhusarov)

## Milestone Goal (context)

Allow users to securely access the platform and manage their profiles.

After this milestone:

- Users can register and authenticate.
- Users can connect their 42 account.
- User profiles exist.
- Roles and permissions foundation exists.

## Lenka's issues in this milestone, in build order

### 1. Implement user profile data

**Your role:** API-facing fields

**Also touches this issue:** Roman (DB model & migration), Martin (API-facing fields)

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

### 2. Implement User Registration

**Your role:** Backend endpoint

**Also touches this issue:** Martin (Backend endpoint), Diana (Registration form UI), Lada (Form-to-API integration)

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

### 3. Implement Authentication System

**Your role:** Backend session/login

**Also touches this issue:** Martin (Backend session/login), Diana (Login page UI), Lada (Integration)

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

### 4. Implement 42 OAuth Authentication

**Your role:** Backend OAuth flow

**Also touches this issue:** Martin (Backend OAuth flow), Roman (Provider config/infra)

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

### 5. Create User Profile System

**Your role:** Backend

**Also touches this issue:** Martin (Backend), Diana (Profile page UI), Lada (Integration)

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

### 6. Implement Avatar Upload System

**Your role:** Backend upload endpoint

**Also touches this issue:** Martin (Backend upload endpoint), Diana (UI), Roman (File storage infra)

## Description

Allow users to upload and manage profile images.

## Checklist

- [ ] Create avatar storage system
- [ ] Create upload endpoint
- [ ] Validate uploaded files
- [ ] Add default avatar
- [ ] Display avatar in UI

## Acceptance Criteria

- Users can upload avatars.
- Invalid files are rejected.
- Default avatar works.

---

### 7. Create Role System

**Your role:** Backend

**Also touches this issue:** Martin (Backend)

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

### 8. Implement Permission Middleware

**Your role:** Backend

**Also touches this issue:** Martin (Backend)

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
