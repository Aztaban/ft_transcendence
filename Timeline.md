# Project Timeline & Milestone Deadlines

**Project:** ft_transcendence
**Window:** Tuesday, September 1, 2026 → Sunday, November 15, 2026 (2.5 months / 76 days)

Structured as two phases:

1. **Full development — 2 months (Sep 1 – Oct 31):** M1 through M8, all feature work. M7 runs in parallel with M3–M6 rather than taking its own slot.
2. **Testing & bug-fixing — half a month (Nov 1 – Nov 15):** M9 (Testing & Deployment) and M10 (Final Polish & Demo), compressed into two weeks with no new feature work.

Durations within the development phase are weighted by scope, not divided evenly — M3 (Core Evaluation, the critical path) still gets by far the largest share.

## Assumptions

- Full-time team of 5, working the sequence described in `WORK_ORDER.md`.
- M7 (Accessibility & i18n) runs **in parallel** with M3–M6, picked up by Lada and Diana alongside their other work — it doesn't extend the development phase.
- No holidays/vacations are subtracted here — adjust dates around any known team time off.
- **This schedule has no built-in slack**, and the testing window is now noticeably tighter than before (2 weeks instead of ~3). See "Buffer & Risk" below.

## Phase 1 — Full Development (Sep 1 – Oct 31, 61 days)

| # | Milestone | Duration | Start | Deadline | Leads (per WORK_ORDER.md) |
|---|---|---|---|---|---|
| M1 | Project Foundation & Infrastructure | 6 days | Tue, Sep 1 | **Sun, Sep 6** | Roman → Diana/Martin/Lenka/Lada |
| M2 | Authentication & User Management | 9 days | Mon, Sep 7 | **Tue, Sep 15** | Roman → Martin & Lenka → Diana → Lada |
| M3 | Core Evaluation System | 17 days | Wed, Sep 16 | **Fri, Oct 2** | Martin & Lenka (chain) → Diana → Lada |
| M4 | Real-Time System | 9 days | Sat, Oct 3 | **Sun, Oct 11** | Roman → Martin & Lenka → Lada → Diana |
| M5 | Communication & Notifications | 6 days | Mon, Oct 12 | **Sat, Oct 17** | Martin & Lenka → Lada → Diana |
| M6 | Search & Discovery System | 6 days | Sun, Oct 18 | **Fri, Oct 23** | Martin & Lenka → Diana → Lada |
| M7 | Accessibility & Internationalization | *(parallel, Sep 16 – Oct 23)* | Wed, Sep 16 | **Fri, Oct 23** (soft) | Lada → Diana, alongside M3–M6 |
| M8 | Security & Administration | 8 days | Sat, Oct 24 | **Sat, Oct 31** | Martin & Lenka + Roman → Diana |

**Development phase ends: Saturday, October 31.** By this point every confirmed feature should be functionally complete — this is not "code freeze with a few loose ends," since there's no slack afterward to finish features during the testing window.

## Phase 2 — Testing & Bug-Fixing (Nov 1 – Nov 15, 15 days)

| # | Milestone | Duration | Start | Deadline | Leads |
|---|---|---|---|---|---|
| M9 | Testing & Deployment | 8 days | Sun, Nov 1 | **Sun, Nov 8** | Martin & Lenka (backend tests) + Diana/Lada (frontend tests) → Roman (deploy) |
| M10 | Final Polish & Demo | 7 days | Mon, Nov 9 | **Sun, Nov 15** | Diana & Lada (polish) → whole team (docs, demo prep) |

This phase is explicitly **no new features** — it's test coverage, fixing whatever the tests (and each other) find, deploying, and getting the demo rehearsed. If a feature isn't working by Oct 31, the plan for Phase 2 is to fix or descope it, not to finish building it.

## Timeline at a Glance

```
Sep                          Oct                            Nov
1  6  15                     2  11 17 23  31                8   15
├M1─┤
   ├──M2──┤
         ├─────────M3─────────┤
         ├──M7 (parallel)──┤
                            ├──M4──┤
                                ├M5─┤
                                   ├M6─┤
                                       ├──M8──┤
─────────────── development ───────────────│──── testing & bug-fixing ────│
                                            ├──M9──┤
                                                   ├──M10──┤
```
