# Contributing to ft_transcendence

This document defines the repository structure and development conventions used by the team. It exists so every teammate works the same way without needing to ask.

**Team:** Diana (dkolarova, Scrum Master), Martin (Aztaban, Product Owner), Roman (webxxcom, IT Architect), Lenka (Lenka1234, Developer), Lada (lformank, Developer — joining frontend work partially from M3).

---

## 1. Repository Structure

Monorepo — one repository where backend and frontend live side by side and are deployed together via Docker Compose.

```text
ft_transcendence/
├── backend/                 # Django + DRF + Channels
│   ├── config/              # Django project settings
│   ├── apps/                # Django apps
│   ├── requirements.txt
│   └── manage.py
├── frontend/                # React + TypeScript
│   ├── src/
│   ├── public/
│   └── package.json
├── docs/                    # Planning & reference documentation
│   ├── architecture.md
│   ├── api-plan.md
│   ├── database-schema.md
│   ├── decisions.md
│   ├── risks.md
│   └── team-roles.md
├── .github/
│   └── workflows/           # CI pipelines
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── README.md
└── CONTRIBUTING.md
```

### Rules

- Backend-specific code lives under `backend/`.
- Frontend-specific code lives under `frontend/`.
- Shared planning and reference documentation belongs under `docs/`.
- Every new Django app gets its own subfolder under `backend/apps/`.
- Repository-level configuration belongs at the repository root or under `.github/` where appropriate.

---

## 2. Git Workflow

Development is organized around GitHub parent issues and sub-issues.

A **parent issue** represents a larger feature or area of work.

Its **sub-issues** represent smaller implementation units that can be developed, reviewed, and merged independently.

Example:

```text
Parent issue:
#19 Initialize Frontend Application

Sub-issues:
#97 Initialize React + TypeScript project
#98 Configure project structure
#99 Setup routing
#100 Create base layout
#101 Create reusable component structure
#102 Configure API communication layer
```

The parent issue is primarily used for:

- planning;
- tracking;
- grouping related work;
- defining acceptance criteria;
- checking overall completion.

A parent issue does **not** normally require its own long-lived implementation branch.

Implementation normally happens on branches corresponding to individual sub-issues.

### Independent work

If sub-issues are independent and do not depend on unmerged code from another sub-issue, each branch may be created directly from `main`.

Example:

```text
main
├── issue-22/118-registration-endpoint
├── issue-22/119-validate-registration-input
└── issue-22/122-registration-form
```

Each PR may target `main` independently.

### Stacked work

If one sub-issue depends on changes introduced by a previous sub-issue, use **stacked branches and stacked pull requests**.

The important rule is:

- the **first branch in the stack is created from `main`;**
- the **first PR targets `main`;**
- every following branch is created from the branch directly below it;
- every following PR targets the branch directly below it, **not `main` directly**.

This keeps each PR focused only on the changes introduced by that specific sub-issue.

#### Example stack

Assume these dependent frontend issues:

```text
#98 Configure project structure
#99 Setup routing
#100 Create base layout
#101 Create reusable component structure
#102 Configure API communication layer
```

The branch stack looks like:

```text
main
 ↑
issue-19/98-configure-project-structure
 ↑
issue-19/99-setup-routing
 ↑
issue-19/100-create-base-layout
 ↑
issue-19/101-create-reusable-component-structure
 ↑
issue-19/102-configure-api-communication-layer
```

The corresponding PR relationships are:

```text
#98 PR  → main

#99 PR  → issue-19/98-configure-project-structure

#100 PR → issue-19/99-setup-routing

#101 PR → issue-19/100-create-base-layout

#102 PR → issue-19/101-create-reusable-component-structure
```

Only the first PR initially targets `main`.

The later PRs target the previous branch in the stack.

---

### How to create a stack correctly

#### Step 1 — Start from an up-to-date `main`

Before creating the first branch:

```bash
git switch main
git pull --ff-only origin main
```

Create the first branch:

```bash
git switch -c issue-19/98-configure-project-structure
```

Implement only issue #98.

Then commit and push:

```bash
git add .
git commit -m "chore: configure frontend project structure"
git push -u origin issue-19/98-configure-project-structure
```

Open the first PR with:

```text
head: issue-19/98-configure-project-structure
base: main
```

Conceptually:

```text
issue-19/98-configure-project-structure
                ↓
              main
```

This is the first PR in the stack and therefore the one linked directly to `main`.

---

#### Step 2 — Create the second branch from the first branch

Do **not** return to `main`.

Create the next branch from the current #98 branch:

```bash
git switch -c issue-19/99-setup-routing
```

Implement only issue #99.

Then commit and push:

```bash
git add .
git commit -m "feat: setup frontend routing"
git push -u origin issue-19/99-setup-routing
```

Open the second PR with:

```text
head: issue-19/99-setup-routing
base: issue-19/98-configure-project-structure
```

The relationship is now:

```text
issue-19/99-setup-routing
                ↓
issue-19/98-configure-project-structure
                ↓
              main
```

The #99 PR therefore shows the changes introduced by #99 compared with the #98 branch.

It does not treat the #98 implementation as new work in the #99 PR.

---

#### Step 3 — Continue building the stack

Create #100 from #99:

```bash
git switch -c issue-19/100-create-base-layout
```

Its PR uses:

```text
head: issue-19/100-create-base-layout
base: issue-19/99-setup-routing
```

Then create #101 from #100:

```text
head: issue-19/101-create-reusable-component-structure
base: issue-19/100-create-base-layout
```

Then create #102 from #101:

```text
head: issue-19/102-configure-api-communication-layer
base: issue-19/101-create-reusable-component-structure
```

The final stack becomes:

```text
PR for #102
issue-19/102-configure-api-communication-layer
                ↓
PR for #101
issue-19/101-create-reusable-component-structure
                ↓
PR for #100
issue-19/100-create-base-layout
                ↓
PR for #99
issue-19/99-setup-routing
                ↓
PR for #98
issue-19/98-configure-project-structure
                ↓
              main
```

---

### Why later PRs should not initially target `main`

Imagine #98 and #99 are not merged yet.

If the #100 PR also targeted `main`, GitHub would compare #100 against `main`.

That PR could therefore contain:

```text
#98 changes
+
#99 changes
+
#100 changes
```

The reviewer would see a much larger diff than necessary.

With a stack:

```text
#99 PR compares #99 with #98
#100 PR compares #100 with #99
#101 PR compares #101 with #100
```

Each PR contains only the incremental changes introduced by its own issue.

This makes reviews:

- smaller;
- clearer;
- faster;
- easier to understand;
- easier to test;
- easier to associate with one GitHub issue.

---

### Reviewing a stack

Stacked PRs may be opened before earlier PRs are merged.

They may also be reviewed while the whole stack is still open.

The reviewer should always know where the PR sits in the stack.

Every stacked PR should contain a section such as:

```markdown
## Stack context

Base branch: `issue-19/99-setup-routing`

Previous PR: #400

Next PR: #402
```

The first PR might say:

```markdown
## Stack context

Base branch: `main`

Previous PR: none

Next PR: #400
```

The final PR might say:

```markdown
## Stack context

Base branch: `issue-19/101-create-reusable-component-structure`

Previous PR: #402

Next PR: none
```

---

### Merge order for stacked PRs

Stacked PRs must be merged from the **bottom of the stack upward**.

Example:

```text
1. #98
2. #99
3. #100
4. #101
5. #102
```

Do not merge #102 before #101.

Do not merge #100 before #99.

Each upper branch contains code that depends on the branch below it.

---

### What happens after the first PR is merged

Suppose the stack currently looks like:

```text
#99 branch
   ↓
#98 branch
   ↓
main
```

After #98 is approved and squash-merged into `main`, the intended relationship becomes:

```text
#99 branch
   ↓
main
```

Before merging #99:

1. verify its base branch;
2. retarget it to `main` if GitHub has not done so automatically;
3. check that its diff contains only the intended #99 changes;
4. verify CI;
5. verify review approval;
6. merge #99.

Then repeat for #100:

```text
#100
  ↓
main
```

Then #101:

```text
#101
  ↓
main
```

Then #102:

```text
#102
  ↓
main
```

Continue until the entire stack has reached `main`.

---

### Rules for stacked work

- Only the first branch in the stack is created from `main`.
- Each following branch is created from the previous branch.
- Only the first PR initially targets `main`.
- Each following PR targets the branch directly below it.
- One PR should correspond to one implementation issue.
- Keep each PR limited to its issue scope.
- Do not add unrelated changes to a stacked PR.
- Merge from the bottom of the stack upward.
- After every merge, verify the next PR's base.
- After every merge, verify the next PR's diff.
- After every merge, verify CI.
- Avoid unnecessary rebases or force-pushes after review has started.
- If a base must be changed, verify the resulting diff before merging.

---

### Parent issue completion

A parent issue remains open until:

- all required sub-issues are completed;
- all required implementation has reached `main`;
- the parent checklist is complete;
- the parent acceptance criteria are satisfied;
- integration has been verified where necessary.

Only then should the parent issue be closed.

---

## 3. Branch Naming

### Sub-issues belonging to a parent issue

Use:

```text
issue-<parent-number>/<sub-issue-number>-<short-description>
```

Examples:

```text
issue-19/98-configure-project-structure
issue-19/99-setup-routing
issue-19/100-create-base-layout
issue-19/101-create-reusable-component-structure
issue-19/102-configure-api-communication-layer
```

Another example:

```text
issue-22/118-registration-endpoint
issue-22/119-validate-registration-input
issue-22/122-registration-form
```

The first number identifies the parent issue.

The second number identifies the actual implementation sub-issue.

This makes the relationship between the parent feature and its implementation branch immediately visible.

### Standalone issues

If an issue does not belong to a parent issue, use:

```text
issue-<issue-number>/<short-description>
```

Example:

```text
issue-404/shared-frontend-ui-foundation
```

### Naming rules

Branch names should:

- use lowercase;
- use hyphens between words;
- remain reasonably short;
- describe the actual issue;
- include the GitHub issue number;
- avoid personal names;
- avoid generic names such as `fix`, `changes`, `test`, or `new-feature`.

Good:

```text
issue-19/99-setup-routing
issue-22/122-registration-form
issue-404/shared-frontend-ui-foundation
```

Avoid:

```text
diana-work
frontend-changes
new
fix
test-branch
```

---

## 4. Pull Request Workflow

Every implementation issue should normally have its own pull request.

A PR should represent one clear unit of work and remain limited to the scope of its linked issue.

### Independent PR

For work that does not depend on another active branch:

1. Update local `main`.
2. Create a new branch from `main`.
3. Implement the issue.
4. Push the branch.
5. Open a PR against `main`.
6. Link the corresponding GitHub issue.
7. Request the appropriate reviewer.
8. Wait for CI.
9. Address review comments.
10. Squash-merge after approval.

Example:

```text
main
 ↑
issue-404/shared-frontend-ui-foundation
```

PR:

```text
head: issue-404/shared-frontend-ui-foundation
base: main
```

### Stacked PR

For dependent work:

1. Create the first branch from `main`.
2. The first PR targets `main`.
3. Create the next branch from the previous branch.
4. The next PR targets the previous branch.
5. Continue this pattern for the whole dependency chain.
6. Keep every PR limited to one issue.
7. Link the corresponding issue in every PR.
8. Request review.
9. Merge from the bottom of the stack upward.
10. Verify the next PR after every merge.

Example:

```text
PR #399
head: issue-19/98-configure-project-structure
base: main

PR #400
head: issue-19/99-setup-routing
base: issue-19/98-configure-project-structure

PR #401
head: issue-19/100-create-base-layout
base: issue-19/99-setup-routing

PR #402
head: issue-19/101-create-reusable-component-structure
base: issue-19/100-create-base-layout

PR #403
head: issue-19/102-configure-api-communication-layer
base: issue-19/101-create-reusable-component-structure
```

Merge order:

```text
#399
 ↓
#400
 ↓
#401
 ↓
#402
 ↓
#403
```

### Linking issues

Use:

```text
Closes #<issue-number>
```

Example:

```text
Closes #99
```

For stacked PRs, GitHub may not close an issue immediately when a PR is merged into another feature branch rather than directly into the default branch.

Always verify the issue state after its implementation reaches `main`.

---

### Review responsibilities

#### Backend

Primary peer-review pairing:

```text
Martin ↔ Lenka
```

#### Frontend — M1 and M2

During M1 and M2, Lada is not part of the active frontend implementation or review workflow.

Frontend PRs use the designated reviewer for the current milestone.

Significant architecture, integration, infrastructure, or cross-cutting changes should be reviewed by Roman.

#### Frontend — from M3

From M3 onward, Lada begins participating partially in frontend development together with Diana.

Where appropriate, the frontend peer-review pairing becomes:

```text
Diana ↔ Lada
```

This does not require every frontend PR to be reviewed by Lada.

Review ownership may still depend on:

- the feature;
- architecture impact;
- current team allocation;
- availability;
- the author of the PR.

#### Roman's own work

Roman cannot be both author and architecture reviewer of the same PR.

His own architecture-level PRs must be reviewed by another appropriate team member.

---

### Rules for merging into `main`

- No direct pushes to `main`.
- All changes to `main` go through pull requests.
- Required reviews must be completed.
- CI must pass before merge.
- Review conversations should be resolved.
- Use squash merge.
- Do not merge unrelated changes together.
- Respect stacked PR merge order.
- Verify the resulting `main` branch after important integrations.
- Merged head branches should be automatically deleted when the repository setting is enabled.

---

### PR description template

Use:

```markdown
## What

Brief description of the change.

## Why

Closes #<issue-number>

## How to test

Steps to verify this works.

## Stack context

If this PR belongs to a stack:

- Base branch:
- Previous PR:
- Next PR:

If it is not stacked, write:

Not stacked.

## Intentionally not included

Mention related work that belongs to another issue or PR.
```

Example:

```markdown
## What

Adds frontend routing using React Router.

## Why

Closes #99

## How to test

1. Start the frontend.
2. Open `/`.
3. Verify the home page loads.
4. Open an unknown path.
5. Verify fallback routing works.

## Stack context

Base branch: `issue-19/98-configure-project-structure`

Previous PR: #399

Next PR: #401

## Intentionally not included

Application layout belongs to #100.
```

---

## 5. Commit Messages

Commit messages are not strictly enforced, but should remain clear and consistent.

Preferred format:

```text
<type>: <short summary>

<optional longer description>
```

Recommended types:

```text
feat
fix
refactor
docs
test
chore
```

Examples:

```text
feat: setup frontend routing

feat: configure frontend API communication

fix: handle invalid registration input

refactor: create reusable layout components

docs: update stacked PR workflow

test: add authentication endpoint tests

chore: update frontend dependencies
```

### Guidelines

Use concise descriptions.

Good:

```text
feat: create registration form
```

Avoid:

```text
worked on form
changes
update stuff
final version
fix again
```

A commit should represent a coherent change.

Do not combine unrelated work into one commit when it can reasonably be separated.

---

## 6. Definition of Done

### Sub-issue

A sub-issue is done when:

- [ ] The intended scope is implemented.
- [ ] All checklist items are completed.
- [ ] Acceptance criteria are satisfied.
- [ ] Relevant tests pass.
- [ ] The application builds successfully.
- [ ] CI passes.
- [ ] Required review is completed.
- [ ] Review comments are resolved.
- [ ] The implementation reaches `main`.
- [ ] The GitHub issue is closed or verified as completed.

For stacked work, merging a PR into another feature branch alone does not necessarily mean the implementation has reached `main`.

### Parent issue

A parent issue is done when:

- [ ] All required sub-issues are complete.
- [ ] All required implementation is present in `main`.
- [ ] The parent checklist is complete.
- [ ] Parent-level acceptance criteria are satisfied.
- [ ] Relevant integration has been verified.
- [ ] CI passes on `main`.
- [ ] No required implementation remains only on an unmerged branch.

Only then should the parent issue be closed.

### Milestone

A milestone is complete when:

- [ ] Required parent issues are completed.
- [ ] Required sub-issues are completed.
- [ ] Integrated functionality works together.
- [ ] CI passes on `main`.
- [ ] No milestone-blocking PR remains open.
- [ ] The milestone acceptance goal is satisfied.

Finishing one developer's assigned work does not automatically mean the whole milestone is complete.

---

## 7. Branch Cleanup

Merged branches should not remain indefinitely.

The repository should have GitHub's **Automatically delete head branches** setting enabled.

The setting is located at:

```text
Repository
→ Settings
→ General
→ Pull Requests
→ Automatically delete head branches
```

When enabled, GitHub automatically deletes the head branch of a pull request after that PR is successfully merged.

This applies to **merged pull request branches**. It is not a general automatic cleanup system for every old or inactive branch.

### Stacked PRs

Automatic deletion can also be used with stacked PRs.

After a lower PR in a stack is merged, verify the next PR before continuing:

- verify its new base branch;
- verify that its diff is still correct;
- verify that CI passes;
- retarget the PR manually if GitHub did not update the base as expected.

Example:

Before merging #399:

```text
#400
  ↓
#399
  ↓
main
```

After #399 is merged and its branch is deleted, the intended result is:

```text
#400
  ↓
main
```

Always verify this in GitHub before merging #400.

### Manual cleanup

Manual branch cleanup may still be necessary for:

- abandoned branches;
- obsolete branches;
- branches belonging to PRs that were closed without being merged;
- old branches that were created outside the normal PR workflow;
- branches that existed before automatic deletion was enabled.

Do not manually delete an active branch that is still being used as the base of another PR without first checking the dependent PR.

The automatic deletion setting should reduce branch clutter, but developers are still responsible for verifying stacked PR relationships before continuing a merge sequence.

---

## 8. Repository Protection and Merge Safety

Documentation describes the expected workflow, but important rules should also be enforced by GitHub where possible.

The `main` branch should be protected against accidental changes.

Recommended protections:

- Require a pull request before merging.
- Require at least one approval.
- Require CI/status checks to pass.
- Require review conversations to be resolved.
- Disallow direct pushes to `main`.
- Disallow force pushes to `main`.
- Disallow deletion of `main`.
- Use squash merge as the normal merge strategy.

These protections reduce the risk of accidentally merging an unfinished, failing, or unreviewed PR.

### CODEOWNERS

The repository may use `.github/CODEOWNERS` to automatically request reviewers based on changed files.

Example:

```text
# Backend
/backend/ @Aztaban

# Infrastructure
/nginx/ @webxxcom
/docker-compose.yml @webxxcom
/.github/ @webxxcom
```

Frontend ownership should be added when frontend review responsibility is agreed for the relevant milestone.

During M1 and M2, Lada should not automatically be assigned as frontend reviewer.

From M3, frontend ownership and reviewer rules may be updated to reflect her partial participation with Diana.

Initially, CODEOWNERS should primarily be used for automatic reviewer assignment.

Making Code Owner approval mandatory can be enabled later if the team agrees that the ownership rules are stable.

---

## 9. General Development Rules

- Start work from the correct and up-to-date base branch.
- One issue should normally correspond to one implementation branch and one PR.
- Keep PR scope small and reviewable.
- Avoid unrelated refactoring inside feature PRs.
- Do not overwrite another developer's work.
- Do not force-push shared branches unless necessary and coordinated.
- Do not merge another developer's PR without the agreed review process.
- Check CI before merging.
- Keep documentation synchronized with the workflow actually used by the team.
- If the team changes the workflow, update this document rather than continuing with undocumented conventions.

The GitHub issues and milestone structure define **what** needs to be implemented.

This document defines **how** the team develops, reviews, and merges that work.