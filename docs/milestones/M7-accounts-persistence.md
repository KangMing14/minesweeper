# M7 Accounts and Persistence

**Goal:** guests and registered players, durable matches and replays, profiles with statistics, and match history.
**Depends on:** M5 (T01 may start earlier; the ranked features need M6 in M8). **Brief phase:** 6 (accounts and authentication) and 7 (match results, statistics, history).
**Baseline skills for every task:** `/test-driven-development`, `/verification-before-completion`. Run `/requesting-code-review` at milestone end. Use `/code-review` for T02 (security-sensitive).

## Conversation Handoff Package

1. **Project context.** Browser-based competitive Minesweeper in TypeScript, OOP, pnpm monorepo (`packages/engine`, `packages/protocol`, `apps/server`, `apps/web`). MVP: 1v1 race plus solo time-attack, leaderboards, rated 1v1. Server is authoritative and runs the engine. Persistence sits behind Repository interfaces so domain code never touches SQL. Better Auth (self-hosted) provides accounts and guest sessions on PostgreSQL via Drizzle.
2. **Tasks:** M7-T01 to M7-T07, in order.
3. **Prerequisites and baseline:** tag `m5-complete` (and `m6-complete` before M8). Copy the actual exported signatures of `Match`, `MatchManager`, protocol message schemas, `PlayerResult`, `MatchOutcome`, `ReplayLog`, `GameResult` before starting.
4. **Locked decisions:** ADR-001..011; PostgreSQL + Drizzle; Better Auth (re-verified in ADR-005; fallback documented there); Repository pattern with in-memory fakes; replay logs stored as JSON; ADR-012 (auth methods, D-07) is written in T02: guests plus email/password at launch, OAuth providers undecided.
5. **Deliverables:** database tooling and migrations, auth integration with guests, repositories with a shared contract test suite, persisted matches and replays, stats service and endpoints, history endpoint, account UI.
6. **Acceptance:** a guest plays a race, registers, and sees the match in their history after reload; the repository contract tests pass against both the in-memory fake and PostgreSQL; WebSocket connections are tied to an authenticated or guest identity.
7. **Skills:** baseline; `/code-review` (T02, T04); `/frontend-design` (T07); `/ux-copy` (T07).
8. **Documents:** spec sections 4.3 and 5; `ARCHITECTURE.md`. Update: `ARCHITECTURE.md` (data model, auth), `DECISIONS.md` (ADR-012), `.env.example`, `ROADMAP.md`, `CHANGELOG.md`.

---

### M7-T01 PostgreSQL, Drizzle and migrations

- **Objective:** a reproducible database foundation.
- **Description:** local Postgres via Docker Compose, Drizzle setup, migration workflow, CI service.
- **Prerequisites:** M5-T03.
- **Implementation guidance:** `docker-compose.yml` with Postgres; Drizzle config and schema folder; migrations generated and committed; scripts `db:generate`, `db:migrate`, `db:reset`. CI uses a Postgres service container. Connection config through the server's Zod environment schema (`DATABASE_URL`). A single migration creating a `schema_info` table proves the pipeline. Policy: migrations are forward-only and run automatically on deploy (M9).
- **Expected output:** `docker-compose.yml`, `apps/server/src/db/` (client, schema index), `drizzle/` migrations, CI changes.
- **Testing requirements:** a test applies all migrations to an empty database and queries `schema_info`; `db:reset` followed by `db:migrate` is idempotent.
- **Acceptance criteria:** tests pass locally and in CI.
- **Relevant skills:** baseline.
- **Documentation updates:** `DEVELOPMENT_GUIDE.md` (database workflow), `ARCHITECTURE.md`, `.env.example`.

### M7-T02 Better Auth integration with guests (ADR-012)

- **Objective:** identities for everyone who connects.
- **Description:** integrate Better Auth with the anonymous-session plugin and email/password.
- **Prerequisites:** M7-T01.
- **Implementation guidance:** mount Better Auth on Fastify with the Drizzle adapter; cookie sessions (`HttpOnly`, `Secure` outside local dev, `SameSite=Lax`). Guests get an anonymous user on first visit; registering upgrades that user to a full account without losing history. WebSocket handshake reads the session cookie and assigns `playerId` (replacing the placeholder from M5). Add `GET /api/me`. Choose and record auth methods in ADR-012 (D-07). Re-check Better Auth's release and advisory status first; if ADR-005's fallback applies, follow it. Use `/code-review` on cookie, CSRF and origin handling.
- **Expected output:** `apps/server/src/auth/`, routes, migrations, `docs/adr/ADR-012-auth-methods.md`, tests.
- **Testing requirements:** guest session created and reused; guest upgrade keeps the same user id; invalid and expired sessions rejected; WebSocket with no cookie gets a guest identity or is refused as configured; cross-origin cookie use rejected; passwords never logged.
- **Acceptance criteria:** tests pass; review findings resolved; ADR committed.
- **Relevant skills:** baseline; `/code-review`; `/architecture`.
- **Documentation updates:** `DECISIONS.md`, `ARCHITECTURE.md` (auth flow), `.env.example`.

### M7-T03 Repositories and in-memory fakes

- **Objective:** persistence behind interfaces with a shared contract suite.
- **Description:** define repositories, Drizzle implementations, fakes, and a contract test suite run against both.
- **Prerequisites:** M7-T02.
- **Implementation guidance:** interfaces in `apps/server/src/repo/`: `UserRepository` (`getProfile(userId)`, `updateDisplayName`), `MatchRepository` (`save(match: MatchRecord): Promise<void>`, `getById`, `listForPlayer(userId, cursor?, limit)`), `ReplayRepository` (`save(matchId, playerId, log: ReplayLog): Promise<void>`, `get(matchId, playerId)`). Schema: `matches`, `match_players`, `replays`. Write the contract suite once as a function taking a repository factory; run it against `InMemory*` and `Drizzle*` implementations. Saves are idempotent on `matchId`.
- **Expected output:** `repo/*.ts`, `repo/memory/*.ts`, `repo/drizzle/*.ts`, migrations, `repo/contract/*.ts`.
- **Testing requirements:** every contract case passes on both implementations; idempotent save; pagination stable and ordered by time then id; missing records return `null`, not exceptions.
- **Acceptance criteria:** tests pass in CI with the Postgres service.
- **Relevant skills:** baseline.
- **Documentation updates:** `ARCHITECTURE.md` (data model diagram), TSDoc.

### M7-T04 Persist matches and replays

- **Objective:** every completed match is stored.
- **Description:** write results and replay logs when a match finishes.
- **Prerequisites:** M7-T03, M6.
- **Implementation guidance:** on `FinishedState`, build a `MatchRecord` (mode, preset, seed, per-player `PlayerResult`, `MatchOutcome`, timestamps, player ids) and each player's `ReplayLog` from `Game.log()`; persist asynchronously with retry and structured error logging. A persistence failure must never block or alter the `result` sent to clients. Enforce size and command-count caps (reuse `validateReplayLog`). Guests' matches are stored under their guest id. Use `/code-review` for the failure paths.
- **Expected output:** `apps/server/src/match/persistence.ts`, wiring, tests.
- **Testing requirements:** finished match appears in the repository with correct fields; repository failure leaves the clients' result unchanged and logs an error; duplicate finish events save once; replay stored equals the engine log and passes `validateReplayLog`.
- **Acceptance criteria:** tests pass.
- **Relevant skills:** baseline; `/code-review`.
- **Documentation updates:** `ARCHITECTURE.md` (persistence flow).

### M7-T05 Profiles and statistics

- **Objective:** server-side player stats replacing the local ones.
- **Description:** `StatsService` and profile endpoint.
- **Prerequisites:** M7-T04.
- **Implementation guidance:** `StatsService.forPlayer(userId): Promise<PlayerStats>` with games, wins, losses, draws, best time per preset, average 3BV/s, and current streak, computed from stored matches (aggregate SQL or a materialized table updated on save; start with SQL aggregates and add caching only if measured). `GET /api/players/:id` returns public profile fields only (display name, stats). Display names validated (length, characters) and unique-enough handling documented.
- **Expected output:** `stats/stats-service.ts`, route, tests.
- **Testing requirements:** stats from a fixture set of matches match hand-computed values; players with no matches get zeros and nulls; unknown id returns 404; response contains no email or internal fields.
- **Acceptance criteria:** tests pass.
- **Relevant skills:** baseline.
- **Documentation updates:** `ARCHITECTURE.md`, API notes in `DEVELOPMENT_GUIDE.md`.

### M7-T06 Match history

- **Objective:** browsable history for each player.
- **Description:** `GET /api/players/:id/matches` with cursor pagination.
- **Prerequisites:** M7-T05.
- **Implementation guidance:** items include opponent display name, mode, preset, outcome from the player's view, times, date. Cursor based on `(finishedAt, matchId)`; limit default 20, maximum 50. Replays are not returned inline; include a `hasReplay` flag.
- **Expected output:** route, serializer, tests.
- **Testing requirements:** pagination covers all items exactly once across pages; limit clamped; deleted or unknown opponent handled; ordering stable with equal timestamps.
- **Acceptance criteria:** tests pass.
- **Relevant skills:** baseline.
- **Documentation updates:** `DEVELOPMENT_GUIDE.md` (API reference).

### M7-T07 Client account UI

- **Objective:** players can sign in and see their data.
- **Description:** auth flows, profile page, history list, replacing local stats display.
- **Prerequisites:** M7-T06.
- **Implementation guidance:** sign up, sign in, sign out, "save your progress" prompt for guests; profile page with stats; history list with pagination; handle expired sessions gracefully. Local stats from M3 are kept only for offline solo play and merged display is out of scope. Copy through `/ux-copy`; layout through `/frontend-design`.
- **Expected output:** `src/screens/account/`, `src/api/` client with typed responses (Zod parse of server responses), tests, e2e extension (guest plays, registers, sees history).
- **Testing requirements:** component tests for each state (loading, error, empty, data); e2e flow in Playwright; API client rejects malformed server responses.
- **Acceptance criteria:** CI green; tag `m7-complete` after review.
- **Relevant skills:** baseline; `/frontend-design`; `/ux-copy`; `/requesting-code-review`.
- **Documentation updates:** `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `CHANGELOG.md`.
