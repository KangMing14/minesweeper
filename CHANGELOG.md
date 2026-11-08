# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entries are drafted from the conventional commits at task close-out and then curated by hand; each names its task ID. Versions start at `v0.<n>.0` for pre-launch releases and `v1.0.0` at public launch (see [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md), "Tags and releases").

## [Unreleased]

### Added

- **M0-T05 Documentation skeleton.** `PROJECT_OVERVIEW.md`, `CHANGELOG.md`, `CLAUDE.md` (read order and rules for AI assistants) and `docs/handoffs/TEMPLATE.md`. `ROADMAP.md` gains a milestone index; `ARCHITECTURE.md` gains the principles, diagrams, patterns and the canonical-names table; `DECISIONS.md` gains the ADR template, the ADR index (ADR-001..016) and the open decisions D-01..D-13; `DEVELOPMENT_GUIDE.md` gains the task loop, the skills and the Windows pnpm note; `README.md` is completed.
- **M0-T05** `pnpm check:links` (`scripts/check-links.mjs`): fails on a broken relative link or anchor in any Markdown file. It runs in CI after `check:todos`. `tools/verify-t05.mjs` verifies the deliverables.
- **M0-T04 Test tooling and CI.** Vitest with one project per package and v8 coverage, TypeDoc for `engine` and `protocol` with warnings as errors, a single-job GitHub Actions workflow named `ci` (typecheck, lint, format check, to-do check, lint fixtures, coverage, API reference, PR-title check), a `pre-push` hook that runs only the affected tests, and a type-check of test files.
- **M0-T03 Lint, format, hooks and documentation lint.** ESLint flat config with TSDoc syntax and doc-comment rules, dependency-boundary rules and engine-purity rules; Prettier; husky and lint-staged hooks; commitlint with a task-ID rule; `scripts/check-todos.mjs`; 51 fixture cases in `tools/lint-fixtures/` that prove each rule fires.
- **M0-T02 Monorepo scaffold.** pnpm workspace with `packages/engine`, `packages/protocol`, `apps/server` and `apps/web` (scope `@minesweeper/`), strict shared TypeScript configuration with project references, pinned tool versions recorded in `DECISIONS.md`, Node 24 via `.nvmrc`.
- **M0-T01 Repository and git conventions.** `.gitignore`, `.gitattributes` (LF), `.editorconfig`, `.env.example`, pull-request template, branch-protection script `tools/github/protect-main.sh` and its verifier.

### Changed

- **M0-T05** The master plan's section F now names the real spec path `docs/superpowers/specs/` (it said `docs/specs/`).

### Notes

- The engine exports only the throwaway `m0SampleAdd`, which exists to exercise the pipeline and is removed in M1-T07. The other packages export nothing yet.
