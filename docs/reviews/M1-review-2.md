# M1 Engine Core: milestone re-review

> **Amended 2026-11-17 in M1-T08.** N2 mistakenly assumed #17 carried a partial fix. In fact its PR CI was green, the post-merge run failed, and #19 reduced the test cost. Edit the “What” paragraph of N2 to match. Leave the verdict unchanged.

- Date: 2026-11-17
- Scope: snapshot `minesweeper-20261117-1316-gitstate.zip` (whole repository plus `GIT_STATE.txt`, generated 2026-11-17T06:16:22Z). `HEAD` and `origin/main` are both `93a0062` (PR #19, a CI fix after the merge of M1-T08 to M1-T10 in PR #17, `d5ceee0`). The working tree has two uncommitted changes: `ROADMAP.md` and `docs/workflow/sessions/2026-11-17-M1-T08-to-T10.md` (see N1). The uploaded `ARCHITECTURE.md`, `DECISIONS.md`, `ROADMAP.md`, `M1-engine-core.md` and `M1-review.md` are identical to the snapshot's (`diff`); the Project copies of `CLAUDE.md`, `ARCHITECTURE.md`, `DECISIONS.md` and `ROADMAP.md` are identical to the snapshot's too.
- Reviewer: Claude, in a new conversation that wrote none of the M1 work, using the `/requesting-code-review` checklist. No subagent tool was available, and the skill's reviewer template forbids spawning one, so I reviewed the milestone myself, in passes: (1) resolution of the first review, (2) the follow-up tasks against their own acceptance criteria, (3) git state, (4) a clean-install run of every check, (5) mutation runs on the new tests. Read-only: nothing in the repository was changed. Every experiment ran in a scratch copy under `/tmp` (one throwaway lint probe file was created in the unpacked snapshot and deleted at once).
- Follows: `docs/reviews/M1-review.md`. The IDs B1, I1, I2 and M1 to M5 are that review's; new findings are N1 to N4.
- Verdict: **not ready to tag today; ready after one docs-only pull request (N1).** No code, test or configuration change is needed. Section 6 has the details.

## 1. Evidence: the checks I ran

Clean install in a scratch copy: Node 24.22.1 (the `node` package from the npm registry; the sandbox's own Node is 22.23.4, below the `engines` floor), pnpm 12.15.0 through Corepack, `rm -rf node_modules`, then `pnpm install --frozen-lockfile --ignore-scripts` ("Done in 3.5s", exit 0; hooks not installed). All commands exit 0:

| Command | Result |
|---|---|
| `pnpm typecheck` | pass (`tsc -b`, then engine and protocol test configs and tooling) |
| `pnpm lint` | pass, no output |
| `pnpm format:check` | "All matched files use Prettier code style!" |
| `pnpm check:todos` | `[check:todos] ok` |
| `pnpm check:links` | `[check:links] ok` |
| `pnpm test:lint-fixtures` | `tests 78`, `pass 78`, `fail 0` |
| `pnpm docs:api` | pass; no warning (warnings are errors); html generated at `./docs/api` |
| `pnpm test:coverage` | 13 files, **253 tests passed**; 100% statements, branches, functions and lines on every engine file that has code (`command.ts` is types only); thresholds 95/90 not in danger |
| `pnpm test` (twice) | 253 passed both times; 8.35 s and 8.20 s wall time; `game.differential.test.ts` 3.9 s of it |
| `pnpm audit:prod` | "No known vulnerabilities found" |
| `pnpm audit:all` (high and up) | exit 0; `pnpm audit` shows the one moderate advisory GHSA-g3hv-75wg-m249 (`minimatch`), the one accepted in `DECISIONS.md` ("Dependency advisories") |

Not verified: husky hooks, commitlint and `check-branch-name` on the real commits (the snapshot has no `.git`; the five newest commit subjects in `GIT_STATE.txt` all match `type(scope): subject [..]`), Windows, and the CI runs themselves beyond the list in `GIT_STATE.txt`.

Two cross-checks of the follow-up claims: the suite is 250 tests before M1-T10 and 253 after, and the three new tests are the three in `game.differential.test.ts`, so no older test was added, removed or loosened; the API-surface snapshot test passes unchanged.

## 2. Resolution of the first review

Status values: Resolved, Partly resolved, Open. "Evidence" is a file and line, or a command I ran in this review.

| ID | Finding (short) | Status | Evidence |
|---|---|---|---|
| B1 | `main` does not record M1-T07 as done, no M1 close-out, review not in git | **Partly resolved** | Done: the review is tracked (it is in the snapshot and `GIT_STATE.txt` lists no `??` file); it is renamed, `docs/reviews/M1-review.md`, and `1-review.md` is gone. `ROADMAP.md:58` shows M1-T07 with `#16`, `a514a0a`, 2026-11-16, and `CHANGELOG.md:11` carries the 242 to 250 test count (`CHANGELOG.md:10` explains it). All ten M1 rows are `Done` and each PR and SHA matches the log in `GIT_STATE.txt` (`ceaeee3` #10 through `a514a0a` #16, `d5ceee0` #17, same dates). Not done: the same pattern as before. `GIT_STATE.txt` again shows ` M ROADMAP.md` and ` M docs/workflow/sessions/...M1-T08-to-T10.md`; the snapshot's `ROADMAP.md:59-61` has PR `#17` and SHA `d5ceee0` for T08 to T10, which the session log says are filled after the merge, so the committed file presumably lacks them. `CHANGELOG.md` has no M1 close-out entry (the M0 one is at `CHANGELOG.md:18`). New: N1. |
| I1 | D-14 and engine docs speak of `exposedMines` only; `GameLost.mineIndex` is also mine data | **Resolved (docs); the decision stays open on purpose** | `ARCHITECTURE.md:150` (race caveat names both outputs and the losing chord); `DECISIONS.md:94` (D-14 row names the event) and `:64` (ADR-009 erratum); TSDoc: `view.ts:49`, `events.ts:64-67` (`GameLost`), `events.ts:90-92` (`GameEvent`); M4-T03 (`M4-mode-framework-ghost-race.md:55`: ADR-010 states what a DNF frame carries, working assumption no mine index, and whether the engine event should change); M5-T01 (`M5-first-networked-race.md:30`: the `delta` schema has a DNF variant with no `mineIndex`); M5-T05 (`:78`: the `delta` carries the engine's events "with `mineIndex` removed from `gameLost` until D-14 allows it", and the leak test includes "a chord that loses"). The two M5 sentences that contradicted each other now agree. A search for `mineIndex` outside reviews and session logs finds all of these. The two files that state D-14 without the word (`CLAUDE.md:26`, rule 8, and `M0-foundations.md`) speak of "the mine layout" generally, which covers it. ADR-009 itself is unchanged (append-only). |
| I2 | Property tests almost never reach chords or deep games | **Resolved** | `game.differential.test.ts` (409 lines, new). Guard on the fixed seed, which I re-ran with a `console.log` added in the scratch copy: `{"games":1000,"chords":653,"chordLost":263,"chordWon":8,"won":348,"lost":566}` (thresholds 300, 50, 3, and 200 for each end). The guard fails when the guided generator is replaced: with commands drawn blindly it reports "expected 101 to be greater than or equal to 300". The differential test passes on 1,000 guided games. Mutation runs in section 3. Boards up to 16x16, at most a quarter mined (`:40-53`). The existing `game.property.test.ts` is unchanged. |
| M1 | Review file name did not follow the guide | **Resolved** | `docs/reviews/M1-review.md` exists; `1-review.md` does not. |
| M2 | Review Focus markers missing on #1 and #4 | **Resolved** | `game.test.ts:236`, `:328`, `:445` ("Review Focus #1"); `config.test.ts:63` ("Review Focus #4: 1x1, 1xN and Nx1 are legal"); `lifecycle.test.ts:275` (#2, as before). |
| M3 | `Command.t` unchecked until M2-T03; `RangeError` message style differs | **Open, by design** | `t` is answered by M2-T03, and the "not checked" line in `ARCHITECTURE.md` is on M2-T03's list (session log, "Follow-ups"). The nit is still there: `game.ts:160` interpolates `${index}`, `board.ts:15` uses `String(value)`. Both give the same text for a number; touch when the file is next edited. |
| M4 | `jsdoc/require-description` and the `@internal`-on-its-own-line sentence missing (M0 re-review N3, gaps 1 and 2) | **Resolved** | `eslint.config.js:122` (`error`, same contexts as `require-example`) and `:128` (off in test files); fixture `engine-internal-no-summary` (three exports) with two manifest cases (`manifest.mjs:40-51`, engine and protocol, `count: 3`). Mutation run: deleting the rule line turns exactly those two cases red (`pass 76`, `fail 2`, "expected error jsdoc/require-description"). `pnpm lint` is clean on the whole repository, so no existing file needed a new comment. `DEVELOPMENT_GUIDE.md:145` states the rule. I also checked its factual claim with a probe: `/** Helper. @internal */` on one line gives `jsdoc/require-example` ("Missing JSDoc @example declaration"); the two-line form is accepted. |
| M5 | `tools/verify-t01.sh` is still in `tools/` | **Open, accepted** | The file is still there. The first review's reason ("will drift") is weaker than it looked: `DEVELOPMENT_GUIDE.md:98` and `:206` document it as the branch-protection verifier, and M0 re-review L1 accepted it. I suggest closing M5 as accepted rather than carrying it. |

Summary: 8 findings: 5 resolved (I1, I2, M1, M2, M4), 1 partly resolved (B1), 2 open on purpose (M3, M5). The partly resolved one is a bookkeeping gap, not a defect: N1.

## 3. The follow-up tasks against their own acceptance criteria

All three were merged in one pull request as an accepted exception (as M0-T07 to M0-T11 were); the session log and the `CHANGELOG.md` entry say so.

**M1-T08 (close-out and lint gaps): met.**

| Criterion (milestone file) | Status | Evidence |
|---|---|---|
| The new fixtures pass; 78 cases; red before the config change | Met | `pnpm test:lint-fixtures`: 78 of 78. Without the rule: 76 pass, 2 fail (section 2, M4). |
| No existing file needs a new comment | Met | `pnpm lint` exit 0 with the rule on. |
| `ROADMAP.md` shows M1-T07 with its PR and commit | Met in the file I was given | `ROADMAP.md:58`. Whether the committed copy has it is the same unknown as in the first review; N1. |
| Tracker cells and session log committed | **Not met for the T08 to T10 cells** | N1. |
| Review renamed and amended, saying what changed | Met | The top note of `M1-review.md` names I1 and M3 and the tag move. |
| `pnpm check:links` | Met | `ok`. |

**M1-T09 (D-14 docs): met.**

| Criterion | Status | Evidence |
|---|---|---|
| A search for `mineIndex` in the docs finds it in the race caveat, D-14 and the three later tasks | Met | Section 2, I1, with lines. |
| No source behavior changed; the test suite is the same | Met as far as I can tell | The 250 older tests pass unchanged and the API-surface snapshot is unchanged; I cannot diff against `a514a0a` (no `.git`). The TSDoc changes are comments only. |
| `pnpm typecheck`, `lint`, `docs:api` (zero warnings), `check:links`, `test` | Met | Section 1. |
| ADR-009 left alone, erratum in `DECISIONS.md` | Met | `DECISIONS.md:64`; D-14 is still `Open`. |

**M1-T10 (tests that reach chords): met, with two notes.**

| Criterion | Status | Evidence |
|---|---|---|
| All engine tests pass; coverage thresholds met | Met | 253 passed; 100% everywhere. |
| The guard fails if the guided generator is replaced by the old one | Met | Section 2, I2 (101 < 300 with a blind generator). |
| 1,000 generated cases per property | Met | `RUNS = 1_000`, `:19`, used by both `fc.assert` calls and the guard sample. |
| Each new test run against at least four mutations of `chord.ts` and `reveal.ts`, and it must fail on every one | Met; the survivors are equivalent mutants | Table below. |
| The whole engine suite stays under about 10 seconds | Met without coverage; not with it | 8.2 to 8.4 s for `pnpm test`; 13.7 s for `pnpm test:coverage` here, of which `game.differential.test.ts` is 7.6 s. See N2. |
| Generators, guard and reference in one new file; existing properties unchanged | Met | One file, no helper module. |
| Review Focus markers | Met | Section 2, M2. |

My mutation runs on the new file alone (scratch copy, one change at a time, each restored; "killed" means at least one test failed):

| Mutation | `game.differential.test.ts` |
|---|---|
| `chord.ts`: `flags !== value` to `flags < value` | killed |
| `chord.ts`: `flags !== value` to `flags > value` | killed |
| `chord.ts`: drop the zero guard | killed |
| `chord.ts`: keep the last mine instead of the lowest | killed |
| `chord.ts`: drop the "nothing to open" guard | survived; **killed by `chord.test.ts`** |
| `chord.ts`: targets include flagged cells | survived; **killed by `chord.test.ts`** |
| `chord.ts`: targets include revealed cells | survived; **killed by `chord.test.ts`** |
| `reveal.ts`: flood fill passes through flags | killed |
| `reveal.ts`: cascade never pushes a zero neighbor | killed (2 tests) |
| `reveal.ts`: cascade expands numbered cells too | killed (2 tests) |
| `reveal.ts`: reveal opens a flagged cell | killed |
| `game.ts`: a flag does not start the game | killed |
| `game.ts`: a win needs one more cell | killed (2 tests) |
| `game.ts`: a lost game is not final | killed (2 tests) |
| `game.ts`: `gameWon` carries `t: 0` | killed |
| `game.ts`: `gameLost` carries `t: 0` | killed |

The three survivors are equivalent at the `Game` level, as the session log says: a chord on a revealed number only happens in a game that is already `'playing'`, and an empty `cells` list with no mine produces no event, so `Game` cannot tell them from a no-op. The unit tests in `chord.test.ts` kill all three (1 of 12 fails each time). The session log lists two such survivors and a third "equivalent everywhere" (flagged targets); my run found the flagged case equivalent at the `Game` level but still killed by `chord.test.ts`, which is the stronger result. Everything else in the table is killed by the new file. The reference compares events, status, `revealedCount`, every cell and `exposedMines`; it does not compare `flagCount` or `minesRemaining`, which `buildGameView` derives from the same cells and `view.test.ts` pins. Not a gap.

## 4. Git state, history, tags and branch protection (`GIT_STATE.txt`)

| Check | Result |
|---|---|
| `HEAD` equals `origin/main` | Yes, `93a0062`. The file says to run `git fetch` first; I cannot tell if it was run, and both values agree. |
| Linear history | Yes: "merge commits reachable from HEAD: 0"; the first-parent list holds the 16 commits from `cc51e30` to `93a0062`, one per PR. |
| ROADMAP against the log | Yes for M0-T01 to M1-T10 (PR numbers, short SHAs and dates). The log has one commit the ROADMAP does not know: `93a0062` (#19). N1. |
| Commit subjects | The newest five follow `type(scope): subject [Mn-Tnn]` or `[chore]`. `#17` and `#19` use `[chore]` for work that belongs to tasks, the same accepted exception as `9c6c701` for M0-T07 to T11. |
| Working tree | **Not clean:** ` M ROADMAP.md`, ` M docs/workflow/sessions/2026-11-17-M1-T08-to-T10.md`. N1. |
| Tags | Only `m0-complete 17bc2ce 2026-11-11`; `m1-complete` absent, as expected until this review. `17bc2ce` is not in the first-parent list, so it is an annotated tag object, not the commit; the file does not show which commit it points at. N3. |
| Branch protection of `main` | Unchanged from M0: required status check `ci` (strict, GitHub Actions app); pull request required with 0 approvals; `enforce_admins` true; linear history required; force pushes and deletions off; conversation resolution required; signatures not required. |
| CI on `main` | `93a0062` (#19) **success**, 39 s. `d5ceee0` (#17) **failure**, 50 s, 18 minutes earlier. `audit` success on 2026-11-16 (scheduled). #16 and #15 success. N2. |

## 5. Findings

IDs are new (N for this review). Each fix is small enough for one pull request, and N1 is the only one that gates the tag.

### Blocking (gates the tag, not M2 work)

**N1. The committed `main` does not record M1-T08 to M1-T10 or PR #19, and there is no M1 close-out entry; the tag must not go on `d5ceee0`.**
- Where: `GIT_STATE.txt` ("working tree": two modified files); `ROADMAP.md:59-61`; `docs/workflow/sessions/2026-11-17-M1-T08-to-T10.md` ("Git" section); `CHANGELOG.md` (M0 close-out at line 18, nothing equivalent for M1).
- What: the same sequence as B1 and as N1 of the M0 re-review. A squash SHA is not known inside its own pull request, so the PR and commit cells and the session log's "Git" section were filled after the merge and are still uncommitted. This time there is more to record: PR #19 (`93a0062`) is in no file. `ROADMAP.md` names `d5ceee0` as the commit of M1-T08 to M1-T10, and CI on `d5ceee0` was red (N2), so the SHA the tracker gives is a commit that was not green until #19.
- Inference: I cannot read `HEAD`'s copy of `ROADMAP.md` (no `.git`). I infer from the ` M` status and the session log that the committed file has empty PR and commit cells for T08 to T10.
- Why it blocks: `m1-complete` should point at a commit whose `ROADMAP.md` says every M1 task is done and whose CI is green.
- Fix (one docs-only pull request, titled `docs: close out M1 [chore]`): commit the two working-tree files; add `93a0062` (#19) to the session log's "Git" section and one clause to the M1-T10 entry of `CHANGELOG.md` or the ROADMAP row's notes; add an "M1 close-out" entry to `CHANGELOG.md` in the shape of the M0 one (re-review `docs/reviews/M1-review-2.md`, the findings resolved, milestone tagged `m1-complete`); add this review to the same pull request. Then tag the merge commit of that pull request, not `d5ceee0` and not `93a0062`, because only the new commit has a `ROADMAP.md` that shows all ten rows with their PRs. Its own PR and SHA cells need not be filled (the close-out row is not a task).

### Important

**N2. `main` was red after the M1-T08 to M1-T10 merge, the record says it was fixed before the merge, and the new tests are still sensitive to machine speed.**
- Where: `GIT_STATE.txt` (CI runs: `d5ceee0` failure, `93a0062` success); session log "CI fix after the first push"; `game.differential.test.ts:21-25`; `CHANGELOG.md:8` ("the engine suite takes about 8 s").
- What: the session log says the first GitHub run failed on Vitest's 5 s default timeout and was fixed in the same pull request (one view per command, a 60 s `SLOW_TEST_MS`). Yet the run on `main` after the squash-merge of #17 failed, and #19, "fix timeouts of the differential tests on CI", followed. I cannot diff #17 against #19, so I cannot say whether #17 carried a partial fix or none; either way the log's "Git" section lists only #17 and nothing in the record says `main` was red for 18 minutes. The timeout is now 60 s, which fixes the symptom: the slowest test takes 2.1 to 2.9 s here under coverage, so there is a wide margin. The remaining facts are about the 10 s criterion and about honesty of the record: `pnpm test` takes 8.3 s, but `pnpm test:coverage`, which is what CI runs, took 13.7 s here (the differential file 7.6 s of it), and the CI job took 39 s in total.
- Why it matters: not for correctness, which is fine. A record that says "fixed before merge" when the merge went red is the kind of gap a later reader trusts, and M2 will reuse these generators (the first review said M2-T03's replay tests would).
- Suggested: say in the session log what #19 changed and that `main` was red at `d5ceee0`; say in `ARCHITECTURE.md`/`CHANGELOG.md` which configuration "about 8 s" refers to (plain `pnpm test`; about 14 s with coverage). If the suite grows in M2, split the 1,000-game guard from the properties (or lower `RUNS` for the reference test only, which the task text allows only at 1,000 in CI, so that is a decision for you, not a change I propose).

### Minor

**N3. `GIT_STATE.txt` cannot show where a tag points.** `tools/snapshot.sh:98` prints `%(objectname:short)`, which for an annotated tag is the tag object (`17bc2ce`), not a commit, so `m0-complete` appears to be a commit that is not in the history list. Add `%(*objectname:short)` (the dereferenced commit) to the format, or print `git rev-parse <tag>^{commit}` per tag, so the next re-review can confirm `m1-complete` lands on the right commit. One line in `tools/snapshot.sh`.

**N4. `ARCHITECTURE.md:3` still says "Status after M1-T07".** M1-T09 and M1-T10 edited the file (race caveat, tests paragraph at `:187`), and no interface changed since T07, so the sentence stays true; change it to "after M1-T10" when N1's pull request touches the docs, so the header and the content agree.

## 6. Is the milestone ready to tag?

**Not today. Ready after the one docs-only pull request in N1.**

- Code and tests: ready. Every check passes from a clean install (section 1). The eight findings of the first review are resolved or consciously left open (section 2): 5 resolved, 1 partly resolved (bookkeeping), M3 and M5 open by design. The three follow-up tasks meet their acceptance criteria (section 3); the only soft spot is the suite time under coverage (N2). The new tests bite: 13 of 16 mutations die in the new file alone, and the other three are equivalent at the `Game` level and die in `chord.test.ts`.
- Milestone acceptance (milestone file): all engine tests pass with 100% branch coverage; no lint exemptions; a full game is played through the public API only (`public-api.test.ts`); `pnpm docs:api` is clean; ADR-009 is committed and D-04 is settled; the public API is exported, documented and locked. The last item, the tag after review, is this section.
- Git: history linear, `main` equals `origin/main`, branch protection intact, CI green at `HEAD`. What blocks the tag is that the committed bookkeeping does not match the merged history (N1) and that the commit the ROADMAP names for T08 to T10 was red (N2).
- After the close-out pull request merges: `git tag -a m1-complete <merge commit>` and push the tag; then M2-T01. N3 and N4 can ride along in the same pull request or wait.

## 7. Declined to judge

- Whether the two review-follow-up bundles (M0-T07 to T11, now M1-T08 to T10) should stay an exception to one task per pull request. Reason: it is a process choice that the session logs record and the developer owns; both times the tasks were small and overlapped in files. I note only that #19 shows the cost: one more pull request for work that belonged to the first.
- Whether `[chore]` rather than a task ID is right for #17 and #19. Reason: same precedent as M0; commitlint accepts it.
- Whether the 300, 50 and 3 thresholds of the guard are the right numbers. Reason: they are stricter than the first review proposed, the margins are wide (653, 263, 8), and the guard fails on a blind generator.
- Whether `ADR-010` should change the engine event instead of filtering it on the server. Reason: M4-T03 owns it, and the working assumption in the task text names both options.
- Husky hooks, commitlint on real commits, Windows and the content of PR #19. Reason: no `.git` in the snapshot.
