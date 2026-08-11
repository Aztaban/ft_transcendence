# Milestone 6 — Search & Discovery System

**Assigned to:** Diana (dkolarov)

## Milestone Goal (context)

Allow authenticated users to discover Hitchhikers and Student Council members through a people-focused search.

The search system focuses on discovering:

- Hitchhikers (Tutors)
- Student Council members

The goal is to provide a simple people discovery experience.

After this milestone:

- Students can find available tutors.
- Students can find Student Council members.
- Search results display relevant role information.

## Diana's issues in this milestone, in build order

### 1. Create People Search Interface

**Your role:** UI

**Also touches this issue:** Lada (Integration)

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

### 2. Create User Discovery Profile View

**Your role:** UI

**Also touches this issue:** Lada (Integration)

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

---
