# Development Guide

> Stub created in M0-T01 with the git section only. M0-T03 adds lint and commit tooling details, M0-T04 adds how to run tests and docs, and M0-T05 completes the guide (code documentation rules, task loop, skills).

## Git workflow

Source: spec section 7.1. Rules are enforced by GitHub settings (`tools/github/protect-main.sh`) and, from M0-T03, by hooks and CI.

### Branches
- `main` is protected and always green. History on `main` is never rewritten. No direct pushes, no force pushes, no branch deletion, linear history required. The rules apply to admins too.
- Trunk-based development: one task = one short-lived branch = one pull request.
- Branch name: `m<n>/<task-id>-<slug>`, for example `m1/M1-T04-flood-fill`.

### Commits
- Conventional Commits: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`.
- Scope is the package (`engine`, `protocol`, `server`, `web`, `docs`); repository-wide changes may omit it.
- The task ID goes in the subject: `feat(engine): iterative flood fill [M1-T04]`. Work that belongs to no task uses `[chore]`.
- Until M0-T03 adds commitlint, follow this format by hand.

### Pull requests and merging
- Open a PR from the task branch. The PR template lists the acceptance criteria, verification output and docs checklist.
- The PR title is a Conventional Commit with the task ID. Squash-merge is the only merge method, and GitHub uses the PR title as the commit subject, so each task is one commit on `main`.
- The PR is the review gate even for a solo developer: CI (required from M0-T04) and `/requesting-code-review` run here.
- Branches are deleted automatically after merge.

### Tags and releases
- Tag each completed milestone `m<n>-complete`.
- Pre-launch releases are `v0.<n>.0`; semantic versioning starts at `v1.0.0` at public launch.
- Handoff packages cite the baseline tag or commit SHA.

### Hygiene
- `.gitignore`, `.gitattributes` (LF line endings everywhere), `.editorconfig`.
- No secrets in git. `.env.example` documents variables with placeholders; real values live in host secrets.
- No generated artifacts committed: build output, TypeDoc output (`docs/api/`), coverage.
- Local worktrees live in `.worktrees/` (ignored).

### Changelog
Drafted from conventional commits at task close-out, then curated by hand.

### Maintainer setup
Run once per repository, as an admin, with an authenticated `gh`:

```bash
tools/github/protect-main.sh OWNER/REPO            # before CI exists
tools/github/protect-main.sh OWNER/REPO <job-name>  # after M0-T04: also require the CI check
tools/verify-t01.sh --remote OWNER/REPO            # verify
```
