# Risks

**Status:** Draft for team review
**Owner:** rkravche, IT Architect
**Last updated:** October 23, 2026

---

## Purpose

This is a simple list of things that could go wrong with Transcendence. Each row says what the problem is, how bad it would be, and what we do about it. When the API Plan (§3) decides a question, the risk moves down to "Closed".

## Risk register

| ID | What could go wrong | How bad? | How likely? | What to do about it |
|---|---|---|---|---|
| R1 | Our poll design keeps votes fully anonymous, but that means if someone disputes the results, we have no way to check or recount them. | High | Medium | Team needs to decide: is full anonymity worth losing the ability to double check results? Still open (api-plan §3.2). |
| R2 | We keep a hidden record of who sent each anonymous council message, just in case of abuse. If that "reveal sender" feature isn't locked down tightly, the anonymity promise to students breaks. | High | Low | Only Admins can use it, they must write a reason, and every use is audit-logged (api-plan §10.6). Keep tests on all three. |
| R4 | We'll need a shared secret key to talk to the 42 API. If it's not clearly someone's job to protect it, it could leak. | High | Low | Keep it only in `.env` files (never in git), give one person clear ownership, and rotate it now and then. |
| R7 | Two tutors picking the same request at once are kept apart by an atomic conditional update (schema §4.2), not by a database index. If someone rewrites a transition as read, modify, then `save()`, double-booking can happen. | High | Low | The rule is in `AGENTS.md`; the concurrency tests must keep passing, and reviews reject read-then-save on request status. |
| R8 | Announcements and Polls aren't approved features yet, but they're already designed in the schema. Someone could start building them too early. | Medium | Medium | Don't merge code for these tables until the team formally says "yes, build this." |

## Closed risks

| ID | Risk | Closed by |
|---|---|---|
| R3 | Hitting the 42 Intra API rate limit with tutor sync. | There is no sync: eligibility is fully manual (api-plan R1). |
| R5 | No rule for when a tutor qualifies before auto-approval. | There is no auto-approval: a Head Tutor reviews every eligibility request (api-plan R1, §7.2). |
| R6 | GDPR confirmation emails we had not planned for. | The GDPR module is out of scope and the app sends no email (api-plan R12). |
| R9 | What happens to the student's other suggested times once a slot is picked. | Students do not offer slots; the Hitchhiker proposes one (api-plan R16). |
| R10 | Tailwind CSS or plain CSS undecided. | The frontend uses plain CSS (`frontend/src/styles/`). |
