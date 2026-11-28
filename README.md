# Competitive Minesweeper

[![CI](https://github.com/KangMing14/minesweeper/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/KangMing14/minesweeper/actions/workflows/ci.yml)

A browser-based competitive Minesweeper: 1v1 races on an identical seeded board with a guaranteed safe opening, plus solo time-attack with leaderboards. TypeScript, pnpm monorepo, a deterministic engine and a server-authoritative backend. Inspired by the competitive feel of TETR.IO, not a copy of it.

**Status:** M0 Foundations, M1 Engine core and M2 Deterministic engine are done and tagged. M3 Local solo client has started: the web app shell and design tokens (M3-T01), the `GameSession` seam with `LocalSession` (M3-T02) the canvas board renderer (M3-T03), the input controller (M3-T04) and the screens (M3-T05: menu, play, result) are in place, so the game can be played in the browser; the restart keys and retry (M3-T06), the local statistics (M3-T07) and the accessibility basics with the Playwright smoke test (M3-T08: live region, focus ring on keyboard focus, skip link, `pnpm test:e2e`) are in. M3 is complete and waits for its review. [ROADMAP.md](ROADMAP.md) has the status of every task. License: all rights reserved until launch ([ADR-008](docs/adr/ADR-008-license.md), [LICENSE](LICENSE)).

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
| `pnpm --filter web dev` / `pnpm --filter web build` | The browser client: Vite dev server at `http://localhost:5173` / type check and production build into `apps/web/dist/` (CI runs the build) |
| `pnpm format` | Prettier, writing changes |
| `pnpm check:todos` | Fails on any TODO, FIXME, XXX or HACK that does not name a task (code, workflow and shell files) |
| `pnpm check:links` | Fails on a broken relative link or anchor in any Markdown file |
| `pnpm test:lint-fixtures` | Proves each lint, TODO, branch-name and commit-message rule fires for the intended reason |
| `pnpm test` | Vitest, once |
| `pnpm test:browser` | The determinism suite in Chromium (Vitest browser mode); run `pnpm exec playwright install chromium` once first |
| `pnpm test:e2e` | The Playwright smoke tests (M3-T08): builds the client, serves it with `vite preview` and plays a seeded game in Chromium with the mouse and with the keyboard; same Chromium as `test:browser` |
| `pnpm test:scripts`, `pnpm compare:fuzz-digests` | The tests of, and the run of, the Node-versus-Chromium comparison of the fuzz digests (after `pnpm test` and `pnpm test:browser`) |
| `pnpm test:affected` | Vitest on tests affected since `origin/main` (the pre-push hook) |
| `pnpm audit:prod` / `pnpm audit:all` | Dependency advisories: moderate or higher in production dependencies (CI) / high or higher anywhere (weekly workflow) |
| `pnpm test:coverage` | Vitest with coverage reports in `coverage/` |
| `pnpm docs:api` | TypeDoc API reference in `docs/api/` |

CI runs all of these on every pull request. Details, the git workflow and the doc-comment rules are in [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md).

## Controls

Implemented by the input controller (M3-T04) on the play screen (M3-T05). Start the app with `pnpm --filter web dev`, pick a difficulty, and play.

| Input | Action |
|---|---|
| Left click | Reveal the cell. On a revealed number: chord (open its neighbors when the flags around it match the number) |
| Right click | Flag or unflag a hidden cell |
| Middle click, or left and right together | Chord |
| Arrow keys | Move the keyboard cursor (stops at the edges). If you reached the board by keyboard (a game started with Enter, Tab, or the skip link) the cursor is already showing; after a mouse click, the first key you press only shows it |
| Space | Reveal the cursor cell |
| F | Flag or unflag the cursor cell |
| Enter or C | Chord at the cursor cell |
| R | Start a new board of the same difficulty (new seed), while the focus is in the game (the board, or anything on the play and result screens). A game in progress is dropped without asking |
| Shift+R | Retry the same board (same seed, same mines): start again from the opening |

The mouse acts when you release the button, over the cell where you release it. Releasing over a gap between cells does nothing. Ctrl+click is ignored. R and Shift+R (M3-T06) work only while the focus is inside the game area, which is the board on the play screen and anything on the play and result screens (M3-T08, WCAG 2.1.4 Character Key Shortcuts); with the focus on the theme button or the page background they do nothing, and they never act on the menu. They are also ignored with Ctrl, Cmd or Alt held (Ctrl+R still reloads the page), while a key is held down, and in a text field. The result screen has buttons for both.

**Screen readers and keyboard.** The board is one focusable canvas (`role="application"`, named "Minesweeper board, 9 by 9") with a hidden key help. A polite live region says each move: the cell under the cursor (`Row 3, column 4, hidden`), what a reveal opened, flags placed and removed, a new game, a win with its time, and a loss (never where the mine was). A "Skip to board" link appears on the first Tab during a game. The live region, the board's role and the keyboard ring are covered by jsdom tests and by the Playwright smoke tests (`pnpm test:e2e`); nobody has tried them with a screen reader yet, see [docs/a11y-findings.md](docs/a11y-findings.md).

## How a game goes

1. **Menu.** Choose Beginner (9 × 9, 10 mines), Intermediate (16 × 16, 40 mines) or Expert (30 × 16, 99 mines). Each game gets a new random board. Once you have finished a game, a "Your records" table shows, for each difficulty, your games, wins, best time and average 3BV per second; the numbers are kept in this browser only, and a retry of the same board is not counted.
2. **Play.** The clock starts as soon as the board appears, not at your first click (the solo timing rule is settled in M4). The HUD shows the clock and the mines left, which goes below zero if you place more flags than there are mines. The board has the keyboard focus from the start. Press R for a new board or Shift+R to retry this one while the focus is in the game; the game in progress is dropped without asking. "Change difficulty" returns to the menu and abandons the game.
3. **Result.** The heading says whether you cleared the board or hit a mine, with your time, the board's 3BV, 3BV per second and how many safe cells you cleared, and the finished board with its mines. "New board" plays the same difficulty on a new board, and "Retry this board" plays the same board again.
4. **Stuck game.** A game that reaches the engine's limit of 100,000 commands without ending cannot go on; the play screen says so and offers "New board".

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
| [ROADMAP.md](ROADMAP.md) | Milestone index and the status of all 90 tasks |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Diagrams, package layout, dependency rule, canonical names |
| [DECISIONS.md](DECISIONS.md) | ADR index, open decisions, dependency pins |
| [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) | Git workflow, tooling, tests, CI, the task loop |
| [CHANGELOG.md](CHANGELOG.md) | What changed, by task |
| [CLAUDE.md](CLAUDE.md) | Read order and rules for AI assistants working here |
| [docs/workflow/HOW_TO_USE.md](docs/workflow/HOW_TO_USE.md) | The developer's guide to running the project one task at a time |
| [Design spec](docs/superpowers/specs/2026-11-04-competitive-minesweeper-design.md) and [master plan](docs/superpowers/plans/2026-11-04-competitive-minesweeper-roadmap.md) | The approved source documents |
