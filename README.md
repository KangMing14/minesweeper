# Competitive Minesweeper

[![CI](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)

A browser-based competitive Minesweeper: 1v1 races on an identical seeded board, plus solo time-attack with leaderboards. TypeScript, pnpm monorepo.

**Status:** M0 Foundations in progress. See [ROADMAP.md](ROADMAP.md) for per-task status.

## Setup

Requires Node 24 LTS (`>=24.15.0`, see `.nvmrc`) and Git. pnpm is pinned by `packageManager` in `package.json` and provided by Corepack.

```bash
corepack enable
pnpm install
git config core.hooksPath   # must print .husky/_ ; if it prints nothing, run: pnpm prepare
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm typecheck` | Type-check every package and every test file |
| `pnpm lint` / `pnpm format:check` | ESLint (TSDoc, boundaries, engine purity) / Prettier |
| `pnpm test` | Vitest, once |
| `pnpm test:coverage` | Vitest with coverage reports in `coverage/` |
| `pnpm docs:api` | TypeDoc API reference in `docs/api/` |

CI runs all of these on every pull request. Details, the git workflow and the doc-comment rules are in [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md).

This README is still short: M0-T05 completes it together with the other project documents.
