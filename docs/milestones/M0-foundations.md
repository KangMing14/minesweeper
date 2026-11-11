# M0 Foundations

**Goal:** a wired, empty monorepo with git conventions, code-documentation lint, CI, the documentation skeleton and the first ADRs.
**Depends on:** approved spec. **Brief phases:** 0 and 1.
**Baseline skills for every task:** `/test-driven-development` (where code exists), `/verification-before-completion`. Run `/requesting-code-review` once at milestone end.

## Conversation Handoff Package

1. **Project context.** Browser-based competitive Minesweeper in TypeScript, OOP, as a pnpm monorepo: `packages/engine` (pure deterministic logic), `packages/protocol` (message schemas), `apps/server` (Fastify + `ws`), `apps/web` (React + Vite + Canvas). MVP: 1v1 race on an identical seeded board with a guaranteed shared safe opening, plus solo time-attack with replay-validated leaderboards. Solo developer; small public launch first. Server is authoritative and never sends mine positions. The repository docs are the source of truth.
2. **Tasks:** M0-T01 to M0-T06, in order, then the review follow-ups M0-T07 to M0-T11 (added after the milestone review, `docs/reviews/M0-review.md`).
3. **Prerequisites and baseline:** the approved spec (`docs/superpowers/specs/2026-11-04-competitive-minesweeper-design.md`) and the roadmap plan (`docs/superpowers/plans/2026-11-04-competitive-minesweeper-roadmap.md`). No code exists yet; there is no baseline tag.
4. **Locked decisions:** everything in the spec's "decided" items: MVP modes, guaranteed shared opening, solo developer and launch scale, the stack in spec section 5, git workflow (7.1), code documentation (7.2). Open decisions D-12 (license) is settled in M0-T06.
5. **Deliverables:** repository with protected `main`; four packages that build and typecheck; lint, format, hooks, CI; documentation skeleton; ADR-001..008; tag `m0-complete`.
6. **Acceptance:** `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm docs:api` pass locally and in CI; a PR cannot merge on red CI; bad commit messages and bare TODOs are rejected; all docs and ADRs are committed.
7. **Skills:** `/using-git-worktrees` (optional isolation), `/architecture` (ADRs), `/documentation` (doc skeleton), `/code-review` or `/requesting-code-review` (milestone end).
8. **Documents:** read the spec sections 4, 5, 7 first. Update at close-out: `ROADMAP.md`, `CHANGELOG.md`, `DECISIONS.md`.

---

### M0-T01 Initialize the repository and git conventions

- **Objective:** a GitHub repository whose rules enforce the git workflow.
- **Description:** create the repo and the files that make history clean and PRs consistent.
- **Prerequisites:** GitHub account; git installed.
- **Implementation guidance:** protect `main` (require PR, require the CI check once it exists in M0-T04, linear history, squash-merge only, no force pushes). Add `.gitignore` (node, build output, coverage, `.env`), `.gitattributes` (`* text=auto eol=lf`), `.editorconfig`, a PR template with the task ID, acceptance checklist and "docs updated" checkbox, and `.env.example` convention. Add the branch-naming and commit rules to a first `DEVELOPMENT_GUIDE.md` section (finished in M0-T05).
- **Expected output:** repository; `.gitignore`, `.gitattributes`, `.editorconfig`, `.github/pull_request_template.md`; branch protection configured.
- **Testing requirements:** clone the repo fresh and confirm the files exist; attempt a direct push to `main` and a force push, both rejected; open a throwaway PR and confirm the template appears.
- **Acceptance criteria:** protection rules active; template renders; LF endings enforced on a test file committed from a CRLF-configured checkout.
- **Relevant skills:** baseline; `/using-git-worktrees`.
- **Documentation updates:** `DEVELOPMENT_GUIDE.md` git section (stub); `README.md` stub.

### M0-T02 Scaffold the monorepo and pin versions

- **Objective:** four empty workspace packages that install, build and typecheck.
- **Description:** pnpm workspace with `packages/engine`, `packages/protocol`, `apps/server`, `apps/web`, a shared strict TypeScript base and project references.
- **Prerequisites:** M0-T01.
- **Implementation guidance:** `pnpm-workspace.yaml`; `tsconfig.base.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`; per-package `tsconfig.json` with project references; `engine` has no dependencies, `protocol` depends on `engine`, apps depend on both. Add `.nvmrc` and `engines`. Look up current releases of every tool and pin exact versions (prefer releases at least two weeks old); record them in `DECISIONS.md` under ADR-005 input. Root scripts: `typecheck`, `lint`, `test`, `build`, `docs:api`.
- **Expected output:** workspace files, four `package.json` files, tsconfigs, `index.ts` placeholder per package exporting nothing.
- **Testing requirements:** `pnpm install` from a clean clone; `pnpm typecheck` passes; a deliberate import from `apps/web` into `apps/server` fails typechecking or lint (lint rule arrives in M0-T03, so assert the dependency graph through `package.json` only).
- **Acceptance criteria:** clean install and typecheck on a fresh clone; versions pinned (no `^` ranges for tools); `engine` declares zero dependencies.
- **Relevant skills:** baseline.
- **Documentation updates:** `ARCHITECTURE.md` package layout; `DECISIONS.md` version table.

### M0-T03 Lint, format, hooks and documentation lint

- **Objective:** tooling that enforces code quality, architecture boundaries and the documentation rules automatically.
- **Description:** ESLint flat config, Prettier, hooks, commit-message lint, TSDoc enforcement, boundary rules, and the bare-TODO check.
- **Prerequisites:** M0-T02.
- **Implementation guidance:** `eslint-plugin-tsdoc` everywhere; `eslint-plugin-jsdoc` `require-jsdoc` for exports with `error` in `engine` and `protocol` and `warn` in apps (flip to `error` in M5-T03). `no-restricted-imports` blocks `engine` importing anything project-internal, `protocol` importing anything but `engine`, and apps importing each other. In `engine`, ban `Math.random`, `Date`, `performance`, `window`, `document`, `process` via `no-restricted-globals` and `no-restricted-properties`. husky + lint-staged (pre-commit: ESLint, Prettier, typecheck of staged packages; pre-push: affected tests); commitlint with Conventional Commits and a rule requiring a task ID `[Mn-Tnn]` or `[chore]`. A small script `scripts/check-todos.mjs` fails on any `TODO` not matching `TODO\(M\d+-T\d+\)`.
- **Expected output:** `eslint.config.js`, `.prettierrc`, `.husky/`, `commitlint.config.js`, `scripts/check-todos.mjs`, `pnpm lint` and `pnpm check:todos` scripts.
- **Testing requirements:** fixture files proving each rule fires: an undocumented export in `engine`, an `engine` file importing `protocol`, `Math.random` in `engine`, a bare TODO, a malformed commit message, a malformed TSDoc tag. Tests live in `tools/lint-fixtures/` and run in CI.
- **Acceptance criteria:** every fixture is rejected for the intended reason; a compliant sample commit passes all hooks.
- **Relevant skills:** baseline; `/documentation`.
- **Documentation updates:** `DEVELOPMENT_GUIDE.md` (lint rules, commit format, doc-comment rules).

### M0-T04 Test tooling and CI

- **Objective:** automated tests and a CI pipeline that gates every PR.
- **Description:** Vitest workspace configuration, coverage reporting, TypeDoc, and a GitHub Actions workflow.
- **Prerequisites:** M0-T03.
- **Implementation guidance:** Vitest with one project per package; one real sample test in `engine` (a trivial exported function with TSDoc, removed or replaced in M1). TypeDoc entry points for `engine` and `protocol` with warnings treated as errors; output to an ignored `docs/api/` directory. CI jobs: install with pnpm cache, typecheck, lint, check-todos, test with coverage, `docs:api`. Make the CI workflow a required status check on `main`. Playwright is added in M3-T08, not now.
- **Expected output:** `vitest.workspace.ts`, `typedoc.json`, `.github/workflows/ci.yml`.
- **Testing requirements:** a PR that breaks a test, a type, a lint rule or a TSDoc comment fails CI; a clean PR passes.
- **Acceptance criteria:** CI required and green on `main`; failing PRs cannot merge.
- **Relevant skills:** baseline; `/testing-strategy` (light, for configuration layout).
- **Documentation updates:** `DEVELOPMENT_GUIDE.md` (how to run tests and docs); `README.md` badges and setup.

### M0-T05 Documentation skeleton

- **Objective:** the documents that carry context between conversations, populated from the spec and plan.
- **Description:** create every project document and the handoff template.
- **Prerequisites:** M0-T04.
- **Implementation guidance:** `README.md` (setup, scripts), `PROJECT_OVERVIEW.md` (concept, MVP, scope, glossary), `ROADMAP.md` (milestone index plus one status row per task copied from the milestone files), `ARCHITECTURE.md` (package layout, diagrams from the spec, canonical names), `DEVELOPMENT_GUIDE.md` (git, code docs, task loop, skills), `DECISIONS.md` (ADR template, ADR list, open decisions D-01..D-13), `CHANGELOG.md`, `CLAUDE.md` (read order: `CLAUDE.md`, `ROADMAP.md`, the milestone file, `ARCHITECTURE.md`, `DECISIONS.md`; rules: docs beat memory, stop on ADR conflicts, never use `engine`-banned APIs), `docs/handoffs/TEMPLATE.md`. Copy the spec, plan and milestone files into the repo paths used in this plan.
- **Expected output:** the files above under the repo root and `docs/`.
- **Testing requirements:** a link checker (for example a small script or `lychee`) runs in CI and passes; a reviewer opens `CLAUDE.md` in a new conversation and can name the next task from `ROADMAP.md` alone.
- **Acceptance criteria:** every document exists with real content, no placeholders; ROADMAP has a row for every task (78 when this task was done; the review follow-ups M0-T07 to M0-T11 added five); links resolve.
- **Relevant skills:** baseline; `/documentation`.
- **Documentation updates:** all of the above are the deliverable.

### M0-T06 ADRs, dependency verification and license

- **Objective:** record the foundational decisions and verify the riskiest dependency assumption.
- **Description:** write ADR-001..008 and re-verify Better Auth.
- **Prerequisites:** M0-T05.
- **Implementation guidance:** use the ADR format Context, Decision, Consequences, Alternatives. ADR-001 monorepo and modular monolith; 002 deterministic engine; 003 server-authoritative play; 004 `GameSession` adapter; 005 technology stack, including the Better Auth check (current maintenance status, release cadence, open security advisories, Drizzle adapter support) and a fallback if it fails; 006 git workflow; 007 code documentation (TSDoc + TypeDoc, why not Doxygen); 008 license (open source or all rights reserved until launch). Use `/architecture` for each record.
- **Expected output:** `docs/adr/ADR-001..008-*.md`; `DECISIONS.md` index updated; tag `m0-complete`.
- **Testing requirements:** none beyond link checks; review each ADR against the spec for contradictions.
- **Acceptance criteria:** eight ADRs committed; ADR-005 states the Better Auth verification result and fallback; D-12 closed; M0 close-out done (ROADMAP statuses, CHANGELOG) and `m0-complete` tagged.
- **Relevant skills:** baseline; `/architecture`; `/requesting-code-review`.
- **Documentation updates:** `DECISIONS.md`, `ROADMAP.md`, `CHANGELOG.md`.

---

## Review follow-ups (from `docs/reviews/M0-review.md`)

Added after the M0 milestone review. Each is small. The tag `m0-complete` follows the re-review (`docs/reviews/M0-review-2.md`).

### M0-T07 Narrow `jsdoc/require-example`: exempt `@internal`, add fixtures

- **Objective:** `@example` is required on the public API only, as spec 7.2 says (review I1).
- **Description:** `jsdoc/require-example` fired on every module-level export, including symbols tagged `@internal` and exports that `index.ts` does not publish.
- **Prerequisites:** M0-T06.
- **Implementation guidance:** `exemptedBy: ['inheritdoc', 'internal']` in `requireExampleOptions` (`eslint.config.js`); `require-jsdoc` is unchanged, so an internal export still needs a summary. Fixture-first: add `engine-internal-without-example` and its two manifest cases (engine and protocol), watch them fail, then change the config.
- **Expected output:** `eslint.config.js`, one fixture, two manifest cases, a guide sentence.
- **Testing requirements:** `pnpm test:lint-fixtures` (the untagged version of the same exports still fails with six `jsdoc/require-example` errors).
- **Acceptance criteria:** an `@internal` export in `engine` or `protocol` lints clean without `@example`; all earlier fixtures still pass.
- **Relevant skills:** baseline.
- **Documentation updates:** `DEVELOPMENT_GUIDE.md` (doc-comment rules).

### M0-T08 Carry the full mine-exposure rule into the docs; open D-14

- **Objective:** the whole Global Constraint is in the repository, and its race interaction is an explicit open decision (review I2).
- **Description:** the plan says mines never reach a client while a game is in progress and, after a game ends, only the player's own finished game may expose its mines. The docs held only the first half. In a race both players share one board.
- **Prerequisites:** M0-T06.
- **Implementation guidance:** `CLAUDE.md` rule 8 and `ARCHITECTURE.md` principle 2 state the full constraint; `DECISIONS.md` gets D-14 (working assumption: release mines only when the match result is final for both players, never in a `delta`); ADR-010 (M4-T03) settles it; M5-T05's leak test is worded to match. ADR-003 is not edited.
- **Expected output:** edits to the four documents and the M4-T03 and M5-T05 task texts.
- **Testing requirements:** `pnpm check:links`.
- **Acceptance criteria:** D-14 is in the open-decisions table with an owner; the rule reads the same in `CLAUDE.md` and `ARCHITECTURE.md`.
- **Relevant skills:** baseline; `/architecture` when ADR-010 is written.
- **Documentation updates:** as above.

### M0-T09 Snapshot git state and `--with-git`; remove the per-task verify scripts

- **Objective:** a milestone review can see history, tags and branch protection; old verification scripts stop going stale (review I3, L1).
- **Description:** `tools/snapshot.sh` gains two opt-in flags; with no flag its output is unchanged. `--git-state` adds `GIT_STATE.txt` (HEAD, first-parent log, merge-commit count, tags, `git status`, remote URL without credentials, and with `gh` the branch protection and the last five CI runs). `--with-git` adds the `.git` folder except `config` and `hooks`. `tools/verify-t02.mjs` to `verify-t06.mjs` are deleted (they assert one moment's state, and remain in history).
- **Prerequisites:** M0-T06.
- **Implementation guidance:** the state file is written to the repository root only while the zip is made and is in `.gitignore`; a trap removes it. Tested in a scratch repository: default, `--git-state`, `--with-git`, partial paths, flag order, a token in the remote URL, `--help`, an unknown flag. Only the `zip` and Python paths were run; the 7-Zip and PowerShell fallbacks share the file list but were not run.
- **Expected output:** `tools/snapshot.sh`, `.gitignore`, `HOW_TO_USE.md`, `PROMPT_TEMPLATES.md` (Prompt F and the new Prompt F2), `DEVELOPMENT_GUIDE.md`.
- **Testing requirements:** the scratch-repository runs above.
- **Acceptance criteria:** `tools/snapshot.sh --git-state` produces a zip with `GIT_STATE.txt` and no credentials; `tools/snapshot.sh` alone is unchanged.
- **Relevant skills:** baseline.
- **Documentation updates:** as above.

### M0-T10 Advisory check in CI, branch-name check, engine-strict, wider marker scan

- **Objective:** guards that were convention only (review L2, L7, L8).
- **Description:** `pnpm audit:prod` in `ci`; weekly `audit.yml` (full report, gate on high or critical); `scripts/check-branch-name.mjs` run on pull requests; `engineStrict: true` in `pnpm-workspace.yaml` (`engine-strict` in `.npmrc` is ignored by pnpm 12, verified); `check-todos` also reads `.yml`, `.yaml`, `.sh` and also catches FIXME, XXX and HACK.
- **Prerequisites:** M0-T06.
- **Implementation guidance:** fixtures and manifest cases first (branch names, marker words, scan scope), then the scripts.
- **Expected output:** `scripts/check-branch-name.mjs`, `scripts/check-todos.mjs`, `.github/workflows/ci.yml`, `.github/workflows/audit.yml`, `package.json` scripts, `pnpm-workspace.yaml`.
- **Testing requirements:** `pnpm test:lint-fixtures`; a clean install on Node 22 fails with `ERR_PNPM_UNSUPPORTED_ENGINE`.
- **Acceptance criteria:** the workflows pass on GitHub (the first run is the pull request that adds them; the `audit` workflow is started once by hand); an unconforming branch name fails `ci`.
- **Relevant skills:** baseline.
- **Documentation updates:** `DEVELOPMENT_GUIDE.md`, `README.md`, `DECISIONS.md` (advisory handling).

### M0-T11 Documentation tidy-ups and ADR errata

- **Objective:** no stale text at the repository root, no misleading cross-references (review L5, L6, L9).
- **Description:** delete `README_FIRST.md` and `WHERE_THINGS_LIVE.txt` (both duplicate `docs/workflow/HOW_TO_USE.md` and were out of date); `ARCHITECTURE.md` status line; the ROADMAP PR column holds the pull request number alone; the README scripts table is complete; `DECISIONS.md` lists errata for ADR-005 and ADR-007 (accepted ADRs are not edited) and the Node 26 and Corepack note.
- **Prerequisites:** M0-T06.
- **Implementation guidance:** docs only.
- **Expected output:** the edits above.
- **Testing requirements:** `pnpm check:links`.
- **Acceptance criteria:** no reference to the deleted files remains outside history and session logs.
- **Relevant skills:** baseline; `/documentation`.
- **Documentation updates:** as above.
