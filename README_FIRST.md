# Competitive Minesweeper: Roadmap Package

This folder is the starting point of your project: the approved design spec, the full roadmap (12 milestones, 78 tasks), a status tracker, and the guides for running the whole project through chat conversations on the free plan.

## What is in here

| Path | What it is |
|---|---|
| `ROADMAP.md` | Status tracker for all 78 tasks. You update it after each task. |
| `docs/superpowers/specs/` | The approved design spec |
| `docs/superpowers/plans/` | The master roadmap plan (sections A to H, canonical names, ADR plan, dependency graph) |
| `docs/milestones/` | `M0` to `M11`: each has a Conversation Handoff Package and every task |
| `docs/workflow/HOW_TO_USE.md` | **Read this first**: setup, per-task loop, close-out checklist, file organization |
| `docs/workflow/PROMPT_TEMPLATES.md` | Copy-paste prompts for starting, debugging, closing and resuming tasks |
| `docs/workflow/SESSION_LOG_TEMPLATE.md` | Template for the per-conversation log |
| `tools/snapshot.sh` | Zips your repo (no `node_modules`, no secrets) to attach to a chat |

## Quick start

1. Install Git, Node.js LTS, pnpm and a code editor; create a GitHub account.
2. Unzip this package so the `minesweeper/` folder is your future repo root (for example `~/projects/minesweeper`).
3. Read `docs/workflow/HOW_TO_USE.md` (about ten minutes).
4. In your Claude Project, keep only the design spec and the master plan as knowledge for now.
5. Open a new chat, attach `docs/milestones/M0-foundations.md`, and paste Prompt A from `PROMPT_TEMPLATES.md` for task `M0-T01`.
6. After each task, follow the close-out checklist (section 6 of HOW_TO_USE) and start the next task in a fresh chat.

## The one-line version

One task per conversation. Claude delivers a zip; you extract it at the repo root, run the checks, commit on a branch, merge through a pull request, update `ROADMAP.md`, and start the next task fresh.
