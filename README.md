# Competitive Minesweeper

[![CI](https://github.com/KangMing14/minesweeper/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/KangMing14/minesweeper/actions/workflows/ci.yml)

A browser-based competitive Minesweeper: 1v1 races on an identical seeded board with a guaranteed safe opening, plus solo time-attack with leaderboards. TypeScript, pnpm monorepo, a deterministic engine and a server-authoritative backend. Inspired by the competitive feel of TETR.IO, not a copy of it.

**Status:** M0 Foundations is done (the `m0-complete` tag follows its review); the game itself starts with the engine in M1. [ROADMAP.md](ROADMAP.md) has the status of every task. License: all rights reserved until launch ([ADR-008](docs/adr/ADR-008-license.md), [LICENSE](LICENSE)).

## Setup

Requires Node 24 LTS (`>=24.15.0`, see `.nvmrc`; an older Node makes `pnpm install` fail) and Git. pnpm is pinned by `packageManager` in `package.json` and provided by Corepack.

```bash
corepack enable
pnpm install
git config core.hooksPath   # must print .husky/_ ; if it prints nothing, run: pnpm prepare
```

On Windows, if pnpm fails to start after `npm i -g pnpm`, see the Windows note in [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md#getting-started).

## Scripts

| Command | What it does |
|---|---|
| `pnpm typecheck` | Type-check every package and every test file |
| `pnpm lint` / `pnpm format:check` | ESLint (TSDoc, boundaries, engine purity) / Prettier |
| `pnpm build` | `tsc -b`, the same build `typecheck` starts with |
| `pnpm format` | Prettier, writing changes |
| `pnpm check:todos` | Fails on any TODO, FIXME, XXX or HACK that does not name a task (code, workflow and shell files) |
| `pnpm check:links` | Fails on a broken relative link or anchor in any Markdown file |
| `pnpm test:lint-fixtures` | Proves each lint, TODO, branch-name and commit-message rule fires for the intended reason |
| `pnpm test` | Vitest, once |
| `pnpm test:affected` | Vitest on tests affected since `origin/main` (the pre-push hook) |
| `pnpm audit:prod` / `pnpm audit:all` | Dependency advisories: moderate or higher in production dependencies (CI) / high or higher anywhere (weekly workflow) |
| `pnpm test:coverage` | Vitest with coverage reports in `coverage/` |
| `pnpm docs:api` | TypeDoc API reference in `docs/api/` |

CI runs all of these on every pull request. Details, the git workflow and the doc-comment rules are in [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md).

## Repository layout

| Path | Role |
|---|---|
| `packages/engine` | Pure, deterministic game logic (no DOM, Node APIs, clocks or `Math.random`) |
| `packages/protocol` | Wire-message schemas and shared types |
| `apps/server` | Authoritative game server (Fastify and `ws`) |
| `apps/web` | Browser client (React, Vite, Canvas 2D) |
| `docs/` | Spec, master plan, milestone files, ADRs, workflow guides |
| `tools/`, `scripts/` | Verification scripts, lint fixtures, repository checks |

## Documentation

| Read this | For |
|---|---|
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | The concept, the MVP, what is out of scope, a glossary |
| [ROADMAP.md](ROADMAP.md) | Milestone index and the status of all 83 tasks |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Diagrams, package layout, dependency rule, canonical names |
| [DECISIONS.md](DECISIONS.md) | ADR index, open decisions, dependency pins |
| [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) | Git workflow, tooling, tests, CI, the task loop |
| [CHANGELOG.md](CHANGELOG.md) | What changed, by task |
| [CLAUDE.md](CLAUDE.md) | Read order and rules for AI assistants working here |
| [docs/workflow/HOW_TO_USE.md](docs/workflow/HOW_TO_USE.md) | The developer's guide to running the project one task at a time |
| [Design spec](docs/superpowers/specs/2026-11-04-competitive-minesweeper-design.md) and [master plan](docs/superpowers/plans/2026-11-04-competitive-minesweeper-roadmap.md) | The approved source documents |
