# Risks

**Status:** Draft for team review
**Owner:** rkravche, IT Architect
**Last updated:** July 26, 2026

---

## Purpose

This is a simple list of things that could go wrong with Transcendence if we don't make a decision about them soon. Most of these come straight from open questions already raised in the API Plan — this document just makes them easier to scan, track, and check off one by one.

Each row says: what the problem is, how bad it would be, and what we plan to do about it. Once we make a decision (and write it down as an ADR), we move the risk down to "Closed."

## Risk register

| ID | What could go wrong | How bad? | How likely? | What to do about it |
|---|---|---|---|---|
| R1 | Our poll design keeps votes fully anonymous, but that means if someone disputes the results, we have no way to check or recount them. | High | Medium | Team needs to decide: is full anonymity worth losing the ability to double check results? Write the decision down. |
| R2 | We keep a hidden record of who sent each anonymous council message, just in case of abuse. If that "unmask" feature isn't locked down tightly, the anonymity promise to students breaks. | High | Low | Make sure only Admins can use it, log every time it's used, and double check the team still wants to keep this feature at all. |
| R3 | The 42 Intra API only allows a limited number of requests per hour. If lots of tutors use the sync feature, we might hit that limit. | Medium | Medium | Keep sync opt in (not automatic for everyone) and keep an eye on usage before turning it on for more people. |
| R4 | We'll need a shared secret key to talk to the 42 API. If it's not clearly someone's job to protect it, it could leak. | High | Low | Keep it only in `.env` files (never in git), give one person clear ownership, and rotate it now and then. |
| R5 | We haven't decided exactly what makes a tutor "good enough" to evaluate a project. If this stays vague, we might let unqualified tutors evaluate students. | Medium | Medium | Team needs to pick one rule (e.g. passed the project, or passed with a high mark) before turning on auto-approval. |
| R6 | GDPR rules require us to send confirmation emails, but our MVP wasn't planning to send any emails at all. This means we now need an email-sending setup we hadn't budgeted for. | Medium | High | Use a simple test tool (like Mailcatcher) while developing, and pick a real email provider before launch. |
| R7 | Right now, a database rule stops two tutors from grabbing the same time slot at once. If that rule ever gets accidentally removed or changed, double-booking could happen again. | High | Low | Treat that rule as untouchable any future change to this part of the database needs extra review. |
| R8 | Announcements and Polls aren't approved features yet, but they're already fully designed in our database plans. Someone could accidentally start building them too early. | Medium | Medium | Don't allow any code for these tables to be merged until the team formally says "yes, build this." |
| R9 | When a tutor claims one time slot from a student's request, we haven't decided what happens to the student's other suggested times. | Low | Medium | Decide the rule (most likely: just hide the other times once one is booked) and write it down. |
| R10 | We haven't picked Tailwind CSS or regular CSS yet. If people start coding before this is settled, we'll end up with a messy mix of styles. | Low | Medium | Just make the call soon and write it down so everyone codes the same way. |

## Closed risks

_None yet._