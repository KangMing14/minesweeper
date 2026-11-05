# M9 Staging Deployment and Hardening

**Goal:** a deployed, observable staging environment with rate limits, anti-cheat heuristics, a completed security review, and an operations runbook.
**Depends on:** M8 (T01 may start after M5). **Brief phases:** 6 (deployment infrastructure), 7 (basic anti-cheat), 9 (security review, deployment).
**Baseline skills for every task:** `/verification-before-completion`; `/test-driven-development` where code is written. Run `/requesting-code-review` at milestone end. Use `/deploy-checklist` in T02 and T06; `/code-review` in T03 to T05.

## Conversation Handoff Package

1. **Project context.** Browser-based competitive Minesweeper in TypeScript, OOP, pnpm monorepo (`packages/engine`, `packages/protocol`, `apps/server`, `apps/web`). Single Node process (Fastify + `ws`), PostgreSQL via Drizzle, static React client. Solo developer; small public launch first, no Redis or multi-instance setup before launch. Rated 1v1 races and replay-validated solo leaderboards exist (M8).
2. **Tasks:** M9-T01 to M9-T06, in order.
3. **Prerequisites and baseline:** tag `m8-complete`. Copy the actual config schema from `apps/server/src/config.ts`, the list of HTTP routes and WebSocket message types, and the `ReplayValidator` failure codes before starting.
4. **Locked decisions:** ADR-001..013; single-container deployment on a VPS or PaaS with managed Postgres; client served as static files from a CDN or the same host; migrations are forward-only and run on deploy; ADR-014 (hosting, D-09) is written in T02; solver bots cannot be detected in the MVP and are recorded as a known limit.
5. **Deliverables:** production Dockerfiles and build, staging environment with CD, rate limiting and limits, anti-cheat flags and an audit tool, completed security review with findings fixed or ticketed, backups, restore drill and runbook.
6. **Acceptance:** staging is reachable over HTTPS/WSS; a race and a ranked match complete there; abusive clients are throttled; flagged runs are excluded from leaderboards pending review; a database restore from backup has been demonstrated.
7. **Skills:** baseline; `/deploy-checklist`; `/code-review`; `/incident-response` (T06 runbook template); `/architecture` for ADR-014.
8. **Documents:** spec sections 5 and 9; `ARCHITECTURE.md`. Update: `ARCHITECTURE.md` (deployment), `DECISIONS.md` (ADR-014), new `RUNBOOK.md`, `DEVELOPMENT_GUIDE.md`, `ROADMAP.md`, `CHANGELOG.md`.

---

### M9-T01 Production build and container images

- **Objective:** reproducible production artifacts.
- **Description:** multi-stage Dockerfile for the server, static client build, environment documentation, health and readiness endpoints.
- **Prerequisites:** M5-T03 (can start earlier).
- **Implementation guidance:** build the workspace with pnpm, prune to production dependencies, run as a non-root user, pin the base image digest, set `NODE_ENV=production`. `GET /health` (liveness) and `GET /ready` (checks database connectivity). Migrations run as a separate command or entrypoint step before the server starts. Client build uses a build-time server URL; hashed asset filenames. Document every environment variable in `.env.example` and in `RUNBOOK.md`.
- **Expected output:** `Dockerfile`, `.dockerignore`, build scripts, readiness route, tests for readiness.
- **Testing requirements:** the image builds in CI; a container smoke test starts it against a Postgres service and checks `/health` and `/ready`; readiness fails when the database is unreachable; the container runs as a non-root user (asserted).
- **Acceptance criteria:** CI builds and smoke-tests the image.
- **Relevant skills:** baseline; `/deploy-checklist`.
- **Documentation updates:** `DEVELOPMENT_GUIDE.md`, `RUNBOOK.md` (first draft), `.env.example`.

### M9-T02 Staging environment and continuous delivery (ADR-014)

- **Objective:** one-command, repeatable deployment to a real environment.
- **Description:** choose hosting, provision staging, deploy automatically.
- **Prerequisites:** M9-T01.
- **Implementation guidance:** compare two or three hosts against: WebSocket support, cost at small scale, managed Postgres, region near the first players, ease of rollback. Record the choice and alternatives in ADR-014 (D-09). Provision staging with secrets in the host's secret store, TLS, and a proxy configuration that supports WebSocket upgrades and long-lived connections (set idle timeouts above the heartbeat interval; add a server ping every 25 s). GitHub Actions deploys on merge to `main` to staging and requires a manual approval for production later. Add a post-deploy smoke test (health, a WebSocket handshake). Keep a rollback command documented. Use `/deploy-checklist`.
- **Expected output:** deployment workflow, infrastructure notes, `docs/adr/ADR-014-hosting.md`, smoke test script.
- **Testing requirements:** a deploy from `main` reaches staging and passes the smoke test; a deliberately failing smoke test blocks promotion; rollback to the previous image is demonstrated once.
- **Acceptance criteria:** staging live; ADR committed; secrets absent from the repository (verified by a secret-scanning step in CI).
- **Relevant skills:** baseline; `/deploy-checklist`; `/architecture`.
- **Documentation updates:** `DECISIONS.md`, `RUNBOOK.md`, `ARCHITECTURE.md` (deployment diagram).

### M9-T03 Rate limiting and message limits

- **Objective:** make abuse expensive.
- **Description:** per-connection, per-account and per-IP limits across HTTP and WebSocket.
- **Prerequisites:** M9-T02.
- **Implementation guidance:** HTTP: Fastify rate-limit plugin with stricter limits on auth and `solo/submit`. WebSocket: token bucket per connection on messages (default burst 30, refill 20 per second, tuned so legitimate chord-heavy play never trips it), maximum frame size already enforced by the protocol, maximum connections per IP and per account, idle and unauthenticated connection timeouts, origin check (from M5-T03) tested again. Exceeding limits sends `error { code: 'rate-limited' }` and, on sustained abuse, closes with code 4008. Make limits configurable and log violations with identifiers but no payloads. Use `/code-review`.
- **Expected output:** limiter modules, configuration, tests.
- **Testing requirements:** burst within budget is accepted; sustained flood throttled then disconnected; limits do not affect a recorded human-speed expert game replayed against the server (use the golden log); per-IP connection cap enforced; HTTP limits return 429 with `Retry-After`.
- **Acceptance criteria:** tests pass; limits documented with rationale.
- **Relevant skills:** baseline; `/code-review`.
- **Documentation updates:** `ARCHITECTURE.md` (limits table), `RUNBOOK.md` (tuning).

### M9-T04 Anti-cheat heuristics and audit tool

- **Objective:** catch obviously impossible performance and give yourself a way to review it.
- **Description:** soft flags on runs and matches plus an offline replay audit command.
- **Prerequisites:** M9-T03, M8-T01.
- **Implementation guidance:** compute per-run signals from the `ReplayLog`: minimum interval between consecutive commands, sustained commands per second, 3BV/s above a configured ceiling, perfectly regular timing (low variance of intervals), and first-command latency after start. Store `flags` (a list of reason codes) on `solo_runs` and `match_players`; flagged solo runs are excluded from leaderboards until reviewed; flagged ranked matches still count but are queued for review. Thresholds are constants in one file with comments explaining the data they were chosen from. Add `pnpm audit:replay <matchId|runId>` that prints signals and re-validates the log. Record in `DECISIONS.md` that solver bots playing at human speed are out of scope for detection in the MVP, along with mitigations (account requirement for ranked, rate limits, manual review).
- **Expected output:** `apps/server/src/anticheat/`, migration for `flags`, CLI script, tests with fixture logs (a human-like log, an impossible log, a perfectly regular log).
- **Testing requirements:** each signal fires on its fixture and not on the human fixture; leaderboards exclude flagged runs; the CLI output is deterministic.
- **Acceptance criteria:** tests pass; thresholds documented.
- **Relevant skills:** baseline; `/code-review`.
- **Documentation updates:** `DECISIONS.md`, `RUNBOOK.md` (review procedure), `ARCHITECTURE.md`.

### M9-T05 Security review

- **Objective:** a structured review of the attack surface before real users arrive.
- **Description:** walk a checklist, fix what is quick, ticket what is not.
- **Prerequisites:** M9-T04.
- **Implementation guidance:** cover: authentication and session cookie flags, CSRF protection for state-changing REST routes, authorization on every endpoint (players can only read what they should), input validation coverage (every route and WebSocket message has a schema), error messages that do not leak internals, dependency audit (`pnpm audit`) and update policy, secret scanning, HTTP security headers and a Content-Security-Policy for the client, CORS and origin settings, SQL injection (all queries parameterized through Drizzle), log hygiene (no secrets or full payloads), the authoritative-server leak test (rerun M5-T05's test on a full ranked flow), denial-of-service paths (large replay logs, many open runs). Use `/code-review` for each area and record findings in `docs/security-review.md` with severity and status. Critical and high findings are fixed in this task; others become tracked tasks in `ROADMAP.md`.
- **Expected output:** `docs/security-review.md`, fixes, new regression tests, CSP and headers configuration.
- **Testing requirements:** each fixed finding has a regression test; the leak test passes on ranked flow; an automated check confirms the security headers on staging.
- **Acceptance criteria:** no open critical or high findings; document committed.
- **Relevant skills:** baseline; `/code-review`; `/deploy-checklist`.
- **Documentation updates:** `docs/security-review.md`, `DECISIONS.md`, `ROADMAP.md`.

### M9-T06 Backups, migrations policy and runbook

- **Objective:** operate the service without panic.
- **Description:** automated backups with a tested restore, migration policy, runbook and incident template.
- **Prerequisites:** M9-T05.
- **Implementation guidance:** enable automated daily Postgres backups with a retention period; perform one restore into a scratch database and verify row counts and a sample match replay; document the migration policy (forward-only, backward-compatible changes in two steps, run before the new server starts). `RUNBOOK.md` covers: how to deploy and roll back, how to read logs, how to rotate secrets, how to review flagged runs, common failure modes (database down, WebSocket disconnect storms), and who to contact (yourself, plus hosting support). Add a blameless incident template based on `/incident-response`. Run `/deploy-checklist` against staging as a dry run for launch.
- **Expected output:** `RUNBOOK.md`, restore drill notes, incident template, backup configuration.
- **Testing requirements:** the restore drill is performed and recorded with date and result; a migration applied on staging from the previous schema succeeds without downtime for a connected test match.
- **Acceptance criteria:** drill documented; runbook reviewed; tag `m9-complete` after milestone review.
- **Relevant skills:** baseline; `/incident-response`; `/deploy-checklist`; `/requesting-code-review`.
- **Documentation updates:** `RUNBOOK.md`, `DEVELOPMENT_GUIDE.md`, `ROADMAP.md`, `CHANGELOG.md`.
