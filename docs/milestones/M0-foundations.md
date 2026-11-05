# M0 Foundations

**Goal:** a wired, empty monorepo with git conventions, code-documentation lint, CI, the documentation skeleton and the first ADRs.
**Depends on:** approved spec. **Brief phases:** 0 and 1.
**Baseline skills for every task:** `/test-driven-development` (where code exists), `/verification-before-completion`. Run `/requesting-code-review` once at milestone end.

## Conversation Handoff Package

1. **Project context.** Browser-based competitive Minesweeper in TypeScript, OOP, as a pnpm monorepo: `packages/engine` (pure deterministic logic), `packages/protocol` (message schemas), `apps/server` (Fastify + `ws`), `apps/web` (React + Vite + Canvas). MVP: 1v1 race on an identical seeded board with a guaranteed shared safe opening, plus solo time-attack with replay-validated leaderboards. Solo developer; small public launch first. Server is authoritative and never sends mine positions. The repository docs are the source of truth.
2. **Tasks:** M0-T01 to M0-T06, in order.
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
- **Acceptance criteria:** every document exists with real content, no placeholders; ROADMAP has 78 task rows; links resolve.
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
