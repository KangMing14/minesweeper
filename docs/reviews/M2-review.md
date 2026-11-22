# M2 Deterministic Engine: milestone review

> **Status, added in the same conversation (2026-11-21).** The developer accepted the review and asked for the follow-ups to be done here, so they were applied as M2-T07 (B1, option A with the constant exported), M2-T08 (I1, I2) and M2-T09 (M1 to M4, M6). M2-T10 (M5) was not done: it needs a real Chromium, which that conversation did not have. **One correction to the review below:** I1 called the uncommitted tracker row a process gap and proposed a sentence for `HOW_TO_USE.md`. That was wrong: section 6, step 7 already says to commit the row edit on `main` "or include it in the next task's branch", and the snapshot was simply taken before that happened. The only action is that the next pull request carries the pending rows, which M2-T08 does; no process change was made for it. The findings text below is otherwise left as written. The tasks' final wording is in `docs/milestones/M2-deterministic-engine.md`.

- Date: 2026-11-21
- Scope: snapshot `minesweeper-20261121-2128-gitstate.zip` (whole repository plus `GIT_STATE.txt`, generated 2026-11-21T14:28:15Z). `HEAD` and `origin/main` are both `6cdc41d` (PR #27, M2-T06). The working tree has two uncommitted changes: `ROADMAP.md` and `docs/workflow/sessions/2026-11-21-M2-T06.md` (see I1). The uploaded `ARCHITECTURE.md`, `DECISIONS.md`, `ROADMAP.md` and `M2-deterministic-engine.md` are identical to the snapshot's, and the Project copies of `CLAUDE.md`, `ARCHITECTURE.md`, `DECISIONS.md` and `ROADMAP.md` are identical too (`cmp`).
- Reviewer: Claude, in a new conversation that wrote none of the M2 work, using the `/requesting-code-review` checklist. No subagent tool was available, and the skill's reviewer template forbids spawning one, so I reviewed the milestone myself, in passes: (1) a clean-install run of every check, (2) each task against its acceptance criteria in `M2-deterministic-engine.md`, (3) the Global Constraints, canonical names and package boundaries, (4) code against `ARCHITECTURE.md`, (5) mutation runs and two probes. Read-only: nothing in the repository was changed. Every experiment ran in a scratch copy under `/tmp`; the probe test files were deleted at once.
- Scope of the review: the engine work of M2-T01 to M2-T06 (`packages/engine`), the docs that describe it, CI, and the hand-over to M3 to M8.
- Verdict: **not ready to tag `m2-complete` today.** One finding blocks the tag (B1: a legitimate live game can produce a log that `replay` rejects, which falsifies an acceptance criterion of the milestone). Two bookkeeping and docs items (I1, I2) must go in before the tag. Everything else is minor. The engine code is otherwise in very good shape: the checks are green, the tests catch every mutant that matters, and the boundaries hold.

## 1. Evidence: the checks I ran

Clean install in a scratch copy: Node 24.22.1 (the `node` package from the npm registry; the sandbox's own Node is 22.23.5, below the `engines` floor), pnpm 12.15.0 through Corepack, `rm -rf node_modules`, then `pnpm install --frozen-lockfile --ignore-scripts` ("Done in 4.1s", exit 0; hooks not installed).

| Command | Result |
|---|---|
| `pnpm typecheck` | pass (`tsc -b`, then engine and protocol test configs and tooling) |
| `pnpm lint` | pass, no output |
| `pnpm format:check` | "All matched files use Prettier code style!" |
| `pnpm check:todos` | `[check:todos] ok` |
| `pnpm check:links` | `[check:links] ok` |
| `pnpm test:lint-fixtures` | `tests 78`, `pass 78`, `fail 0` |
| `pnpm docs:api` | pass; no warning (warnings are errors) |
| `pnpm test:coverage` | 23 files, **683 tests passed**; 100% statements and functions and lines on every engine file with code; branches 99.05% overall (`replay.ts` 96.61%, lines 72 and 75; see M3 below); thresholds 95/90 not in danger |
| `pnpm test` | 683 passed, 13.4 s |
| `pnpm audit:prod` | "No known vulnerabilities found" |
| `pnpm test:browser` | **not run**: `playwright install chromium` fails in this sandbox ("Download failure"), no other Chromium is installed |

What the git state says: `HEAD` equals `origin/main`; history is linear (0 merge commits); every M2 commit subject has the form `type(scope): subject [M2-Tnn] (#n)` and the PR numbers and SHAs match `ROADMAP.md` (#22 `aa412cf` to #27 `6cdc41d`); the last five CI runs on `main` all concluded `success`, including run 44913505620 for #27 (1m10s), which is the first run whose `ci.yml` has the Chromium steps. Branch protection requires `ci`, linear history and conversation resolution, and applies to admins.

Not verified by me: the browser suite (see above; the evidence for it is the green CI run, and I could not read that run's log, so I infer the browser step passed from the job's success and from `ci.yml:` containing both steps without `continue-on-error`), husky hooks, commitlint on the real commits, Windows.

Mutation runs (scratch copy, full engine suite after each change, file restored after each; `cmp` confirms the original is back):

| Mutant | Result |
|---|---|
| `replay.ts`: `t < previousT` to `t <= previousT` | 14 tests fail |
| `replay.ts`: `> MAX_REPLAY_COMMANDS` to `>=` | 1 test fails (the 100,000 boundary) |
| `opening.ts`: fast path `>=` to `>` | **survives**, and is an equivalent mutant: when `total - 9 == mineCount` the scan path lists every cell and draws `nextInt(total)`, the same draw as the fast path. Not a test gap |
| `generator.ts`: opening center allowed to hold a mine | 91 fail |
| `threebv.ts`: numbered border no longer counted as covered | 12 fail |
| `result.ts`: rate computed with two roundings | 2 fail |
| `game.ts`: `t < lastT` to `t <= lastT` | 53 fail |
| `game.ts`: drop the `isSafeInteger` check | 6 fail |
| `prng.ts`: warm-up 12 to 11 | 91 fail (golden vectors) |

## 2. Acceptance criteria of the milestone

From the "Acceptance" line of the handoff package and from each task.

| Criterion | Status | Evidence |
|---|---|---|
| Same seed gives identical layouts in Node and a real browser | **Met, with a caveat on my side** | `fixtures/boards.json` (22 boards, hashes produced outside the engine) and `prng-vectors.json` run in both runners through `determinism.shared.ts`; `ci.yml` runs `playwright install --with-deps chromium` and `pnpm test:browser`; CI on #27 is green. I did not run Chromium (section 1). |
| `replay(log)` reproduces any live game's final view and result exactly | **Not met for games with more than 100,000 accepted commands** | B1. For every game below that size it holds: 1,000-case properties in `replay.test.ts` and `result.test.ts`, and 500 fuzz games in both runners. |
| Fuzz tests pass | Met | `replay.test.ts` (three properties), `result.test.ts` (two), `determinism.shared.ts` (500 games, plain and with throwing stubs). Guard tests pin the mix of games (won by play, lost, unfinished, chords, seeds above 2^31). |
| Docs clean | Met, with minors | M1, M2 below. `docs:api` has no warning; `check:links` and `check:todos` are green. |

| Task | Verdict | Notes |
|---|---|---|
| M2-T01 PRNG | Met | `prng.ts`: sfc32 over a SplitMix32 seed expansion, `Math.imul`, `>>> 0`, `| 0` only; rejection sampling for `nextInt`; invalid seeds and `maxExclusive` throw `RangeError` before the state moves. Golden vectors for seeds 0, 1, 42, 4294967295 plus a BigInt differential test. The fixture came from third-party code, not the engine. |
| M2-T02 Generator and opening | Met | Partial Fisher-Yates over the cells outside the opening zone; `SafeOpeningPolicy` is a class with `select`; config-only rejection (`mineCount` reason) with no hang; 22 golden boards (task asks for 20); reference-implementation comparison; distribution check. One deviation from the task text: "new generator id" became "new `ReplayLog.version`" (recorded in `DECISIONS.md` and `ARCHITECTURE.md`; fine, see M6). |
| M2-T03 `createGame` and log | Met | Opening is part of creation, not logged; `Game.log()` returns frozen copies of `type`, `index`, `t`; `t` rule pinned (fractional, negative, NaN, infinite, decreasing, above 2^53, equal allowed). Deviation from the task text, approved on 2026-11-19: a created game that the opening already clears is `'won'` at `t = 0` (option A1, recorded). |
| M2-T04 Replay | Met except B1 | Fixed order of checks, error positions in every reason, `replay` throws on a rejected command, empty log replays to `'ready'` (or `'won'` on a cleared board). |
| M2-T05 Results and 3BV | Met | `result()` is `undefined` mid-game; `threeBVPerSecond` is a single division, 0 at `t = 0`; the TSDoc example for `computeThreeBV` checks out by hand (1x9 row, mines at 3 and 5: openings `{0,1}` and `{7,8}` plus the isolated 4, so 3). The reference is secondhand (M4). |
| M2-T06 Determinism suite | Met | One shared suite, two runners; throwing stubs for `Date`, `performance`, `Math.random` and `Intl.DateTimeFormat`; the runners check that they really run in Node and in Chromium; the CI steps are in the single `ci` job. The "introduce a `Math.random` in a branch and watch CI fail" check was done by hand locally and is described, not committed (acceptable; M7). |

## 3. Global Constraints, boundaries, names, TODOs

| Constraint | Status | Evidence |
|---|---|---|
| `engine` imports nothing project-internal, no DOM, Node API, clock or `Math.random` | Met | Every non-test engine file imports only relative modules (grep of `from '[^.]` over `packages/engine/src/*.ts` minus tests: empty). Test files import `vitest`, `fast-check` and `typescript` only; `engine/package.json` has no dependency. Lint (purity and boundary rules, 78 fixture cases) is green, and the throwing stubs back it at run time. |
| `protocol` imports only engine types; apps do not import each other | Met | `protocol/src/index.ts` is `export {}`; the apps are stubs. Nothing to violate yet. |
| TSDoc on every exported symbol, `@example` in `engine` | Met | `pnpm lint` and `pnpm docs:api` green; `jsdoc/require-example` and `require-description` are errors in `engine`. |
| Every TODO names a task | Met | `check:todos` ok. The only marker in the code is `eslint.config.js:133`, `TODO(M5-T03)`, whose task is still `Not started`. `TODO(M2-T06)` in `generator.golden.test.ts` was resolved (the SHA-256 helper moved to `determinism.support.ts`). |
| Canonical names exact | Met | The 30 public names in `index.ts` equal the 14 values and 16 types in `ARCHITECTURE.md` "Public interfaces today" and the snapshot `api-surface.txt` (the test passes). `InvalidReplayError` is the one name the master plan's table lacked and `ARCHITECTURE.md` records it. `computeThreeBV`, `buildGameResult`, `openingZone` and `MAX_REPLAY_COMMANDS` stay internal. |
| Mine positions never reach a client | Not applicable yet; **carried forward correctly** | `exposedMines`, `GameLost.mineIndex` and now `GameResult.threeBV` are all named in D-14 in `DECISIONS.md`, `ARCHITECTURE.md` and the TSDoc of `Game.result()`. M5-T05's leak test must cover the record (the note for ADR-010 says so). |

Review Focus coverage in M2: **#2** (out-of-order commands) is pinned by `game.log.test.ts` ("Command.t: which times are accepted (Review Focus #2)") on top of `lifecycle.test.ts`; "before the start signal" is a match concern (M5-T04, M6-T04) and `ARCHITECTURE.md` says so. **#4** (config extremes) is pinned by `generator.test.ts` ("extreme configs (Review Focus #4)": 78 mines on 9x9, 2x2, one row, one column, one cell). **#1** is M1's. **#3** and **#5** belong to M4 to M6.

## 4. Findings

### Blocking

**B1. A live game can log more than 100,000 accepted commands, and `replay` then rejects its own log.**

- **What.** `Game.apply` accepts every flag toggle. Flagging and unflagging the same hidden cell is accepted each time (an equal `t` is allowed), and each accepted toggle is appended to `Game.log()`. `validateReplayLog` refuses a log with more than `MAX_REPLAY_COMMANDS` (100,000) entries. So a game that is legal and still running can have a log that the engine's own `replay` throws on.
- **Evidence.** I ran it in a scratch copy: `createGame(PRESETS.beginner, 42)`, then 100,001 `flag` commands on one hidden cell at `t = 1000`. Result: status `playing`, `log().length` 100001, and `replay(...)` throws `InvalidReplayError`: "commands has 100001 entries, more than the maximum of 100000". The cap is therefore not "far below" any real game, as the TSDoc of `MAX_REPLAY_COMMANDS` (`replay.ts`) says ("The longest real game (100x100, every cell touched twice) stays far below this"): that sentence counts reveals but forgets that flag toggles are unbounded.
- **Why it blocks.** It falsifies the milestone's acceptance criterion ("`replay(log)` reproduces any live game's final view and result exactly") and the promise in `ARCHITECTURE.md` "Replay and validation". It also leaves the live log unbounded in memory (the server's rate limit of M5-T03 and M9-T03 would be the only guard). And it is cheapest to fix now: once logs are stored (M7) and a ranked flow exists (M8), a game that cannot be validated is a user-visible bug, and any change to `Game.apply` after the tag is a contract change under ADR-002.
- **Fix, proposed as M2-T07 (section 5).** Make the engine enforce the same limit it validates: once `log().length` reaches the cap, `apply` returns `[]` for any further command (a rejected command, so it is not logged and the invariant "a log holds only accepted commands" and "every live game replays" both hold). This does not need a new replay version: a stored log cannot exceed the cap today (validation rejects it), so no stored game changes. The alternative (leave the engine as is, document the limit, and make the ranked flow refuse such games) is weaker because it leaves the memory growth and the false guarantee; I do not recommend it, but the developer may choose it. If so, B1 drops to Important and the TSDoc claim above must be corrected either way.
- **Related decision for the same task.** M5-T01 must put the same limit in the Zod schema (`DECISIONS.md`, "Replay and versioning": "must not be looser"), but `protocol` imports only engine types, and `MAX_REPLAY_COMMANDS` is an internal value. M2-T07 should decide how the limit is shared: export it (a new public value, which adds a row to the canonical names, an `api-surface.txt` update and a line in `ARCHITECTURE.md`), or leave it internal and make M5-T01 carry a literal with a parity test. I recommend the export.

### Important

**I1. The M2 close-out is not in git yet (the tracker row for M2-T06, its session log, the CHANGELOG close-out entry and this review).**

- **What.** `GIT_STATE.txt` shows ` M ROADMAP.md` and ` M docs/workflow/sessions/2026-11-21-M2-T06.md`. The snapshot's `ROADMAP.md` already shows M2-T06 as `Done`, `#27`, `6cdc41d`, 2026-11-21, which is data that only exists after the squash-merge, so the committed file on `main` cannot have it. `CHANGELOG.md` has the M2-T01 to M2-T06 entries but no M2 close-out entry (M1 has one, and `d8c91eb` "docs: close out M1 [chore]" is the pattern). The review file itself is not committed yet. The tag `m2-complete` does not exist (correct: it waits for this review).
- **Why.** `CLAUDE.md` rule 12 asks for the roadmap row at the end of a task, but the PR number and the squash SHA are not known before the merge, so the row can only be completed afterwards. M0 and M1 both ended in a follow-up `[chore]` PR for this reason. It is not a defect: the row is completed after the merge on purpose (see the correction at the top).
- **Fix, proposed as M2-T08.** A close-out `[chore]` PR after B1's task: commit the `ROADMAP.md` and session-log changes, add the M2 close-out entry (and M2-T07 to M2-T09) to `CHANGELOG.md`, commit this review, then tag `m2-complete`. (The sentence for `HOW_TO_USE.md` and `CLAUDE.md` rule 12 that I proposed here was not needed: see the correction at the top.)

**I2. `ARCHITECTURE.md` says CI had not run on the browser suite; it has, and it passed.**

- **What.** `ARCHITECTURE.md`, "Determinism tests", "Verified where": "CI on GitHub had not run when this was written." `GIT_STATE.txt` shows run 44913505620 for #27 as `completed success` (1m10s), and `ci.yml` contains the Chromium steps. The sentence was true when it was written and is now misleading in the one place a reader looks for the evidence of the milestone's main acceptance criterion.
- **Fix.** Include in the close-out PR (M2-T08): replace it with the run's result and date, and keep the sentence that the sandbox run used Chromium 153 and a throwaway config. Say in the same place that the CI step is the evidence for Playwright 1.65.0's own Chromium.

### Minor

**M1. A garbled sentence in `ARCHITECTURE.md`, "Game state, views and events".** "Methods so far: `subscribe(listener)`, `view()`, `apply(command)` from M2-T03 `log()` and from M2-T05 `result()`." The "from M2-T03" and "from M2-T05" were meant to introduce `log()` and `result()`; as written, `apply` appears to arrive in M2-T03. Reword: "`subscribe`, `view`, `apply`, and, from M2-T03, `log` and, from M2-T05, `result`."

**M2. `replay(log).log()` equals `log.commands` only for commands without extra properties.** `validateReplayLog` ignores unknown properties on the log and on each command, and `Game.log()` copies only `type`, `index` and `t`. I ran a log whose command carries `extra: 'x'`: it validates, replays, and `replay(log).log()` is `[{"type":"flag","index":0,"t":5}]`, not equal to the input. `ARCHITECTURE.md` ("`replay(log).log()` equals `log.commands`") and the TSDoc of `replay` state the equality without that qualifier. Harmless in the engine; relevant for M5-T01 and M8-T01, which will store what they receive. Fix by wording in the engine docs, and by a sentence in M5-T01 (the Zod schemas are strict, so unknown keys are rejected or stripped before they reach the engine) and in M8-T01 (store the replayed `game.log()`, not the submitted object).

**M3. Two branches of `show()` in `replay.ts` are untested (lines 72 and 75).** The truncation of a string longer than 24 characters and the "an array"/"an object" descriptions. They only shape error messages, and the overall branch coverage is 99.05%, but the reasons are part of the documented API ("the reason says where"). Add a table-driven test for `show` through `validateReplayLog` (a 30-character `version`, an array as `config`, an object as `seed`).

**M4. The 3BV reference is secondhand.** `threebv.ts` cites "Bechtel's Board Benchmark Value ... reported by Minesweeper Arbiter and used on the Authoritative Minesweeper site" and says it was checked against explanations, not the original text; `ARCHITECTURE.md` says the same. The milestone asks for "3BV definition documented with a reference". The definition is standard and the 20 tests (hand-computed boards, a perfect-player property, a literal reading of the definition) make it safe, but the citation has no URL or title a reader can follow. Add one linkable source when M3-T07 (local statistics) first shows the number to a user.

**M5. The fuzz evidence is self-consistency only, by design, and it stays that way.** `determinism.shared.ts` proves that live play equals `replay` in each environment, and the golden boards and PRNG vectors prove that Node, Chromium and an outside reference agree on layouts. Nothing compares the *outcomes of the fuzz games* between Node and Chromium, so a rule that differed between engines while staying self-consistent (for example in `Game.apply` or in 3BV) would not be seen. The reason given (no committed digest, because a fixture must not come from the code it checks) is sound for a correctness oracle; it does not apply to a cross-environment equality check, which needs no oracle. Optional, low priority, proposed as M2-T10: each runner prints a SHA-256 of its fuzz outcomes, and the CI step compares the two values (computed in the run, never committed). Do it when the next change touches `Game.apply`, the generator or `Prng`, or at M10; not before M3.

**M6. Two handoff gaps for later tasks.** (a) `replay(log, generator?)` is public and the log carries no generator id, only `version: 1`. A server that validates untrusted logs (M8-T01) must call `replay(log)` and never pass a generator it did not pick itself; `M8-competitive-layer.md` does not say so. One sentence in M8-T01. (b) `GameResult.timeMs` can be as large as a safe integer for a legal game, because `Game.apply` only requires `t` to be a non-decreasing safe integer. M8-T01 already lists "last command `t` is not greater than wall time elapsed since issue"; add that the same bound applies to a race (M5-T05) so `timeMs` and `threeBVPerSecond` cannot be inflated by a client-chosen `t`. (Under the server-stamped `t` of the data flow this is already the design; the note only makes the dependency explicit.)

### Declined to judge (as the reviewer template asks)

- Whether the engine should cap flag toggles separately from the total command count (for example a per-cell limit). Out of scope: a game-design and anti-cheat choice (M9-T04), not a consistency requirement of M2. M2-T07 uses the total count because it matches the existing validation limit.
- The correctness of the sfc32 and SplitMix32 choice as a statistical generator. The task names the algorithm; the tests pin its output and its bias properties loosely.
- `vitest` 5.1.x, `playwright` 1.65.1 and other dependency bumps. `DECISIONS.md` records them as deliberate and dated.
- Whether `tools/verify-t01.sh` should remain (accepted in the M0 re-review).

## 5. Proposed new tasks for `ROADMAP.md`

M1's follow-ups were added as M1-T08 to M1-T10 in the same way. The total becomes 90 (86 plus four). Title and one-line contract; each task still gets its own section in `docs/milestones/M2-deterministic-engine.md`, with the usual objective, guidance, tests and acceptance criteria written by the task's own conversation.

| Task | Title | Status | PR | Commit | Done on |
|---|---|---|---|---|---|
| M2-T07 | Bound the command log: the engine refuses commands past `MAX_REPLAY_COMMANDS` so every live game replays (B1) | Not started | | | |
| M2-T08 | M2 close-out: commit the ROADMAP and session-log rows, CHANGELOG entry, this review, I2 (the tag is set by the developer afterwards) | Not started | | | |
| M2-T09 | M2 review minors: M1, M2, M3, M4 (docs and tests), M6 (handoff sentences in M5-T01 and M8-T01) | Not started | | | |
| M2-T10 | Cross-environment digest of the fuzz outcomes, compared in CI (M5; optional, can move to M10) | Not started | | | |

Order: M2-T07 first (it is the only task that changes code); M2-T08 after it, because it records it and tags the milestone; M2-T09 may share a pull request with M2-T08 as an accepted exception (as M1-T08 to M1-T10 did); M2-T10 can wait.

**M2-T07 contract (for the milestone file).** (1) Decide the limit as a single number and where it lives (recommended: one internal constant used by `Game.apply` and `validateReplayLog`, exported publicly for `protocol`; if exported, update the canonical-names table, `api-surface.txt` and `ARCHITECTURE.md` in the same task, and state that the surface is then 31 names). (2) `Game.apply` returns `[]` and logs nothing once `log().length` equals the limit; the index check still comes first and still throws. (3) Tests, written first: the probe above (100,000 toggles are accepted, the next command is rejected, the log has exactly 100,000 entries and `replay` accepts it and gives the same view); a game that reaches the limit and is then won or lost by a command is not possible (state it), so say what happens to a game that is at the limit and not finished (it stays `'playing'`, the result is `undefined`, and the caller must start a new game; M3 and M5 handle that in the UI and the match, and the task adds one line to each handoff). (4) Fix the TSDoc of `MAX_REPLAY_COMMANDS` and of `validateReplayLog`; add the rule to `Game.apply`, `ARCHITECTURE.md` ("Game creation and the command log" and "Replay and validation") and the "Replay and versioning" note in `DECISIONS.md`, including the argument that no ADR is needed (no stored log can exceed the limit). (5) Run the determinism suites again; the golden fixtures must not change.

## 6. What is good, so it is kept

- The version-1 promise is written down in four places that agree (`ReplayLog` TSDoc, `ARCHITECTURE.md`, `DECISIONS.md`, `validateReplayLog`), and the golden fixtures were produced outside the engine.
- Every decision the tasks left open is recorded where the next task will read it (the status of a game cleared at creation, the tie at `t = 0` for ADR-010, `threeBV` under D-14, `effectiveCommands` counting flags).
- The throwing-stub design is careful: installed by name, restored in `finally`, refuses to nest, fails loudly if a stub cannot be installed, and its limits (module-load reads, unused references, implicit locale paths) are stated.
- The tests are strong where it counts: nine mutants run, eight caught with 1 to 91 failures each, the ninth equivalent.
