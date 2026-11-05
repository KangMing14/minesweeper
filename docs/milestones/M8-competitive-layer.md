# M8 Competitive Layer

**Goal:** validated solo leaderboards, a rating system, matchmaking and ranked 1v1.
**Depends on:** M6, M7. **Brief phase:** 7.
**Baseline skills for every task:** `/test-driven-development`, `/verification-before-completion`. Run `/requesting-code-review` at milestone end. Use `/code-review` for T01, T02 and T06 (cheating surface).

## Conversation Handoff Package

1. **Project context.** Browser-based competitive Minesweeper in TypeScript, OOP, pnpm monorepo (`packages/engine`, `packages/protocol`, `apps/server`, `apps/web`). MVP: 1v1 race plus solo time-attack, with leaderboards and rated matchmaking. The engine is deterministic, so the server can replay any submitted command log to verify a result. Mine positions never reach clients mid-game. Accounts and persistence exist (M7); the match lifecycle survives disconnects (M6).
2. **Tasks:** M8-T01 to M8-T07, in order.
3. **Prerequisites and baseline:** tags `m6-complete` and `m7-complete`. Copy the actual exported signatures of `replay`, `validateReplayLog`, `ReplayLog`, `GameResult`, `TimeAttackMode`, `RaceMode`, `Match`, `MatchManager`, the repository interfaces, `StatsService` and the protocol schemas before starting.
4. **Locked decisions:** ADR-001..012; replay validation uses the same engine code; ranked race preset from ADR-010; single-round matches (D-03) are revisited in T06 (best-of-N only if justified); `RatingSystem` is a Strategy; rating math is pure and engine-independent; ADR-013 (D-06) is written in T04.
5. **Deliverables:** `ReplayValidator`, server-issued solo runs, leaderboard endpoints and UI, `RatingSystem` and `Glicko2RatingSystem`, `Matchmaker`, ranked flow with atomic rating updates, rating display.
6. **Acceptance:** a forged or edited replay is rejected; leaderboards list only validated runs; two queued players are paired by rating, play a race, and both ratings change correctly and atomically; rating-system tests match published reference values.
7. **Skills:** baseline; `/code-review`; `/architecture` for ADR-013; `/frontend-design`, `/ux-copy` for T03 and T07.
8. **Documents:** spec sections 2.2, 4.8 and 9; `ARCHITECTURE.md`. Update: `ARCHITECTURE.md`, `DECISIONS.md` (ADR-013, D-03 follow-up), `ROADMAP.md`, `CHANGELOG.md`.

---

### M8-T01 `ReplayValidator`

- **Objective:** trustworthy solo results.
- **Description:** server component that validates a submitted `ReplayLog` against an issued run.
- **Prerequisites:** M7.
- **Implementation guidance:** `ReplayValidator.validate(run: IssuedRun, log: ReplayLog): ValidationResult` where `IssuedRun = { runId; userId; preset; seed; issuedAt }` and `ValidationResult = { ok: true; result: GameResult } | { ok: false; reason: ValidationFailure }`. Checks: `log.seed` and `log.config` equal the issued values; `validateReplayLog` passes; `replay(log)` reproduces a finished game; claimed result equals the replayed result; last command `t` is not greater than wall time elapsed since issue (plus tolerance); minimum plausible interval between commands is not violated (a conservative threshold constant; soft flags in M9-T04). Failures carry stable reason codes.
- **Expected output:** `apps/server/src/solo/replay-validator.ts`, tests with fixture logs.
- **Testing requirements:** valid log accepted; each tampering case rejected with its code: changed seed, changed config, extra command, removed command, altered `t`, claimed time lower than replayed time, unfinished game claimed as won, log for a different run; replay of an expert-size log completes within a documented budget.
- **Acceptance criteria:** tests pass; `/code-review` findings resolved.
- **Relevant skills:** baseline; `/code-review`.
- **Documentation updates:** `ARCHITECTURE.md` (validation flow), `DECISIONS.md` (anti-cheat limits).

### M8-T02 Solo ranked flow and leaderboard API

- **Objective:** server-issued solo runs that feed leaderboards.
- **Description:** start and submit endpoints plus leaderboard queries.
- **Prerequisites:** M8-T01.
- **Implementation guidance:** `POST /api/solo/start { preset }` returns `{ runId, seed, config }` and stores the issued run (expires after a documented TTL); `POST /api/solo/submit { runId, log }` validates through `ReplayValidator`, stores the run, and updates the player's best per preset. Each run id is single-use. Table `solo_runs` (id, userId, preset, timeMs, threeBV, finishedAt, flags). `GET /api/leaderboards/:preset?cursor=` returns best time per player, ordered by time then earliest. Guests are excluded from public leaderboards (registered accounts only) unless ADR-012 says otherwise. Rate limits arrive in M9-T03; add a basic per-user concurrency limit now (one open run).
- **Expected output:** routes, `SoloRunRepository` with fake and Drizzle implementations, migrations, tests.
- **Testing requirements:** start then submit valid log updates the board; resubmitting the same run id is rejected; expired run rejected; a worse later result does not replace a better best; leaderboard order and pagination correct; guests excluded; submission body over the size cap rejected before parsing the log.
- **Acceptance criteria:** tests pass; contract tests cover both repository implementations.
- **Relevant skills:** baseline; `/code-review`.
- **Documentation updates:** `DEVELOPMENT_GUIDE.md` (API), `ARCHITECTURE.md`.

### M8-T03 Leaderboard UI and ranked solo mode

- **Objective:** players can compete on solo times.
- **Description:** ranked solo play flow and leaderboard screens.
- **Prerequisites:** M8-T02.
- **Implementation guidance:** "Ranked solo" in the menu: calls start, plays through `LocalSession` with the issued seed, records the `ReplayLog`, submits on finish, shows the validated result and rank. Leaderboard screen per preset with the viewer's row highlighted and pagination. Offline or failed submissions show a clear retry state (the log is held in memory and optionally in local storage for one retry).
- **Expected output:** `src/screens/leaderboard/`, `src/api/solo.ts`, tests, e2e extension.
- **Testing requirements:** component tests for loading, empty, error, and populated states; e2e: complete a seeded ranked solo game and see the entry; submission failure retry path.
- **Acceptance criteria:** CI green.
- **Relevant skills:** baseline; `/frontend-design`; `/ux-copy`.
- **Documentation updates:** `README.md`, `ARCHITECTURE.md`.

### M8-T04 `RatingSystem` and Glicko-2 (ADR-013)

- **Objective:** a correct, swappable rating algorithm.
- **Description:** interface, implementation, and decision record.
- **Prerequisites:** M7.
- **Implementation guidance:** `type Rating = { rating: number; deviation: number; volatility: number }`; `interface RatingSystem { initial(): Rating; update(a: Rating, b: Rating, outcome: 'a' | 'b' | 'draw'): readonly [Rating, Rating] }`. `Glicko2RatingSystem` follows Glickman's published algorithm (system constant tau default 0.5, documented, configurable); one match is treated as a rating period of one game per player (document the simplification and the alternative of periodic batches). Pure functions, no I/O. Display rating is `rating - 2 * deviation` rounded, or the raw rating, decided in the ADR (D-06). Record why Glicko-2 over Elo (uncertainty handling for few games).
- **Expected output:** `apps/server/src/rating/`, `docs/adr/ADR-013-rating-system.md`, tests.
- **Testing requirements:** reproduce the worked example from Glickman's paper for the single-period case within tolerance; symmetric outcomes give mirrored changes; a draw between equal players leaves ratings near equal; winners gain and losers lose; deviation shrinks with games and grows with inactivity (if implemented, otherwise documented); invalid inputs rejected.
- **Acceptance criteria:** reference values match; ADR committed.
- **Relevant skills:** baseline; `/architecture`.
- **Documentation updates:** `DECISIONS.md`, `PROJECT_OVERVIEW.md` (rating explanation for players).

### M8-T05 `Matchmaker`

- **Objective:** pair players of similar rating.
- **Description:** in-memory queue with widening search window.
- **Prerequisites:** M8-T04.
- **Implementation guidance:** `Matchmaker.enqueue(playerId: string, rating: Rating): Ticket`, `cancel(ticketId)`, `tick(nowMs: number): Pairing[]` where `Pairing = { a: Ticket; b: Ticket }`. Window starts at +/-100 rating points and widens by a fixed amount per 5 seconds waited up to a cap; pair the closest ratings first; a player cannot be matched with themselves or hold two tickets. Time is injected. A scheduler in the server calls `tick` once per second. Document that this is single-instance and in-memory (scale-out in P10-F).
- **Expected output:** `apps/server/src/matchmaking/matchmaker.ts`, tests.
- **Testing requirements:** equal ratings pair immediately; distant ratings pair only after the window widens; closest-first selection; cancel removes the ticket; duplicate enqueue rejected; odd number of players leaves one waiting; large queue (1,000 tickets) ticks within budget.
- **Acceptance criteria:** tests pass with a fake clock.
- **Relevant skills:** baseline.
- **Documentation updates:** `ARCHITECTURE.md`.

### M8-T06 Ranked 1v1 flow

- **Objective:** end-to-end rated matches.
- **Description:** queue messages, match creation, result handling, atomic rating updates.
- **Prerequisites:** M8-T05, M6.
- **Implementation guidance:** add protocol messages `queue { modeId: 'race' }`, `queueCancel {}`, server `queued {}` and `matched { code: string }`. On pairing, create a ranked `Match` with the ranked preset and auto-join both players (they still ready up). On finish, compute the new ratings through `RatingSystem` and persist match, results and rating changes in a single database transaction; include `ratingChange` in the `result` message. Forfeits count as losses; both-gone draws count as draws; matches with fewer than N commands from a player (documented minimum) before a forfeit are not rated to prevent abuse. Revisit D-03: keep single-round unless playtesting justifies best-of-N, and record the outcome in `DECISIONS.md`. Users must be registered (not guests) to queue ranked.
- **Expected output:** protocol additions, queue handling, ranked finish logic, migration (`ratings` table), tests.
- **Testing requirements:** two queued players are matched and rated after a race; transaction rolls back fully on failure (no rating change without a stored match); a cancelled ticket is never matched; a player disconnecting while queued is removed; guests cannot queue ranked; rating changes are deterministic given the same sequence of results; tie handling (Review Focus #3) gives a draw rating update.
- **Acceptance criteria:** tests pass including a two-client integration test with `InMemoryTransport`.
- **Relevant skills:** baseline; `/code-review`; `/systematic-debugging`.
- **Documentation updates:** `ARCHITECTURE.md` (ranked flow), `DECISIONS.md`, protocol table.

### M8-T07 Rating display and ranked leaderboard

- **Objective:** make ratings visible and meaningful.
- **Description:** show rating on profile and results, plus a ranked leaderboard.
- **Prerequisites:** M8-T06.
- **Implementation guidance:** profile shows rating, deviation-aware display value (per ADR-013) and rank; result screen shows `ratingChange` with sign; `GET /api/leaderboards/ranked` lists top players by displayed rating, requiring a minimum number of rated games to appear. Provisional marker for high deviation.
- **Expected output:** endpoints, UI, tests, e2e extension (two contexts play a ranked match).
- **Testing requirements:** ordering and provisional-marker logic tested; component tests for states; e2e ranked match from queue to updated rating.
- **Acceptance criteria:** CI green; tag `m8-complete` after review.
- **Relevant skills:** baseline; `/frontend-design`; `/requesting-code-review`.
- **Documentation updates:** `README.md`, `ROADMAP.md`, `CHANGELOG.md`.
