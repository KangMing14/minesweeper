# M0 Foundations: milestone review

- Date: 2026-11-10
- Scope: the whole repository as of the snapshot `minesweeper-20261110-0816.zip` (M0-T06 recorded as merged in `ROADMAP.md`: PR #7, `3aa4c1b`). The snapshot has no `.git` folder, so history, tags and GitHub settings were not visible (see B1 and I3).
- Reviewer: Claude, in a fresh conversation that did not write any M0 task, using the `/requesting-code-review` checklist. No subagent tool was available (and the skill's reviewer template forbids spawning one), so I reviewed the milestone myself, in passes.
- Supersedes: the earlier `docs/reviews/M0-review.md`, which the author of M0-T06 wrote in the same conversation, before M0-T06 was merged. That draft is out of date (it says the ADRs were not yet committed, and it ran on Node 22 only).
- Labels: B = blocking, I = important, L = minor (low). Proposed tasks are in the last section; nothing in the repository was changed.

## Verdict

**Ready to merge / tag: with fixes.** I found no defect in the code, the configuration or the documents that breaks an M0 deliverable. One acceptance criterion cannot be confirmed from a snapshot and gates the `m0-complete` tag (B1). Three important findings should be fixed before M1-T01 or soon after (I1 before M1-T01). Everything else is minor.

| Group | Count | Items |
|---|---|---|
| Blocking (blocks the tag, not M1 work) | 1 | B1 |
| Important | 3 | I1 `@example` rule is wider than the spec, I2 mine-exposure rule is incomplete in the docs, I3 snapshot hides git state |
| Minor | 9 | L1 to L9 |

## What I ran

Clean install (`pnpm install --frozen-lockfile`, pnpm 12.15.0), then every CI step, on **Node 24.15.0** (the repository's required line; I fetched the binary from the npm registry) and on Node 22.23.4.

| Step | Node 24.15.0 | Node 22.23.4 |
|---|---|---|
| `pnpm typecheck` | pass | pass |
| `pnpm lint` | pass | pass |
| `pnpm format:check` | pass | pass |
| `pnpm check:todos` | pass | pass |
| `pnpm check:links` | pass | pass |
| `pnpm test:lint-fixtures` | 51 of 51 | 51 of 51 |
| `pnpm test:coverage` | 1 file, 2 tests; `sample.ts` 100% | same |
| `pnpm docs:api` | pass, no warnings | pass |
| `node tools/verify-t02` to `t06` (default mode) | 101, 41, 65, 130, 210 passed, 0 failed | not run |
| `pnpm audit` / `pnpm audit --prod` | 1 moderate (dev-only) / none | not run |

Also done: a diff of `ARCHITECTURE.md`, `CLAUDE.md`, `DECISIONS.md`, `ROADMAP.md` and the milestone file against the Project copies (identical); a programmatic comparison of the canonical-names table with the master plan (identical) and of both Mermaid diagrams with spec 4.3 and 4.4 (identical); a check of the 78 ROADMAP rows against the milestone headings (all present, titles identical); a repository-wide search for TODO, FIXME, XXX and HACK in every file type; and scratch experiments on the lint configuration (listed under I1 and L3; every scratch file was removed).

## Acceptance criteria

### Milestone level (handoff package, item 6)

| Criterion | Evidence | Status |
|---|---|---|
| `install`, `typecheck`, `lint`, `test`, `docs:api` pass locally | Table above, on Node 24 | Met |
| The same pass in CI | `ci.yml` runs the same steps; GitHub was not visible | Not verified (B1) |
| A PR cannot merge on red CI | `tools/github/protect-main.sh` configures it; the setting itself was not visible | Not verified (B1) |
| Bad commit messages and bare TODOs are rejected | 51 fixtures assert the rule ID and the exact error count; `commitlint.config.js`; `check-todos.mjs` | Met |
| All docs and ADRs committed | All M0-T05 documents and `docs/adr/ADR-001` to `008` are in the snapshot | Met (as far as a snapshot shows) |
| Tag `m0-complete` | Not in a snapshot; ROADMAP and README say it follows this review | Pending (B1) |

### Per task

| Task | Acceptance (from the milestone file) | Status |
|---|---|---|
| M0-T01 | Protection rules active; template renders; LF enforced | Files, `.gitattributes` (`* text=auto eol=lf`) and the PR template are right. Protection not visible (B1). `verify-t01.sh` needs a git repository and was not run. |
| M0-T02 | Clean install and typecheck; pinned versions; `engine` has zero dependencies | Met. No `^` or `~` in any `package.json`; `engine` has no `dependencies`; `protocol` depends on `engine`; apps depend on both. |
| M0-T03 | Every fixture rejected for the intended reason; compliant commit passes hooks | Fixtures met (they assert rule ID, count and "no extra rule"). Hooks were not run (no `.git`); the session log records a real-hook run. |
| M0-T04 | CI required and green on `main`; failing PRs cannot merge | Workflow is sound. Required status not visible (B1). |
| M0-T05 | Every document real; ROADMAP has 78 rows; links resolve | Met. The first row that is not `Done` is M1-T01, so a new conversation can name the next task from `ROADMAP.md`. |
| M0-T06 | Eight ADRs; ADR-005 has the Better Auth result and fallback; D-12 closed; close-out done; tag | Met except the tag. All eight files have the template's header fields and its four sections; `DECISIONS.md` links them; D-12 is `Settled by ADR-008`. |

## Global Constraints (master plan)

| Constraint | Finding |
|---|---|
| Strict TypeScript flags | In `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`. Met. |
| Engine purity | Enforced by the compiler (`lib: ES2023`, `types: []`) and by lint. Holds against the cases the fixtures name; see L3 for what lint alone does not catch. |
| `protocol` imports only engine types | Package-level rule enforced. "Types only" is not enforced (L4). |
| Apps never import each other | Enforced by `package.json`, lint (package name and relative path) and four fixtures. Met. |
| Mine positions never reach a client | Only half of the constraint is written into the docs (I2). |
| Zod, size and rate limits on inbound messages | Not applicable yet. Carried by `CLAUDE.md` rule 8 and ADR-003. |
| Solo developer; no Redis or broker before M11 | Nothing added. Met. |
| Git: one task, one branch, one PR, squash, task ID, protected `main` | Commit and PR-title rule enforced; squash-only and protection scripted. Branch names are convention only (L7). |
| TSDoc on every export; TODOs name tasks | Met today; see I1 for the rule's scope. Two TODOs exist and both name a task that owns the work (M1-T07, M5-T03). |
| Exact dependency pins, re-verified when added | Met. The security exception to the 14-day rule is recorded in `DECISIONS.md` and ADR-005. |
| ADRs append-only | Nothing to compare without history. All eight are `Accepted`; none edited as far as the snapshot shows. |

### Review Focus (master plan)

M0 contains no engine, server or client behavior, so none of the five cases can be tested yet. I checked traceability instead: each of the five conditions is marked "Review Focus #n" in every task the plan names as its owner (#1: M1-T04, M1-T05; #2: M1-T06, M5-T05, M6-T01, M6-T04; #3: M4-T03, M6-T05; #4: M1-T01, M2-T02; #5: M6-T02, M6-T04, M6-T05). Nothing is missing. Two items for those owners are in I2 and L3.

## Strengths

- **The architecture rules are enforced, in layers, not described.** The dependency direction rests on `package.json` plus project references plus lint. Engine purity rests on a compiler configuration with no DOM lib and no ambient types, plus lint, plus fixtures. I tried seven evasions on scratch files: Node built-ins, `setTimeout`, a relative import into `protocol`, `Date` through an alias, `Math.random` through destructuring and through an alias, and `performance` through `globalThis`. The compiler or lint caught most of them; the ones neither caught are L3.
- **The tests of the tooling are good tests.** The 51 fixtures assert the exact rule ID and error count and that no other rule fired, so a rule cannot pass for the wrong reason. They cover documented and undocumented exports, `@example`, boundaries, the `globalThis` route, the computed `Math['random']` route, commit messages and TODOs.
- **CI is conservative.** Every action is pinned by commit SHA, the token is read-only, the PR title goes through an environment variable instead of being interpolated into a script, installs use a frozen lockfile, and a newer push cancels the older run.
- **The documents agree with each other and with the code.** The canonical-names table is verbatim identical to the plan, the diagrams are identical to the spec, "Public interfaces today" matches the real exports (`m0SampleAdd` only), and `check:links` runs in CI.
- **The hand-off to M1 is clean.** Exactly two TODOs exist; M1-T07 owns removing the sample and M5-T03 owns flipping the doc rule to `error`, and both tasks say so in their own text.
- **Decisions are recorded with their reasons.** ADR-005 states what could not be checked, and the exception to the 14-day pin rule was written down when it was first needed.

## Findings

### Blocking

**B1. The CI and branch-protection criteria, and the tag, cannot be confirmed from the snapshot.**
- Where: M0-T01 and M0-T04 acceptance; milestone acceptance items 2 and 3; M0-T06 acceptance ("`m0-complete` tagged").
- What: whether `ci` is a required status check on `main`, whether the `ci` run on `main` after PR #7 is green, whether history is linear and squash-only, and whether the tag exists are GitHub and git facts. The snapshot has no `.git` folder, and ROADMAP's PR and commit values cannot be checked against history.
- Why it blocks: ADR-006 says a milestone is tagged after its review, and these are the criteria that make "failing PRs cannot merge" true. If the check was never made required, every later milestone is built on an unprotected `main`.
- How to clear it (maintainer, a few minutes), from a clone:
  1. `tools/verify-t01.sh --remote KangMing14/minesweeper` (the repository named in the README badge).
  2. `gh run list --branch main --limit 3` shows `ci` green on the merge of PR #7.
  3. `git log --oneline --first-parent origin/main` shows linear squash commits with `3aa4c1b` at or below the head, and `git ls-remote --tags origin m0-complete` shows nothing yet.
  4. Then `git tag m0-complete <sha> && git push origin m0-complete`.
- Scope note: this blocks the tag, not the start of M1 work; only I1 should land before M1-T01.

### Important

**I1. `jsdoc/require-example` is wider than the spec: `@internal` exports and non-public exports still need an `@example`.**
- Where: `eslint.config.js`, `requireExampleOptions`; `DEVELOPMENT_GUIDE.md`, "Documentation comment rules"; spec 7.2.
- What: spec 7.2 and ADR-007 say `@internal` marks members exported only for tests, and `@example` is required on the *public* API. I linted two scratch files in `packages/engine/src`. An export marked `@internal` fails with "Missing JSDoc @example", and so does a documented constant that is exported for another engine file but not re-exported from `index.ts`. The rule works on every module-level `export`, not on what `index.ts` publishes. (Re-exports through `index.ts` are fine; I tested `export { X } from`, `export type` and `export *`.)
- Why: M1 adds many cross-module helpers (neighbor math, flood fill, validation). Authors will either write filler examples, which lowers the value of the real ones, or reach for a lint exemption, which M1's acceptance forbids ("no lint exemptions"). It will show up in the first M1 task.
- Fix: set `exemptedBy: ['inheritdoc', 'internal']` for `jsdoc/require-example`; add two fixtures to `manifest.mjs` (an `@internal` export is clean, the same export without the tag is still an error); add one sentence to the guide ("mark a symbol `@internal` if it is exported only for other engine files or for tests"). `require-jsdoc` stays as it is: internal exports still need a summary. TypeDoc already drops them (`excludeInternal`). No ADR change is needed because ADR-007 already says this. Proposed as M0-T07.

**I2. The second half of the mine-exposure constraint is missing from the docs, and it interacts with the identical-board race.**
- Where: master plan, Global Constraints; `CLAUDE.md` rule 8; `ARCHITECTURE.md` principle 2; ADR-003; spec 4.1 and section 8; M5-T05.
- What: the plan says: "Mine positions never reach a client while a game is in progress. After a game ends, only the player's own finished game may expose its mines." Every repository document carries only the first sentence, and with different wording ("game in progress" in `CLAUDE.md`, "during a match" in `ARCHITECTURE.md` and the spec, "while a networked match is in progress" in ADR-003). A search for the second sentence finds nothing.
- Why it matters for M5 (my reading; please confirm the intent): in a race both players get the same seeded board. M5-T05 sends `result`, with the finished game's `exposedMines` "inside that player's own view", once both players are final "or one wins and the other is still playing, per ADR-010". It does not say whether the player still playing is stopped at that moment, nor whether a player who hits a mine (D-02: a DNF) can receive mine data in an earlier `delta`. Its leak test checks only "before game end". If either player can hold the full layout while the other is still racing on the same board, it can be passed on by voice or chat. Whether that can happen depends on decisions not yet made (ADR-010, M5-T04), so this is a design question for M4 and M5, not an M0 defect; but the constraint as written in the docs cannot answer it.
- Fix: state the full constraint in `CLAUDE.md` rule 8 and `ARCHITECTURE.md` principle 2 (docs only; neither is an ADR). Open a decision, for example D-14 "When may a race player see the mines", owned by M4-T03 (ADR-010), with the working assumption "mines are released only when the match result is final for both players". Tighten M5-T05's leak test to say which event ends exposure protection ("before the match result is final for both players"). ADR-003 is not edited; if the decision changes its wording, a new ADR supersedes it. Proposed as M0-T08.

**I3. The snapshot hides the git and GitHub state, so milestone reviews cannot check history, tags or protection.**
- Where: `tools/snapshot.sh`.
- What: the script leaves out `.git` on purpose. As a result this review could not verify B1, the commit-message format of merged history, linear history, or the tag, and every later milestone review will have the same blind spot.
- Fix: have `snapshot.sh` write one generated text file into the zip root (not into the repository) with `git rev-parse HEAD origin/main`, `git log --oneline --decorate -n 40`, `git tag -l`, `git status --short`, and, when `gh` is installed and authenticated, the branch-protection JSON of `main` and the last five `ci` runs. Update the Prompt F text in `docs/workflow/PROMPT_TEMPLATES.md` to mention it. Proposed as M0-T09.

### Minor

**L1. Per-task verify scripts assert state that M1 will change.** `tools/verify-t06.mjs` requires every M1 and later row to be `Not started` (line 385), the engine to export only `m0SampleAdd` (417 to 418) and no ADR-009 or later file to exist (421). `verify-t02.mjs:207` requires the exact `index.ts` export line, and `verify-t04.mjs:330` (the `--full` mode) imports `m0SampleAdd`. All five scripts pass today and none is wired into CI or a hook, so nothing merges wrongly; but the first M1 task will turn `verify-t06` red for reasons that are not defects. The earlier draft of this review raised the same pattern for `verify-t05` and the fix was to relax two assertions; the structural fix was not made. Fix: at `m0-complete`, move `verify-t02` to `t06` to `tools/verify/archive/` with a README line ("valid only at the commit tagged `m0-complete`"), or delete them (the tag keeps them), and keep only `verify-t01.sh` if it stays useful. Folded into M0-T09.

**L2. No dependency advisory check, and one advisory exists today.** ADR-005 says advisories must be watched and applied promptly, and Better Auth (many advisory rounds in 2026) arrives in M7. Nothing automated does that. `pnpm audit` works on this lockfile: it reports one moderate advisory, GHSA-g3hv-75wg-m249 (minimatch below 11.0.1, reached through `eslint` and `typedoc`; development tooling only), and `pnpm audit --prod` reports nothing because there are no production dependencies yet. Fix: add `pnpm audit --prod` as a blocking CI step and a scheduled weekly workflow for the full audit that opens a failure, and record in `DECISIONS.md` how a dev-only advisory is handled (wait for the tool's next release, or add a `pnpm.overrides` entry). Before M7-T02. Proposed as M0-T10.

**L3. The engine-purity lint has gaps that the compiler and the golden tests must cover.** On scratch files, lint did not flag `const M = Math; M.random()`, `globalThis['performance']` read through a cast, or `new Intl.DateTimeFormat('en').format()` (which reads the current time). `Date` and destructured `Math.random` were flagged. The compiler caught `import ... from 'fs'`, `setTimeout` and a relative import into `protocol` (TS2591, TS2304, TS6059, TS6307), but ESLint did not. ADR-002 and the guide say lint bans "any import that leaves the package"; in fact lint bans `@minesweeper/*`, paths containing `packages` or `apps`, and `node:*`, and the compiler does the rest. None of this is an M0 defect (lint is one layer), but M2-T06 is where determinism is actually proven. Fix: amend M2-T06 to run the golden-seed and fuzz suites with `Date`, `Math.random`, `performance` and `Intl.DateTimeFormat` replaced by stubs that throw, which catches aliasing at runtime; reword the guide to "lint plus the compiler". No ESLint change needed.

**L4. "`protocol` imports only engine types" is not enforced.** The spec, ADR-001 and `ARCHITECTURE.md` say types only; lint allows any import from `@minesweeper/engine` (the `protocol-imports-engine` fixture asserts that), and `engine` is a regular `dependency`. M5-T01 says "reuse engine types where possible", and its replay-log bounds may want engine constants. Decide in M5-T01: either allow value imports and reword the three documents, or enforce `import type` with `@typescript-eslint/consistent-type-imports` plus a restricted-imports `allowTypeImports` rule. Plan amendment, no new row.

**L5. Onboarding leftovers at the repository root are stale.** `README_FIRST.md` step 4 says to keep only the spec and plan as Project knowledge, but the Project now holds `CLAUDE.md`, `ROADMAP.md`, `ARCHITECTURE.md` and `DECISIONS.md` (the earlier draft raised this too; it is still open). `WHERE_THINGS_LIVE.txt` is the only file in the repository with CRLF endings (21 lines; `.gitattributes` would normalize it at the next commit) and describes `CLAUDE.md` and the other documents as "created in M0-T05". Both duplicate `docs/workflow/HOW_TO_USE.md`, and neither is link-checked. Fix: fold what is still true into `HOW_TO_USE.md` and delete both, or correct them.

**L6. Small documentation inconsistencies.**
- `ARCHITECTURE.md` opens with "Status after M0-T05"; M0-T06 is merged.
- `ROADMAP.md` says to fill the PR column with the pull request *number*, and `DEVELOPMENT_GUIDE.md` says the same, but rows M0-T02 to M0-T06 hold the PR title plus the number. Pick one (the number alone is simpler to check).
- The README scripts table omits `test:lint-fixtures`, `test:affected`, `build` and `format`.
- ADR-005 (Alternatives, Biome) cites "the boundary rules of ADR-006 and ADR-007"; ADR-006 is the git workflow and the boundary rules are in ADR-001 and ADR-002.
- ADR-007 (Context) says spec 7.2 asked for Doxygen-style comments; spec 7.2 and section 5 reject Doxygen, and the request came from the original brief.
- Accepted ADRs are not edited, so record the last two as an "Errata" note under the ADR index in `DECISIONS.md`.

**L7. Branch names and the Node floor are convention only.** The branch rule `m<n>/<task-id>-<slug>` is checked nowhere; `[chore]` work has no branch convention at all. CI could check `github.head_ref` against a pattern (and the guide would define the chore pattern, for example `chore/<slug>`). Separately, `engines` says `>=24.15.0` but installing on Node 22 succeeded without a warning that stops anything; a one-line `.npmrc` (`engine-strict=true`) would make the requirement real. Folded into M0-T10.

**L8. `check-todos` scans code files only.** It reads `.ts .tsx .mts .cts .js .jsx .mjs .cjs`; it does not read `.yml`, `.json`, `.sh` or Markdown, and it looks only for the word `TODO`, not `FIXME`, `XXX` or `HACK`. I searched all file types by hand: there is no bare marker today, and keeping Markdown out is right because the documents discuss the rule. Fix when convenient: add `.yml`, `.yaml` and `.sh`, and the other three words. Folded into M0-T10.

**L9. Forward notes for the next dependency revisit.** (a) CI installs pnpm with `corepack enable`. As far as I know Corepack is no longer bundled with Node from v25, so the planned Node 26 move needs a different pnpm install step; add that to the "revisit Node 26" line in `DECISIONS.md` (I could not check Node 26 here). (b) `vitest.config.ts` says "M1 sets" coverage thresholds, but M1 states only "high coverage of branches" with no number and no task owns the config change; name a number in M1-T07 (and exclude the `index.ts` barrels, which report 0% today). Plan amendments, no new row.

## Declined to judge

Behaviors I considered and set aside as outside what a snapshot can show, or not covered by the review request. The maintainer rules on each line.

- GitHub-side state: branch protection, the required check, `ci` results, PR numbers and merge SHAs in ROADMAP, the tag. Reason: not in the snapshot (B1).
- Whether the husky hooks fire correctly in a real clone. Reason: no `.git`; I relied on the fixtures, which exercise commitlint and lint, and on the session logs. `tools/verify-t01.sh` and the `--full` modes of the other verify scripts were not run for the same reason.
- That the pinned action SHAs in `ci.yml` match their stated tags, and the facts about Better Auth in ADR-005 (advisory dates and counts, version history). Reason: I found no contradiction with anything in the repository, but I did not query GitHub or the registry for them.
- The prose quality of `PROJECT_OVERVIEW.md`, `HOW_TO_USE.md`, `PROMPT_TEMPLATES.md` and the six session logs. Reason: out of the review's checklist; I checked that they exist, have no unfilled placeholders (`verify-t05` reports none) and are not stale where they state project status (`PROJECT_OVERVIEW.md` is not).
- Milestone files M1 to M11 beyond traceability. Reason: I checked headings against ROADMAP, the Review Focus markers, and the specific tasks cited above (M1-T07, M2-T06, M5-T01, M5-T03, M5-T05), not their design.
- ADR-003, ADR-004 and ADR-008: I read the decision sections and the LICENSE, not every consequence and alternative. ADR-001, 002, 005, 006 and 007 were read in full.

## Proposed tasks (to add to `ROADMAP.md`)

Each row uses the ROADMAP table format. All are small. The IDs continue M0 because they come from the M0 review; if you prefer to keep the count at 78, do them as `[chore]` commits instead, and the "when" column still applies.

| Task | Title | Status | PR | Commit | Done on |
| --- | --- | --- | --- | --- | --- |
| M0-T07 | Narrow `jsdoc/require-example`: exempt `@internal`, add fixtures (I1) | Not started | | | |
| M0-T08 | Carry the full mine-exposure rule into the docs; open D-14 (I2) | Not started | | | |
| M0-T09 | Snapshot writes a git-state file; archive the per-task verify scripts (I3, L1) | Not started | | | |
| M0-T10 | Advisory check in CI, branch-name check, `engine-strict`, wider TODO scan (L2, L7, L8) | Not started | | | |
| M0-T11 | Documentation tidy-ups and ADR errata (L5, L6) | Not started | | | |

| Task | Why it is a separate task | When |
|---|---|---|
| M0-T07 | Touches `eslint.config.js` and the fixtures; first M1 task would hit it | Before M1-T01 |
| M0-T08 | Docs only, but it opens a decision that M4-T03 and M5-T05 depend on | Before M4-T03; earlier is fine |
| M0-T09 | Tooling only; improves the next milestone review | Before the M1 review |
| M0-T10 | CI and config guards | Before M7-T02 (Better Auth) |
| M0-T11 | No code | Any time |

Side effects of adding five rows: the total becomes 83 in `ROADMAP.md` (the "Total tasks: 78" footer and the M0 row of the milestone index, 6 to 11), `README.md`, `PROJECT_OVERVIEW.md`, `DEVELOPMENT_GUIDE.md`, `CLAUDE.md` and `README_FIRST.md`; and `tools/verify-t05.mjs` and `verify-t06.mjs` assert 78 rows, which M0-T09 retires. If you add the rows, tag `m0-complete` after all five are `Done`; if you want to tag sooner, use the `[chore]` route.

### Amendments to existing tasks (no new row)

| Task | Amendment | From |
|---|---|---|
| M1-T07 | Name a numeric coverage threshold for `packages/engine` and exclude `index.ts` barrels | L9 |
| M2-T06 | Run golden-seed and fuzz suites with `Date`, `Math.random`, `performance`, `Intl.DateTimeFormat` stubbed to throw | L3 |
| M4-T03 | ADR-010 also settles D-14: when race mines are released | I2 |
| M5-T01 | Decide "engine types only" versus value imports for `protocol`, then make docs and lint agree | L4 |
| M5-T05 | Leak test: "before the match result is final for both players", not "before game end" | I2 |

## Follow-up status (added when the follow-ups were implemented)

| Finding | Task | Result |
|---|---|---|
| B1 | none (maintainer) | Open until the maintainer runs the commands in B1; `tools/snapshot.sh --git-state` now captures the evidence for the re-review |
| I1 | M0-T07 | Implemented; 2 fixtures |
| I2 | M0-T08 | Implemented; D-14 opened; M4-T03 and M5-T05 reworded |
| I3 | M0-T09 | Implemented: `--git-state` and `--with-git`, both opt-in |
| L1 | M0-T09 | `verify-t02` to `t06` deleted (they stay in history); `verify-t01.sh` kept |
| L2 | M0-T10 | `audit:prod` in `ci`, weekly `audit.yml`, handling table in `DECISIONS.md` |
| L3 | M0-T11 and M2-T06 | Guide and DECISIONS reworded; M2-T06 gained the throwing-stubs run |
| L4 | M5-T01 | Amendment written; decision still to be taken in M5-T01 |
| L5 | M0-T11 | Both root files deleted |
| L6 | M0-T11 | Done; ADR errata listed in `DECISIONS.md` |
| L7 | M0-T10 | Branch-name check added. **Correction:** `engine-strict` in `.npmrc` does nothing on pnpm 12; `engineStrict: true` in `pnpm-workspace.yaml` works (verified: Node 22 now fails with `ERR_PNPM_UNSUPPORTED_ENGINE`) |
| L8 | M0-T10 | Scan widened to `.yml .yaml .sh` and FIXME, XXX, HACK |
| L9 | M0-T11 and M1-T07 | Corepack note in `DECISIONS.md`; M1-T07 gained the coverage-threshold sentence |

