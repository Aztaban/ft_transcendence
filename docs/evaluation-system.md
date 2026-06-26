# Evaluation System

Status: draft  
Owner: TBD  
Last updated: TBD

## Goal

Create an evaluation-request flow inspired by 42 Intra evaluations, but with opposite logic:

- the evaluatee creates availability
- the tutor claims a slot

This should help students find tutors when they are ready for evaluation.

## Important dependency

The project should check whether a student is actually eligible/ready for evaluation using 42 API if possible.

Open question:

- Can we get project status from 42 API?
- Can we know that a project is marked for evaluation?
- Can we create real evaluations in Intra?
- Can we only link/notify instead?

Decision: TBD after 42 API research and tutor/staff discussion.

## Main flow

### Student flow

1. Student logs in.
2. Student opens "Request evaluation".
3. App lists projects that can be evaluated.
4. Student chooses project.
5. Student creates one or more availability slots.
6. Slot becomes visible to tutors.
7. Tutor claims slot.
8. Student gets notification.
9. Slot status changes to claimed.
10. Evaluation happens outside or inside the platform depending on final decision.

### Tutor flow

1. Tutor logs in.
2. Tutor sees open evaluation slots.
3. Tutor filters by project/date.
4. Tutor claims a slot.
5. App prevents other tutors from claiming the same slot.
6. Tutor sees claimed slots in dashboard.

### Head tutor/admin flow

1. View all slots.
2. Cancel invalid slots.
3. Reassign/release problematic claims.
4. Manage projects and resources.
5. View evaluation demand analytics.

## Slot statuses

```txt
open
claimed
cancelled_by_student
cancelled_by_tutor
expired
completed
```

## Race condition requirement

Two tutors must not be able to claim the same slot.

Backend should use one of:

- database transaction
- row locking
- atomic update with status condition
- unique constraint for claimed slot

Example logic:

```txt
UPDATE evaluation_slot
SET status = 'claimed', claimed_by_id = :tutor_id
WHERE id = :slot_id
AND status = 'open';
```

If affected rows = 0, claim failed because someone else already claimed it.

## Data fields draft

### EvaluationSlot

| Field | Notes |
|---|---|
| id | primary key |
| student_id | user who wants evaluation |
| project_id | local project reference |
| starts_at | start time |
| ends_at | end time |
| status | open/claimed/cancelled/etc. |
| claimed_by_id | tutor user id, nullable |
| student_note | optional |
| tutor_note | optional |
| created_at | timestamp |
| updated_at | timestamp |

## Notifications

Trigger notifications when:

- slot is created
- slot is claimed
- slot is cancelled
- slot is close to start time
- tutor releases slot
- head tutor/admin modifies slot

## MVP limitations

MVP can stop at internal slot claiming. Real Intra evaluation creation is optional/research.
