# M1 Engine Core

**Goal:** a pure, well-tested Minesweeper engine: board, cells, reveal, flood fill, flags, chording, win and loss.
**Depends on:** M0. **Brief phase:** 2.
**Baseline skills for every task:** `/test-driven-development`, `/verification-before-completion`. Run `/requesting-code-review` at milestone end. Use `/systematic-debugging` on any failing invariant.

## Conversation Handoff Package

1. **Project context.** Browser-based competitive Minesweeper in TypeScript, OOP, pnpm monorepo (`packages/engine`, `packages/protocol`, `apps/server`, `apps/web`). MVP: 1v1 race on an identical seeded board with a guaranteed shared safe opening, plus solo time-attack. The engine is pure and deterministic: no DOM, no Node APIs, no clocks, no `Math.random`; time enters only as `t` (ms since game start) on a `Command`. Docs in the repo are the source of truth.
2. **Tasks:** M1-T01 to M1-T07, in order.
3. **Prerequisites and baseline:** tag `m0-complete`. Working monorepo, lint rules that ban impure APIs in `engine`, CI, TSDoc rules. Engine currently exports nothing useful.
4. **Locked decisions:** ADR-001..008; engine is deterministic and UI-free; canonical names in the roadmap plan (`CellIndex`, `BoardConfig`, `Board`, `Game`, `Command`, `GameEvent`, `GameView`, `GameStatus`); iterative (not recursive) flood fill; hidden-cell data never appears in `GameView`.
5. **Deliverables:** `packages/engine` with config validation, `Board`, `Game`, commands, events, views, win/loss; unit and property tests; API-surface test; TypeDoc output; ADR-009 (cell rules).
6. **Acceptance:** all engine tests pass with high coverage of branches; no lint exemptions; a full game can be played in a test using only the public API; `pnpm docs:api` is clean.
7. **Skills:** as in the baseline; `/architecture` for ADR-009.
8. **Documents:** read spec section 4.5 and `ARCHITECTURE.md`. Update: `ARCHITECTURE.md` (engine section), `DECISIONS.md` (ADR-009), `ROADMAP.md`, `CHANGELOG.md`.

**Command semantics fixed for this milestone** (so tasks agree): `Game.apply(command)` returns `readonly GameEvent[]`. A command that is invalid for the current state or has no effect returns `[]` and mutates nothing. It never throws for in-range indices; an out-of-range index throws `RangeError`.

---

### M1-T01 Core types, presets and config validation

- **Objective:** the vocabulary every other task builds on.
- **Description:** define `CellIndex`, `BoardConfig`, `PRESETS` and `validateBoardConfig`.
- **Prerequisites:** M0.
- **Implementation guidance:** `PRESETS.beginner` 9x9/10, `intermediate` 16x16/40, `expert` 30x16/99 (D-01 working values). `validateBoardConfig(config: BoardConfig): void` throws `InvalidBoardConfigError` (extends `Error`, with a `reason` string) unless width and height are integers in 1..100 and `0 <= mineCount <= width * height - 1`. Opening-aware limits arrive in M2-T02. Export helpers `cellCount(config)` and `safeCellCount(config)`.
- **Expected output:** `packages/engine/src/config.ts`, `errors.ts`, tests.
- **Testing requirements:** each preset validates; non-integer, zero, negative, over-limit dimensions rejected; `mineCount` equal to cell count rejected; a 1x1 board with 0 mines accepted; 1xN boards accepted (Review Focus #4).
- **Acceptance criteria:** all cases above pass; error messages name the offending field.
- **Relevant skills:** baseline.
- **Documentation updates:** `ARCHITECTURE.md` (config); TSDoc with `@example`.

### M1-T02 Board and neighbor math

- **Objective:** an immutable mine layout with fast adjacency.
- **Description:** `Board` class holding config, mine set, and adjacency helpers.
- **Prerequisites:** M1-T01.
- **Implementation guidance:** `new Board(config: BoardConfig, mines: Iterable<CellIndex>)` validates config, dedupes, rejects out-of-range mines, and rejects a mine count that disagrees with `config.mineCount`. Methods: `isMine(i)`, `neighbors(i): readonly CellIndex[]` (precomputed lazily, cached), `adjacentMines(i): number`, `indexOf(x, y)`, `coordsOf(i)`, `readonly config`. The board never changes after construction. Use a `Uint8Array` for mine flags.
- **Expected output:** `packages/engine/src/board.ts`, tests.
- **Testing requirements:** corner, edge and interior neighbor counts (3, 5, 8); 1xN and Nx1 boards; adjacency counts on a hand-built 3x3 layout; duplicate and out-of-range mines rejected; `indexOf`/`coordsOf` round-trip for every cell of the expert board.
- **Acceptance criteria:** tests pass; no allocation per `neighbors` call after the first.
- **Relevant skills:** baseline.
- **Documentation updates:** TSDoc; `ARCHITECTURE.md`.

### M1-T03 Game state, views and events

- **Objective:** the mutable game aggregate's state model and the read-only view that clients see.
- **Description:** `Game` constructor, cell-state array, `GameStatus`, `GameView`, `CellView`, `GameEvent` types and a typed event emitter.
- **Prerequisites:** M1-T02.
- **Implementation guidance:** `new Game(board: Board)`. `GameView = { width; height; status: GameStatus; cells: readonly CellView[]; revealedCount; flagCount; minesRemaining; exposedMines?: readonly CellIndex[] }`. `CellView = { state: 'hidden' } | { state: 'flagged' } | { state: 'revealed'; value: number }`. `exposedMines` is set only when `status` is `'won'` or `'lost'`. `GameEvent = CellsRevealed { cells: { index; value }[] } | FlagToggled { index; flagged } | GameWon { t } | GameLost { t; mineIndex }`. `game.subscribe(listener: (e: GameEvent) => void): () => void` (Observer). `view()` returns a fresh immutable snapshot.
- **Expected output:** `packages/engine/src/game.ts`, `view.ts`, `events.ts`, tests.
- **Testing requirements:** a new game's view has all cells hidden and `status` `'ready'`; hidden cells carry no mine information at any point before game over (assert by deep-scanning the serialized view); `exposedMines` absent until the game ends; unsubscribe stops delivery.
- **Acceptance criteria:** tests pass; view serialization of an in-progress game contains no mine indices.
- **Relevant skills:** baseline.
- **Documentation updates:** TSDoc; `ARCHITECTURE.md` (view and event model).

### M1-T04 Reveal and iterative flood fill

- **Objective:** correct reveal behavior including cascades.
- **Description:** implement `Game.apply({ type: 'reveal', index, t })`.
- **Prerequisites:** M1-T03.
- **Implementation guidance:** revealing a hidden non-mine cell reveals it; a zero-value cell cascades through its neighbors using an explicit stack (no recursion), skipping flagged cells and already revealed cells; revealing a mine ends the game with `GameLost`. One `CellsRevealed` event per command, listing every newly revealed cell. Commands on revealed or flagged cells are no-ops (`[]`). The first accepted command moves status `'ready'` to `'playing'`.
- **Expected output:** reveal logic in `game.ts` (or `reveal.ts`), tests.
- **Testing requirements:** single reveal; cascade on a hand-built board with a known zero region; cascade stops at numbers and flagged cells; reveal on mine loses; reveal on revealed and on flagged cell returns `[]` and leaves the view identical (Review Focus #1); out-of-range index throws `RangeError`; expert board with zero mines cascades the whole board without stack overflow (performance under 16 ms).
- **Acceptance criteria:** tests pass; flood fill proven non-recursive by the max-size test.
- **Relevant skills:** baseline; `/systematic-debugging` if cascades misbehave.
- **Documentation updates:** TSDoc (`@remarks` on the iterative approach); `ARCHITECTURE.md`.

### M1-T05 Flags and chording

- **Objective:** flag toggling and chord reveals following the classic rules.
- **Description:** implement `flag` and `chord` commands and record ADR-009.
- **Prerequisites:** M1-T04.
- **Implementation guidance:** `flag` toggles a hidden cell to flagged and back; flagging a revealed cell is a no-op. `chord` on a revealed number whose adjacent flag count equals its value reveals every non-flagged hidden neighbor via the normal reveal path (so wrong flags can cause a loss); a chord with a differing flag count, on a hidden cell, or on a zero cell is a no-op. Per D-04, flags are never required to win and there are no question marks. Emit one aggregated `CellsRevealed` per chord. ADR-009 records these rules.
- **Expected output:** logic, tests, `docs/adr/ADR-009-cell-rules.md`.
- **Testing requirements:** toggle on and off; flag on revealed no-op; chord with correct flags cascades; chord with wrong flag placement loses; chord with too few and too many flags is a no-op (Review Focus #1); chord reveals neighbors once even when two neighbors cascade into the same area.
- **Acceptance criteria:** tests pass; ADR committed.
- **Relevant skills:** baseline; `/architecture` for the ADR.
- **Documentation updates:** `DECISIONS.md`, `ARCHITECTURE.md`, TSDoc.

### M1-T06 Win and loss, status transitions, post-game rejection

- **Objective:** complete game lifecycle semantics.
- **Description:** win detection, status transitions, rejection after game over, and property tests.
- **Prerequisites:** M1-T05.
- **Implementation guidance:** the game is won when `revealedCount === safeCellCount`; emit `GameWon { t }`. On loss or win, status is final: every later command returns `[]`. After a loss, `view().exposedMines` lists all mines; after a win it lists all mines too (the player's own finished game). Add `fast-check` property tests: random command sequences never throw for in-range indices, never reveal a mine without losing, never decrease `revealedCount`, and never change the mine layout.
- **Expected output:** lifecycle logic, property tests.
- **Testing requirements:** win on a tiny board; loss; commands after win and after loss return `[]` and leave state unchanged (Review Focus #2); status is `'ready'` before any command and `'playing'` after; 1x1 zero-mine board is won by one reveal.
- **Acceptance criteria:** tests and properties pass with at least 1,000 generated cases in CI.
- **Relevant skills:** baseline; `/systematic-debugging`.
- **Documentation updates:** TSDoc; `ARCHITECTURE.md` (lifecycle).

### M1-T07 Public API surface

- **Objective:** a single guarded entry point for the engine.
- **Description:** export the public API from `packages/engine/src/index.ts` and lock it with a test.
- **Prerequisites:** M1-T06.
- **Implementation guidance:** export only the canonical names from this milestone. Add an API-surface test that compares the exported names (and the type shapes of `Command`, `GameEvent`, `GameView`) against a committed snapshot, so signature changes are visible in review. Remove the M0 sample code. Set numeric `coverage.thresholds` for the `engine` project in `vitest.config.ts` (a number you can defend, for example 90% branches) and exclude `index.ts` barrels from coverage; the config comment says M1 does this. Build TypeDoc and read it as a consumer.
- **Expected output:** `index.ts`, `api-surface.test.ts` and snapshot, TypeDoc build clean.
- **Testing requirements:** a full game played using only `index.ts` imports; the snapshot test fails when an export is added or renamed.
- **Acceptance criteria:** `pnpm docs:api` has zero warnings; `m1-complete` tagged after milestone review.
- **Relevant skills:** baseline; `/requesting-code-review`.
- **Documentation updates:** `ARCHITECTURE.md` (engine public API), `ROADMAP.md`, `CHANGELOG.md`.
