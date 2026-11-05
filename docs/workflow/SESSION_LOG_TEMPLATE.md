# Session Log Template

Save one filled-in copy per conversation as `docs/workflow/sessions/YYYY-MM-DD-<task-id>.md` (for example `2026-11-10-M1-T04.md`). Claude can fill it in for you at close-out (Prompt C). Keep it short: its job is to let you, or a fresh conversation, see what happened without rereading a chat.

```markdown
# Session: <task-id> <task title>

- Date: <YYYY-MM-DD>
- Conversation: <title or link, optional>
- Baseline: <tag or commit SHA the work started from>
- Skills used: <list>

## Outcome
<Done | Partly done | Blocked> in one or two sentences.

## What changed
- Files added or changed (grouped by package)
- Public API or protocol changes (or "none")

## Verification
- Commands run locally and result (typecheck, lint, tests, docs:api, e2e)
- Anything not verified, and why

## Decisions and deviations
- ADRs written or updated (or "none")
- Deviations from the task text, with reason

## Follow-ups
- Tasks to add to ROADMAP.md
- Docs still to update
- Open questions

## Git
- Branch: <name>
- PR: <number or link>
- Merge commit: <short SHA>

## Next
<next task ID and what to attach>
```
