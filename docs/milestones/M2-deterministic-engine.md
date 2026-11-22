# M2 Deterministic Engine

**Goal:** seeded board generation with a guaranteed shared safe opening, a command log, replay, and scoring, all provably deterministic.
**Depends on:** M1. **Brief phase:** 2 (timer and scoring foundation).
**Baseline skills for every task:** `/test-driven-development`, `/verification-before-completion`. Run `/requesting-code-review` at milestone end. Use `/systematic-debugging` for any determinism mismatch.

## Conversation Handoff Package

1. **Project context.** Browser-based competitive Minesweeper in TypeScript, OOP, pnpm monorepo (`packages/engine`, `packages/protocol`, `apps/server`, `apps/web`). MVP: 1v1 race on an identical seeded board with a guaranteed shared safe opening, plus solo time-attack with replay-validated leaderboards. The engine is pure and deterministic: no DOM, Node APIs, clocks or `Math.random`; time is the `t` field (ms since game start) on each `Command`. Server will later replay command logs to validate results, so identical inputs must give identical outputs everywhere.
2. **Tasks:** M2-T01 to M2-T10, in order. M2-T07 to M2-T10 came from the milestone review (`docs/reviews/M2-review.md`) and are not part of the original plan.
3. **Prerequisites and baseline:** tag `m1-complete`. Copy the actual exported signatures of `BoardConfig`, `Board`, `Game`, `Command`, `GameEvent`, `GameView` from `packages/engine/src/index.ts` before starting.
4. **Locked decisions:** ADR-001..009; guaranteed shared opening (spec 2.3); `BoardGenerator` is an interface so a no-guess generator can be added later; the opening reveal is part of game initialization, not a logged command; seeds are unsigned 32-bit integers for the MVP.
5. **Deliverables:** `Prng`, `SeededBoardGenerator`, `SafeOpeningPolicy`, `createGame`, command log, `ReplayLog` and `replay`, `GameResult` with scoring (including 3BV), golden-seed fixtures and cross-environment tests.
6. **Acceptance:** same seed gives identical layouts in Node and a real browser; `replay(log)` reproduces any live game's final view and result exactly; fuzz tests pass; docs clean.
7. **Skills:** baseline; `/testing-strategy` (light) when designing the cross-environment test.
8. **Documents:** spec sections 2.3 and 4.1. Update: `ARCHITECTURE.md` (determinism and replay), `DECISIONS.md` if the opening policy changes, `ROADMAP.md`, `CHANGELOG.md`.

**Time convention:** `t` is milliseconds since the game's start signal (t = 0). The engine never reads time; callers stamp it. A command's `t` must be a non-negative integer and non-decreasing within a game.

---

### M2-T01 In-engine PRNG

- **Objective:** a platform-independent random source.
- **Description:** implement `Prng` and `createPrng` using only integer arithmetic.
- **Prerequisites:** M1.
- **Implementation guidance:** `interface Prng { nextUint32(): number; nextInt(maxExclusive: number): number }`; `createPrng(seed: number): Prng` where seed is a uint32 (reject others). Use a small, well-known generator (for example sfc32 seeded through a splitmix32-style mixer) with `>>> 0` and `Math.imul` only, never floating-point in the state. `nextInt` must be unbiased (rejection sampling). Comment the algorithm and its source.
- **Expected output:** `packages/engine/src/prng.ts`, tests, fixture `fixtures/prng-vectors.json`.
- **Testing requirements:** golden vectors: for seeds 0, 1, 42 and 4294967295, the first 20 outputs match the committed fixture; `nextInt(1)` always returns 0; `nextInt(n)` stays in range and covers all values over many draws; invalid seeds (negative, fractional, above 2^32-1) throw `RangeError`.
- **Acceptance criteria:** vectors pass; lint confirms no banned APIs.
- **Relevant skills:** baseline.
- **Documentation updates:** TSDoc `@remarks` (algorithm, why integers only); `ARCHITECTURE.md`.

### M2-T02 Seeded board generator and safe opening

- **Objective:** boards that are identical for a given seed and always start with a safe cascading opening.
- **Description:** implement `BoardGenerator`, `GeneratedBoard`, `SafeOpeningPolicy`, `SeededBoardGenerator`.
- **Prerequisites:** M2-T01.
- **Implementation guidance:** `interface BoardGenerator { generate(config: BoardConfig, seed: number): GeneratedBoard }`; `GeneratedBoard = { board: Board; opening: readonly CellIndex[] }` where `opening` is the cell(s) to reveal at start. `SafeOpeningPolicy.select(config, prng): readonly CellIndex[]` picks a center cell whose full neighborhood (itself plus existing neighbors) is excluded from mine placement, so the opening cell has value 0 and cascades. Place mines by partial Fisher-Yates over the eligible indices. If eligible cells are fewer than `mineCount`, throw `InvalidBoardConfigError` with a clear reason (Review Focus #4); this is the opening-aware bound promised in M1-T01. For tiny boards the neighborhood shrinks to what exists. Document that board output for a given seed is a stable contract: changing it invalidates stored replays, so any change requires a new generator id and an ADR.
- **Expected output:** `generator.ts`, `opening.ts`, tests, golden fixture `fixtures/boards.json` (seed, config, SHA-256 of the mine index list).
- **Testing requirements:** same seed gives identical boards; different seeds usually differ; the opening cell has value 0 and none of its neighbors is a mine; mine count is exact; expert preset with 100 random seeds never fails; a config with too many mines for the opening is rejected with an error and no hang; 1xN and 2x2 boards behave sensibly (either valid or a clear error); distribution sanity (each cell's mine frequency over many seeds is within a loose tolerance).
- **Acceptance criteria:** golden fixtures committed and passing; no unbounded loops.
- **Relevant skills:** baseline.
- **Documentation updates:** TSDoc; `ARCHITECTURE.md`; `DECISIONS.md` note on generator stability.

### M2-T03 `createGame` and the command log

- **Objective:** one entry point that builds a ready-to-play game and records what was played.
- **Description:** add `createGame(config, seed, generator?)` and a command log to `Game`.
- **Prerequisites:** M2-T02.
- **Implementation guidance:** `createGame(config: BoardConfig, seed: number, generator: BoardGenerator = new SeededBoardGenerator()): Game` generates the board, applies the opening reveal at `t = 0` without logging it, and returns a game whose status is `'ready'`. `Game.log(): readonly Command[]` returns accepted commands in order. Rejected or no-op commands are not logged. Reject (return `[]`) a command whose `t` is lower than the previous accepted command's `t`, or non-integer or negative (Review Focus #2).
- **Expected output:** `create-game.ts`, `Game` changes, tests.
- **Testing requirements:** two games from the same seed produce equal views; opening cells are revealed immediately; log contains only accepted commands; decreasing and fractional `t` rejected; log is unaffected by rejected commands.
- **Acceptance criteria:** tests pass; existing M1 tests still pass.
- **Relevant skills:** baseline.
- **Documentation updates:** TSDoc; `ARCHITECTURE.md` (game creation flow).

### M2-T04 `ReplayLog` and `replay`

- **Objective:** reproduce any game from its inputs.
- **Description:** define `ReplayLog`, `validateReplayLog`, and `replay`.
- **Prerequisites:** M2-T03.
- **Implementation guidance:** `interface ReplayLog { version: 1; config: BoardConfig; seed: number; commands: readonly Command[] }`. `validateReplayLog(log: ReplayLog): void` throws `InvalidReplayError` on a wrong version, invalid config, non-uint32 seed, commands out of range, non-monotonic `t`, or more than a documented maximum command count (default 100,000). `replay(log: ReplayLog, generator?: BoardGenerator): Game` builds the game via `createGame` and applies every command, throwing if a logged command is rejected (a valid log contains only accepted commands). JSON parsing and Zod live in `protocol` (M5-T01); the engine accepts typed input only.
- **Expected output:** `replay.ts`, errors, tests.
- **Testing requirements:** replay of a finished game equals the original final view and result; each validation failure triggers its error; a log containing a command that would have been rejected causes `replay` to throw; empty command list replays to a `'ready'` game.
- **Acceptance criteria:** tests pass; round-trip property holds for fuzzed games (random seeds, random command sequences).
- **Relevant skills:** baseline; `/systematic-debugging`.
- **Documentation updates:** TSDoc; `ARCHITECTURE.md` (replay contract and versioning rule).

### M2-T05 Results and scoring

- **Objective:** a standard result record for every finished or abandoned game.
- **Description:** add `GameResult`, `Game.result()`, and a 3BV calculator.
- **Prerequisites:** M2-T04.
- **Implementation guidance:** `GameResult = { outcome: 'won' | 'lost'; timeMs: number; safeCellsRevealed: number; totalSafeCells: number; effectiveCommands: number; threeBV: number; threeBVPerSecond: number }`. `timeMs` is the `t` of the finishing command. `Game.result(): GameResult | undefined` returns `undefined` until the game ends. `computeThreeBV(board: Board): number` counts zero-value connected regions (including their numbered border) plus numbered cells not adjacent to any zero, per the standard Minesweeper 3BV definition; document the definition. `threeBVPerSecond` is 0 when `timeMs` is 0.
- **Expected output:** `result.ts`, `threebv.ts`, tests.
- **Testing requirements:** 3BV on hand-computed boards (all-zero board gives 1; a checkerboard-like layout with known value); result after win and loss; `result()` undefined mid-game; no division by zero; result is identical for live play and replay.
- **Acceptance criteria:** tests pass; 3BV definition documented with a reference.
- **Relevant skills:** baseline.
- **Documentation updates:** TSDoc; `ARCHITECTURE.md` (results); `PROJECT_OVERVIEW.md` glossary (3BV).

### M2-T06 Determinism and cross-environment tests

- **Objective:** evidence that determinism holds in Node and in a browser.
- **Description:** golden-seed suite plus fuzzed replay tests, run in both environments.
- **Prerequisites:** M2-T05.
- **Implementation guidance:** a shared test module consumed by Vitest in Node and in a real browser (Vitest browser mode with Chromium, or a Playwright page that loads the built engine and runs the same checks). The suite verifies golden board hashes for at least 20 seeds across all presets, PRNG vectors, and 500 fuzzed games whose live final state equals `replay` output. Add the browser job to CI (Chromium only). If browser mode is impractical, use Playwright against a minimal static page; record the choice in `ARCHITECTURE.md`.
- **Expected output:** `packages/engine/test/determinism.shared.ts`, Node and browser runners, CI job.
- **Testing requirements:** the suite itself; deliberately introduce a `Math.random` call in a branch and confirm CI fails (lint and test). Run the golden-seed and fuzz suites once more with `Date`, `Math.random`, `performance` and `Intl.DateTimeFormat` replaced by stubs that throw, so a clock or random read that lint cannot see (an alias, `globalThis['performance']`) fails at runtime (M0 review, L3).
- **Acceptance criteria:** both environments pass in CI; tag `m2-complete` after review.
- **Relevant skills:** baseline; `/testing-strategy`; `/requesting-code-review`.
- **Documentation updates:** `ARCHITECTURE.md`, `DEVELOPMENT_GUIDE.md` (running the browser tests), `ROADMAP.md`, `CHANGELOG.md`.

---

### M2-T07 Bound the command log so every live game replays

- **Objective:** `replay(log)` reproduces every game that was played, not only the ones below 100,000 commands (review B1).
- **Description:** flag toggles are accepted for ever, so a legal game could log more commands than `validateReplayLog` accepts (100,000); the M2 review reproduced it with 100,001 toggles. `Game.apply` now stops at the same number, and the number is public.
- **Prerequisites:** M2-T06 and `docs/reviews/M2-review.md`.
- **Implementation guidance:** tests first (`game.limit.test.ts`). Move `MAX_REPLAY_COMMANDS` from `replay.ts` to a new `limits.ts` (so that `game.ts` and `replay.ts` share it without an import cycle) and export it from `index.ts` as a public value with `@example` (canonical names: one row added; the surface is 31 names; `api-surface.txt` updated on purpose with `vitest -u`). `Game.apply` returns `[]` when `log().length` has reached the limit; the order of checks becomes index, game over, size, `t`, command. The command that makes the log that long is accepted and can win; the next one is refused and not logged. No new `ReplayLog` version and no ADR, because no stored log can exceed the limit; say so in `DECISIONS.md`. Correct the TSDoc that called the limit "far below any real game". Add the stuck-game rule to the handoffs of M3-T02 and M5-T05 and the shared limit to M5-T01.
- **Expected output:** `limits.ts`, `game.ts`, `replay.ts`, `index.ts`, `game.limit.test.ts`, small edits in `replay.test.ts` and `api-surface.test.ts`, the updated API snapshot, docs.
- **Testing requirements:** 100,000 commands accepted and the next refused and not logged; the last allowed command can win; a bad index still throws at the limit; a game stopped at the limit has a log that `validateReplayLog` accepts and `replay` plays to the same view; mutation record (`>=` to `>`, the check removed, off by one, check before the index check) in the session log.
- **Acceptance criteria:** the 100,001-toggle probe of the review no longer produces a log that `replay` rejects; golden fixtures unchanged; the API-surface diff is exactly one constant.
- **Relevant skills:** baseline.
- **Documentation updates:** TSDoc, `ARCHITECTURE.md` (canonical names, public API, game creation and the log, replay), `DECISIONS.md`, `CHANGELOG.md`, `ROADMAP.md`, session log.

### M2-T08 M2 close-out: tracker, CHANGELOG, review on record

- **Objective:** `main` records M2 as it is (review I1, I2).
- **Description:** commit what is pending in the working tree (the M2-T06 row of `ROADMAP.md` and its session log), add the M2 close-out entry to `CHANGELOG.md`, put the review on record, and correct the one statement in `ARCHITECTURE.md` that the green CI run of #27 made out of date.
- **Prerequisites:** M2-T07.
- **Implementation guidance:** documentation only. `ROADMAP.md`: the four new rows, the M2 index row (6 to 10 tasks), total 86 to 90, the counts in the other docs. `CHANGELOG.md`: M2-T07 to M2-T09 entries, one "M2 close-out" entry, the new task count. `docs/reviews/M2-review.md`: add the review to git with a status note at the top (what was applied; I1 corrected, see the note there). `ARCHITECTURE.md` "Determinism tests", "Verified where": the CI result of #27 instead of "had not run" (I2). The tag `m2-complete` is not part of this task; the developer sets it after the follow-ups are merged and M2-T10 is `Done` or deliberately moved.
- **Expected output:** `ROADMAP.md`, `CHANGELOG.md`, `docs/reviews/M2-review.md`, `ARCHITECTURE.md`, count edits, session log.
- **Testing requirements:** `pnpm check:links`, `pnpm check:todos`.
- **Acceptance criteria:** `git status` is clean after the commit; `ROADMAP.md` shows M2-T06 with its PR and commit.
- **Relevant skills:** baseline.
- **Documentation updates:** as above.

### M2-T09 M2 review minors

- **Objective:** close the minor findings M1 to M4 and M6 of the review.
- **Description:** a garbled sentence in `ARCHITECTURE.md` (M1); unknown properties on a log or command are accepted by validation and dropped by the game, so `replay(log).log()` equals `log.commands` only without them (M2); two untested branches of the error-message helper in `replay.ts` (M3); a source for the 3BV definition that a reader can follow (M4); two handoff sentences for M5-T01 and M8-T01 (M6).
- **Prerequisites:** M2-T07.
- **Implementation guidance:** tests first for M2 and M3 (they describe existing behavior, so they pass at once; prove they bite by mutating `show()`). M2 and M6 are docs: `ARCHITECTURE.md`, `DECISIONS.md` (the M5-T01 and M8-T01 notes of "Replay and versioning"), and the milestone files of M5 and M8. M4: the TSDoc of `computeThreeBV` cites https://minesweeper.online/help (read on 2026-11-21); the original text of Bechtel is still not read, and the TSDoc says so.
- **Expected output:** four tests in `replay.test.ts`, TSDoc of `threebv.ts`, docs.
- **Testing requirements:** the new tests fail on two mutants of `show()` (the 24-character cut, the array/object branch); `pnpm lint`, `pnpm docs:api`.
- **Acceptance criteria:** branch coverage of `replay.ts` is 100%; no source behavior changed.
- **Relevant skills:** baseline.
- **Documentation updates:** as above, `CHANGELOG.md`, `ROADMAP.md`, session log.

### M2-T10 Cross-environment digest of the fuzz outcomes (optional)

- **Objective:** evidence that the fuzz games end the same in Node and in Chromium, not only that each environment agrees with itself (review M5).
- **Description:** each runner computes a SHA-256 of the JSON of its 500 fuzz outcomes (`determinism.shared.ts`) and reports it; CI compares the two values. The digest is computed in the run and is never committed, so no fixture is produced by the code it checks (`DEVELOPMENT_GUIDE.md`).
- **Prerequisites:** M2-T07.
- **Implementation guidance:** needs a real Chromium to write and to check, so it is a task for the developer's machine or for a conversation that has a browser; it was not done in the review conversation for that reason (a CI change that cannot be run before it is pushed risks the required check `ci`). Decide how the browser runner hands its digest to the job (for example a Vitest browser command that writes a file) and keep the step inside the single job `ci`. Low priority: do it when a task next changes `Game.apply`, the generator or `Prng`, or at M10. If the developer prefers to defer it, move the row to M10 (and say so in `ROADMAP.md`) so that M2 can be tagged.
- **Expected output:** changes to `determinism.shared.ts`, the two runners, `ci.yml`, docs.
- **Testing requirements:** a deliberate difference (an environment-dependent branch in a scratch copy) makes the comparison fail.
- **Acceptance criteria:** CI green with the comparison step; `pnpm test` and `pnpm test:browser` still pass locally.
- **Relevant skills:** baseline; `/testing-strategy`.
- **Documentation updates:** `ARCHITECTURE.md` ("Determinism tests"), `DEVELOPMENT_GUIDE.md`, `CHANGELOG.md`, `ROADMAP.md`, session log.

