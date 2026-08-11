# Milestone 2 — Authentication & User Management

**Assigned to:** Roman (rkravche)

## Milestone Goal (context)

Allow users to securely access the platform and manage their profiles.

After this milestone:

- Users can register and authenticate.
- Users can connect their 42 account.
- User profiles exist.
- Roles and permissions foundation exists.

## Roman's issues in this milestone, in build order

### 1. Implement user profile data

**Your role:** DB model & migration

**Also touches this issue:** Martin (API-facing fields), Lenka (API-facing fields)

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

### 2. Implement 42 OAuth Authentication

**Your role:** Provider config/infra

**Also touches this issue:** Martin (Backend OAuth flow), Lenka (Backend OAuth flow)

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

### 3. Implement Avatar Upload System

**Your role:** File storage infra

**Also touches this issue:** Martin (Backend upload endpoint), Lenka (Backend upload endpoint), Diana (UI)

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
