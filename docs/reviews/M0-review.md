# M0 Foundations: milestone review

- Date: 2026-11-09
- Scope: the whole repository as of the snapshot `minesweeper-20261109-1515.zip` (after M0-T05 was merged as `cab55e4`) plus the M0-T06 changes
- Reviewer: Claude, with the `/requesting-code-review` checklist, in the same conversation that did M0-T06. This is **not an independent review**: no separate reviewer subagent was available, so the author of the last task also reviewed the milestone. A second look in a fresh conversation (Prompt F in `docs/workflow/PROMPT_TEMPLATES.md`) is still worthwhile.
- Method: read the configuration that enforces the rules (`ci.yml`, `eslint.config.js`, `commitlint.config.js`, `lint-staged.config.js`, `.husky/`, `scripts/`, `vitest.config.ts`), compared the exported API with `ARCHITECTURE.md`, ran the checks listed below in a Linux sandbox, and checked the milestone's acceptance criteria one by one.

## Acceptance criteria of the milestone

| Criterion (M0 handoff package, item 6) | Evidence | Status |
|---|---|---|
| `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm docs:api` pass locally | Run in the sandbox on Node 22.23.4 and pnpm 12.15.0: `install --frozen-lockfile`, `typecheck`, `lint`, `test:coverage` (1 file, 2 tests), `docs:api` all exit 0. Also `format:check`, `check:todos`, `check:links` and `test:lint-fixtures` (51 passed, 0 failed). | Met here; Node 24 not tried |
| The same pass in CI | The workflow `ci.yml` runs these steps, but it cannot be run from a snapshot. | Not verified here |
| A pull request cannot merge on red CI | `tools/github/protect-main.sh` configures it; the GitHub setting itself is outside the snapshot. | Not verified here (see Important 1) |
| Bad commit messages and bare TODOs are rejected | `commitlint.config.js` and `scripts/check-todos.mjs`, pinned by the lint fixtures (51 cases) and `tools/verify-t03.mjs`. | Met |
| All docs and ADRs committed | Every document from M0-T05 is in the snapshot; ADR-001 to ADR-008 are added by M0-T06 and are not committed until you commit them. | Met after your commit |

## Strengths

- The architecture rules are enforced, not described: the dependency direction by `package.json` and project references, the engine's purity by a TypeScript configuration with no DOM lib and no ambient types plus lint bans, each pinned by fixtures that prove a rule fires for the intended reason.
- CI is conservative: read-only token permissions, every action pinned by commit SHA, the pull request title passed through an environment variable and not interpolated into a script, a frozen lockfile, and a link checker that never fetches external URLs.
- The documents agree with the code: the "Public interfaces today" table in `ARCHITECTURE.md` matches the real exports (`m0SampleAdd` only), and the canonical names are labeled planned, not implemented.
- Each task left a verification script (`tools/verify-t02` to `t06`) that can be re-run, and a session log.

## Issues

### Critical

None found.

### Important

1. **Required check not confirmed.** The M0-T04 acceptance criterion says CI is required and green on `main`. Whether `ci` is a required status check is a GitHub setting that a snapshot cannot show. Before tagging `m0-complete`: confirm the `ci` run on `main` after merging this task is green, and verify the protection with `tools/verify-t01.sh --remote OWNER/REPO` or the repository's branch settings page.

### Minor

2. **`README_FIRST.md` is stale.** Its quick start (step 4) says to keep only the spec and plan as Project knowledge, but since M0-T05 the Project holds `CLAUDE.md`, `ROADMAP.md`, `ARCHITECTURE.md` and `DECISIONS.md`. Fix in a `[chore]` commit.
3. **No dependency advisory check in CI.** The Better Auth work showed that advisories are the main ongoing risk (ADR-005). Consider an advisory check in CI as part of M9-T05; I did not test whether any specific command suits this lockfile.
4. **Accumulating verify scripts.** `tools/verify-t05.mjs` asserted facts that became false when M0-T06 ran (M0-T06 is `Not started`, no ADR is accepted). M0-T06 relaxed those two assertions. Later verify scripts should assert only what must stay true after the next task.
5. **Line endings.** `WHERE_THINGS_LIVE.txt` has CRLF endings in the snapshot. `.gitattributes` normalizes to LF on commit, so this is harmless.
6. **Node version.** The sandbox ran Node 22.23.4 while the repository requires 24. CI uses `.nvmrc` (24), so the Node 24 behavior is first exercised on GitHub.

## Assessment

M0 is ready to be tagged `m0-complete` once Important 1 is confirmed and CI is green on `main` after the M0-T06 pull request merges. I found nothing that blocks M1. The one finding that changed project state is outside this review's scope but was fixed in M0-T06: the pinned Better Auth version was affected by a security release (ADR-005, `DECISIONS.md`).
