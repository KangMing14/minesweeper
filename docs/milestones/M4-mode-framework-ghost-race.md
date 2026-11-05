# M4 Mode Framework and Ghost Race

**Goal:** pluggable game-mode rules, settled race rules, and a local race against a recorded ghost that exercises the whole race flow without a network.
**Depends on:** M2, M3. **Brief phase:** 4 (reframed from hot-seat multiplayer; see spec section 6).
**Baseline skills for every task:** `/test-driven-development`, `/verification-before-completion`. Run `/requesting-code-review` at milestone end. `/brainstorming` is used in M4-T03 if the race rules need rethinking.

## Conversation Handoff Package

1. **Project context.** Browser-based competitive Minesweeper in TypeScript, OOP, pnpm monorepo (`packages/engine`, `packages/protocol`, `apps/server`, `apps/web`). MVP: 1v1 race on an identical seeded board with a guaranteed shared safe opening, plus solo time-attack. Game-mode rules are a Strategy (`GameMode`) living in the engine. A ghost is a recorded `ReplayLog` played back as a stand-in opponent, which lets race rules be built and tested locally.
2. **Tasks:** M4-T01 to M4-T05, in order.
3. **Prerequisites and baseline:** tag `m3-complete`. Copy the actual exported signatures of `createGame`, `Game`, `GameResult`, `ReplayLog`, `replay`, `PRESETS`, and the web `GameSession`, `LocalSession` before starting.
4. **Locked decisions:** ADR-001..009; mode rules are pure and live in `packages/engine/src/modes`; ties and DNFs are resolved deterministically (Review Focus #3); open items D-01 (ranked race preset), D-02 (mine-hit rule) and D-03 (match format, single round for now) are settled in M4-T03 as ADR-010.
5. **Deliverables:** `GameMode`, `ModeRegistry`, `TimeAttackMode`, `RaceMode`, `GhostPlayer`, ghost race UI, ADR-010.
6. **Acceptance:** a player can race their own previous run on the same seed and see a correct winner; rule edge cases (ties, both DNF) are covered by tests; ADR-010 committed.
7. **Skills:** baseline; `/architecture` for ADR-010; `/frontend-design` for the race screen.
8. **Documents:** spec sections 2.2, 3 and 4.5. Update: `ARCHITECTURE.md` (modes), `DECISIONS.md` (ADR-010, D-01, D-02, D-03), `ROADMAP.md`, `CHANGELOG.md`.

**Types fixed for this milestone:**
- `type ModeId = 'race' | 'time-attack'`.
- `type PlayerResult = { outcome: 'won' | 'lost' | 'forfeit'; timeMs: number | null; safeCellsRevealed: number; threeBV: number }`.
- `type MatchOutcome = { winnerIndex: 0 | 1 | null; reason: 'faster' | 'opponent-dnf' | 'progress' | 'tie' | 'forfeit' }`.
- `interface GameMode { readonly id: ModeId; readonly displayName: string; boardConfig(): BoardConfig; createGame(seed: number): Game; playerResult(game: Game, forfeited?: boolean): PlayerResult; decide(results: readonly PlayerResult[]): MatchOutcome }`.

---

### M4-T01 `GameMode` interface and registry

- **Objective:** a Strategy slot for rules so future modes do not touch existing code.
- **Description:** define the interface, types and `ModeRegistry` in the engine.
- **Prerequisites:** M3.
- **Implementation guidance:** put the types above in `packages/engine/src/modes/`. `ModeRegistry.register(mode: GameMode): void`, `get(id: ModeId): GameMode` (throws on unknown id), `list(): readonly GameMode[]`. Registration of built-in modes happens in one `defaultModes()` function, not through global side effects. `playerResult` maps a finished or abandoned `Game` to a `PlayerResult`; an unfinished game that is not forfeited yields `outcome: 'lost'` with `timeMs: null`.
- **Expected output:** `modes/mode.ts`, `modes/registry.ts`, exports from `index.ts`, tests with a stub mode.
- **Testing requirements:** register, get, duplicate registration rejected, unknown id throws; stub mode round-trips through the registry; API-surface snapshot updated deliberately.
- **Acceptance criteria:** tests pass; no global mutable state.
- **Relevant skills:** baseline.
- **Documentation updates:** TSDoc; `ARCHITECTURE.md` (Strategy usage for modes).

### M4-T02 `TimeAttackMode`

- **Objective:** the solo mode's rules.
- **Description:** implement `TimeAttackMode` with preset-based board config.
- **Prerequisites:** M4-T01.
- **Implementation guidance:** `new TimeAttackMode(preset: 'beginner' | 'intermediate' | 'expert')`; `id` is `'time-attack'`; `decide` with one result returns `winnerIndex: 0` if won else `null` with reason `'faster'` or `'opponent-dnf'` as appropriate (document the convention for solo runs). Clock start for solo play is the start signal; record this in ADR-010 along with the race rules, so solo and race share one definition.
- **Expected output:** `modes/time-attack.ts`, tests, web integration so the menu uses `ModeRegistry`.
- **Testing requirements:** win and loss results; unfinished game gives DNF; the solo flow from M3 still works through the registry.
- **Acceptance criteria:** M3 e2e smoke test still passes.
- **Relevant skills:** baseline.
- **Documentation updates:** TSDoc; `ARCHITECTURE.md`.

### M4-T03 `RaceMode` and tie-break rules (ADR-010)

- **Objective:** a deterministic definition of who wins a race.
- **Description:** implement `RaceMode`, settle D-01, D-02, D-03 and record ADR-010.
- **Prerequisites:** M4-T02.
- **Implementation guidance:** working rules from the spec: both players get the same seed and opening; a mine hit ends that player's run (DNF). `decide(results)` for exactly two results: (1) one won and the other did not: winner, reason `'opponent-dnf'`; (2) both won: lower `timeMs` wins, reason `'faster'`; equal `timeMs`: `winnerIndex: null`, reason `'tie'` (a draw); (3) both DNF: more `safeCellsRevealed` wins, reason `'progress'`; equal progress: draw; (4) a forfeit loses to any non-forfeit, reason `'forfeit'`; both forfeit: draw. If playtesting suggests a time penalty instead of DNF, run `/brainstorming` first and revise ADR-010 before coding. Choose the ranked race preset (working assumption: `intermediate`) and list it in the ADR. Race `boardConfig()` is fixed per match preset.
- **Expected output:** `modes/race.ts`, `docs/adr/ADR-010-race-rules.md`, tests.
- **Testing requirements:** table-driven tests for every `decide` branch including equal times, equal progress, both DNF, forfeit combinations, and result order symmetry (swapping players swaps the winner) (Review Focus #3); determinism: same inputs always same outcome.
- **Acceptance criteria:** ADR-010 committed with D-01, D-02, D-03 decided; tests pass.
- **Relevant skills:** baseline; `/architecture`; `/brainstorming` (only if rules change).
- **Documentation updates:** `DECISIONS.md`, `PROJECT_OVERVIEW.md` (race rules in plain language), TSDoc.

### M4-T04 Ghost recorder and player

- **Objective:** replay a recorded run as a live opponent.
- **Description:** `GhostPlayer` over a `ReplayLog`, plus saving the last run per preset.
- **Prerequisites:** M4-T03, M2-T04.
- **Implementation guidance:** `new GhostPlayer(log: ReplayLog)`. `advanceTo(tMs: number): GameView` applies all commands with `t <= tMs`, never moves backward (calling with a smaller `tMs` returns the current view unchanged), and is cheap per call (incremental, not replaying from scratch). Also expose `progress(): number` (safe cells revealed) and `result(): GameResult | undefined`. In `apps/web`, store the best run's `ReplayLog` per preset using the `StatsStore` pattern (versioned JSON, try/catch, size cap).
- **Expected output:** `engine/src/modes/ghost.ts`, `apps/web/src/ghost/GhostStore.ts`, tests.
- **Testing requirements:** advancing in small steps and one big step reach the same final view; non-monotonic calls do not rewind; a ghost of a loss ends in `GameLost` at the logged time; empty log yields an idle ghost; oversize or corrupt stored data is discarded.
- **Acceptance criteria:** tests pass.
- **Relevant skills:** baseline.
- **Documentation updates:** TSDoc; `ARCHITECTURE.md` (ghosts and replay reuse).

### M4-T05 Ghost race UI

- **Objective:** a playable local race that proves the race flow end to end.
- **Description:** a race screen where you play your seed against your previous run.
- **Prerequisites:** M4-T04.
- **Implementation guidance:** menu option "Race your ghost" uses `RaceMode`, the same seed as the stored ghost, and a 3-2-1 countdown (a client-side placeholder; the server countdown arrives in M6-T04). Show the ghost's progress as a bar and a small read-only mini board; on finish call `RaceMode.decide` and show a result screen with reason text written with `/ux-copy`. Save a new best run as the ghost after a win.
- **Expected output:** `src/screens/GhostRaceScreen.tsx`, components, tests, an extension of the Playwright smoke test.
- **Testing requirements:** component tests with a fake clock for win, loss, tie; the e2e test races a seeded ghost and wins; mini board never shows information the ghost has not yet revealed.
- **Acceptance criteria:** CI green; tag `m4-complete` after milestone review.
- **Relevant skills:** baseline; `/frontend-design`; `/ux-copy`; `/requesting-code-review`.
- **Documentation updates:** `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `CHANGELOG.md`.
