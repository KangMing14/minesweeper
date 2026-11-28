# CLAUDE.md

Instructions for Claude (and any other AI assistant) working in this repository. Humans can read it too: it is the short version of how work is done here.

## Read order

At the start of every conversation, read these in this order, and stop reading when you have what the task needs:

1. `CLAUDE.md` (this file).
2. `ROADMAP.md`: the status of all 90 tasks. The next task is the first row that is not `Done`, unless the developer names another one.
3. The milestone file for the task, `docs/milestones/Mn-*.md`. Its Conversation Handoff Package comes first; then the task itself.
4. `ARCHITECTURE.md`: package layout, dependency rule, diagrams and the canonical names.
5. `DECISIONS.md`: the ADR index, the open decisions and the dependency pins.

Read further only when the task points there: the spec is `docs/superpowers/specs/2026-11-04-competitive-minesweeper-design.md`, the master plan is `docs/superpowers/plans/2026-11-04-competitive-minesweeper-roadmap.md`, ADRs are in `docs/adr/` (from M0-T06), and the workflow guide for the developer is `docs/workflow/HOW_TO_USE.md`.

## Rules

1. **One task per conversation.** Do exactly the task you were given. Do not start the next one, and do not "tidy up" other tasks' files. One exception: the conversation that reviews a milestone (Prompt F) may also apply that review's follow-up tasks when the developer asks for it (Prompt F1) and all of them are small: no more than about five, each verifiable in your sandbox, none needing a decision the developer has not made, none needing a tool you cannot run (a real browser, a database). Append them to `ROADMAP.md` and the milestone file first, check feasibility before starting and say so plainly, then do them in order, each as in rule 6, and deliver them as one pull request (rule 10). A follow-up that fails those criteria stays `Not started` for its own conversation.
2. **The docs beat memory.** If your recollection, a chat summary or project memory disagrees with a file in this repository, the file wins until the developer changes it on purpose. Never explain a decision with "we talked about it": if it matters, it is in a file.
3. **Compare before you code.** Compare the real code (exported signatures, file layout) in the snapshot with what the handoff package says. Report every disagreement before writing anything.
4. **Stop on conflicts.** Stop and ask when the task conflicts with an ADR, an open decision in `DECISIONS.md`, or the canonical names in `ARCHITECTURE.md`. ADRs are append-only: never edit an accepted ADR; propose a new one that supersedes it.
5. **Canonical names are exact.** Use the names in the canonical-names table of `ARCHITECTURE.md` exactly. A rename is a deliberate task that updates the table and every consumer together.
6. **Test first.** Write the failing test, watch it fail for the right reason, then implement (`/test-driven-development`). Before saying a task is done, run the checks and show the real output (`/verification-before-completion`). Say plainly which checks you could not run.
7. **The engine stays pure.** `packages/engine` must not use `Math.random`, `Date`, `performance`, `window`, `document`, `process`, Node APIs, or import anything project-internal. Time enters only as `t` on a `Command`. Lint enforces this; do not disable the rule.
8. **Mine positions never reach a client while a game is in progress. After a game ends, only the player's own finished game may expose its mines.** In a race both players share one board, so until D-14 is settled (M4-T03, ADR-010) release the mine layout only when the match result is final for both players. Every inbound network message is validated with a Zod schema and is size- and rate-limited.
9. **Document the code.** Every exported symbol gets a TSDoc comment (`@example` is required in `engine` and `protocol`). Inline comments say why, not what. Every TODO names a task: `// TODO(M6-T04): ...`.
10. **Git conventions.** One task = one branch `m<n>/<task-id>-<slug>` = one PR, squash-merged. The only exception is the review follow-up batch of rule 1: one branch `chore/m<n>-review-followups`, one PR titled `chore: apply M<n> review follow-ups (M<n>-Tnn to M<n>-Tnn) [chore]`. Commit and PR title: `type(scope): subject [Mn-Tnn]`, for example `feat(engine): iterative flood fill [M1-T04]`; work that belongs to no task ends with `[chore]`.
11. **Deliver files, not snippets.** Hand over one zip that keeps repo-relative paths, plus the exact commands to run. Never ask for or paste secrets (`.env` contents, tokens, database URLs).
12. **Close out in the docs.** At the end of a task update the status row in `ROADMAP.md`, `CHANGELOG.md`, `ARCHITECTURE.md` if an interface changed, and `DECISIONS.md` (plus a new `docs/adr/ADR-0NN-*.md`) if a decision was made.

## Commands

Run from the repository root. CI runs all of them on every pull request.

```bash
pnpm install --frozen-lockfile
pnpm typecheck        # tsc -b, then the test files and tooling configs
pnpm lint             # ESLint: TSDoc, boundaries, engine purity
pnpm format:check     # Prettier (code and config files, not Markdown)
pnpm check:todos      # every TODO names a task
pnpm check:links      # relative links and anchors in Markdown files resolve
pnpm test:lint-fixtures
pnpm test:scripts     # node:test tests of the fuzz-digest comparison
pnpm test             # Vitest, all four projects
pnpm --filter @minesweeper/web build  # tsc -b, then the Vite production build of the client
pnpm test:browser     # determinism suite in Chromium (first run: pnpm exec playwright install chromium)
pnpm compare:fuzz-digests  # after pnpm test and pnpm test:browser: Node and Chromium ended the fuzz games the same way
pnpm test:e2e         # Playwright smoke tests in Chromium against the production build of the client (needs the same Chromium install)
pnpm docs:api         # TypeDoc for engine and protocol, warnings are errors
```

Details, the task loop and the doc-comment rules are in `DEVELOPMENT_GUIDE.md`.
