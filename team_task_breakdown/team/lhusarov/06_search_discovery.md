# Milestone 6 — Search & Discovery System

**Assigned to:** Lenka (lhusarov)

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

## Lenka's issues in this milestone, in build order

### 1. Create People Search API

**Your role:** Backend

**Also touches this issue:** Martin (Backend)

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
