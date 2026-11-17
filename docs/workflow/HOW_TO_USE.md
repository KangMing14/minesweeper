# How to Use This Roadmap (Free Plan, Chat-Only Workflow)

You are the hands; Claude is the engineer who cannot see your computer. Claude can write files and run code inside its own sandbox, but only on what you upload to that conversation. Your repository lives on your machine and on GitHub. Everything that must survive between conversations lives in files in that repository.

Four rules make this work:

1. **One task per conversation.** Task IDs look like `M1-T04`. Do not combine tasks.
2. **The docs are the memory.** Claude does not remember earlier conversations reliably. Never explain a decision by "we talked about it"; make sure it is in `DECISIONS.md`, `ARCHITECTURE.md` or the milestone file.
3. **Claude hands you files, not snippets.** Ask for a zip that keeps repo paths, so you extract it at the repo root instead of copy-pasting pieces.
4. **Nothing is done until it is green on your machine.** You run the checks, paste real output back, and only then close the task.

---

## 1. One-time setup

**Install on your computer**
- Git (on Windows this includes Git Bash, which the helper script uses)
- Node.js LTS (through nvm, fnm or the installer) and pnpm (`corepack enable`)
- A code editor (VS Code is fine)
- A GitHub account

**Folder.** Unzip this package. The folder `minesweeper/` becomes your repository root, for example `~/projects/minesweeper`. It already contains `docs/` (spec, plan, all milestone files, these guides), `ROADMAP.md` (status tracker) and `tools/snapshot.sh`. Do not run `git init` yet; task M0-T01 walks you through it. When M0-T05 later says "copy the spec, plan and milestone files into the repo", tell Claude they are already there.

**GitHub note.** M0-T01 asks for a protected `main` branch with required CI. As far as I know, GitHub's free plan supports branch protection only on public repositories; private repositories need a paid plan. Check GitHub's current rules, then either make the repository public, or keep it private and rely on the local hooks and your own discipline (merge only through PRs, only when CI is green). Tell Claude which you chose at M0-T01.

**Claude Project.** Use one Claude Project for this game (the free plan allows a few projects). Project knowledge counts toward the context of every message, and the free plan has no automatic expansion for large knowledge, so keep it small:

| Phase | What to keep in Project knowledge |
|---|---|
| Before M0-T05 | The design spec and the master plan |
| After M0-T05 | `CLAUDE.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md` only |

Everything else (the current milestone file, source code, the task's docs) is attached to the individual conversation. Project knowledge does not sync with your repo: when one of those four files changes, delete the old copy and upload the new one (this is part of closing a task).

Project memory may remember some facts, but treat it as a convenience, never as the source of truth.

---

## 2. Where things live

```
minesweeper/                      <- git repo root
  ROADMAP.md                      status of all 83 tasks (you update after every task)
  CLAUDE.md                       created in M0-T05: read-order and rules for Claude
  README.md, PROJECT_OVERVIEW.md, ARCHITECTURE.md, DEVELOPMENT_GUIDE.md,
  DECISIONS.md, CHANGELOG.md      created in M0-T05
  docs/
    superpowers/specs/            the approved design spec
    superpowers/plans/            the master roadmap plan
    milestones/                   M0..M11 files: handoff package + tasks
    adr/                          ADR-001... one file per decision
    handoffs/                     TEMPLATE.md (from M0-T05)
    reviews/                      milestone review reports
    workflow/
      HOW_TO_USE.md               this file
      PROMPT_TEMPLATES.md         copy-paste prompts
      SESSION_LOG_TEMPLATE.md
      sessions/                   one log per conversation (you save these)
      checkpoints/                mid-task checkpoints (you save these)
  packages/engine, packages/protocol, apps/server, apps/web   created in M0-T02
  tools/snapshot.sh               zips the repo for attaching to a chat

../snapshots/                     OUTSIDE the repo: snapshot zips you upload (never committed)
```

---

## 3. Starting a task conversation

1. Open a **new chat inside the Project**.
2. Decide which task is next from `ROADMAP.md` (first row that is not `Done`). Tasks inside a milestone run in order.
3. Attach what that task needs:

| Situation | Attach to the chat |
|---|---|
| Any task | The milestone file (for example `docs/milestones/M1-engine-core.md`) |
| M0 tasks | Nothing else (spec and plan are in Project knowledge) |
| After M0 | The Project already holds `CLAUDE.md`, `ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md` |
| First task of a milestone | Also `packages/*/src/index.ts` files of the packages it depends on, or a partial snapshot |
| Milestone review, or any check of history, tags or branch protection | A snapshot taken with `tools/snapshot.sh --git-state` after `git fetch` (adds `GIT_STATE.txt`; `--with-git` adds the `.git` folder itself, rarely needed) |
| Any coding task | A snapshot zip: `tools/snapshot.sh` (whole repo) or `tools/snapshot.sh packages/engine packages/protocol` (only what the task touches) |
| Tasks that change docs | Also the doc file being changed if it is not in Project knowledge |
| Resuming an interrupted task | The checkpoint file (section 8) |

   Keep each upload small. The helper script never includes `node_modules`, build output or `.env` files.
4. Paste **Prompt A** from `PROMPT_TEMPLATES.md`, filling in the task ID and file names. Name the skills the task lists (for example `/test-driven-development`); Claude will read and apply them.

Claude should begin by reading the handoff package, comparing the real code signatures with the docs, and telling you about any mismatch before writing code. If it starts coding immediately, say "stop, do step 1 first".

---

## 4. During the task: the working loop

1. Claude summarizes the plan, writes tests first, then the implementation. If it can, it runs `pnpm install`, `typecheck`, `lint` and `test` in its sandbox on your snapshot and shows the real output. Browser tests (Playwright) and anything needing a database or other downloads may not run in its sandbox; Claude must say what it could not run, and you run those yourself.
2. Claude delivers **one zip** with every new or changed file at repo-relative paths, plus the commands to run.
3. You extract the zip **at the repo root**, overwriting files. Run the commands. Before M0-T04 only some checks exist; Claude lists exactly which apply.
4. If anything fails, paste **Prompt B** with the real output. Claude fixes it and sends a new zip containing only files changed since the last one. Repeat until everything is green.
5. If Claude wants to change a decision, a canonical name or a public signature, it must stop and use **Prompt G**. Do not let it quietly deviate.

Never paste secrets into a chat: no `.env` contents, tokens, passwords or database URLs. Use placeholder values.

---

## 5. Where Claude's output goes

| Claude produced | Put it |
|---|---|
| Source, tests, configs | In the repo at the same paths (via the zip) |
| Updated docs (`ARCHITECTURE.md`, `DECISIONS.md`, `CHANGELOG.md`, `DEVELOPMENT_GUIDE.md`, ...) | In the repo (via the zip), then re-upload the four Project-knowledge files if they changed |
| A new decision | `docs/adr/ADR-0NN-title.md`, plus a line in `DECISIONS.md` |
| Commit message and PR description | Into git and the GitHub PR |
| Session log entry | `docs/workflow/sessions/YYYY-MM-DD-Mn-Tnn.md` |
| Checkpoint | `docs/workflow/checkpoints/Mn-Tnn-checkpoint.md` |
| Milestone review report | `docs/reviews/Mn-review.md` |
| Snapshot zips | `../snapshots/` (outside the repo) |
| Long explanations and brainstorming text | Not saved. If it contains something durable, it belongs in an ADR or `ARCHITECTURE.md`; otherwise let it go. |

---

## 6. Closing a task (do this every time)

1. **Green locally.** Run the project checks that exist so far (from M0-T04 on): `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm docs:api`. Also run any end-to-end tests the task mentions.
2. **Ask for the close-out** with **Prompt C**. Claude returns a zip with the doc updates (including the `ROADMAP.md` status), the commit message, the PR description, a session log entry, and the next task.
3. **Extract that zip** at the repo root.
4. **Branch, commit, push** (names follow the plan; adapt the example):
   ```
   git switch main && git pull
   git switch -c m1/M1-T04-flood-fill
   # extract the bundles into the repo root (done above)
   git status                      # check: no node_modules, no .env, nothing surprising
   git add -A
   git commit -m "feat(engine): iterative flood fill [M1-T04]"
   git push -u origin HEAD
   ```
   Before M0-T01 finishes there is no remote yet; Claude's instructions for M0 tasks say what to do.
5. **Pull request.** Open it on GitHub with the description Claude gave you, wait for CI to go green, then **squash-merge**.
6. **Tidy up.**
   ```
   git switch main && git pull
   git branch -d m1/M1-T04-flood-fill
   ```
7. **Update `ROADMAP.md`:** set the task to `Done`, add the PR number, the squash-merge commit's short SHA and the date. Commit this small edit on `main` through your normal flow (or include it in the next task's branch).
8. **Re-upload changed Project knowledge files** (`ROADMAP.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `CLAUDE.md`), deleting the old copies.
9. **Save the session log** into `docs/workflow/sessions/`.
10. **Start the next task in a fresh conversation.**

If a task produced no code (for example an ADR-only task), skip steps that do not apply but still update `ROADMAP.md`.

---

## 7. Ending a milestone

When the last task of a milestone is `Done`:

1. Run `git fetch`, then take a whole-repo snapshot with git state: `tools/snapshot.sh --git-state`.
2. New conversation, attach the milestone file, snapshot, `ARCHITECTURE.md`, `DECISIONS.md`, and paste **Prompt F** (milestone review with `/requesting-code-review`). Save the report as `docs/reviews/Mn-review.md`. After the follow-up tasks are merged, run a re-review in a **new** conversation with **Prompt F2** and save it as `docs/reviews/Mn-review-2.md`; tag only after it is clean.
3. Fix blocking findings as extra tasks (add rows to `ROADMAP.md`), through the normal loop.
4. Tag and push: `git tag m1-complete && git push --tags`.
5. Check that the next milestone's "Prerequisites and baseline" matches what you now have. The next milestone's first conversation will ask Claude to copy the real exported signatures from your code.

---

## 8. When a conversation gets long, or you hit usage limits

The free plan has usage limits and conversations have a length limit. Signs you should wrap up: Claude starts forgetting earlier details, replies slow down, or you see a limit warning.

1. Paste **Prompt D** (checkpoint). Claude writes a markdown file: what is done, what remains, decisions, files changed since your last commit, failing output, and the exact next step.
2. Save it to `docs/workflow/checkpoints/Mn-Tnn-checkpoint.md`. Commit your work in progress on the task branch.
3. In a new conversation (after your limit resets if needed), attach the checkpoint, the milestone file and a fresh snapshot, and paste **Prompt E**.

Small tasks are the best defense: if a task feels too big for one conversation, ask Claude to propose a split into sub-steps before coding and record the split in the session log.

---

## 9. Keeping the project consistent

- `ROADMAP.md` is the only place that says what is done.
- Decisions are append-only ADRs. If a task conflicts with one, use Prompt G; do not edit old ADRs to fit.
- Canonical names (in the master plan) are exact. Renames are separate, deliberate tasks.
- The engine's API-surface test (M1-T07) and lint rules (M0-T03) are guard rails. Do not disable them to make a task pass; ask Claude why they fail.
- Check `git diff` before committing. You should be able to explain every changed file.
- If Claude and the docs disagree, the docs win until you change them on purpose.

---

## 10. Suggested first sessions

| Conversation | Task | Notes |
|---|---|---|
| 1 | M0-T01 | Create the repo and git rules; first commit contains this package's files |
| 2 | M0-T02 | Scaffold the monorepo; you will run `pnpm install` for the first time |
| 3 | M0-T03 | Lint, hooks, doc rules |
| 4 | M0-T04 | Tests and CI |
| 5 | M0-T05 | Docs skeleton; upload the four Project knowledge files afterwards |
| 6 | M0-T06 | ADRs, license, Better Auth check; tag `m0-complete` |
| 7+ | M1-T01 onward | One task per conversation |

---

## 11. Troubleshooting

| Problem | What to do |
|---|---|
| Claude ignores the docs | Re-paste Prompt A and say "read the Handoff Package and check signatures first" |
| Claude's code does not match your files | You probably attached an old snapshot. Make a new one and say so |
| Claude invented a new name or API | Point to the canonical names table and ask it to conform, or use Prompt G if the change is genuinely needed |
| The zip overwrote something you changed | Use `git diff` and `git restore` to compare; commit small and often on the task branch |
| Tests pass for Claude, fail for you | Tell Claude your OS, Node and pnpm versions and paste the full output (Prompt B) |
| CI fails but local passes | Paste the CI log; usually a missing file, a different Node version, or a service (like Postgres) missing in CI |
| Running out of usage | Prompt D, then continue after reset; prefer shorter tasks |
| A file is too large to upload | Use a partial snapshot of only the relevant folders |
