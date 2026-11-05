# M11 Launch Readiness

**Goal:** prove the system holds up, make it observable, close legal and operational gaps, and launch publicly.
**Depends on:** M9, M10. **Brief phase:** 9 (testing, performance, monitoring) and the start of 10.
**Baseline skills for every task:** `/verification-before-completion`; `/test-driven-development` where code is written. Run `/requesting-code-review` at milestone end.

## Conversation Handoff Package

1. **Project context.** Browser-based competitive Minesweeper in TypeScript, OOP, pnpm monorepo (`packages/engine`, `packages/protocol`, `apps/server`, `apps/web`). Feature-complete MVP deployed to staging and an alpha audience: local solo, ghost race, networked 1v1 races, accounts, validated leaderboards, ranked matches, polish and accessibility. Single server process with PostgreSQL; no Redis. Solo developer launching to a small public audience first, then scaling.
2. **Tasks:** M11-T01 to M11-T06, in order.
3. **Prerequisites and baseline:** tags `m9-complete` and `m10-complete`. Copy the actual exported signatures of the WebSocket message schemas, config schema and routes, and read `RUNBOOK.md`, `docs/security-review.md`, `docs/performance.md` before starting.
4. **Locked decisions:** ADR-001..016; capacity target D-11 (about 200 concurrent matches on one small instance) is measured and then confirmed or adjusted here; ack latency target p95 under 150 ms within one region; known limits (D-10 ping fairness, solver bots) stay documented and are stated in launch communication where relevant.
5. **Deliverables:** end-to-end suites in CI, load test and capacity report, monitoring and alerts, error reporting, launch checklist with legal basics, public launch `v1.0.0`, post-launch intake process.
6. **Acceptance:** load test meets targets or the adjusted targets are documented; alerts fire in a drill; end-to-end suites pass on release builds; a rollback has been rehearsed; the launch checklist is fully ticked.
7. **Skills:** baseline; `/testing-strategy` (T01, T02); `/deploy-checklist` (T05, T06); `/incident-response` (T03, T06); `/code-review` (T04 for privacy scrubbing).
8. **Documents:** `RUNBOOK.md`, `docs/security-review.md`, `docs/performance.md`, `ARCHITECTURE.md`. Update: `ARCHITECTURE.md` (capacity and known limits), `RUNBOOK.md`, `DECISIONS.md`, `ROADMAP.md`, `CHANGELOG.md`, `README.md`.

---

### M11-T01 End-to-end test suites

- **Objective:** automated confidence in the flows that matter most.
- **Description:** consolidate and extend Playwright suites.
- **Prerequisites:** M10.
- **Implementation guidance:** apply `/testing-strategy` to decide the pyramid: unit and integration tests already cover logic, so end-to-end focuses on journeys: guest solo game, ghost race, create and join a networked race, reconnect mid-race, register and see history, ranked queue and rating change, ranked solo submission and leaderboard, mobile-emulated game, accessibility scan on each screen. Tests use deterministic seeds and the engine to drive plays. Run a fast subset on every PR and the full suite on release candidates and nightly. Quarantine flaky tests with a tracking task rather than retrying blindly; record the flake rate.
- **Expected output:** organized `e2e/` suites, CI workflows (PR subset, nightly full), a flake log.
- **Testing requirements:** the suites themselves; a deliberate regression (for example breaking resume) is caught by at least one test.
- **Acceptance criteria:** full suite green on a release candidate; flake rate under a documented threshold.
- **Relevant skills:** baseline; `/testing-strategy`.
- **Documentation updates:** `DEVELOPMENT_GUIDE.md` (e2e guide), `ROADMAP.md`.

### M11-T02 Load and performance testing

- **Objective:** know the real capacity and latency before users do.
- **Description:** simulate many concurrent matches and measure.
- **Prerequisites:** M11-T01.
- **Implementation guidance:** write a Node load generator that opens N pairs of WebSocket clients, runs scripted races using the engine, and records per-command ack latency, errors, disconnects, server CPU, memory and event-loop lag. Ramp to the D-11 target of about 200 concurrent matches (400 connections) and beyond until degradation, against a staging instance sized like production; include a reconnection storm and a leaderboard-query burst. Look for memory growth across thousands of matches (leaks in `MatchManager` or timers). Apply fixes where needed and re-run. Record p50/p95/p99 ack latency, the saturation point and the bottleneck in `docs/performance.md` and update D-10 and D-11 with real numbers.
- **Expected output:** `tools/load/`, a capacity report, fixes for findings.
- **Testing requirements:** the load run is repeatable with a fixed seed; at the target load, p95 ack latency under 150 ms within one region (or the documented adjusted target) and no unbounded memory growth; error rate near zero.
- **Acceptance criteria:** report committed; targets met or consciously adjusted with an ADR note.
- **Relevant skills:** baseline; `/testing-strategy`; `/systematic-debugging`.
- **Documentation updates:** `docs/performance.md`, `ARCHITECTURE.md` (known limits and capacity), `DECISIONS.md`.

### M11-T03 Monitoring and alerting

- **Objective:** find out about problems before players tell you.
- **Description:** metrics, dashboards, uptime checks and alerts.
- **Prerequisites:** M11-T02.
- **Implementation guidance:** expose application metrics (active connections, active matches, queue length and wait time, command ack latency histogram, message and error rates, persistence failures, event-loop lag) through a Prometheus-compatible endpoint protected from public access, or use the host's built-in metrics if sufficient. Dashboard with the handful of charts that answer "is it healthy". External uptime checks on the site, `/ready`, and a synthetic WebSocket handshake. Alerts to email or chat: service down, error rate spike, ack latency over target, database unreachable, disk or memory pressure, backup failure. Rehearse one alert (stop the service on staging) and one recovery following the runbook.
- **Expected output:** metrics module, dashboard definition, alert rules, uptime checks, drill notes in `RUNBOOK.md`.
- **Testing requirements:** metrics unit tests (counters change on events); the alert drill is performed and recorded; the metrics endpoint is not reachable without credentials from outside.
- **Acceptance criteria:** drill documented; alerts reach you.
- **Relevant skills:** baseline; `/incident-response`.
- **Documentation updates:** `RUNBOOK.md`, `ARCHITECTURE.md` (observability).

### M11-T04 Error reporting and logging

- **Objective:** actionable errors without leaking player data.
- **Description:** Sentry for client and server, source maps, scrubbing, log retention.
- **Prerequisites:** M11-T03.
- **Implementation guidance:** integrate Sentry in `apps/web` and `apps/server` with release tagging from the build, source map upload in CI (maps not publicly served), and scrubbing of emails, tokens, cookies and replay payloads (`beforeSend`). Capture the match id and mode as tags only. Define log levels and retention (for example 14 days) consistent with the privacy note from ADR-016. Add a test error endpoint available only in non-production, and confirm client and server errors arrive on staging. Review scrubbing with `/code-review`.
- **Expected output:** Sentry integration, CI source map step, scrubbing tests, retention settings.
- **Testing requirements:** unit tests that `beforeSend` removes sensitive fields from sample events; staging drill: trigger a client error and a server error and confirm grouped, symbolicated reports.
- **Acceptance criteria:** drill passes; no PII in sampled events.
- **Relevant skills:** baseline; `/code-review`.
- **Documentation updates:** `RUNBOOK.md`, privacy note, `DEVELOPMENT_GUIDE.md`.

### M11-T05 Launch checklist and legal basics

- **Objective:** close the gaps that are not code.
- **Description:** a complete go/no-go checklist plus minimal legal and data-rights features.
- **Prerequisites:** M11-T04.
- **Implementation guidance:** run `/deploy-checklist` for production and extend it with project items: production environment provisioned like staging, secrets rotated, backups verified (restore drill repeated recently), migration dry run on a production-sized copy, rollback rehearsed, rate limits tuned from load results, domain, TLS and DNS, status page or announcement channel, support contact. Legal and data: terms of service and privacy policy written in plain language and matching actual data use (consult a professional where the audience or jurisdiction requires it; this is not legal advice), cookie notice if non-essential cookies exist, account deletion and data export requests supported (an endpoint or documented manual process), minimum age statement. Make the go/no-go decision explicit in the checklist.
- **Expected output:** `docs/launch-checklist.md` fully ticked, policy pages, account deletion path, production environment ready.
- **Testing requirements:** account deletion removes personal data while preserving anonymized match integrity (decide and test: for example match records keep a placeholder player); the rollback rehearsal is performed on production-like infrastructure.
- **Acceptance criteria:** every checklist item ticked or consciously waived with a note.
- **Relevant skills:** baseline; `/deploy-checklist`; `/incident-response`.
- **Documentation updates:** `docs/launch-checklist.md`, `RUNBOOK.md`, `README.md`.

### M11-T06 Public launch and feedback loop

- **Objective:** launch, watch, and turn feedback into the next plan.
- **Description:** release `v1.0.0`, monitor the first week, intake feedback into the post-launch backlog.
- **Prerequisites:** M11-T05.
- **Implementation guidance:** tag `v1.0.0`, deploy through the normal pipeline during a time you can watch, announce through the channels you chose, and monitor dashboards and error reports daily for the first week with a written triage policy (severity levels and response targets). Collect feedback in one place, group it, and feed it into `ROADMAP.md`. For each Phase 10 item (P10-A to P10-H in the roadmap plan), start a `/brainstorming` session and a spec before planning, in the order your data supports: the likely first is versus-with-attacks, or scale-out (P10-F) if capacity becomes the constraint. Write a short retrospective and update `ARCHITECTURE.md` with what the real world taught you.
- **Expected output:** `v1.0.0` tag and release notes, triage policy, first-week log, retrospective, updated backlog.
- **Testing requirements:** post-deploy smoke test and synthetic checks pass; first-week error budget reviewed.
- **Acceptance criteria:** launched; retrospective and prioritized post-launch backlog committed; tag `m11-complete`.
- **Relevant skills:** baseline; `/deploy-checklist`; `/incident-response`; `/brainstorming` for the next items; `/requesting-code-review`.
- **Documentation updates:** `CHANGELOG.md`, `ROADMAP.md`, `README.md`, `ARCHITECTURE.md`, `DECISIONS.md`.
