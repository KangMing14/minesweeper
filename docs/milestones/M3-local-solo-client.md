# M3 Local Solo Client

**Goal:** a playable single-player Minesweeper in the browser, built on `GameSession` so networking can be added without UI changes.
**Depends on:** M2. **Brief phase:** 3 (plus the design tokens and accessibility basics from the polish phase).
**Baseline skills for every task:** `/test-driven-development` (logic and components), `/verification-before-completion`. UI tasks also use `/frontend-design`. Run `/requesting-code-review` at milestone end.

## Conversation Handoff Package

1. **Project context.** Browser-based competitive Minesweeper in TypeScript, OOP, pnpm monorepo (`packages/engine`, `packages/protocol`, `apps/server`, `apps/web`). MVP: 1v1 race on an identical seeded board with a guaranteed shared safe opening, plus solo time-attack. The client's UI talks only to a `GameSession` interface; `LocalSession` runs the engine in the browser now and `RemoteSession` will talk to the server in M5. The engine is pure and deterministic.
2. **Tasks:** M3-T01 to M3-T08, in order.
3. **Prerequisites and baseline:** tag `m2-complete`. Copy the actual exported signatures of `createGame`, `Game`, `GameView`, `GameEvent`, `Command`, `PRESETS`, `GameResult` from `packages/engine/src/index.ts` before starting.
4. **Locked decisions:** ADR-001..009; React + Vite + Zustand + Tailwind with CSS-variable tokens; Canvas 2D board behind `BoardRenderer`; the `GameSession` shape in the roadmap plan's canonical names; time is stamped by the session, never by the engine; desktop-first (D-08 working assumption).
5. **Deliverables:** web app shell with design tokens; `GameSession`, `LocalSession`, `Clock`; `CanvasBoardRenderer`; `InputController`; screens (menu, play, result); restart and retry; local stats; accessibility basics; Playwright smoke test in CI.
6. **Acceptance:** a person can pick a preset, play to a win or loss with mouse and keyboard, see time and mines remaining, restart, and see persisted best times; keyboard-only play works; CI runs the smoke test.
7. **Skills:** baseline; `/frontend-design`; `/ux-copy` for user-facing strings; `/accessibility-review` (light check in T08).
8. **Documents:** spec 4.1 and 4.8; `ARCHITECTURE.md`. Update: `ARCHITECTURE.md` (web section), `DEVELOPMENT_GUIDE.md` (running the web app), `ROADMAP.md`, `CHANGELOG.md`.

**Interfaces fixed for this milestone:**
- `interface Clock { nowMs(): number }` (declared in `engine` as an interface only; `SystemClock` implemented in `apps/web`).
- `type PlayerAction = { type: Command['type']; index: CellIndex }`.
- `interface GameSession { start(): void; dispatch(action: PlayerAction): void; subscribe(listener: (event: GameEvent) => void): () => void; view(): GameView; elapsedMs(): number; result(): GameResult | undefined; dispose(): void }`.

---

### M3-T01 Web scaffold and design tokens

- **Objective:** a running app shell with a themeable token system.
- **Description:** Vite + React + Tailwind in `apps/web`, workspace dependency on `engine`, CSS-variable tokens.
- **Prerequisites:** M2.
- **Implementation guidance:** tokens for color (surface, text, accent, number colors 1-8 chosen for contrast), spacing, radius, type scale; light and dark via `prefers-color-scheme` and a data attribute. A minimal layout shell with header and main region. Wire Vitest + React Testing Library for components. The `eslint-plugin-jsdoc` rule for `apps/web` stays at `warn` until M5-T03, but document new exports anyway.
- **Expected output:** `apps/web` app, `src/styles/tokens.css`, `src/App.tsx`, test setup.
- **Testing requirements:** a render test of `App`; token file contains every number color 1-8 in both themes; contrast ratios of number colors on the cell background are computed in a unit test and meet 4.5:1 for text sizes used.
- **Acceptance criteria:** `pnpm --filter web dev` serves the app; build passes; tests pass.
- **Relevant skills:** baseline; `/frontend-design`.
- **Documentation updates:** `DEVELOPMENT_GUIDE.md`; `ARCHITECTURE.md` (web layout).

### M3-T02 `GameSession` and `LocalSession`

- **Objective:** the adapter seam between UI and game logic.
- **Description:** implement the interface above, plus `LocalSession` and `SystemClock`.
- **Prerequisites:** M3-T01.
- **Implementation guidance:** `new LocalSession(config: BoardConfig, seed: number, clock: Clock)`. `start()` creates the game with `createGame` and records `clock.nowMs()` as t0; `dispatch` stamps `t = Math.round(clock.nowMs() - t0)` (never below the previous `t`) and calls `game.apply`; events are forwarded to subscribers. The timer starts at `start()` (race semantics) in this milestone; whether solo time starts on first click is settled in M4 with time-attack rules. `dispose()` unsubscribes everything. Use a fake clock in tests.
- **Expected output:** `src/session/GameSession.ts`, `LocalSession.ts`, `SystemClock.ts`, tests.
- **Testing requirements:** with a fake clock, a scripted game produces a log with the expected `t` values; dispatch before `start()` is ignored; dispatch after game end is ignored (Review Focus #2); `elapsedMs()` freezes at game end; `dispose()` stops events.
- **Acceptance criteria:** tests pass; no UI code imports `engine` directly except through the session and view types.
- **Relevant skills:** baseline.
- **Documentation updates:** TSDoc; `ARCHITECTURE.md` (session contract).

### M3-T03 Canvas board renderer

- **Objective:** a fast, crisp board.
- **Description:** `BoardRenderer` interface and `CanvasBoardRenderer`.
- **Prerequisites:** M3-T02.
- **Implementation guidance:** `interface BoardRenderer { mount(canvas: HTMLCanvasElement): void; render(view: GameView): void; hitTest(clientX: number, clientY: number): CellIndex | null; resize(): void; unmount(): void }`. Handle `devicePixelRatio`, redraw only changed cells (diff against the previous view), draw hidden, revealed, flagged, mine (after game over) and wrong-flag states using tokens. Cell size adapts to container, with a minimum size.
- **Expected output:** `src/render/BoardRenderer.ts`, `CanvasBoardRenderer.ts`, a `BoardCanvas` React component, tests.
- **Testing requirements:** `hitTest` maps pixel coordinates to indices for several sizes and DPRs, including edges and gaps (returns `null` outside); render smoke test using a canvas mock or `node-canvas`; benchmark test: full expert redraw under a documented budget.
- **Acceptance criteria:** tests pass; manual check on an expert board is smooth.
- **Relevant skills:** baseline; `/frontend-design`.
- **Documentation updates:** TSDoc; `ARCHITECTURE.md` (rendering).

### M3-T04 Input controller

- **Objective:** mouse and keyboard play mapped to `PlayerAction`.
- **Description:** `InputController` translating DOM events into session actions.
- **Prerequisites:** M3-T03.
- **Implementation guidance:** left click reveals, right click flags (suppress the context menu on the canvas), middle click or left+right together chords, click on a revealed number chords as an option. Keyboard: arrow keys move a visible cursor; Space reveals; F flags; Enter or C chords. The controller depends on `BoardRenderer.hitTest` and `GameSession.dispatch` only. No touch support yet (M10-T04).
- **Expected output:** `src/input/InputController.ts`, tests.
- **Testing requirements:** simulated pointer and keyboard events yield the expected `PlayerAction`s; context menu prevented; cursor clamps at board edges; input ignored when the game is over.
- **Acceptance criteria:** tests pass; keyboard-only completion of a seeded game works in a component test.
- **Relevant skills:** baseline.
- **Documentation updates:** `ARCHITECTURE.md`; user-facing key bindings in `README.md`.

### M3-T05 Game lifecycle, screens and difficulty

- **Objective:** a complete flow from menu to result.
- **Description:** menu with presets, play screen with HUD, result screen.
- **Prerequisites:** M3-T04.
- **Implementation guidance:** a screen state machine (`menu`, `playing`, `result`) held in Zustand with an explicit transition table (an enum plus switch is enough on the client). HUD: elapsed time, mines remaining, preset name. Result screen shows `GameResult` fields (time, 3BV, 3BV/s, outcome). Seeds come from `crypto.getRandomValues` (uint32). Use `/ux-copy` for button and message text.
- **Expected output:** `src/screens/`, `src/state/appStore.ts`, tests.
- **Testing requirements:** component tests for each screen; transition table tests including invalid transitions rejected; HUD updates from session events.
- **Acceptance criteria:** a manual play-through works for all three presets.
- **Relevant skills:** baseline; `/frontend-design`; `/ux-copy`.
- **Documentation updates:** `ARCHITECTURE.md` (screen flow); `README.md`.

### M3-T06 Restart, retry same board, new board

- **Objective:** fast iteration, which is what competitive players expect.
- **Description:** restart controls with hotkeys.
- **Prerequisites:** M3-T05.
- **Implementation guidance:** `R` starts a new board with the same preset and a new seed; `Shift+R` retries the same seed; both available as buttons on the result screen. A restart disposes the old session before creating the next. Keep the last finished game's `ReplayLog` in memory for ghost use in M4.
- **Expected output:** controls, store actions, tests.
- **Testing requirements:** retrying the same seed yields an identical opening and layout; a new board differs with overwhelming probability; rapid repeated restarts leave no leaked subscriptions (count listeners).
- **Acceptance criteria:** tests pass; hotkeys documented.
- **Relevant skills:** baseline.
- **Documentation updates:** `README.md` key bindings.

### M3-T07 Local statistics

- **Objective:** basic per-preset stats persisted locally.
- **Description:** `StatsStore` interface and a `localStorage` implementation.
- **Prerequisites:** M3-T06.
- **Implementation guidance:** `interface StatsStore { record(preset: string, result: GameResult): void; summary(preset: string): PresetStats }` with `PresetStats = { games; wins; bestTimeMs: number | null; averageThreeBVPerSecond: number }`. Store a versioned JSON blob under one key; wrap every read and write in try/catch and behave correctly when storage is unavailable or corrupt (fall back to an in-memory store). Stats view in the menu.
- **Expected output:** `src/stats/StatsStore.ts`, `LocalStorageStatsStore.ts`, `MemoryStatsStore.ts`, UI, tests.
- **Testing requirements:** win and loss recording; best time updates only on wins; corrupt JSON ignored; storage that throws falls back without crashing; version mismatch resets safely.
- **Acceptance criteria:** tests pass.
- **Relevant skills:** baseline.
- **Documentation updates:** TSDoc; `ARCHITECTURE.md` (persistence boundary: local stats are replaced by server stats in M7).

### M3-T08 Accessibility basics and end-to-end smoke test

- **Objective:** a baseline that stays accessible, and a regression test for the whole flow.
- **Description:** ARIA live announcements, focus management, Playwright smoke test in CI.
- **Prerequisites:** M3-T07.
- **Implementation guidance:** a visually hidden live region announces status changes (game started, cell revealed value, flag placed, win, loss); visible focus ring on the cursor cell; skip-to-board link. Add Playwright (Chromium) with a test that plays a fixed-seed game: the test computes safe cells with the engine and clicks them to a win, then checks the result screen. Add the job to CI. Run `/accessibility-review` as a quick pass and log findings for M10-T05.
- **Expected output:** accessibility code, `e2e/smoke.spec.ts`, CI job, findings list in `docs/a11y-findings.md`.
- **Testing requirements:** component test asserts live-region messages; the Playwright test passes in CI; keyboard-only variant of the smoke test.
- **Acceptance criteria:** CI green with the browser job; tag `m3-complete` after review.
- **Relevant skills:** baseline; `/accessibility-review`; `/requesting-code-review`.
- **Documentation updates:** `DEVELOPMENT_GUIDE.md` (running e2e), `ROADMAP.md`, `CHANGELOG.md`.
