## Task

<!-- One task = one branch = one PR. Branch name: m<n>/<task-id>-<slug> -->
Task ID: M_-T__
Milestone file: `docs/milestones/M_-....md`

PR title must be a Conventional Commit with the task ID, because squash-merge uses it as the commit subject:
`type(scope): summary [Mn-Tnn]`, for example `feat(engine): iterative flood fill [M1-T04]`.

## What changed and why

<!-- Two to five lines. Link ADRs or spec sections where relevant. -->

## Acceptance criteria

<!-- Paste the task's acceptance criteria and tick each one you verified. -->
- [ ]
- [ ] Exported symbols documented; lint and TypeDoc pass (TSDoc on every export)

## Verification

<!-- Paste the real output of the checks you ran (typecheck, lint, test, docs:api, or the task's own verification). -->

## Docs updated

- [ ] `ROADMAP.md`: this task's row (status, PR, commit, date)
- [ ] `CHANGELOG.md`
- [ ] `ARCHITECTURE.md` (only if an interface or the package layout changed)
- [ ] `DECISIONS.md` (only if a decision was made or an open decision closed)
- [ ] Not applicable: explain why

## Checks

- [ ] No conflict with an accepted ADR, an open decision, or the canonical names table (otherwise stop and propose a new ADR)
- [ ] No secrets, no generated artifacts, no commented-out code
- [ ] Every TODO names a task: `// TODO(Mn-Tnn): ...`
