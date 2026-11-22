# M2 Deterministic Engine: milestone re-review

- Date: 2026-11-22
- Scope: snapshot `minesweeper-20261122-1551-gitstate.zip` (whole repository plus `GIT_STATE.txt`, generated 2026-11-22T08:51:51Z). `HEAD` and `origin/main` are both `36e7964` (PR #29, M2-T10). The working tree has two uncommitted changes: `ROADMAP.md` and `docs/workflow/sessions/2026-11-22-M2-T10.md`. The uploaded `ARCHITECTURE.md`, `DECISIONS.md`, `ROADMAP.md`, the milestone file and `docs/reviews/M2-review.md` are identical to the snapshot's (`cmp`), and the Project copies of `CLAUDE.md`, `ARCHITECTURE.md`, `DECISIONS.md` and `ROADMAP.md` are identical too.
- Reviewer: Claude, in a new conversation that wrote none of the M2 work, using the `/requesting-code-review` checklist. No subagent tool was available, and the skill's reviewer template says not to spawn one, so I reviewed in passes: (1) every finding of the first review, (2) each follow-up task against its own acceptance criteria, (3) `GIT_STATE.txt`, (4) a clean-install run of every check that this sandbox can run, (5) mutation runs and one probe. Read-only: nothing in the repository was changed. Every experiment ran in a scratch copy outside the repository.
- Verdict: **no blocking finding. The engine, the tests and CI are ready for `m2-complete`. Do not tag `36e7964` itself.** `main` still lacks the M2-T07 to M2-T10 tracker cells, this review and two corrections of statements that the last merges made out of date (N1, N2, N3). Land those in a docs-only close-out pull request, as M0 and M1 did, and tag its squash commit.

## 1. Resolution of the first review

| ID | First review | Status | Evidence |
|---|---|---|---|
| B1 | A live game could log more than 100,000 commands and `replay` then rejected its own log | **Resolved** | `packages/engine/src/limits.ts` holds `MAX_REPLAY_COMMANDS = 100_000`; `game.ts:218` returns `NO_EVENTS` when `this.#log.length >= MAX_REPLAY_COMMANDS`, after the index check (`game.ts:213`) and the game-over check (`game.ts:215`) and before `t` (`game.ts:221`). The review's probe, run by me on the built engine (`dist`): 100,001 flag toggles on one hidden cell of `createGame(PRESETS.beginner, 42)` give `{"MAX_REPLAY_COMMANDS":100000,"accepted":100000,"logLen":100000,"status":"playing","replayStatus":"playing","sameView":true}`; `validateReplayLog` and `replay` accept that log. `game.limit.test.ts` has 5 tests (limit and refusal, last command can win, bad index still throws, stopped game replays to the same view, the constant is 100,000). The false "far below any real game" sentence is gone (`grep "far below"` finds only an unrelated line in `result.ts:59`). The constant is public: `api-surface.txt:91` is `const MAX_REPLAY_COMMANDS: 100000`, and `ARCHITECTURE.md` lists 15 values and 16 types, 31 names. Mutants, whole `packages/engine/src` suite (625 tests), file restored after each: `>=` to `>` 4 fail; check removed 4 fail; `>= MAX - 1` 5 fail. All killed (my counts are higher than the session log's because I ran the whole folder, not only the new file). |
| I1 | The M2 close-out was not in git (tracker row, session log, CHANGELOG entry, the review) | **Resolved as scoped; the same pattern recurs for M2-T07 to M2-T10 (N3)** | `docs/reviews/M2-review.md` is committed and carries the status note. `CHANGELOG.md:9` and `:11` hold the M2 close-out and M2-T08 entries. `GIT_STATE.txt` no longer lists `2026-11-21-M2-T06.md` as modified, so that session log is committed. The `ROADMAP.md` M2-T06 row shows `#27`, `6cdc41d`, 2026-11-21, which matches `GIT_STATE.txt`. The first review's own correction stands: filling the PR and commit cells after the merge is by design. |
| I2 | `ARCHITECTURE.md` said CI had not run the browser suite | **Resolved for #27; the same sentence is wrong again for #29 (N1)** | `ARCHITECTURE.md:278` now names run 44913505620 for #27, `success`. `GIT_STATE.txt` agrees: `completed success ... 44913505620 1m10s 2026-11-21T14:21:26Z`. `ci.yml` has both Chromium steps and no `continue-on-error`, so a green job means the step passed. I could not read the run's log, as in the first review. |
| M1 | Garbled sentence in "Game state, views and events" | **Resolved** | `ARCHITECTURE.md:147`: "Methods: `subscribe(listener)`, `view()` and `apply(command)`, and, added later, `log()` (M2-T03) and `result()` (M2-T05)." |
| M2 | `replay(log).log()` equals `log.commands` only without extra properties | **Partly resolved** | Done: `ARCHITECTURE.md:241` carries the qualifier; `DECISIONS.md:116` says to store the replayed `game.log()`; `M5-first-networked-race.md` (M5-T01) says unknown command keys are rejected or stripped; `M8-competitive-layer.md:25` repeats the rule for M8-T01; `replay.test.ts:300` tests that unknown properties are dropped. **Still open:** the TSDoc of `replay` says "the same `view()`, the same `log()`" with no qualifier (`replay.ts:173`, and `:192`), and that text is what the generated API reference shows. See N5. |
| M3 | Two untested branches of `show()` in `replay.ts` | **Resolved** | `pnpm test:coverage` (below): `replay.ts` 100% statements, branches, functions and lines; the engine is at 100% in all four columns. Mutants of `show()`: the 24-character cut changed to 99 makes 3 tests fail; the array and object branches swapped make 3 fail. |
| M4 | The 3BV reference was secondhand | **Resolved, with a caveat** | `threebv.ts:31-37` cites https://minesweeper.online/help, read 2026-11-21. I fetched it today: it redirects to `/help/gameplay`, and its "3BV" section says what the TSDoc says it says (the minimum number of clicks that completes a board without flags; the 5/30/100 limits). It does not spell out "openings plus isolated numbers"; the TSDoc says so itself ("checked against such explanations, not against the original text"). The two other names in that paragraph (Minesweeper Arbiter, minesweepergame.com) have no link and I did not check them. |
| M5 | The fuzz evidence is self-consistency only | **Resolved by M2-T10, as far as it can be checked here** | See section 3. My own mutation of `buildGameResult`: all 71 determinism tests stayed green, the two digests differed, `compare:fuzz-digests` exited 1 naming both. The browser side was not run by me (section 2). |
| M6a | A server must call `replay(log)` without a generator | **Resolved** | `M8-competitive-layer.md:25` ("call it without the optional `generator` argument") and `DECISIONS.md:116`. |
| M6b | The wall-time bound on `t` also applies to a race, so `timeMs` cannot be inflated | **Open (optional, low)** | `M8-competitive-layer.md:25` still has only the solo bound ("last command `t` is not greater than wall time elapsed since issue"); `M5-first-networked-race.md` (M5-T05) says "stamp `t` from the server clock", which is the design, but neither says why it matters for `timeMs` and `threeBVPerSecond`. The task M2-T09 scoped its handoff sentences to M5-T01 and M8-T01, so this is a gap in the scoping, not a missed item. One sentence in M5-T05 closes it. |

## 2. Evidence: the checks I ran

Clean install in a scratch copy of the snapshot: Node 24.22.1 (the `node` package from the npm registry; the sandbox's own Node is 22.23.5, below the `engines` floor of 24.15.0), pnpm 12.15.0 through Corepack, no `node_modules`, `pnpm install --frozen-lockfile --ignore-scripts`:

```text
+ vitest 5.0.5
Done in 3.9s using pnpm v12.15.0        (exit 0; hooks not installed)
```

| Command | Result |
|---|---|
| `pnpm typecheck` | exit 0 (`tsc -b`, then the engine and protocol test configs and the tooling config) |
| `pnpm lint` | exit 0, no output |
| `pnpm format:check` | "All matched files use Prettier code style!" |
| `pnpm check:todos` | `[check:todos] ok` |
| `pnpm check:links` | `[check:links] ok` |
| `pnpm test:lint-fixtures` | `tests 78`, `pass 78`, `fail 0` |
| `pnpm test:scripts` (new in M2-T10) | `tests 15`, `pass 15`, `fail 0` |
| `pnpm docs:api` | exit 0; no warning (warnings are errors) |
| `pnpm audit:prod` | "No known vulnerabilities found" |
| `pnpm test:coverage` | `Test Files 24 passed (24)`, `Tests 696 passed (696)`, 26.0 s. Every engine file with code is at 100% statements, branches, functions and lines (`All files 100 / 100 / 100 / 100`); `command.ts` shows 0 because it holds only a type. Thresholds (95/90) not in danger. |
| `pnpm test` | `Test Files 24 passed (24)`, `Tests 696 passed (696)`, 17.1 s |
| `reports/fuzz-digest/node.json` after the run | `plain` and `stubbed` digests both `e746f0d470dd21eec92e4c155171c6f1ba3027404d27b8f7030b05f629d3deed`, 500 games; the value the M2-T10 session log reports |
| `pnpm test:browser`, `pnpm compare:fuzz-digests` | **Not run.** `pnpm exec playwright install chromium` fails here: "Failed to download Chrome for Testing 158.0.8127.18 ... hostname: 'cdn.playwright.dev' ... Download failure". No other Chromium is installed. The evidence for these two steps is CI (section 3). |

The test count adds up: 683 in the first review, plus 5 (`game.limit.test.ts`), 4 (`replay.test.ts`, M2-T09) and 4 (determinism suite, M2-T10) is 696.

Mutation runs (scratch copy, file restored and `cmp` after each): see the B1 and M3 rows above, and:

| Mutant | Result |
|---|---|
| `result.ts`: rate computed as `threeBV / (timeMs / 1000)` (two roundings) | `determinism.node.test.ts` still 71 of 71 green; `node.json` digest becomes `e15fd060...ccba97`; `node scripts/compare-fuzz-digests.mjs` against a stand-in `browser.json` holding the clean digest exits 1 and prints both digests |
| `browser.json` missing | exits 1: "cannot read ... ENOENT" |
| Two identical reports | exits 0: "node and browser ended 500 games the same way" |

## 3. The follow-up tasks against their own acceptance criteria

| Task | Criterion | Verdict | Evidence |
|---|---|---|---|
| M2-T07 | The 100,001-toggle probe no longer produces a log `replay` rejects | **Met** | Probe output in the B1 row. |
| | Golden fixtures unchanged | **Met as far as it can be checked** | The golden suites pass on the committed fixtures (they were produced outside the engine, so a matching engine and fixture is real evidence). The snapshot has no `.git`, so I could not diff the fixture files against `m1-complete` or `6cdc41d`. |
| | API-surface diff is exactly one constant | **Met as far as it can be checked** | `api-surface.txt` has the one line (`:91`), the surface is 31 names, and `api-surface.test.ts` passes. No earlier snapshot to diff against (no `.git`). |
| | Tests first; mutation record in the session log | **Met** | Session log records red-first (2 of 5 failing for the right reason) and four mutants; I reran three and all die. |
| M2-T08 | `ROADMAP.md` shows M2-T06 with PR and commit; review on record; I2 corrected | **Met** | Section 1, rows I1 and I2. "`git status` is clean after the commit" was true then; it is not true now only because of later work (N3). |
| M2-T09 | Branch coverage of `replay.ts` is 100% | **Met** | Coverage table above. |
| | "No source behavior changed" | **Met as far as it can be checked** | The only source file the task names is the TSDoc of `threebv.ts`; the 696 tests and the golden suites pass. No diff available. |
| M2-T10 | CI green with the comparison step | **Met** | `GIT_STATE.txt`: run 45004544490 for #29 on `main`, `completed success`, 1m8s. `ci.yml` runs `pnpm test:scripts`, `pnpm test:coverage`, the Chromium steps, then `pnpm compare:fuzz-digests`, none with `continue-on-error`. The log was not read. |
| | `pnpm test` and `pnpm test:browser` still pass locally | **Node half verified by me; browser half reported by the developer** | `pnpm test`: 696 passed. The session log says the developer ran `pnpm test:browser` and the comparison green. |
| | A deliberate difference makes the comparison fail | **Met, and I reproduced it** | Section 2, first mutant. The session log's variant (an environment-dependent branch) was not rerun; mine is a different mutation with the same outcome. |

The design is sound where it matters. The reporter removes a stale file when the digest tests did not all pass, `buildReport` refuses a missing mode, a malformed digest or different game counts, and `compare-fuzz-digests.test.mjs` pins each way the comparison could pass by mistake. Node and Chromium both run V8, which `ARCHITECTURE.md` states as a limit.

## 4. Git state (`GIT_STATE.txt`)

| Item | Finding |
|---|---|
| `HEAD` and `origin/main` | Both `36e79640377fc6d06060ad96d8e5a5062857a477`. The snapshot is not behind `origin`. |
| History | Linear: "merge commits reachable from HEAD: 0". Every commit of M2 has the form `type(scope): subject [M2-Tnn] (#n)`; the three follow-ups are `chore: apply M2 review follow-ups (M2-T07 to M2-T09) [chore] (#28)`. |
| PR numbers and SHAs against `ROADMAP.md` | M2-T01 `#22 aa412cf`, T02 `#23 0ef1497`, T03 `#24 c21bee8`, T04 `#25 6262635`, T05 `#26 6b499bf`, T06 `#27 6cdc41d`, T07 to T09 `#28 c73eb1e`, T10 `#29 36e7964`: all match. One date does not (N4). |
| Tags | `m0-complete` (`17bc2ce`, on `0606c99`) and `m1-complete` (`82a042d`, on `d8c91eb`). **`m2-complete` does not exist**, which is correct before this review. Both earlier tags sit on the docs-only close-out commit of their milestone; M2 should follow that pattern. |
| Branch protection of `main` | Required check `ci` (`strict: true`), linear history required, conversation resolution required, `enforce_admins: true`, force pushes and deletions off. Unchanged in substance since the first review. For the record: `required_approving_review_count` is 0 and commit signatures are not required; reasonable for one developer, a decision for the developer to revisit before others join. |
| CI on `main` | The last five runs, #25 to #29, are all `completed success` (37 s, 46 s, 1m10s, 1m5s, 1m8s). |
| Working tree | ` M ROADMAP.md` and ` M docs/workflow/sessions/2026-11-22-M2-T10.md`. The snapshot's `ROADMAP.md` already shows M2-T07 to M2-T10 as `Done` with `#28 c73eb1e` and `#29 36e7964`, which only exist after the merges, so the committed file on `main` cannot have them (an inference: with no `.git` I cannot show the diff). Expected, and part of N3. |

## 5. New findings

### Blocking

None.

### Important

**N1. `ARCHITECTURE.md` says CI has not run the M2-T10 steps; it has, and it passed.**

- **What.** `ARCHITECTURE.md:277` ("Verified where (M2-T10)") ends with: "CI on GitHub has not run the new steps (`pnpm test:scripts`, `pnpm compare:fuzz-digests`); the first run is the pull request." `GIT_STATE.txt` shows run 45004544490 for #29 as `completed success`, and `ci.yml` contains both steps. This is the defect of the first review's I2, in the next paragraph of the same section: true when written, misleading now, in the place a reader looks for the evidence of the cross-environment criterion.
- **Fix, in the close-out pull request.** Replace the sentence with the run's result and date (run 45004544490, `main`, 2026-11-22, `success`, 1m8s), say in the same words as `:278` that the job's conclusion is the evidence and that the log was not read, and drop "the first run is the pull request". Keep "If a browser run did not hand over its meta, `browser.json` would be missing and the comparison would fail, never pass."

**N2. `CHANGELOG.md` says M2-T10 is not done.**

- **What.** `CHANGELOG.md:9` (the "M2 close-out" entry) says "M2-T10 (a cross-environment digest of the fuzz outcomes, review M5) is not done: it needs a real Chromium." The entry directly above it (`:8`, M2-T10) says it is done. Both are in `[Unreleased]`, and this file is what a reader of the tag sees.
- **Fix.** In the close-out pull request, change the M2 close-out entry to say that M2-T10 was done afterwards in its own conversation (#29), and add one "M2 re-review" line in the style of the M1 close-out entry: this review's counts and the tag.

**N3. The M2-T07 to M2-T10 close-out is not in git, and there is no `m2-complete` yet.**

- **What.** See section 4, "Working tree". Until a commit carries the PR numbers, SHAs and dates of the four tracker rows, the session log of M2-T10 (it already holds its PR and merge commit), the corrections of N1 and N2, and this review, a tag on `36e7964` would point at a tree whose `ROADMAP.md` shows M2-T07 to M2-T10 without their PR, commit and date cells (an inference from the dirty working tree; with no `.git` I cannot show the diff).
- **Fix.** A `[chore]` pull request, for example `docs: close out M2 [chore]` on branch `chore/m2-closeout`, as `d8c91eb` was for M1: commit `ROADMAP.md` and the session log as they are in the snapshot, add `docs/reviews/M2-review-2.md`, apply N1, N2 and the minors you choose, and add the CHANGELOG line. Then tag the squash commit `m2-complete`, as `m1-complete` sits on `d8c91eb`. The tag is the developer's step.

### Minor

**N4. The M2-T05 row has the wrong date.** `ROADMAP.md:73` says 2026-11-19. `GIT_STATE.txt` dates the squash commit `6b499bf` 2026-11-21, and the session log is dated 2026-11-20. The task could not have been done before its predecessor's merge on 2026-11-19; use 2026-11-21.

**N5. The TSDoc of `replay` still states the `log()` equality without the qualifier** (the open half of M2). Add "as long as the commands carry no properties besides `type`, `index` and `t`" to `replay.ts:173` and `:192`, and to the `ReplayLog` TSDoc if you like; comments only, so `docs:api` is the only check to rerun.

**N6. A missing full stop in `ARCHITECTURE.md:241`.** "...not the object it was given) From M2-T05 the guarantee covers the result record too" needs a full stop after the closing parenthesis.

**N7. M6b is still open** (section 1). One sentence in M5-T05: the server stamps `t`, and the same wall-clock bound as in M8-T01 applies, so a client cannot inflate `timeMs` or `threeBVPerSecond` in a race.

**N8. A local run of the digest comparison can use a stale file.** `tools/fuzz-digest-reporter.mjs` leaves the files alone when a run holds no digest test (`if (this.seen === 0) return;`), as its header says. If a local `pnpm test:browser` fails before any test starts, `pnpm compare:fuzz-digests` compares today's `node.json` with an older `browser.json`. It cannot pass wrongly after a change to engine output (the digests would differ), and CI starts from a clean checkout, so the risk is a confusing local pass after a crashed run. Optional: one line in `DEVELOPMENT_GUIDE.md` saying to delete `reports/` before a local cross-check. I read this from the code and did not run it.

**N9. Two "Verified where" bullets stand in reverse order** in `ARCHITECTURE.md:277` (M2-T10) and `:278` (M2-T06). Harmless; swap them when N1 is edited.

### Observations (no action)

- The M2-T10 session log says the skills were "followed as practices; the SKILL.md files were not opened in this conversation". `CLAUDE.md` rule 6 asks for the practice, not the file, and the log shows red-first and a deliberate-difference check, so the practice was followed. Noted for the record.
- `limits.ts` calls the bound "generous for real play" and describes a 100x100 game that "flags and unflags each of them a few times". That is accurate for play and says nothing false about the bound, which a script can still reach with toggles; the stuck-game rule in the handoffs of M3-T02 and M5-T05 is the right place for that, and it is there.

## 6. What I could not verify

- **The browser suite and `pnpm compare:fuzz-digests` with a real Chromium.** The Playwright download is blocked here. The evidence is CI runs 44913505620 (#27) and 45004544490 (#29), both `success`, plus the developer's report. I read neither run's log.
- **Diffs against earlier commits.** The snapshot has no `.git`, so "golden fixtures unchanged", "the API diff is one constant" and "no source behavior changed in M2-T09" rest on the passing golden and API-surface tests, the committed snapshot line, and the task and session records, not on a diff.
- **Husky hooks, commitlint on the real commits, Windows.** Not run, as in the first review.
- **The Better Auth, Playwright 1.65.1 and Vitest 5.1.x pin questions.** Outside M2; `DECISIONS.md` records them as deliberate.

## 7. Declined to judge

- Whether the engine should cap flag toggles per cell as well as in total. Still a game-design and anti-cheat choice (M9-T04); M2-T07 chose the total because it equals the validation limit.
- Whether `required_approving_review_count: 0` is right for this repository. A policy decision for the developer.
- Whether the digest comparison should also run in Firefox or WebKit. The task's claim is Node and Chromium; the limit is written in `ARCHITECTURE.md`.
- The statistical quality of sfc32 and SplitMix32, as before.

## 8. What is good, so it is kept

- B1 was fixed at the smallest scope that makes the claim true: one constant, one check, the order of checks documented in the TSDoc and in `ARCHITECTURE.md`, and a probe that is now a test.
- The follow-up tasks each recorded the mutants that prove their tests bite, and every one I reran dies.
- M2-T10 closed the one gap the first review called a gap in evidence, with a design that fails closed (missing file, malformed digest, different counts, differing modes), and its own tests for each way it could pass by mistake. The mutation I tried is exactly the case it exists for: the suite stays green and the comparison goes red.
- The docs state their limits (V8 on both sides, what the stubs cannot see, what was and was not run), and the corrections of the first review were made where readers look.

## 9. Ready to tag?

**Yes, once the close-out pull request of N3 is merged; no, not on `36e7964` as it stands.** There is nothing blocking in the code, the tests, CI, the history or the branch protection. What remains is documentation and bookkeeping: N1, N2 and N3 (Important, all in the same docs-only pull request), then N4 to N9 as you see fit. After that merge, `git tag` the squash commit as `m2-complete` and push the tag.
