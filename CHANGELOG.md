# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entries are drafted from the conventional commits at task close-out and then curated by hand; each names its task ID. Versions start at `v0.<n>.0` for pre-launch releases and `v1.0.0` at public launch (see [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md), "Tags and releases").

## [Unreleased]

### Added

- **M0-T07** `jsdoc/require-example` no longer applies to symbols tagged `@internal` (`exemptedBy`); two fixtures pin it.
- **M0-T08** The full mine-exposure constraint is in `CLAUDE.md` rule 8 and `ARCHITECTURE.md` principle 2. New open decision D-14 (when race mines are released), owned by M4-T03 (ADR-010); M5-T05's leak test and M4-T03 are reworded. M1-T07 (coverage thresholds), M2-T06 (throwing stubs), M5-T01 (`protocol` and engine imports) gained one sentence each.
- **M0-T09** `tools/snapshot.sh --git-state` writes `GIT_STATE.txt` into the zip; `--with-git` includes `.git` (without `config` and `hooks`); no flag, no change. Prompt F2 (re-review) added. `tools/verify-t02.mjs` to `verify-t06.mjs` removed.
- **M0-T10** `pnpm audit:prod` in `ci`; weekly `audit.yml`; `scripts/check-branch-name.mjs` on pull requests; `engineStrict: true`; `check-todos` reads `.yml`, `.yaml`, `.sh` and catches FIXME, XXX and HACK. Lint fixtures: 51 to 76 cases.
- **M0-T11** `README_FIRST.md` and `WHERE_THINGS_LIVE.txt` removed; ROADMAP PR column is the PR number; README scripts table completed; `DECISIONS.md` gains "Errata to accepted ADRs" and "Dependency advisories".
- **M0-T06 ADRs, dependency verification and license.** `docs/adr/ADR-001` to `ADR-008` (monorepo and modular monolith, deterministic engine, server-authoritative play, `GameSession` adapter, technology stack, git workflow, code documentation, license), all `Accepted`; the ADR index in `DECISIONS.md` links them. ADR-005 records the Better Auth re-verification of 2026-11-09 (verdict: passes with conditions) and its fallback. D-12 is settled: **all rights reserved until launch**, with a `LICENSE` file and `"license": "UNLICENSED"` in the five `package.json` files. The M0 milestone review is `docs/reviews/M0-review.md`; `tools/verify-t06.mjs` verifies the deliverables.
- **M0-T05 Documentation skeleton.** `PROJECT_OVERVIEW.md`, `CHANGELOG.md`, `CLAUDE.md` (read order and rules for AI assistants) and `docs/handoffs/TEMPLATE.md`. `ROADMAP.md` gains a milestone index; `ARCHITECTURE.md` gains the principles, diagrams, patterns and the canonical-names table; `DECISIONS.md` gains the ADR template, the ADR index (ADR-001..016) and the open decisions D-01..D-13; `DEVELOPMENT_GUIDE.md` gains the task loop, the skills and the Windows pnpm note; `README.md` is completed.
- **M0-T05** `pnpm check:links` (`scripts/check-links.mjs`): fails on a broken relative link or anchor in any Markdown file. It runs in CI after `check:todos`. `tools/verify-t05.mjs` verifies the deliverables.
- **M0-T04 Test tooling and CI.** Vitest with one project per package and v8 coverage, TypeDoc for `engine` and `protocol` with warnings as errors, a single-job GitHub Actions workflow named `ci` (typecheck, lint, format check, to-do check, lint fixtures, coverage, API reference, PR-title check), a `pre-push` hook that runs only the affected tests, and a type-check of test files.
- **M0-T03 Lint, format, hooks and documentation lint.** ESLint flat config with TSDoc syntax and doc-comment rules, dependency-boundary rules and engine-purity rules; Prettier; husky and lint-staged hooks; commitlint with a task-ID rule; `scripts/check-todos.mjs`; 51 fixture cases in `tools/lint-fixtures/` that prove each rule fires.
- **M0-T02 Monorepo scaffold.** pnpm workspace with `packages/engine`, `packages/protocol`, `apps/server` and `apps/web` (scope `@minesweeper/`), strict shared TypeScript configuration with project references, pinned tool versions recorded in `DECISIONS.md`, Node 24 via `.nvmrc`.
- **M0-T01 Repository and git conventions.** `.gitignore`, `.gitattributes` (LF), `.editorconfig`, `.env.example`, pull-request template, branch-protection script `tools/github/protect-main.sh` and its verifier.

### Changed

- **M0-T06** The pinned `better-auth` moves from 1.7.12 to 1.7.18: every version below 1.7.16 is affected by the 12 advisories of 2026-11-03. The pin rule in `DECISIONS.md` gains a security-fix exception to the 14-day wait (ADR-005). The developer chose 1.7.18 over 1.7.16.
- **M0-T06** `tools/verify-t05.mjs` no longer asserts that M0-T06 is `Not started` or that no ADR is accepted; both were true only until this task. It now checks that every ADR marked `Accepted` has a file in `docs/adr/`.
- **M0-T05** The master plan's section F now names the real spec path `docs/superpowers/specs/` (it said `docs/specs/`).

### Notes

- The task count is 83 (was 78): M0-T07 to M0-T11 came from the M0 milestone review. The approved master plan and spec still say 78; `ROADMAP.md` is the authority.
- The engine exports only the throwaway `m0SampleAdd`, which exists to exercise the pipeline and is removed in M1-T07. The other packages export nothing yet.
