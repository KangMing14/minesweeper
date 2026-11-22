# Prompt Templates

Copy a prompt, replace the parts in `<angle brackets>`, and paste it into a new chat inside the Project. Skill names (like `/test-driven-development`) work by name: Claude reads and applies them.

---

## Prompt A: Start a task

```
We are building a competitive Minesweeper game. The attached docs are the source of truth.

Task for this conversation: <M1-T04> only. Do not start other tasks.

Attached: <milestone file>, <snapshot zip>, <other files>. Project knowledge has CLAUDE.md, ROADMAP.md, ARCHITECTURE.md and DECISIONS.md.

Please:
1. Read the milestone's Conversation Handoff Package and the <M1-T04> task. Compare the real exported signatures and file layout in my snapshot with what the docs say. Tell me about any disagreement BEFORE writing code.
2. Summarize in about five lines what you will build, and which ADRs and canonical names constrain it.
3. Use the skills the task lists (<for example /test-driven-development and /verification-before-completion>): failing test first, then implementation.
4. If you can, run install, typecheck, lint and tests in your sandbox on my snapshot and show the real output. Say clearly which checks you could not run.
5. Deliver every new or changed file as ONE zip that keeps repo-relative paths, plus the exact commands I should run locally.
6. Stop and ask me if the task conflicts with an ADR, an open decision, or the canonical names.
```

---

## Prompt B: Report local results (or a failure)

```
I extracted your bundle at the repo root and ran: <commands>.

Result:
<paste the output; trim to the failing parts but keep full error messages; no secrets>

Environment: <OS>, Node <version>, pnpm <version>.

Please diagnose with /systematic-debugging, explain the cause briefly, fix it, and send a new zip containing only the files that changed since your last bundle.
```

---

## Prompt C: Close out a task

```
This task is green on my machine<and in CI>. Please produce the close-out as one zip with repo-relative paths, plus a short text list:
1. ROADMAP.md with this task's status set to Done (leave PR, commit and date empty; I will fill them).
2. Updates to CHANGELOG.md, ARCHITECTURE.md, DECISIONS.md (and a new docs/adr/ADR-0NN file if a decision was made), DEVELOPMENT_GUIDE.md, README.md, only where the task's "Documentation updates" or the actual changes require them.
3. The commit message (Conventional Commits, with the task ID in brackets) and a pull-request description with the acceptance criteria as a checklist.
4. A session log entry using docs/workflow/SESSION_LOG_TEMPLATE.md.
5. Which Project-knowledge files I must re-upload.
6. The next task and exactly what I should attach to its conversation.
```

---

## Prompt D: Checkpoint (running out of room or limits)

```
I need to stop for now. Write a checkpoint I can paste into a new conversation, as one markdown file named <Mn-Tnn>-checkpoint.md:
- task ID and goal
- what is done (with file names) and what remains
- decisions made in this conversation, and any open questions
- files changed since my last commit; for any file I may not have saved, include its full content
- failing tests or errors, with the relevant output
- the exact next step
Be specific enough that a fresh conversation can continue without asking me to re-explain.
```

---

## Prompt E: Resume from a checkpoint

```
We are resuming task <Mn-Tnn> of the competitive Minesweeper project.

Attached: the checkpoint, the milestone file, a fresh repo snapshot <zip>.

Treat the checkpoint as authoritative for progress, but verify it against the snapshot and tell me about any mismatch. Then continue from its "next step", using the same skills as before. Deliver changes as one zip with repo-relative paths.
```

---

## Prompt F: Milestone review

```
Milestone <Mn> is complete. Attached: the milestone file, a whole-repo snapshot with GIT_STATE.txt, ARCHITECTURE.md, DECISIONS.md, ROADMAP.md.

Use /requesting-code-review to review the whole milestone against its acceptance criteria and the Global Constraints in the master plan. Check: package boundaries, canonical names, test quality and coverage of the "Review Focus" cases, documentation and TSDoc coverage, leftover TODOs without task IDs, and consistency between code and ARCHITECTURE.md.

Output docs/reviews/<Mn>-review.md with findings grouped by severity (blocking, important, minor). Do not change code in this step; propose fixes as new tasks I can add to ROADMAP.md, and say which of them are small enough to be done in this conversation (Prompt F1).
```

Take the snapshot with `git fetch && tools/snapshot.sh --git-state`, so the review can see history, tags and branch protection (`GIT_STATE.txt`).

## Prompt F1: Apply the review follow-ups (same conversation as the review)

Paste it in the conversation that wrote the review, after you have read the review. It is the one exception to "one task per conversation" (`CLAUDE.md`, rule 1).

```
The review is accepted. Follow-ups to apply: <all | the finding IDs or task IDs>. <My decisions on anything the review left open, for example "B1: option A, export the constant">.

Do this like Prompt A, for all of them in one conversation:
1. Append the tasks to ROADMAP.md (rows, the milestone's count in the index, the total) and to the milestone file (handoff item 2 and one section per task, in the usual format). Update the task count wherever it is written (README.md, CLAUDE.md, PROJECT_OVERVIEW.md, DEVELOPMENT_GUIDE.md, docs/workflow/HOW_TO_USE.md, CHANGELOG.md).
2. Check whether finishing all of them here is feasible: about five tasks or fewer, each small, each verifiable in your sandbox, none needing a decision I have not made, none needing a tool you cannot run (a real browser, a database). Say plainly which are feasible. Do those; leave the others `Not started` in ROADMAP.md and tell me, so I can run them in their own conversations. If none is feasible, stop after step 1 and say so.
3. For each task you do, in order: compare the real code with what the docs say and report any disagreement before changing anything; write the failing test first and watch it fail for the right reason (/test-driven-development); implement; mutate the new code or tests to show they bite when the task asks for it. Stop and ask me if a task conflicts with an ADR, an open decision or the canonical names.
4. Run a clean install and the full check suite (typecheck, lint, format:check, check:todos, check:links, test:lint-fixtures, test with coverage, docs:api, audit:prod) after the last edit and show the real output (/verification-before-completion). Say which checks you could not run.
5. Deliver every new or changed file as ONE zip with repo-relative paths, plus the exact commands for me: branch chore/<mn>-review-followups, the commit and the pull request title `chore: apply <Mn> review follow-ups (<Mn-Tnn> to <Mn-Tnn>) [chore]`, the pull request description with the acceptance criteria of every task as a checklist, a session log entry (docs/workflow/sessions/, one entry for the batch), the Project-knowledge files I must re-upload, and what to do next (PR and commit cells in ROADMAP.md after the merge, the re-review F2, the tag).
```

## Prompt F2: Re-review after the review follow-ups

Use a **new** conversation, not the one that made the fixes. Attach a fresh snapshot (`git fetch && tools/snapshot.sh --git-state`), the milestone file, `ARCHITECTURE.md`, `DECISIONS.md`, `ROADMAP.md`, and the first review (`docs/reviews/<Mn>-review.md`).

```
Milestone <Mn> had a review (attached) and its follow-up tasks (<list of task IDs>) are merged (done in the review conversation with Prompt F1 or in their own conversations). Attached: the first review, the milestone file, a whole-repo snapshot with GIT_STATE.txt, ARCHITECTURE.md, DECISIONS.md, ROADMAP.md.

Use /requesting-code-review for a re-review. (1) For every finding in the first review, say whether it is resolved, partly resolved or open, with the evidence (file, line, command output). (2) Review the follow-up changes themselves for new problems, including whether each task met its own acceptance criteria. (3) Use GIT_STATE.txt to check the blocking items about history, tags and branch protection. (4) Re-run the full check suite from a clean install and show the output.

Output docs/reviews/<Mn>-review-2.md with a resolution table first, then any new findings by severity. State plainly whether the milestone is ready to tag. Do not change code.
```

---

## Prompt G: A conflict or a new decision

```
This task appears to conflict with <ADR-0NN / open decision D-NN / canonical name>. Do not work around it.

Use /brainstorming to lay out two or three options with trade-offs, recommend one, and draft the new ADR (superseding the old one if needed) as docs/adr/ADR-0NN-<title>.md. I will decide before any code changes. After I decide, list which docs and which milestone tasks need updating.
```

---

## Prompt H: Quick sanity check mid-task (optional)

```
Before continuing: list every file you have created or changed so far in this conversation, and confirm that none of them breaks the package-dependency rules (engine imports nothing project-internal; protocol imports only engine; apps do not import each other) or uses banned APIs in the engine (Math.random, Date, performance, DOM, Node APIs).
```
