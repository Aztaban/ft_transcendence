# Privacy and GDPR

Status: placeholder / bonus module target  
Owner: TBD  
Last updated: TBD

## Purpose

Define privacy expectations, stored data, and possible GDPR-style features.

This app may store personal data from 42 users, so this must be handled carefully.

## Required public pages

The project must include accessible:

- Privacy Policy
- Terms of Service

These pages must be real and relevant to the project, not placeholders.

## Data inventory draft

| Data | Source | Reason | Public? |
|---|---|---|---|
| Intra login | 42 OAuth/API | Identify user | Maybe, based on profile settings |
| Email | 42 OAuth or email auth | Login/contact | No |
| Avatar | 42 OAuth or upload | Profile | Maybe |
| Roles | Admin/head tutor | Permissions | No/public badges maybe |
| Tutor bio | User/admin | Public profile | Yes if public |
| Location/status | User/tutor | Availability | Yes for tutors |
| Evaluation slots | Student/tutor | Evaluation flow | Private/role-based |
| Suggestions | Public/user | Feedback | Private to council/admin |
| Announcements | Council/admin | Public communication | Yes |
| Logs/metrics | System | Debug/monitoring | No |

## Data minimization

Store only what is needed.

Avoid storing:

- 42 OAuth access tokens long-term unless necessary
- sensitive private messages
- unnecessary personal details
- raw IP addresses unless needed for security/logging
- passwords in any form except secure hashes

## User privacy features draft

If claiming GDPR/privacy module:

- user can request/export their data
- user can request account deletion
- user gets confirmation before deletion
- deleted/anonymized data is handled consistently
- admin can process deletion/export requests
- confirmation notification or email is sent

## Export format draft

Possible export:

```json
{
  "user": {
    "id": "...",
    "intra_login": "...",
    "email": "..."
  },
  "profile": {
    "display_name": "...",
    "bio": "..."
  },
  "evaluation_slots": [],
  "suggestions": [],
  "notifications": []
}
```

## Deletion/anonymization questions

Some data may be needed for integrity.

Open questions:

- Should completed evaluation slots be deleted or anonymized?
- Should public announcements remain if author deletes account?
- Should anonymous suggestions be fully deleted?
- Should admin audit logs keep user id?

Possible approach:

- delete profile data
- anonymize historical records
- keep system integrity where needed

## Logging privacy

Never log:

- passwords
- OAuth tokens
- private suggestion content
- full personal data exports
- session cookies

## Open decisions

- Do we implement real deletion, anonymization, or both?
- Do we send confirmation by email or in-app notification?
- What is the retention policy for logs?
- Who can see suggestions?
