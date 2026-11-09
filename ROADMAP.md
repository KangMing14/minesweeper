# ROADMAP: Status Tracker

Single source of truth for progress. Update one row at the end of every task (see `docs/workflow/HOW_TO_USE.md`, section 6).

**Status values:** `Not started`, `In progress`, `Done`, `Blocked`. Fill **PR** with the pull request number, **Commit** with the squash-merge commit short SHA, **Done on** with the date (YYYY-MM-DD).

Full task details live in `docs/milestones/`; the plan is `docs/superpowers/plans/2026-11-04-competitive-minesweeper-roadmap.md`.

## Milestone index

Twelve milestones, 78 tasks. Tasks inside a milestone run in numeric order unless a task's prerequisites say otherwise. A milestone is finished when all its tasks are `Done` and its exit criteria hold; then it is reviewed and tagged (`docs/workflow/HOW_TO_USE.md`, section 7). Dependency graph: master plan, section E.

| ID | Milestone | Tasks | Depends on | Exit criteria | File | Tag |
| --- | --- | --- | --- | --- | --- | --- |
| M0 | Foundations | 6 | spec approved | CI green on wired monorepo; docs and ADR-001..008 committed; tag `m0-complete` | [`M0-foundations.md`](docs/milestones/M0-foundations.md) | `m0-complete` |
| M1 | Engine core | 7 | M0 | Playable-in-tests engine; public API exported and documented | [`M1-engine-core.md`](docs/milestones/M1-engine-core.md) | `m1-complete` |
| M2 | Deterministic engine | 6 | M1 | Seeded boards, command log, replay; golden-seed tests pass in Node and a browser | [`M2-deterministic-engine.md`](docs/milestones/M2-deterministic-engine.md) | `m2-complete` |
| M3 | Local solo client | 8 | M2 | Playable solo game in the browser; Playwright smoke test green | [`M3-local-solo-client.md`](docs/milestones/M3-local-solo-client.md) | `m3-complete` |
| M4 | Mode framework and ghost race | 5 | M2, M3 | `GameMode` registry; race against your ghost; ADR-010 | [`M4-mode-framework-ghost-race.md`](docs/milestones/M4-mode-framework-ghost-race.md) | `m4-complete` |
| M5 | First networked race | 8 | M4 | Two browsers race on localhost and a second LAN device | [`M5-first-networked-race.md`](docs/milestones/M5-first-networked-race.md) | `m5-complete` |
| M6 | Match lifecycle and reconnection | 5 | M5 | Fault-injection suite green; ADR-011 | [`M6-lifecycle-reconnection.md`](docs/milestones/M6-lifecycle-reconnection.md) | `m6-complete` |
| M7 | Accounts and persistence | 7 | M5 | Guests and registered users; matches and replays persisted; ADR-012 | [`M7-accounts-persistence.md`](docs/milestones/M7-accounts-persistence.md) | `m7-complete` |
| M8 | Competitive layer | 7 | M6, M7 | Validated solo leaderboards; ranked 1v1; ADR-013 | [`M8-competitive-layer.md`](docs/milestones/M8-competitive-layer.md) | `m8-complete` |
| M9 | Staging and hardening | 6 | M8 | Deployed staging with rate limits, anti-cheat flags, reviewed security; ADR-014 | [`M9-staging-hardening.md`](docs/milestones/M9-staging-hardening.md) | `m9-complete` |
| M10 | Polish and alpha | 7 | M8 (T01 can start after M3) | Accessible, responsive, animated, with sound; alpha released; ADR-015, ADR-016 | [`M10-polish-alpha.md`](docs/milestones/M10-polish-alpha.md) | `m10-complete` |
| M11 | Launch readiness | 6 | M9, M10 | Load tested, monitored, end-to-end suites green; public launch `v1.0.0` | [`M11-launch-readiness.md`](docs/milestones/M11-launch-readiness.md) | `m11-complete` |

## M0 Foundations

File: `docs/milestones/M0-foundations.md`. Tag when finished: `m0-complete`.

| Task   | Title                                         | Status      | PR                               | Commit  | Done on    |
| ------ | --------------------------------------------- | ----------- | -------------------------------- | ------- | ---------- |
| M0-T01 | Initialize the repository and git conventions | Done        | n/a (bootstrap commit on main)   | cc51e30 | 2026-11-05 |
| M0-T02 | Scaffold the monorepo and pin versions        | Done        |chore: scaffold monorepo and pin versions [M0-T02] (#1)| 80f3dfc | 2026-11-05 |
| M0-T03 | Lint, format, hooks and documentation lint    | Done        |chore: add lint, format, hooks and doc lint [M0-T03] (#2)|d90869d|2026-11-07|
| M0-T04 | Test tooling and CI                           | Done        |ci: add test tooling, TypeDoc and CI workflow [M0-T04] (#5)|722bf34|2026-11-07|
| M0-T05 | Documentation skeleton                        | Done        |docs: add documentation skeleton and link check [M0-T05] (#6)|cab55e4|2026-11-08|
| M0-T06 | ADRs, dependency verification and license     | Not started |                                  |         |            |

## M1 Engine Core

File: `docs/milestones/M1-engine-core.md`. Tag when finished: `m1-complete`.

| Task   | Title                                                 | Status      | PR  | Commit | Done on |
| ------ | ----------------------------------------------------- | ----------- | --- | ------ | ------- |
| M1-T01 | Core types, presets and config validation             | Not started |     |        |         |
| M1-T02 | Board and neighbor math                               | Not started |     |        |         |
| M1-T03 | Game state, views and events                          | Not started |     |        |         |
| M1-T04 | Reveal and iterative flood fill                       | Not started |     |        |         |
| M1-T05 | Flags and chording                                    | Not started |     |        |         |
| M1-T06 | Win and loss, status transitions, post-game rejection | Not started |     |        |         |
| M1-T07 | Public API surface                                    | Not started |     |        |         |

## M2 Deterministic Engine

File: `docs/milestones/M2-deterministic-engine.md`. Tag when finished: `m2-complete`.

| Task   | Title                                   | Status      | PR  | Commit | Done on |
| ------ | --------------------------------------- | ----------- | --- | ------ | ------- |
| M2-T01 | In-engine PRNG                          | Not started |     |        |         |
| M2-T02 | Seeded board generator and safe opening | Not started |     |        |         |
| M2-T03 | `createGame` and the command log        | Not started |     |        |         |
| M2-T04 | `ReplayLog` and `replay`                | Not started |     |        |         |
| M2-T05 | Results and scoring                     | Not started |     |        |         |
| M2-T06 | Determinism and cross-environment tests | Not started |     |        |         |

## M3 Local Solo Client

File: `docs/milestones/M3-local-solo-client.md`. Tag when finished: `m3-complete`.

| Task   | Title                                          | Status      | PR  | Commit | Done on |
| ------ | ---------------------------------------------- | ----------- | --- | ------ | ------- |
| M3-T01 | Web scaffold and design tokens                 | Not started |     |        |         |
| M3-T02 | `GameSession` and `LocalSession`               | Not started |     |        |         |
| M3-T03 | Canvas board renderer                          | Not started |     |        |         |
| M3-T04 | Input controller                               | Not started |     |        |         |
| M3-T05 | Game lifecycle, screens and difficulty         | Not started |     |        |         |
| M3-T06 | Restart, retry same board, new board           | Not started |     |        |         |
| M3-T07 | Local statistics                               | Not started |     |        |         |
| M3-T08 | Accessibility basics and end-to-end smoke test | Not started |     |        |         |

## M4 Mode Framework and Ghost Race

File: `docs/milestones/M4-mode-framework-ghost-race.md`. Tag when finished: `m4-complete`.

| Task   | Title                                    | Status      | PR  | Commit | Done on |
| ------ | ---------------------------------------- | ----------- | --- | ------ | ------- |
| M4-T01 | `GameMode` interface and registry        | Not started |     |        |         |
| M4-T02 | `TimeAttackMode`                         | Not started |     |        |         |
| M4-T03 | `RaceMode` and tie-break rules (ADR-010) | Not started |     |        |         |
| M4-T04 | Ghost recorder and player                | Not started |     |        |         |
| M4-T05 | Ghost race UI                            | Not started |     |        |         |

## M5 First Networked Race

File: `docs/milestones/M5-first-networked-race.md`. Tag when finished: `m5-complete`.

| Task   | Title                                       | Status      | PR  | Commit | Done on |
| ------ | ------------------------------------------- | ----------- | --- | ------ | ------- |
| M5-T01 | Protocol package                            | Not started |     |        |         |
| M5-T02 | Transport abstraction                       | Not started |     |        |         |
| M5-T03 | Server skeleton                             | Not started |     |        |         |
| M5-T04 | `Match` state machine and `MatchManager`    | Not started |     |        |         |
| M5-T05 | Authoritative command handling              | Not started |     |        |         |
| M5-T06 | `RemoteSession` and `ViewMirror`            | Not started |     |        |         |
| M5-T07 | Lobby UI                                    | Not started |     |        |         |
| M5-T08 | LAN end-to-end test and latency measurement | Not started |     |        |         |

## M6 Match Lifecycle and Reconnection

File: `docs/milestones/M6-lifecycle-reconnection.md`. Tag when finished: `m6-complete`.

| Task   | Title                                                   | Status      | PR  | Commit | Done on |
| ------ | ------------------------------------------------------- | ----------- | --- | ------ | ------- |
| M6-T01 | Sequencing, acks and pipelining semantics               | Not started |     |        |         |
| M6-T02 | Resume tokens, snapshots and single-connection takeover | Not started |     |        |         |
| M6-T03 | Disconnect grace period and forfeit (ADR-011)           | Not started |     |        |         |
| M6-T04 | Ready and countdown hardening                           | Not started |     |        |         |
| M6-T05 | `FaultyTransport` and the fault-injection suite         | Not started |     |        |         |

## M7 Accounts and Persistence

File: `docs/milestones/M7-accounts-persistence.md`. Tag when finished: `m7-complete`.

| Task   | Title                                         | Status      | PR  | Commit | Done on |
| ------ | --------------------------------------------- | ----------- | --- | ------ | ------- |
| M7-T01 | PostgreSQL, Drizzle and migrations            | Not started |     |        |         |
| M7-T02 | Better Auth integration with guests (ADR-012) | Not started |     |        |         |
| M7-T03 | Repositories and in-memory fakes              | Not started |     |        |         |
| M7-T04 | Persist matches and replays                   | Not started |     |        |         |
| M7-T05 | Profiles and statistics                       | Not started |     |        |         |
| M7-T06 | Match history                                 | Not started |     |        |         |
| M7-T07 | Client account UI                             | Not started |     |        |         |

## M8 Competitive Layer

File: `docs/milestones/M8-competitive-layer.md`. Tag when finished: `m8-complete`.

| Task   | Title                                 | Status      | PR  | Commit | Done on |
| ------ | ------------------------------------- | ----------- | --- | ------ | ------- |
| M8-T01 | `ReplayValidator`                     | Not started |     |        |         |
| M8-T02 | Solo ranked flow and leaderboard API  | Not started |     |        |         |
| M8-T03 | Leaderboard UI and ranked solo mode   | Not started |     |        |         |
| M8-T04 | `RatingSystem` and Glicko-2 (ADR-013) | Not started |     |        |         |
| M8-T05 | `Matchmaker`                          | Not started |     |        |         |
| M8-T06 | Ranked 1v1 flow                       | Not started |     |        |         |
| M8-T07 | Rating display and ranked leaderboard | Not started |     |        |         |

## M9 Staging Deployment and Hardening

File: `docs/milestones/M9-staging-hardening.md`. Tag when finished: `m9-complete`.

| Task   | Title                                                 | Status      | PR  | Commit | Done on |
| ------ | ----------------------------------------------------- | ----------- | --- | ------ | ------- |
| M9-T01 | Production build and container images                 | Not started |     |        |         |
| M9-T02 | Staging environment and continuous delivery (ADR-014) | Not started |     |        |         |
| M9-T03 | Rate limiting and message limits                      | Not started |     |        |         |
| M9-T04 | Anti-cheat heuristics and audit tool                  | Not started |     |        |         |
| M9-T05 | Security review                                       | Not started |     |        |         |
| M9-T06 | Backups, migrations policy and runbook                | Not started |     |        |         |

## M10 UX/UI Polish and Alpha

File: `docs/milestones/M10-polish-alpha.md`. Tag when finished: `m10-complete`.

| Task    | Title                                          | Status      | PR  | Commit | Done on |
| ------- | ---------------------------------------------- | ----------- | --- | ------ | ------- |
| M10-T01 | Visual identity and design system              | Not started |     |        |         |
| M10-T02 | Animations and transitions                     | Not started |     |        |         |
| M10-T03 | Sound effects and `AudioController`            | Not started |     |        |         |
| M10-T04 | Responsive layout and touch controls (ADR-015) | Not started |     |        |         |
| M10-T05 | Accessibility audit and fixes                  | Not started |     |        |         |
| M10-T06 | Performance optimization                       | Not started |     |        |         |
| M10-T07 | Alpha release and telemetry decision (ADR-016) | Not started |     |        |         |

## M11 Launch Readiness

File: `docs/milestones/M11-launch-readiness.md`. Tag when finished: `m11-complete`.

| Task    | Title                             | Status      | PR  | Commit | Done on |
| ------- | --------------------------------- | ----------- | --- | ------ | ------- |
| M11-T01 | End-to-end test suites            | Not started |     |        |         |
| M11-T02 | Load and performance testing      | Not started |     |        |         |
| M11-T03 | Monitoring and alerting           | Not started |     |        |         |
| M11-T04 | Error reporting and logging       | Not started |     |        |         |
| M11-T05 | Launch checklist and legal basics | Not started |     |        |         |
| M11-T06 | Public launch and feedback loop   | Not started |     |        |         |

_Total tasks: 78._
