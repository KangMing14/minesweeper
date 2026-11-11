# M0 Foundations: milestone re-review

- Date: 2026-11-11
- Scope: the snapshot `minesweeper-20261111-1709-gitstate.zip`: the whole repository plus `GIT_STATE.txt` (generated 2026-11-11T10:09:26Z). `HEAD` and `origin/main` are both `9c6c701` (PR #8, the squash-merge of M0-T07 to M0-T11). The working tree has one uncommitted change, `ROADMAP.md` (see N1).
- Reviewer: Claude, in a new conversation that wrote none of the M0 work, using the `/requesting-code-review` checklist. No subagent tool was available, and the skill's reviewer template forbids spawning one, so I reviewed the milestone myself, in passes. Read-only: nothing in the repository was changed. Every experiment ran in a scratch copy under `/tmp` or through `eslint --stdin`.
- Follows: `docs/reviews/M0-review.md`. The IDs B1, I1 to I3 and L1 to L9 are that review's; new findings are N1 to N8.
- Verdict: **ready to tag after one docs-only pull request (N1).** No code or configuration change is needed. Details in the last section.

## 1. Resolution of the first review

Status values: Resolved, Partly resolved, Open. "Evidence" is a file and line, or a command I ran in this review.

| ID | Finding (short) | Status | Evidence |
|---|---|---|---|
| B1 | CI, branch protection, history and tag could not be confirmed | **Resolved; the tag itself is still to do** | `GIT_STATE.txt`, section "branch protection of main": required status check `ci` (strict, GitHub Actions app), pull request required (0 approvals), `enforce_admins` true, linear history required, force pushes and deletions off, conversation resolution required. History: 0 merge commits, 7 first-parent commits, linear. Every ROADMAP SHA, PR number and date for M0-T01 to M0-T06 matches the log (`cc51e30`, `80f3dfc` #1, `d90869d` #2, `722bf34` #5, `cab55e4` #6, `3aa4c1b` #7), and so does `9c6c701` #8 for M0-T07 to M0-T11. `ci` is green on the merge of PR #7 (run 42734086319) and PR #8 (run 42998986154). The tag list is empty, which is correct before tagging. Squash-only is not shown by `GIT_STATE.txt` (N5); the history is consistent with it. |
| I1 | `jsdoc/require-example` wider than the spec | **Resolved** | `eslint.config.js:73` `exemptedBy: ['inheritdoc', 'internal']`; fixture `engine-internal-without-example` with two manifest cases; the untagged variant still gives six `jsdoc/require-example` errors; `DEVELOPMENT_GUIDE.md:144` states the rule. Mutation run: removing `'internal'` turns exactly those two cases red. Small gaps are N3. |
| I2 | Second half of the mine-exposure rule missing from the docs | **Resolved in the docs; the design decision stays open on purpose** | `CLAUDE.md:26` (rule 8) and `ARCHITECTURE.md:10` (principle 2) carry both sentences and the race rule in the same words. `DECISIONS.md:93` opens D-14 with owner M4-T03 (ADR-010); the ADR index row at `DECISIONS.md:50` names D-14. M4-T03 (lines 53, 55, 58) and M5-T05 (lines 78, 80) are reworded, and the leak test now says "before the match result is final for both players (D-14)". Two leftovers are N4. |
| I3 | Snapshot hides git and GitHub state | **Resolved** | `GIT_STATE.txt` is in the zip I received and is the evidence for B1 and section 4. Scratch-repository test of `tools/snapshot.sh`: with no flag, no `GIT_STATE.txt`; `--git-state` adds it; with a token in the remote URL (`https://user:<token>@github.com/...`) the token appears in no file of the zip and the remote prints without credentials; `--with-git` adds `.git` without `config` and `hooks`; `GIT_STATE.txt` is not left in the repository root; flags work before and after folder names. Docs: `HOW_TO_USE.md:80,155`, `PROMPT_TEMPLATES.md:93-95` (Prompt F2). One gap is N5. |
| L1 | Per-task verify scripts go stale | **Resolved** | `tools/` now holds `github/`, `lint-fixtures/`, `snapshot.sh`, `verify-t01.sh`. `verify-t02` to `t06` are gone. `DEVELOPMENT_GUIDE.md:29` says not to keep such scripts and where the old ones are in history. The remaining mentions are in session logs, `CHANGELOG.md` and reviews. |
| L2 | No dependency advisory check | **Resolved** | `ci.yml:72` runs `pnpm audit:prod`; `audit.yml` runs weekly and by hand and gates on `pnpm audit:all` (high or critical). `DECISIONS.md:66` ("Dependency advisories") records GHSA-g3hv-75wg-m249 with a decision. My runs: `audit:prod` exit 0 ("No known vulnerabilities found"); `audit:all` exit 0; `pnpm audit` exit 1 with the one moderate advisory (minimatch below 11.0.1, reached through `eslint` and `typedoc`; I confirmed a `typedoc > minimatch@10.2.6` path). The `audit` workflow was started by hand and succeeded (run 43000282733, 2026-11-11T10:02:55Z). |
| L3 | Engine-purity lint gaps | **Resolved** | `DEVELOPMENT_GUIDE.md:150` now says lint plus the compiler; `DECISIONS.md:58` lists the ADR-002 and guide erratum; M2-T06 (`M2-deterministic-engine.md:89`) adds the run with `Date`, `Math.random`, `performance` and `Intl.DateTimeFormat` stubbed to throw. |
| L4 | "Engine types only" for `protocol` is not enforced | **Resolved as an amendment; the decision is deferred to M5-T01 on purpose** | M5-T01 (`M5-first-networked-race.md:30`) says to settle types-only versus values and then make spec 4.1, the `ARCHITECTURE.md` wording and the lint rule agree. |
| L5 | Stale onboarding files at the root | **Resolved** | `README_FIRST.md` and `WHERE_THINGS_LIVE.txt` are not in the tree. They are mentioned only in `CHANGELOG.md:13`, a session log, the milestone file and the reviews, which record the change. |
| L6 | Small documentation inconsistencies | **Resolved** | `ARCHITECTURE.md:3` reads "Status after M0-T11". ROADMAP's PR column holds numbers only (M0-T01 reads "n/a (bootstrap commit on main)", which is right). The README scripts table lists every script in `package.json` except `typecheck:tests` and `prepare`. `DECISIONS.md:58` ("Errata to accepted ADRs") lists the three corrections. ADR-005 and ADR-007 still contain the original sentences, so append-only held. |
| L7 | Branch names and Node floor are convention only | **Resolved** | `scripts/check-branch-name.mjs`; `ci.yml:45-50` (pull requests only); 13 branch cases in `manifest.mjs`. `pnpm-workspace.yaml:9` `engineStrict: true`. On Node 22.23.4, `pnpm install --frozen-lockfile` fails with `ERR_PNPM_UNSUPPORTED_ENGINE` (wanted `>=24.15.0`). Mutation run: dropping the milestone back-reference in the branch regex turns one case red. A forward note is N8. |
| L8 | `check-todos` scope too narrow | **Resolved** | `scripts/check-todos.mjs:10` matches TODO, FIXME, XXX and HACK; `:12-24` adds `.yml`, `.yaml`, `.sh`. Fixtures `todo-fixme`, `todo-xxx-hack`, `todo-markers-good` and the scope cases. Mutation runs: dropping FIXME, and dropping `.yml`, each turn one case red. Real pre-commit hook: a bare TODO is rejected, a named one is accepted. One gap is N6. |
| L9 | Forward notes (Corepack, coverage threshold) | **Resolved** | `DECISIONS.md:106` (Node row) carries the Node 26 and Corepack note. M1-T07 (`M1-engine-core.md:99`) now asks for numeric `coverage.thresholds` and for excluding the `index.ts` barrels. |

Summary: 13 of 13 resolved, 0 partly resolved, 0 open. Two of them (I2 and L4) are resolved as documentation, with the underlying design decision still open by design.

## 2. New findings

### Blocking (gates the tag, not M1 work)

**N1. `ROADMAP.md` has an uncommitted edit, so `main` does not yet record M0-T07 to M0-T11 completely, and this review is not in git.**
- Where: `GIT_STATE.txt`, "working tree": ` M ROADMAP.md`. The snapshot's `ROADMAP.md` shows M0-T07 to M0-T11 as `Done`, PR `#8`, commit `9c6c701`, 2026-11-11. The session log (`docs/workflow/sessions/2026-11-11-M0-T07-to-T11.md`, "Next") says those cells are filled after the merge, because a squash SHA is not known inside its own pull request.
- Inference: I cannot read `HEAD`'s copy of the file (the snapshot has no `.git`). I infer that the committed `ROADMAP.md` lacks those cells, from the ` M` status and the session log.
- Why it blocks: a tag named `m0-complete` should point at a commit whose `ROADMAP.md` says every M0 task is done. `9c6c701` is probably not that commit. `main` is protected with `enforce_admins`, so the edit needs a pull request.
- How to clear it (maintainer, a few minutes):
  1. Branch `chore/m0-re-review` (passes `scripts/check-branch-name.mjs`). Commit the `ROADMAP.md` change and this file, `docs/reviews/M0-review-2.md`.
  2. Pull request title: `docs: add M0 re-review and fill ROADMAP cells for M0-T07 to M0-T11 [chore]` (passes `commitlint`; I ran it). Wait for `ci` and squash-merge.
  3. `git checkout main && git pull && git tag m0-complete && git push origin m0-complete`. The tag goes on that merge commit, not on `9c6c701`.
  4. Fill the Tag column or the M0 close-out note as the guide asks, if you track it; no further code change.

### Important

None. I found no defect in the code, the configuration, the workflows or the documents that breaks an M0 deliverable or would mislead the next milestone.

### Minor

**N2. Five tasks were merged as one `[chore]` commit, so `git log` cannot trace M0-T07 to M0-T11 by task ID.**
- Where: `9c6c701` "chore: apply M0 review follow-ups (M0-T07 to M0-T11) [chore] (#8)"; `CLAUDE.md` rules 1 and 10 (one task, one branch, one pull request); `docs/workflow/sessions/2026-11-11-M0-T07-to-T11.md`.
- What: the follow-ups were given task IDs in `ROADMAP.md` but landed as one commit with no task ID. The session log declares this as a deliberate exception ("the five tasks are small and touch overlapping files"), and it also says that for M0-T10 the cases and the implementation were written in one step, so the red run was not observed (the task text asks for fixtures first).
- Effect: history is permanent and `main` forbids force pushes, so the gap stays. Task-level review granularity was lost for #8. The traceability that remains is the ROADMAP row (PR and SHA), `CHANGELOG.md` and the session log.
- Mitigation I checked: the T10 tests can fail for the right reason. I broke the branch regex, the marker regex and the scan list in a scratch copy; each change turned the matching case red (section 5). So the missing red run did not leave toothless tests.
- Fix: nothing to undo. Record the exception once, in the `CHANGELOG.md` M0 entry (one sentence: "M0-T07 to M0-T11 were merged together in PR #8 as an accepted exception to one task per pull request"), and go back to one task per pull request from M1.

**N3. The `@internal` exemption has three small gaps.**
- Where: `eslint.config.js:73`; M0-T07's claim that "an internal export still needs a summary".
- What, from `eslint --stdin` probes in `packages/engine/src`:
  1. `/** @internal */` with no summary lints clean. `require-jsdoc` only wants a comment, so the claim about a summary is true of the guide, not of the lint.
  2. `/** Helper. @internal */` on one line is not exempt (the tag must start its own line). That fails safe: it reports `jsdoc/require-example`.
  3. A symbol in `packages/engine/src/index.ts` tagged `@internal` is accepted, and `excludeInternal` then drops it from the TypeDoc reference. Nothing checks that a symbol published through `index.ts` is not hidden this way.
- Fix: in M1-T07, make the API-surface test fail if any name exported from `index.ts` carries `@internal`. Optionally add `jsdoc/require-description` for engine and protocol, so gap 1 closes too. Say gap 2 in one sentence of the guide ("put `@internal` on its own line").

**N4. Two small leftovers from M0-T08.**
- `PROJECT_OVERVIEW.md:21` still says only "mine positions never reach a client during a game", the first half of the rule. The task's own description says the docs held only the first half. M4-T03 already lists `PROJECT_OVERVIEW.md` under its documentation updates, so this can wait for it, or take one sentence now.
- M5-T05 (`M5-first-networked-race.md:78`) says `result` goes to both players once both are final "or one wins and the other is still playing, per ADR-010", and D-14's working assumption is "final for both players". It is not clear whether the second branch releases anything to a player who is still racing on the same board. This is the question I raised in the first review (I2); D-14 now owns it. Ask ADR-010 to say what, if anything, is released in that branch, and add that case to M5-T05's leak test.

**N5. `GIT_STATE.txt` does not show the repository's merge-method settings, so "squash-merge only" cannot be confirmed from it.**
- Where: `tools/snapshot.sh:103-112` (`write_git_state`). The protection JSON shows `required_linear_history: true`, which also allows rebase-merge. `tools/github/protect-main.sh` sets `allow_merge_commit=false` and `allow_rebase_merge=false`, but a snapshot cannot show whether it was run.
- Evidence I do have: all six merged pull requests are single commits with the ` (#n)` suffix, which is what a squash with `PR_TITLE` produces, and there are 0 merge commits. So it is consistent, not proven.
- Fix: in `write_git_state`, add `gh api "repos/$slug" --jq '{allow_squash_merge,allow_merge_commit,allow_rebase_merge,delete_branch_on_merge}'` next to the protection call.

**N6. The pre-commit hook does not run `check-todos` on `.yml`, `.yaml` or `.sh` files.**
- Where: `lint-staged.config.js`: the `'*.{json,yml,yaml}'` entry runs only Prettier, and there is no `.sh` entry. The full scan in CI (`pnpm check:todos`) does cover them since M0-T10, so nothing slips through; the hook just gives feedback later than for code files.
- Fix: add `node scripts/check-todos.mjs ...` to the `yml/yaml` entry and add a `*.sh` entry. Optional, since CI is the authority.

**N7. One commit on `main` breaks the commit-message rule.**
- Where: `80f3dfc` "M0/m0 t02 monorepo scaffold (#1)": no type, no `[M0-T02]`. It predates `commitlint` in the hooks and the pull-request-title check, which arrived with M0-T03 and M0-T04. All later commits conform.
- Fix: none possible (history is protected). Accept it. No one needs to act.

**N8. `engineStrict` is stricter than it looks (forward note).**
- Where: `pnpm-workspace.yaml:9`. As far as I know from pnpm's documentation, `engineStrict` applies to every installed package's `engines`, not only to the root. I did not test this. If so, a future dependency that requires Node above the developer's installed 24.x would stop `pnpm install` locally. CI is not affected: `setup-node` reads `.nvmrc` (`24`) and gets the newest 24.x.
- Fix: add one line to the dependency rule in `DECISIONS.md`: "check each new dependency's `engines` against `engines.node` before pinning it".

## 3. Did each follow-up meet its own acceptance criteria?

| Task | Acceptance (from `M0-foundations.md`) | Result |
|---|---|---|
| M0-T07 | An `@internal` export in engine or protocol lints clean without `@example`; all earlier fixtures still pass | **Met.** Two new manifest cases pass; the untagged version still errors six times; 76 of 76 fixtures pass. Gaps: N3. |
| M0-T08 | D-14 is in the open-decisions table with an owner; the rule reads the same in `CLAUDE.md` and `ARCHITECTURE.md` | **Met.** `DECISIONS.md:93`; `CLAUDE.md:26` and `ARCHITECTURE.md:10` are word-for-word the same apart from "client" and "browser". Leftovers: N4. |
| M0-T09 | `snapshot.sh --git-state` produces a zip with `GIT_STATE.txt` and no credentials; `snapshot.sh` alone is unchanged | **Met.** Scratch-repository runs (section 1, I3) and the real `GIT_STATE.txt` in the zip I received. The 7-Zip and PowerShell fallbacks were not run, by the author or by me. Gap: N5. |
| M0-T10 | Workflows pass on GitHub (the `audit` one started by hand); an unconforming branch name fails `ci`; a clean install on Node 22 fails with `ERR_PNPM_UNSUPPORTED_ENGINE` | **Met, with one item I could not see.** `ci` on `main` after #8 is green; `audit` was started by hand and is green; Node 22 fails with the named error (I ran it). That a bad branch name fails the pull-request run on GitHub is shown only by the script, its 13 cases, and the step's wiring (`ci.yml:45-50`); `GIT_STATE.txt` lists `main` runs only. The red-first order was not followed (N2). |
| M0-T11 | No reference to the deleted files remains outside history and session logs | **Met.** Section 1, L5. |

Milestone level (handoff package, item 6), re-checked:

| Criterion | Status |
|---|---|
| `install`, `typecheck`, `lint`, `test`, `docs:api` pass locally | **Met** (section 5, Node 24.15.0). |
| The same pass in CI | **Met.** `ci` is green on `main` for #5, #6, #7 and #8. |
| A pull request cannot merge on red CI | **Met.** `ci` is a required, strict status check, and `enforce_admins` is on. |
| Bad commit messages and bare TODOs are rejected | **Met.** 76 fixtures, and the real `commit-msg` and `pre-commit` hooks, which I ran in a scratch repository (below). |
| All docs and ADRs committed | **Met.** ADR-001 to ADR-008 are present and `Accepted`; the documents agree with each other (`ARCHITECTURE.md`, `CLAUDE.md` and `DECISIONS.md` are identical to the Project copies; `ROADMAP.md` is identical to the Project copy, including the uncommitted edit of N1). |
| Tag `m0-complete` | **Pending** (N1). |

Real hooks, run in a scratch `git init` of the snapshot with `pnpm prepare`: a compliant commit passed all hooks; `Fixed some stuff` was rejected by `commit-msg` (`subject-empty`, `type-empty`, `task-id-in-subject`); a staged file with `// TODO: later` was rejected by `pre-commit` (`check-todos`); the same file with `TODO(M6-T04)` was accepted. The `pre-push` hook (`test:affected`) needs `origin/main` and was not run.

## 4. History, tags and branch protection (from `GIT_STATE.txt`)

| Item | Observed | Verdict |
|---|---|---|
| `HEAD` and `origin/main` | both `9c6c7014f37df2f88f5180cfa30b5a2f6c25cb39`; branch `main` | Nothing unpushed. |
| History | 7 first-parent commits, 0 merge commits | Linear. |
| Commit messages | 6 of 7 follow `type(scope): subject [Mn-Tnn]` or `[chore]`; `80f3dfc` does not (N7) | Accepted. |
| Pull-request numbers | #1, #2, #5, #6, #7, #8 (numbers 3 and 4 never merged) | Match ROADMAP. |
| Tags | none | Correct before tagging; `m0-complete` follows N1. |
| Required status check | `ci`, strict, GitHub Actions app | Met. |
| Pull request required | yes, 0 approvals (solo developer) | Met. |
| `enforce_admins` | true | Met. |
| Linear history | required | Met. |
| Force pushes, deletions | off | Met. |
| Squash-only | not shown (N5); consistent with the history | Partly evidenced. |
| Last CI runs on `main` | `ci` success for #5, #6, #7, #8; `audit` success (manual) | Met. |
| Working tree | ` M ROADMAP.md` | N1. |

## 5. Full check suite, clean install

Environment: Node 24.15.0 and pnpm 12.15.0 (installed from the npm registry), fresh unzip of the snapshot, `pnpm install --frozen-lockfile`, every step run separately with its exit code. In the extracted snapshot the `prepare` script reports ".git can't be found", which is expected (the zip has no `.git`).

| Step | Exit | Result |
|---|---|---|
| `pnpm install --frozen-lockfile` | 0 | "Lockfile is up to date", 277 packages added |
| `pnpm typecheck` | 0 | `tsc -b`, then the engine, protocol and tooling test configs |
| `pnpm lint` | 0 | no output |
| `pnpm format:check` | 0 | "All matched files use Prettier code style!" |
| `pnpm check:todos` | 0 | `[check:todos] ok` |
| `pnpm check:links` | 0 | `[check:links] ok` |
| `pnpm test:lint-fixtures` | 0 | **76 of 76** pass (was 51), 0 fail |
| `pnpm test` | 0 | 1 file, 2 tests |
| `pnpm test:coverage` | 0 | `sample.ts` 100%; the four `index.ts` barrels report 0% (M1-T07 owns the thresholds and the exclusion) |
| `pnpm docs:api` | 0 | TypeDoc for engine and protocol, no warnings |
| `pnpm audit:prod` | 0 | "No known vulnerabilities found" |
| `pnpm audit:all` (high gate) | 0 | 1 moderate, below the gate |
| `pnpm audit` (full report) | 1 | 1 moderate: GHSA-g3hv-75wg-m249, minimatch `>=7.0.0 <11.0.1`, patched `>=11.0.1`; accepted in `DECISIONS.md:66` |
| `pnpm install --frozen-lockfile` on Node 22.23.4 | 1 | `ERR_PNPM_UNSUPPORTED_ENGINE`: wanted `{"node":">=24.15.0"}`, current `22.23.4` |

Key output:

```text
$ pnpm typecheck
$ tsc -b && pnpm typecheck:tests
$ tsc -p packages/engine/tsconfig.test.json && tsc -p packages/protocol/tsconfig.test.json && tsc -p tsconfig.tooling.json
(exit 0)

$ pnpm test:lint-fixtures
...
ℹ tests 76
ℹ suites 5
ℹ pass 76
ℹ fail 0

$ pnpm test
 ✓  engine  src/sample.test.ts (2 tests) 3ms
 Test Files  1 passed (1)
      Tests  2 passed (2)

$ pnpm audit:prod
$ pnpm audit --prod --audit-level moderate
No known vulnerabilities found

$ pnpm install --frozen-lockfile        # Node 22.23.4
Error: ERR_PNPM_UNSUPPORTED_ENGINE
  × Unsupported engine for /tmp/n22: wanted: {"node":">=24.15.0"} (current: {"node":"22.23.4"})
```

Extra checks beyond the suite (all in scratch copies):

| Check | Result |
|---|---|
| Mutation: branch regex without the milestone back-reference | 75 pass, 1 fail (`m1/M2-T04-wrong-milestone`) |
| Mutation: marker regex without FIXME | 1 fail (`todo-fixme`) |
| Mutation: `.yml` removed from the scanned extensions | 1 fail (`.github/workflows/ci.yml is scanned`) |
| Mutation: `'internal'` removed from `exemptedBy` | 2 fail (the two `@internal` cases) |
| All four mutations reverted | 76 of 76 pass again |
| `tools/verify-t01.sh` (local mode, extracted copy) | 32 passed, 1 failed ("protect-main.sh is executable"). The zip stores no executable bits (it was made on Windows: file modes 666), so this is an artifact of the zip, not counted as a finding. |
| Proposed PR title through `commitlint`; proposed branch through `check-branch-name` | both accepted |

## Strengths

- **The follow-ups did what the first review asked, with tests.** Every behavioral change (`@internal`, branch names, marker words, scan scope) has fixtures, and I could make each one fail by breaking the rule it protects.
- **The evidence problem is fixed at its root.** `--git-state` is opt-in, strips credentials (tested with a token in the remote URL), cleans up after itself, and produced exactly the facts this review needed.
- **Honest bookkeeping.** The session log states the one-conversation exception, the red run that was not observed, and what was not run (new workflows on GitHub, the 7-Zip and PowerShell fallbacks, hooks). The `engine-strict` correction (`.npmrc` is ignored by pnpm 12, `engineStrict` works) was found by running it and was recorded.
- **Append-only held.** The ADR errata went into `DECISIONS.md`; ADR-005 and ADR-007 still carry the sentences they were corrected for.
- **The advisory routine is proportionate.** Production dependencies block pull requests at moderate; the weekly run gates on high anywhere; the one dev-only moderate advisory has a written decision and a review trigger.

## Declined to judge

Behaviors I considered and set aside as outside what the snapshot or this environment can show. The maintainer rules on each line.

- The pull-request-event `ci` run of PR #8 (branch-name step and PR-title step). Reason: `GIT_STATE.txt` lists runs on `main` only. The script, its cases and the step wiring were checked.
- The repository's merge-method settings (squash-only). Reason: not captured (N5).
- The executable bit of `tools/github/protect-main.sh` and `tools/verify-t01.sh` in git. Reason: the Windows-made zip carries no modes; `git ls-files -s` on the real clone would show it. If the bit is missing there, running the script directly on macOS or Linux, as the guide shows, would fail with "permission denied"; `bash tools/github/protect-main.sh` works either way.
- The `pre-push` hook, the 7-Zip and PowerShell fallbacks of `snapshot.sh`, and the `gh` path of `snapshot.sh` in my scratch run (`gh` is not installed here; the real `GIT_STATE.txt` shows that path working).
- The pinned action SHAs against their tags, and the Better Auth facts in ADR-005. Reason: unchanged by the follow-ups and not re-queried here, as in the first review.
- ADR-003, ADR-004 and ADR-008 in full, the spec and the plan, and milestone files M1 to M11 beyond the amendments listed in section 1. Reason: outside the follow-ups; I read the specific lines cited.
- Behavior of the new scripts on Windows. Reason: I ran them on Linux only.

## Verdict

**Ready to tag: yes, after one docs-only pull request (N1).**

- Every finding of the first review is resolved: 13 of 13, with the history, tag and branch-protection items now backed by `GIT_STATE.txt`. Two of them (I2 and L4) leave the underlying design decision open, as the plan intends (D-14 in M4-T03, the `protocol` import rule in M5-T01).
- All five follow-up tasks met their acceptance criteria. The full suite passes from a clean install on Node 24.15.0, and Node 22 is refused as designed.
- There is no Important finding. N2 to N8 are minor and none blocks M1 or the tag; fix N3 in M1-T07 and N5 whenever `snapshot.sh` is next touched.
- The one blocker is procedural: the uncommitted `ROADMAP.md` edit and this review need to be merged first, and `m0-complete` goes on that merge commit (N1).