# Conversation Handoff Package: template

Every milestone file in `docs/milestones/` opens with one of these. Copy this structure when a handoff must be written or refreshed by hand (for example when a task is split, or a milestone starts from a different baseline). Replace everything in angle brackets; delete this paragraph.

Rules for the writer:

- Cite a baseline tag or commit SHA, so a fresh conversation starts from known code.
- Copy exported signatures **from the code**, never from memory or from the plan.
- Locked decisions are ADR IDs. The executing conversation must not re-decide them.

---

## Handoff: `<Mn-Tnn>` `<task title>`

1. **Project context.** `<About five lines: what the product is, the packages and their roles, the MVP, who builds it, and the rule that the repository documents are the source of truth.>`
2. **The tasks to execute and their order.** `<For example: M1-T04, then M1-T05. Name the first row of ROADMAP.md that is not Done.>`
3. **Prerequisites and completed dependencies.** `<Baseline tag or commit SHA. For every dependency: the task that delivered it and its actual exported signatures, copied from the code.>`
4. **Locked decisions.** `<ADR IDs, for example ADR-001..009, plus the canonical names the task uses. State "do not re-decide".>`
5. **Expected deliverables.** `<Files and behaviour, as in the task's "Expected output".>`
6. **Acceptance criteria.** `<The task's criteria, plus: exported symbols documented; lint and TypeDoc pass.>`
7. **Required skills and when to use them.** `<For example: /test-driven-development while implementing, /systematic-debugging on failures, /verification-before-completion before claiming done, /requesting-code-review at milestone end.>`
8. **Documents to consult first and to update at close-out.** `<Read: CLAUDE.md, ROADMAP.md, the milestone file, ARCHITECTURE.md, DECISIONS.md. Update: the files the task's "Documentation updates" lists.>`
