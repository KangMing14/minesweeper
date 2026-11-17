# M1 Engine Core: milestone review

> **Amended 2026-11-17 in M1-T08.** Reading M2-T03 and M5-T05 closely while writing the follow-up tasks showed that two statements below were too strong: finding I1 (M5-T05 already forbids mine data in a `delta`; the real problem is that it also says the `delta` carries the engine's events, which include `mineIndex`) and finding M3 (M2-T03 already requires `Game` to reject a bad `t`). Both are corrected in place. The tag moves to after M1-T10, because `ROADMAP.md` says a milestone is finished when all its tasks are `Done`. The file was renamed from `1-review.md` to the convention name. Nothing else changed.

- Date: 2026-11-16
- Scope: snapshot `minesweeper-20261116-1638-gitstate.zip` (whole repository plus `GIT_STATE.txt`, generated 2026-11-16T09:38:05Z). `HEAD` and `origin/main` are both `a514a0a` (PR #16, M1-T07). The working tree has two uncommitted changes: `ROADMAP.md` and `docs/workflow/sessions/2026-11-16-M1-T07.md`. The uploaded `ARCHITECTURE.md`, `DECISIONS.md`, `ROADMAP.md`, `M1-engine-core.md` and the Project copy of `CLAUDE.md` are identical to the snapshot's.
- Reviewer: Claude, in a new conversation that wrote none of the M1 work, using the `/requesting-code-review` checklist. No subagent tool was available, and the skill's reviewer template forbids spawning one, so I reviewed the milestone myself, in passes: (1) plan and acceptance, (2) code, (3) tests and mutation runs, (4) docs against code, (5) git state. Read-only: nothing in the repository was changed. Every experiment ran in a scratch copy under `/tmp`.
- Reviewed against: `docs/milestones/M1-engine-core.md` (handoff package, T01 to T07, acceptance), the Global Constraints and Review Focus of the master plan, `CLAUDE.md`, `ARCHITECTURE.md`, `DECISIONS.md`, ADR-009.
- Verdict: **no code change is blocking.** One docs-only close-out (B1) is needed before the tag, and two important findings (I1, I2) became tasks M1-T09 and M1-T10, so the tag `m1-complete` follows M1-T10. Details in section 6.

## 1. Evidence: the checks I ran

Clean install in a scratch copy (Node 24.22.1 from the npm registry, pnpm 12.15.0 through Corepack, `pnpm install --frozen-lockfile --ignore-scripts`; hooks not installed). All exit 0:

| Command | Result |
|---|---|
| `pnpm typecheck` | pass (`tsc -b`, then engine and protocol test configs and tooling) |
| `pnpm lint` | pass, no output |
| `pnpm format:check` | "All matched files use Prettier code style!" |
| `pnpm check:todos` | ok |
| `pnpm check:links` | ok |
| `pnpm test:lint-fixtures` | 76 of 76 |
| `pnpm docs:api` | pass; `treatWarningsAsErrors` and `treatValidationWarningsAsErrors` are on; no warning |
| `pnpm test:coverage` | 12 files, **250 tests passed**; 100% statements, branches, functions and lines on every engine file that has code (`command.ts` is types only) |

`GIT_STATE.txt`: linear history (0 merge commits); every ROADMAP row for M1-T01 to M1-T07 matches the log (`ceaeee3` #10, `e2decf7` #11, `f357725` #12, `67159eb` #13, `f82d02f` #14, `143f05b` #15, `a514a0a` #16, with the same dates); `ci` is green on the last five runs on `main`, including #16; branch protection is unchanged from M0 (required check `ci`, strict, `enforce_admins`, linear history, no force pushes); the only tag is `m0-complete`.

Not verified: husky hooks, commitlint and `check-branch-name` on the real commits (the snapshot has no `.git`), Windows, `pnpm audit` (not run), and whether the `@example` blocks in TSDoc compile (they are comments; no tool compiles them).

## 2. Acceptance criteria of M1

| Criterion (milestone file) | Status | Evidence |
|---|---|---|
| All engine tests pass with high branch coverage | **Met** | 250 tests; 100% branches; thresholds 95/90 in `vitest.config.ts:62`. Mutation runs below show the tests bite. |
| No lint exemptions | **Met** | No `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `any` or non-null assertion in `packages/engine/src` (grep). |
| A full game can be played in a test using only the public API | **Met** | `public-api.test.ts` imports only `./index.js`: a won game (cascade, flag, chord, final reveal), a lost game, unsubscribe, an out-of-range index, the config helpers. |
| `pnpm docs:api` is clean | **Met** | Zero warnings; session log reports 18 engine pages. |
| ADR-009 committed | **Met** | `docs/adr/ADR-009-cell-rules.md`; D-04 row in `DECISIONS.md` reads "Settled by ADR-009". |
| Public API exported, documented and locked | **Met** | `index.ts` exports 18 names; `dist/index.d.ts` matches; the snapshot guard fails when I reshape `Command` or export an internal (runs below). |
| `m1-complete` tagged after the review | **Pending** | Tag list holds only `m0-complete`. See B1. |

## 3. Global Constraints and Review Focus

| Item | Status | Evidence |
|---|---|---|
| Engine imports nothing project-internal, no Node or DOM APIs, no clocks, no `Math.random` | **Met** | Only relative imports in `src/*.ts`; the one non-relative import in a test is `typescript` in `api-surface.test.ts`, a root devDependency used in a test only (documented in the session log). `tsconfig` has `lib: ["ES2023"]`, `types: []`. |
| `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` | **Met** | `tsconfig.base.json`; `pnpm typecheck` passes. |
| `protocol` and apps untouched | **Met** | Each `src/index.ts` is still the empty placeholder; the lint boundary fixtures pass. |
| Mine positions never reach a client in progress | **Met in the engine** | `buildGameView` reads mines only for `exposedMines`, and only after a win or loss. Mutations that leak a mine through a hidden or flagged cell die (section 4). The race side is I1. |
| TSDoc on every exported symbol, `@example` in engine; every TODO names a task | **Met** | Lint and TypeDoc pass; the only TODO in code or config is `eslint.config.js:126` `TODO(M5-T03)`; the two `TODO(M1-T05)` placeholders are gone. |
| Canonical names | **Met** | Public names are 7 values and 11 types, all in the canonical table; internal names (`GameEventEmitter`, `buildGameView`, `CELL_*`, `revealCell`, `RevealResult`, `chordCells`, `ChordResult`) stay out of `index.ts`; the `ARCHITECTURE.md` text about which task added which name matches the code. |
| Review Focus #1 (no-op commands) | **Met** | Tests: reveal on revealed or flagged cell returns `[]` and the view is identical (`game.test.ts:237-265`); flag on a revealed cell (`:356`, `:364`); chord with too few or too many flags, on hidden, flagged, zero (`:516-552`); no throw. |
| Review Focus #2 (after game over) | **Met for the engine** | `lifecycle.test.ts:275-336`, `it.each` over won and lost, every command type on every cell. Commands before the start signal belong to M5-T04 and M6-T04, as `ARCHITECTURE.md` says. |
| Review Focus #4 (config extremes) | **Met for M1** | `config.test.ts` accepts 1x1 with 0 mines, 1xN, Nx1 and rejects a mine on every cell; the "too few cells for the safe opening" half is M2-T02. |
| Review Focus #3 and #5 | Not in M1 | Owners are M4-T03, M6. |

## 4. How hard the tests bite

I broke the engine in a scratch copy 31 ways and ran the engine project each time. 27 mutations were killed (1 to 21 failing tests each). Four survived, and none is a test gap: `>=` for `===` in win detection and counting the mine as revealed in the private counter after a loss are equivalent mutants (the count can never exceed the safe cells; the view derives its count from the cells and the status is final); a mutation that built a structurally identical frozen `{ state: 'hidden' }` object is also equivalent; and one emitter mutation I wrote was a no-op, so it proves nothing (I re-ran the emitter with a real change, which died).

Killed, among others: chord `flags < value` and `flags > value`; dropping the zero guard; dropping the nothing-to-open guard; last mine instead of lowest; the flood fill passing through flags; a recursive flood fill (4 tests fail, so the 100x100 test does prove "non-recursive"); a flag not starting the game; post-game rejection removed for lost; range check after the status check; `exposedMines` while playing, unsorted, or with `unshift`; a hidden cell leaking `mine: true`, an adjacent count, or a flagged cell leaking mine-ness; `minesRemaining` clamped; `gameWon` with `t: 0`; unfrozen events array; the emitter mutating its live list; the emitter not delivering to every listener after a throw; `MAX_DIMENSION` 101; `mineCount` equal to the cell count allowed; `indexOf` accepting `x == width`; duplicate mines not collapsed.

Guards of the M1-T07 deliverables, run the same way: adding `readonly extra?: number` to `Command` fails the snapshot test (the diff shows the line); adding `export { revealCell }` to `index.ts` fails three tests (snapshot, internals denylist, `@internal` check). Adding a 30-statement untested internal module used by `game.ts` turns `pnpm test:coverage` red (87% statements, 84% branches), so the thresholds are not decoration.

One weakness the mutations could not show, found by a probe: **I2**.

## 5. Strengths

- The M1-T04 to M1-T06 semantics are written down once and then followed: one `cellsRevealed` per command, a fixed discovery order, `gameLost` or `gameWon` always last, one internal step (`#settle`, `#announce`) so `reveal` and `chord` cannot disagree. The order of checks in `apply` (index, then status, then command) is pinned by tests.
- ADR-009 is a good record. Its Consequences name the exact coupling to D-02 (a losing chord's `revealedCount` feeds the race tie-break) and the M2-T02 trap (a flag can be the first command that takes effect). Both are things M2 and M4 will need.
- Honest verification notes: the session logs and `DECISIONS.md` say what was not checked; the docs were corrected when code changed (the T06 follow-up on a winning chord).
- The public-API guard goes further than the task asked: it renders type shapes through the compiler API, checks runtime names against declared values, and fails on an `@internal` tag on an exported name (closing M0 re-review N3, third gap).
- Engine purity holds without exemptions; 100% coverage with thresholds that can fail; `fast-check` was pinned with the 14-day rule checked and the audit run (`DECISIONS.md`, "M1-T06 verification notes").

## 6. Findings

IDs are new (B, I, M for this review). Each proposed fix is a task you can add to `ROADMAP.md`; I numbered them M1-T08 onwards only as suggestions, and each is small enough for one pull request.

### Blocking (gates the tag, not M2 work)

**B1. `main` does not yet record M1-T07 as done, the M1 close-out is not written, and this review is not in git.**
- Where: `GIT_STATE.txt`, "working tree": ` M ROADMAP.md` and ` M docs/workflow/sessions/2026-11-16-M1-T07.md`. The snapshot's `ROADMAP.md` shows M1-T07 as `Done`, `#16`, `a514a0a`, 2026-11-16; the session log's "Git" section holds the PR and merge commit. A squash SHA is not known inside its own pull request, so these are filled after the merge. `CHANGELOG.md` has an "M0 close-out" line but no M1 one, and its M1-T07 entry gives no test count (the session log says 242 to 250).
- Inference: I cannot read `HEAD`'s copy of `ROADMAP.md` (no `.git` in the snapshot). I infer from the ` M` status and the session log that the committed file lacks the M1-T07 cells. This is the same situation as N1 in the M0 re-review.
- Why it blocks: `m1-complete` should point at a commit whose `ROADMAP.md` says every M1 task is done.
- Task **M1-T08**: commit the `ROADMAP.md` and session-log changes, the `CHANGELOG.md` M1 close-out line and the M1-T07 test count; rename this review; close N3 gaps 1 and 2 (M4 below). The task count rises from 83 to 86 with M1-T08 to M1-T10. The tag `m1-complete` goes on the merge commit that leaves all ten M1 rows `Done`; whether to run a re-review (Prompt F2) first is yours.

### Important

**I1. D-14 and the engine docs speak of `exposedMines` only; `GameLost.mineIndex` is also mine data in a DNF frame, and M5-T05 contradicts itself about it.**
- Where: `ARCHITECTURE.md` "Game state, views and events", Race caveat (only `exposedMines`); `view.ts` `GameView` TSDoc (same); `events.ts` `GameEvent` TSDoc ("never where the mines are, except `GameLost`, which names the one mine that was hit"); `game.ts` `#settle` (`gameLost { t, mineIndex }`); `chord.ts` (lowest-index mine reached); `DECISIONS.md` D-14; ADR-009 Consequences ("the mine layout still leaves the engine only through `exposedMines`"); `M5-first-networked-race.md` M5-T05.
- What: in a race both players share one board, and the DNF player's `gameLost` arrives while the opponent still plays. For a plain reveal the mine index is the cell the player chose, so it adds little. For a losing chord it is the lowest-index mine among the neighbors the player did not click, one more mine location. M5-T05 says "`delta` and `opponentProgress` never carry mine data, even after a DNF" and its leak test covers "the `delta` that reports a player's own DNF". The same task says the `delta` carries the engine's events, and the engine's `gameLost` event has `mineIndex`. The two sentences conflict, and neither M5-T01 (the `delta` schema) nor M4-T03 (ADR-010) says which one wins or what a DNF frame shows. (My first version of this finding said nobody told the server author; that was too strong. The leak test would catch the problem, but the contract is unstated.)
- Why it matters: this is the project's main anti-cheat promise (`CLAUDE.md` rule 8), and the engine's own docs call these outputs safe to hand to a client.
- Not a defect today: no network code exists, and the engine documents that the server filters.
- Task **M1-T09 (docs, no behavior change)**: name `GameLost.mineIndex` next to `exposedMines` in the Race caveat, the `GameView` and `GameEvent` TSDoc, the D-14 row and an ADR-009 erratum; ask ADR-010 (M4-T03) to state what a race DNF frame carries; give the `delta` schema (M5-T01) a DNF variant without a mine index; add a chord that loses to the M5-T05 leak test. If you would rather the engine not expose the choice at all, that is an engine change and a new ADR superseding the relevant lines of ADR-009, taken in M4-T03.

**I2. The property tests almost never exercise chording or deep games.**
- Where: `game.property.test.ts:20-45` (`boardArbitrary`, `playArbitrary`).
- What: I ran the same generators for 1,000 games with counters. Of 1,034 `chord` commands, **3 took effect** (2 of them lost). 455 of 1,000 games ended in a loss, most within a few commands, because `mineCount` is drawn uniformly from 0 to cells minus 1, so most boards are very dense, and chords and flags land on random cells. The properties are therefore mostly properties of reveal, flag and early loss. Chord's invariants (no cell listed twice, flagged cells never opened, a chord with the right flags never loses, an effective chord equals the reveal of each neighbor in order) rest on example tests alone.
- Mitigation I checked: the example tests are strong; 6 of my 6 chord mutations died (section 4). So this is a gap in the extra safety net, not a bug.
- Why it matters: the property tests are the milestone's answer to "never throws, never decreases, never changes the mine layout" for arbitrary play (M1-T06), and M2 will rely on them for replay equivalence. The existing guard "generators reach both a win and a loss" would not notice that chords are never effective.
- Task **M1-T10 (tests only)**: (a) bound mine density (for example up to 25% of the cells) and add a guided generator that flags and chords on revealed numbers and, with some probability, flags the true mines first; (b) add a pinned check like the existing one: in a fixed-seed sample, at least N chords take effect and at least one chord loses and one wins; (c) add a differential test against a short naive reference implementation (recursive reveal, chord by the ADR-009 rules) over random boards and commands, comparing events and views; (d) raise the cap from 8x8 to something like 16x16 for part of the sample. No production code changes.

### Minor

**M1. The file name did not follow the guide.** The prompt asked for `docs/reviews/1-review.md`; `HOW_TO_USE.md` section 7, Prompt F and the existing `M0-review.md` use `Mn-review.md`. Renamed to `M1-review.md` in M1-T08.

**M2. Only Review Focus #2 is marked in the tests.** `lifecycle.test.ts:275` says "(Review Focus #2)". The cases for #1 (`game.test.ts`, "commands that do nothing", flag and chord no-ops) and #4 (`config.test.ts`, 1x1, 1xN, Nx1) are present but unmarked, although the master plan says each is "marked 'Review Focus #n' there" and the milestone file asks for it. Add the marker to those `describe` titles (rename only).

**M3. `Command.t` is unchecked in the live `Game` until M2-T03.** `game.ts` `apply` and `ARCHITECTURE.md` say `t` is not checked, so `GameWon.t` and `GameLost.t` can carry `NaN`, a negative number or a time earlier than the previous command. M2-T03 already requires `Game` to reject (return `[]`) a command whose `t` is lower than the previous accepted one, fractional or negative, so this is a known interval, not a gap. (My first version asked for a sentence in M2-T03; it is already there.) M2-T03's close-out must change the "not checked" line in `ARCHITECTURE.md`; it lists `ARCHITECTURE.md` under its documentation updates. Related nit: the `RangeError` message in `game.ts:160` interpolates `${index}` while `board.ts` uses `String(value)`; make them match when the file is next touched.

**M4. Two gaps from the M0 re-review (N3, gaps 1 and 2) are still open.** The session log of M1-T07 says the developer was to decide. `eslint.config.js` has no `jsdoc/require-description` for engine and protocol, and `DEVELOPMENT_GUIDE.md:144` does not say that `@internal` goes on its own line. Both are one-line changes. Closed in M1-T08 (`jsdoc/require-description` with two fixtures; one guide sentence).

**M5. `tools/verify-t01.sh` is still in `tools/`.** It checks M0-T01 state and will drift; M0 re-review L1 accepted it. Nothing in M1 uses it. Remove it or mark it as an M0 artifact when `tools/` is next touched.

## 7. Declined to judge

Behaviors I considered and set aside, one line each:

- Whether flagging before the first reveal should start the game (and so a timer): decided by M1-T04 and ADR-009 ("first command that takes effect"); M2-T02 and M4 are warned in ADR-009.
- Whether a chord that hits a mine should open the safe neighbors first: ADR-009 chose the classic behavior and left D-02 and ADR-010 to supersede it.
- Whether `exposedMines` should also appear after a win in a race: D-14 and M4-T03.
- Aggregate versus per-file coverage thresholds: with all files at 100% the aggregate threshold failed for a 30-statement untested file; a smaller one might slip under. Within the "number you can defend" the task asks for.
- Performance beyond the 16 ms expert-board test: M10-T06.

## 8. Resulting ROADMAP rows

| Task | Title | Covers |
|---|---|---|
| M1-T08 | M1 close-out: tracker cells, CHANGELOG, `@internal` lint gaps | B1, M1, M4 |
| M1-T09 | Carry `GameLost.mineIndex` into the D-14 docs | I1 |
| M1-T10 | Property tests that reach chords: guided play, differential check | I2, M2 |

Left open on purpose: M3 (answered by M2-T03) and M5 (`tools/verify-t01.sh`, remove it when `tools/` is next touched). M1-T09 must land before M4-T03; M1-T10 before M2-T03, whose replay tests will reuse the generators.
