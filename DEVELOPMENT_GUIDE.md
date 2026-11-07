# Development Guide

> Stub: M0-T01 wrote the git section, M0-T03 the tooling section and M0-T04 the tests, API docs and CI section. M0-T05 completes the guide (task loop, skills).

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
- In `packages/engine` and `packages/protocol` every exported symbol also needs an `@example` with content (error, `jsdoc/require-example`). Apps do not need one. Test files (`*.test.ts`) are exempt. Declare and export in one statement (`export function ...`, `export const ...`): a symbol exported later with `export { name }` is only covered by the doc-comment rule, not the `@example` rule.
- Not machine-enforced: `@param`/`@returns` completeness. Reviewers check it.
- Every TODO names a task: `// TODO(M6-T04): ...`. A bare `TODO` fails the commit and `pnpm check:todos`.

### Architecture and engine-purity rules

- `packages/engine` may import nothing project-internal and no Node built-ins.
- `packages/protocol` may import only `@minesweeper/engine` (and third-party packages), no Node built-ins.
- `apps/server` and `apps/web` may not import each other, by package name or relative path.
- Inside `packages/engine` (tests excepted) these are errors: `Math.random`, `Date`, `performance`, `window`, `document`, `process`, and the same names through `globalThis`. Time enters only as `t` on a `Command`.

### Changing a rule

Add or change a fixture in `tools/lint-fixtures/cases/` and its entry in `tools/lint-fixtures/manifest.mjs` first, watch `pnpm test:lint-fixtures` fail, then change `eslint.config.js`. Fixture files use the `.fixture` extension so the normal lint ignores them; the test lints them as if they lived at the `virtualPath` given in the manifest.

## Tests, API docs and CI (M0-T04)

### Commands

| Command | What it does |
|---|---|
| `pnpm test` | Vitest, all four projects (`engine`, `protocol`, `server`, `web`), once, no watch |
| `pnpm test:coverage` | The same with v8 coverage: terminal table plus `coverage/` (`lcov.info`, `coverage-summary.json`) |
| `pnpm test:affected` | Only tests affected by changes since `origin/main` (what `pre-push` runs); the whole suite if `origin/main` is missing |
| `pnpm typecheck` | `tsc -b` for the packages, then `pnpm typecheck:tests` |
| `pnpm typecheck:tests` | Type-checks test files (`packages/*/tsconfig.test.json`) and `vitest.config.ts` (`tsconfig.tooling.json`) |
| `pnpm docs:api` | TypeDoc API reference for `engine` and `protocol` into `docs/api/` (ignored by git); any warning is an error |
| `pnpm exec vitest --project engine` | Run one project; add `--watch` while developing |

### Where tests live
- Unit tests sit next to the code: `src/**/*.test.ts` (or `.spec.ts`). Shared and integration tests go in a package's `test/` directory (`engine` determinism suite in M2, server fault tests in M6).
- Playwright specs live in `e2e/` (M3-T08) and are never picked up by Vitest.
- `vitest.config.ts` defines one project per package. Workspace files (`vitest.workspace.ts`) were removed in Vitest 4, so projects are declared in `test.projects`.
- Tests import workspace packages by name (`@minesweeper/engine`). Vitest resolves those names to the package **source**, so tests run on a fresh clone without `tsc -b`. TypeScript still reads types from the built output, which is why `typecheck` builds first.
- `*.test.ts` files are excluded from the `tsc -b` build of `engine` and `protocol` (they are not shipped, and those packages compile without Node types). The `tsconfig.test.json` next to each checks them instead.
- Coverage has no thresholds yet. M1 sets them once the engine has real code.
- The M0 sample (`packages/engine/src/sample.ts` and its test) exists only to exercise the pipeline. M1-T07 removes it.

### API reference (TypeDoc)
- `typedoc.json` documents `packages/engine` and `packages/protocol` (spec section 7.2). `treatWarningsAsErrors` makes unresolved `{@link}`s, unknown tags and unexported references fail `pnpm docs:api`, locally and in CI.
- Open `docs/api/index.html` after a run to read the reference as a consumer would. The output is never committed.
- `@internal` symbols are left out of the reference. An empty package (`protocol` until M5-T01) is not a warning.

### Continuous integration
- Workflow: `.github/workflows/ci.yml`, one job named `ci`, on every pull request to `main` and every push to `main`.
- Steps, in order: install with `--frozen-lockfile` (pnpm store cached), `typecheck`, `lint`, `format:check`, `check:todos`, `test:lint-fixtures`, `test:coverage`, `docs:api`, and on pull requests a commitlint check of the **PR title**. Coverage and `docs/api` are uploaded as the `ci-reports` artifact (7 days).
- Third-party actions are pinned to full commit SHAs (tag in a comment). Versions and dates are in `DECISIONS.md`. Update them on purpose, one at a time.
- Running everything CI runs, locally: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm format:check && pnpm check:todos && pnpm test:lint-fixtures && pnpm test:coverage && pnpm docs:api`.
- Checking a PR title locally: `printf '%s\n' 'ci: add test tooling [M0-T04]' | pnpm exec commitlint`.

### Making CI a required check
After the first CI run exists on GitHub (open the M0-T04 pull request), run once as a repository admin:

```bash
tools/github/protect-main.sh OWNER/REPO ci
tools/verify-t01.sh --remote OWNER/REPO
```

The required check is the job name, `ci`. Rename the job only together with this command.
