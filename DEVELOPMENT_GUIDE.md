# Development Guide

How to work in this repository. Spec section 7 is the source for the rules; this guide is the practical version. If this guide and an ADR disagree, the ADR wins.

Contents: [Getting started](#getting-started), [The task loop](#the-task-loop), [Skills](#skills), [Git workflow](#git-workflow), [Tooling and enforcement](#tooling-and-enforcement-m0-t03), [Tests, API docs and CI](#tests-api-docs-and-ci-m0-t04), [Keeping the documents current](#keeping-the-documents-current).

## Getting started

Requirements: Git, Node 24 LTS (`>=24.15.0`, see `.nvmrc`) and pnpm, which Corepack provides at the exact version pinned in `package.json`.

```bash
git clone https://github.com/KangMing14/minesweeper.git
cd minesweeper
corepack enable
pnpm install --frozen-lockfile
git config core.hooksPath      # must print .husky/_ ; if it prints nothing, run: pnpm prepare
pnpm typecheck && pnpm lint && pnpm test
```

**Windows note.** If `npm i -g pnpm` blocks its install script and `pnpm` then fails to start, use `corepack enable`, or install with `npm install -g --allow-scripts=pnpm pnpm@12.15.0`.

## The task loop

One task is one conversation, one branch and one pull request (spec section 7; the per-task loop in the master plan, section F; the developer's checklist in `docs/workflow/HOW_TO_USE.md`).

1. **Pick the task.** The first row of `ROADMAP.md` that is not `Done`. Tasks in a milestone run in numeric order.
2. **Start a conversation.** Attach the milestone file and a snapshot (`tools/snapshot.sh`), and paste Prompt A from `docs/workflow/PROMPT_TEMPLATES.md`. The assistant reads `CLAUDE.md`, the handoff package and the task, and reports any mismatch with the real code before writing anything.
3. **Implement test first.** Failing test, run it, implement, run it again (`/test-driven-development`). Use `/systematic-debugging` on any failure.
4. **Verify.** `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm format:check && pnpm check:todos && pnpm check:links && pnpm test:lint-fixtures && pnpm test && pnpm docs:api` (`/verification-before-completion`). Do not keep per-task verification scripts in the repository: they assert the state of one moment (task counts, which files exist) and turn red when a later task changes it. A one-off check belongs in the task's own tests, or in a script deleted at close-out. The M0 scripts `tools/verify-t02.mjs` to `verify-t06.mjs` were removed in M0-T09 and remain in history (`git show 3aa4c1b:tools/verify-t06.mjs`). `tools/verify-t01.sh` stays: it checks repository settings that do not change.
5. **Branch, commit, push.** Branch `m<n>/<task-id>-<slug>`; commit `type(scope): subject [Mn-Tnn]`. Open a PR with the same title and wait for the `ci` check.
6. **Review and merge.** Run `/requesting-code-review` at the end of a milestone. Squash-merge, delete the branch, pull `main`.
7. **Close out.** Set the task's row in `ROADMAP.md` (status, PR number, commit SHA, date); update `CHANGELOG.md`, `ARCHITECTURE.md` if an interface changed, and `DECISIONS.md` (with a new `docs/adr/` file) if a decision was made; save the session log in `docs/workflow/sessions/`. When the milestone's last task is done, tag `m<n>-complete`.

If a task conflicts with an ADR, an open decision or the canonical names, stop and settle it first; do not work around it.

## Skills

Skills the project uses, and when. Each task names its own; the baseline for every task is the first two.

| Skill | Use it for |
|---|---|
| `/test-driven-development` | Every task that adds behavior or tooling: failing test first |
| `/verification-before-completion` | Before saying a task is done: run the checks, read the output |
| `/systematic-debugging` | Any failing test or unexpected behavior, before proposing a fix |
| `/requesting-code-review` | Once at the end of each milestone |
| `/using-git-worktrees` | Optional isolated workspace for a task (`.worktrees/` is git-ignored) |
| `/documentation` | Documentation tasks (M0-T05) and doc updates |
| `/architecture` | Writing ADRs |
| `/frontend-design` | UI work in M3 and M10 |
| `/accessibility-review` | The accessibility pass in M10 |
| `/deploy-checklist` | Staging and launch in M9 and M11 |
| `/testing-strategy` | Test layout (light in M0-T04) and launch testing in M11 |
| `/brainstorming` | Before any post-launch item (backlog P10-A to P10-H) |



## Git workflow

Source: spec section 7.1. Rules are enforced by GitHub settings (`tools/github/protect-main.sh`) and, from M0-T03, by hooks and CI.

### Branches
- `main` is protected and always green. History on `main` is never rewritten. No direct pushes, no force pushes, no branch deletion, linear history required. The rules apply to admins too.
- Trunk-based development: one task = one short-lived branch = one pull request.
- Branch name: `m<n>/M<n>-T<nn>-<slug>`, for example `m1/M1-T04-flood-fill`; the milestone number repeats in the task ID. Work that belongs to no task: `chore/<slug>`. Lower case and hyphens only. CI checks the name of every pull request's branch (`scripts/check-branch-name.mjs`).

### Commits
- Conventional Commits: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`.
- Scope is the package (`engine`, `protocol`, `server`, `web`, `docs`); repository-wide changes may omit it.
- The task ID goes in the subject: `feat(engine): iterative flood fill [M1-T04]`. Work that belongs to no task uses `[chore]`.
- Enforced by commitlint in the `commit-msg` hook (see "Tooling and enforcement"). The check also runs on the PR title through CI from M0-T04.

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
tools/github/protect-main.sh OWNER/REPO ci           # after the first CI run (M0-T04): also require the `ci` check
tools/verify-t01.sh --remote OWNER/REPO            # verify
```

## Tooling and enforcement (M0-T03)

Hooks give fast feedback; CI (M0-T04) is the authority.

### First-time setup

```bash
pnpm install
git config core.hooksPath      # must print .husky/_ ; if it prints nothing, run: pnpm prepare
```

`pnpm install` skips the `prepare` step (which installs the hooks) when nothing changed, so run `pnpm prepare` yourself after cloning or if `core.hooksPath` is empty.

### Commands

| Command | What it does |
|---|---|
| `pnpm lint` | ESLint over the whole repo: TSDoc syntax, doc comments on exports, dependency boundaries, engine purity |
| `pnpm format` / `pnpm format:check` | Prettier write / check (code and config files; not Markdown) |
| `pnpm check:todos` | Fails on any TODO that does not name a task |
| `pnpm check:links` | Fails on a broken relative link or `#anchor` in any Markdown file (external links are not fetched) |
| `pnpm test:lint-fixtures` | Proves each rule above fires on a known-bad sample and stays quiet on a good one |
| `pnpm typecheck` | `tsc -b` for all packages |

### Hooks

- `pre-commit` (lint-staged): ESLint, Prettier check and the TODO check on staged files, plus `tsc -b` for every package that has a staged TypeScript file.
- `commit-msg`: commitlint.
- `pre-push`: `pnpm test:affected`, which runs only the tests affected by your changes since `origin/main` (see "Tests, API docs and CI").

### Commit message rule (commitlint)

`type(scope): subject [Mn-Tnn]`

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`. Scopes (optional): `engine`, `protocol`, `server`, `web`, `docs`.
- The subject must end with a task ID (`[M1-T04]`) or `[chore]`. GitHub's ` (#12)` suffix after a squash-merge is allowed.
- Subjects may start with an acronym (`PRNG`, `ADR-001`); the type must be lower case.
- Good: `feat(engine): iterative flood fill [M1-T04]`. Bad: `fix stuff`, `feat(engine): flood fill`, `feat(tools): ... [M1-T04]`.

### Documentation comment rules (spec section 7.2)

- Every exported class, function, interface, type alias, enum and constant needs a `/** ... */` comment. This is an **error** in `packages/engine` and `packages/protocol`, and a **warning** in `apps/*` until M5-T03 turns it into an error.
- Comment syntax is checked everywhere by `tsdoc/syntax`: use `@param name - text` (with the hyphen), standard tags only (`@remarks`, `@example`, `@throws`, `@returns`, `@internal`, `@deprecated`), and close every `{@link ...}`.
- In `packages/engine` and `packages/protocol` every exported symbol also needs an `@example` with content (error, `jsdoc/require-example`). Apps do not need one. Test files (`*.test.ts`) are exempt. A symbol that is exported only for other engine files or for tests, not through `index.ts`, is tagged `@internal`: it keeps its summary comment but needs no `@example`, and TypeDoc leaves it out. Declare and export in one statement (`export function ...`, `export const ...`): a symbol exported later with `export { name }` is only covered by the doc-comment rule, not the `@example` rule.
- In `packages/engine` and `packages/protocol` every exported declaration also needs a summary line (error, `jsdoc/require-description`): a comment that holds only `/** @internal */` fails. Put `@internal` on its own line, below the summary; `/** Helper. @internal */` on one line is not recognized as the tag and still asks for an `@example` (M1-T08).
- Not machine-enforced: `@param`/`@returns` completeness. Reviewers check it.
- Every TODO, FIXME, XXX and HACK names a task: `// TODO(M6-T04): ...`. A bare one fails the commit and `pnpm check:todos`. The scan reads code, workflow and shell files (`.ts .tsx .mts .cts .js .jsx .mjs .cjs .yml .yaml .sh`), not Markdown.

### Architecture and engine-purity rules

- `packages/engine` may import nothing project-internal and no Node built-ins. Lint bans the package names, paths into `packages` and `apps`, and `node:` imports; the compiler (`types: []`, no DOM lib, `rootDir`) rejects the rest (bare `fs`, relative paths into another package, `setTimeout`). Neither sees aliasing such as `const M = Math; M.random()`; the determinism tests of M2-T06 run with throwing stubs to catch that.
- `packages/protocol` may import only `@minesweeper/engine` (and third-party packages), no Node built-ins.
- `apps/server` and `apps/web` may not import each other, by package name or relative path.
- Inside `packages/engine` (tests excepted) these are errors: `Math.random`, `Date`, `performance`, `window`, `document`, `process`, and the same names through `globalThis`. Time enters only as `t` on a `Command`.

### Dependency advisories

- `ci` runs `pnpm audit:prod` on every pull request: an advisory of moderate severity or higher in a production dependency fails it. Fix by moving to the patched version, with a new pin and the 14-day rule's security exception (see `DECISIONS.md`).
- The `audit` workflow runs weekly and on demand: it prints the full report and fails on high or critical severity anywhere, including development tools.
- A moderate advisory in a development tool that has no fixed release yet is recorded in `DECISIONS.md` under "Dependency advisories" with its reason and review date, not silenced.

### Changing a rule

Add or change a fixture in `tools/lint-fixtures/cases/` and its entry in `tools/lint-fixtures/manifest.mjs` first, watch `pnpm test:lint-fixtures` fail, then change `eslint.config.js`. Fixture files use the `.fixture` extension so the normal lint ignores them; the test lints them as if they lived at the `virtualPath` given in the manifest.

## Tests, API docs and CI (M0-T04)

### Commands

| Command | What it does |
|---|---|
| `pnpm test` | Vitest, all four projects (`engine`, `protocol`, `server`, `web`), once, no watch; never needs a browser (`*.browser.test.ts` files are excluded) |
| `pnpm test:coverage` | The same with v8 coverage: terminal table plus `coverage/` (`lcov.info`, `coverage-summary.json`) |
| `pnpm test:browser` | The determinism suite in Chromium (Vitest browser mode, `vitest.browser.config.ts`); needs the browser installed once (see "Running the browser tests") |
| `pnpm test:affected` | Only tests affected by changes since `origin/main` (what `pre-push` runs); the whole suite if `origin/main` is missing |
| `pnpm typecheck` | `tsc -b` for the packages, then `pnpm typecheck:tests` |
| `pnpm typecheck:tests` | Type-checks test files (`packages/*/tsconfig.test.json`) and `vitest.config.ts` and `vitest.browser.config.ts` (`tsconfig.tooling.json`) |
| `pnpm docs:api` | TypeDoc API reference for `engine` and `protocol` into `docs/api/` (ignored by git); any warning is an error |
| `pnpm exec vitest --project engine` | Run one project; add `--watch` while developing |

### Where tests live
- Unit tests sit next to the code: `src/**/*.test.ts` (or `.spec.ts`). Shared and integration tests go in a package's `test/` directory (the `engine` determinism suite since M2-T06, server fault tests in M6). A module there that is not named `*.test.ts` is not collected by itself and is linted like source code; the runners are the `*.test.ts` files that call it.
- Golden data (known-good outputs that pin a contract, such as `prng-vectors.json`) sits in `packages/<name>/fixtures/` and is imported from tests with `import data from '../fixtures/x.json' with { type: 'json' }`; the package's `tsconfig.test.json` sets `resolveJsonModule` for it, and engine code may not read files with `node:fs`. A fixture says in its own `generatedBy` field how it was produced, and it must not be produced by the code it checks. Editing a golden value is a contract change (ADR-002), not a test fix.
- Playwright end-to-end specs live in `e2e/` (M3-T08) and are never picked up by Vitest. Browser-mode Vitest tests are different: they are `packages/*/test/**/*.browser.test.ts` files, run by `pnpm test:browser`.
- `vitest.config.ts` defines one project per package. Workspace files (`vitest.workspace.ts`) were removed in Vitest 4, so projects are declared in `test.projects`.
- Tests import workspace packages by name (`@minesweeper/engine`). Vitest resolves those names to the package **source**, so tests run on a fresh clone without `tsc -b`. TypeScript still reads types from the built output, which is why `typecheck` builds first.
- `*.test.ts` files are excluded from the `tsc -b` build of `engine` and `protocol` (they are not shipped, and those packages compile without Node types). The `tsconfig.test.json` next to each checks them instead.
- Coverage thresholds apply to `packages/engine` only (95% statements, functions and lines; 90% branches) and `index.ts` barrels are excluded (`vitest.config.ts`, M1-T07). `pnpm test:coverage` runs in CI, so they gate every pull request. Changing a number is a deliberate edit of that file, explained in the pull request.
- The engine's public surface is locked by `packages/engine/src/api-surface.test.ts` against `packages/engine/src/__snapshots__/api-surface.txt`. A task that adds, renames or reshapes an export updates the snapshot with `pnpm exec vitest run --project engine -u`, reads the diff and explains it in the pull request. CI never writes snapshots.

### Running the browser tests
- One-time per machine, and again after `playwright` changes version: `pnpm exec playwright install chromium`. On a bare Linux machine or container use `pnpm exec playwright install --with-deps chromium` (CI does), which also installs the system libraries.
- Run: `pnpm test:browser`. It starts Chromium headless, runs `packages/engine/test/determinism.browser.test.ts` (the same suite as the Node runner, `determinism.shared.ts`) and prints the usual Vitest report. Run only the Node side with `pnpm exec vitest run --project engine packages/engine/test/determinism.node`.
- "Executable doesn't exist" means the browser is not installed (or is the revision of another `playwright` version): run the install command above. A failure in the browser run only means a real difference between Node and Chromium (or a stub that Chromium will not let the test install, which is reported by name), so read the first failing test before changing anything; never edit a golden fixture to turn it green (ADR-002).
- The browser tests run the TypeScript source through Vite, not the built `dist/`. They are not part of `pnpm test`, `pnpm test:coverage` or the `pre-push` hook, so a machine without Chromium can still do everything else.
- Changing the suite: the checks live in `packages/engine/test/determinism.shared.ts` (one file for both environments), the stubs and the fuzz player in `determinism.support.ts`. The module is subject to the engine's purity lint, so the names `Date`, `performance` and `Math.random` may only appear as strings there.

### API reference (TypeDoc)
- `typedoc.json` documents `packages/engine` and `packages/protocol` (spec section 7.2). `treatWarningsAsErrors` makes unresolved `{@link}`s, unknown tags and unexported references fail `pnpm docs:api`, locally and in CI.
- Open `docs/api/index.html` after a run to read the reference as a consumer would. The output is never committed.
- `@internal` symbols are left out of the reference. An empty package (`protocol` until M5-T01) is not a warning.

### Continuous integration
- Workflow: `.github/workflows/ci.yml`, one job named `ci`, on every pull request to `main` and every push to `main`.
- Steps, in order: install with `--frozen-lockfile` (pnpm store cached), `typecheck`, `lint`, `format:check`, `check:todos`, `check:links` (added in M0-T05), `test:lint-fixtures`, `test:coverage`, `playwright install --with-deps chromium` and `test:browser` (added in M2-T06), `docs:api`, and on pull requests a commitlint check of the **PR title**. Coverage and `docs/api` are uploaded as the `ci-reports` artifact (7 days).
- Third-party actions are pinned to full commit SHAs (tag in a comment). Versions and dates are in `DECISIONS.md`. Update them on purpose, one at a time.
- Running everything CI runs, locally: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm format:check && pnpm check:todos && pnpm check:links && pnpm test:lint-fixtures && pnpm test:coverage && pnpm test:browser && pnpm docs:api` (run `pnpm exec playwright install chromium` once before `pnpm test:browser`).
- Checking a PR title locally: `printf '%s\n' 'ci: add test tooling [M0-T04]' | pnpm exec commitlint`.

### Making CI a required check
After the first CI run exists on GitHub (open the M0-T04 pull request), run once as a repository admin:

```bash
tools/github/protect-main.sh OWNER/REPO ci
tools/verify-t01.sh --remote OWNER/REPO
```

The required check is the job name, `ci`. Rename the job only together with this command.

## Keeping the documents current

The documents carry context between conversations, so a task is not done until they are right.

| Document | Holds | Changes when |
|---|---|---|
| `README.md` | Setup, scripts, where everything is | A script or setup step changes |
| `PROJECT_OVERVIEW.md` | Concept, MVP, scope, glossary | Scope or vocabulary changes (rare; scope changes need an ADR) |
| `ROADMAP.md` | Milestone index and the status of all 86 tasks, the only status table | Every task close-out |
| `ARCHITECTURE.md` | Diagrams, canonical names, public interfaces, known limits | An interface, package or limit changes |
| `DECISIONS.md` | ADR index, open decisions, dependency pins | A decision is made or a dependency is added |
| `CHANGELOG.md` | What changed, by task | Every task close-out |
| `DEVELOPMENT_GUIDE.md` | This guide | A rule, command or workflow changes |
| `CLAUDE.md` | Read order and rules for assistants | The workflow changes |
| `docs/milestones/` | Handoff package and tasks per milestone | A task is split or corrected on purpose |
| `docs/handoffs/TEMPLATE.md` | The handoff package format | The format changes |
| `docs/adr/` | One file per decision, append-only | A decision is made (never edited afterwards) |
| `docs/workflow/sessions/` | One log per conversation | Every task close-out |

`pnpm check:links` keeps the links between these files honest; CI runs it on every pull request. The spec and the master plan are approved documents: correct a typo in them only deliberately and say so in the changelog.
