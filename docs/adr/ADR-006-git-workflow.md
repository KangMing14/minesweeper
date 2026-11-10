# ADR-006: Git workflow

- Status: Accepted
- Date: 2026-11-09
- Task: M0-T06
- Settles: none

## Context

The project is built across many separate conversations, one task at a time, by a solo developer. History has to show which task produced which change, `main` has to stay releasable, and work done by an AI assistant has to pass the same gates as work done by hand. A solo developer cannot approve their own pull request, so the gate has to be automated checks rather than a second reviewer.

## Decision

The workflow follows spec section 7.1 and is enforced by tooling set up in M0-T01 to M0-T04.

- **Hosting and protection.** A GitHub repository. `main` is protected and always green: no direct pushes, no force pushes, no deletion, linear history, conversations resolved, rules applied to administrators too, and the CI check required once it exists. Required approvals are 0 on purpose, because a solo developer cannot approve their own pull request; the pull request is still required and is the gate where CI and `/requesting-code-review` run. The settings are applied by `tools/github/protect-main.sh`.
- **Branching.** Development is trunk-based. One task is one short-lived branch and one pull request. Branch names are `m<n>/<task-id>-<slug>`, for example `m1/M1-T04-flood-fill`.
- **Merging.** Squash-merge only, so each task is one commit on `main`. GitHub uses the pull request title as the commit subject.
- **Commits.** Conventional Commits. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`. The scope is optional and, when present, one of `engine`, `protocol`, `server`, `web` or `docs`. The subject ends with a task ID, `[Mn-Tnn]`, or `[chore]` for work that belongs to no task; the ` (#n)` suffix that GitHub adds after a squash-merge is allowed. The rule is enforced by commitlint in the `commit-msg` hook and, because squash-merge makes the title the commit, again on the pull request title in CI. The default `subject-case` rule is off because subjects often start with an acronym such as `PRNG` or `ADR-001`.
- **Hooks.** Husky with lint-staged: `pre-commit` runs ESLint, Prettier and a type-check on the staged files, and `pre-push` runs the tests affected since `origin/main`. Hooks are fast feedback; CI is the authority.
- **CI.** One workflow with a single job named `ci`, so branch protection needs exactly one required check.
- **Tags and releases.** Each finished milestone is tagged `m<n>-complete`, after its review. Pre-launch releases are `v0.<n>.0`, and semantic versioning starts at `v1.0.0` at public launch. Handoff packages cite the baseline tag or commit.
- **Hygiene.** `.gitignore`, `.gitattributes` (LF endings), `.editorconfig`. No secrets in Git, only `.env.example`. No generated artifacts committed: build output, TypeDoc output and coverage.
- **Changelog.** Drafted from the conventional commits at task close-out, then curated by hand.

## Consequences

- Every change on `main` names its task, so a ROADMAP row, a pull request and a commit can be matched by ID, which the multi-conversation workflow relies on.
- A bad commit message, a broken test, type, lint rule or doc comment cannot merge once the `ci` check is required.
- Hooks are installed by `pnpm prepare`. An `install` on an already up-to-date checkout skips that script, so a fresh clone must confirm `git config core.hooksPath` prints `.husky/_` and run `pnpm prepare` if it does not.
- With zero required approvals, protection depends on discipline: the pull request is opened, CI is waited for, and the review step is done even though nobody forces it.
- The task-ID rule means maintenance work needs the `[chore]` marker; that is deliberate and keeps the log uniform.
- Squash-merge discards the intermediate commits of a task branch, which is acceptable because the task is the unit of history.

## Alternatives

- **GitFlow with release branches.** Rejected: a solo project with one deployable does not need release branches.
- **Committing directly to `main`.** Rejected: there would be no point at which CI and review run before the change lands.
- **Merge commits or rebase-merge.** Rejected: they spread one task over several commits and break the one-task-one-commit rule.
- **No commit-message lint.** Rejected: the changelog and the task-to-commit mapping depend on a uniform format that people and assistants will not keep by habit.
- **Requiring a second reviewer.** Not possible for a solo developer; the automated gates replace it.
