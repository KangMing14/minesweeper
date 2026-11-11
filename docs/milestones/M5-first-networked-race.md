# M5 First Networked Race

**Goal:** two browsers race on an identical board through an authoritative server, on localhost and across a LAN.
**Depends on:** M4. **Brief phases:** 5 and 6 (first half).
**Baseline skills for every task:** `/test-driven-development`, `/verification-before-completion`. Run `/requesting-code-review` at milestone end; use `/systematic-debugging` for synchronization bugs (this is the highest-risk milestone). Use `/system-design` before T04 if the match/connection model needs rethinking.

## Conversation Handoff Package

1. **Project context.** Browser-based competitive Minesweeper in TypeScript, OOP, pnpm monorepo (`packages/engine`, `packages/protocol`, `apps/server`, `apps/web`). MVP: 1v1 race on an identical seeded board with a guaranteed shared safe opening. The server is authoritative: it holds the real board, runs the engine, and sends clients only revealed cells; mine positions never leave the server mid-match. Clients may pipeline commands. `RemoteSession` implements the same `GameSession` interface as `LocalSession`.
2. **Tasks:** M5-T01 to M5-T08, in order.
3. **Prerequisites and baseline:** tag `m4-complete`. Copy the actual exported signatures of `GameMode`, `ModeRegistry`, `RaceMode`, `createGame`, `Game`, `GameEvent`, `GameView`, `Command`, `ReplayLog`, and the web `GameSession`, `PlayerAction`, `LocalSession` before starting.
4. **Locked decisions:** ADR-001..010; Fastify + `ws` in one process (no framework like Colyseus); Zod for all message validation; single-round matches (D-03); server timestamps each command on receipt as `t = serverNow - match.startedAtServerMs`; no Redis; in-memory match storage for now.
5. **Deliverables:** protocol schemas, `Transport` abstraction with in-memory and WebSocket implementations, server skeleton, `Match` state machine and `MatchManager`, authoritative command handling, `RemoteSession`, lobby UI, LAN end-to-end test.
6. **Acceptance:** two browser contexts create and join a match by code, race, and receive the same winner; an automated leak test proves no mine information is sent before game over; the race also works from a second device on the LAN.
7. **Skills:** baseline; `/system-design`; `/code-review` on T05 (security-sensitive); `/frontend-design` for T07.
8. **Documents:** spec sections 4.3, 4.4 and 4.6; `ARCHITECTURE.md`. Update: `ARCHITECTURE.md` (protocol, server, remote session, known limit D-10), `DEVELOPMENT_GUIDE.md` (running server and LAN), `ROADMAP.md`, `CHANGELOG.md`. In this milestone switch `eslint-plugin-jsdoc` to `error` for `apps/*` (M5-T03).

**Message vocabulary fixed for this milestone** (field names are canonical):
- Client to server: `hello { protocol: number; resumeToken?: string }`, `create { modeId: ModeId; preset: string }`, `join { code: string }`, `ready {}`, `cmd { seq: number; action: PlayerAction }`.
- Server to client: `welcome { playerId: string; resumeToken: string; serverTimeMs: number }`, `lobby { code: string; players: { id: string; ready: boolean }[] }`, `countdown { startsAtServerMs: number }`, `started { config: BoardConfig; startedAtServerMs: number; view: GameView }`, `delta { ackSeq: number; events: GameEvent[]; tMs: number }`, `opponentProgress { revealed: number }`, `result { outcome: MatchOutcome; results: PlayerResult[] }`, `error { code: string; message: string }`.
- All encoded as JSON text frames via `encodeMessage`/`decodeMessage`; maximum frame size 4 KB for client messages.

---

### M5-T01 Protocol package

- **Objective:** one validated message vocabulary shared by client and server.
- **Description:** Zod schemas, inferred types, encode/decode helpers, and the replay-log schema.
- **Prerequisites:** M4.
- **Implementation guidance:** `PROTOCOL_VERSION = 1`. `ClientMessageSchema` and `ServerMessageSchema` as discriminated unions on `type`. `decodeMessage(raw: string, schema)` returns a typed message or a `ProtocolError` (invalid JSON, oversize, unknown type, schema violation) and never throws on hostile input. Add `ReplayLogSchema` mirroring the engine's `ReplayLog`, with bounds (command count, index range). Reuse engine types where possible; do not duplicate engine logic. Settle in this task whether `protocol` may import engine values (for example constants for the `ReplayLogSchema` bounds) or only types, then make spec 4.1, ADR-001's wording in `ARCHITECTURE.md` and the lint rule agree (`import type` enforcement if types only).
- **Expected output:** `packages/protocol/src/` messages, schemas, codec, tests; exports from `index.ts`; API-surface test.
- **Testing requirements:** every message type round-trips; each of: invalid JSON, 5 KB frame, missing field, wrong type, extra unknown type, negative `seq`, non-integer index is rejected with a `ProtocolError`; fuzz test: random strings never throw.
- **Acceptance criteria:** tests pass; TypeDoc clean.
- **Relevant skills:** baseline.
- **Documentation updates:** `ARCHITECTURE.md` (message table); TSDoc.

### M5-T02 Transport abstraction

- **Objective:** make networking testable without sockets.
- **Description:** `Transport` interface with in-memory and WebSocket implementations.
- **Prerequisites:** M5-T01.
- **Implementation guidance:** `interface Transport { send(message: string): void; onMessage(handler: (message: string) => void): void; onClose(handler: (code: number) => void): void; close(code?: number): void; readonly isOpen: boolean }` in `protocol`. `InMemoryTransport.pair()` returns two linked transports with configurable synchronous or microtask delivery. `WebSocketTransport` (browser) and a server-side wrapper over `ws` live in the apps.
- **Expected output:** `protocol/src/transport.ts`, `in-memory-transport.ts`, `apps/web/src/net/WebSocketTransport.ts`, `apps/server/src/net/ServerSocket.ts`, tests.
- **Testing requirements:** in-memory pair delivers in order; closing one side closes the other and fires `onClose`; sending after close throws or is ignored consistently (document which); WebSocket adapters tested against a local `ws` server.
- **Acceptance criteria:** tests pass.
- **Relevant skills:** baseline.
- **Documentation updates:** TSDoc; `ARCHITECTURE.md` (Adapter use).

### M5-T03 Server skeleton

- **Objective:** a running server that accepts WebSocket connections and exposes health.
- **Description:** Fastify app, config, logging, `ws` upgrade endpoint, graceful shutdown.
- **Prerequisites:** M5-T02.
- **Implementation guidance:** config via a Zod-validated environment schema (`PORT`, `HOST`, `ALLOWED_ORIGINS`, `LOG_LEVEL`); pino logging with request and connection IDs; `GET /health`; `/ws` endpoint with origin check; each connection becomes a `Transport`. Graceful shutdown closes sockets with code 1001. Bind to `0.0.0.0` only when configured (LAN testing). Flip `eslint-plugin-jsdoc` to `error` for `apps/*` and fix warnings.
- **Expected output:** `apps/server/src/main.ts`, `config.ts`, `app.ts`, `.env.example`, tests.
- **Testing requirements:** health check responds; invalid config fails fast with a readable message; a disallowed origin is rejected; shutdown closes connections; no unhandled rejections on abrupt client disconnect.
- **Acceptance criteria:** `pnpm --filter server dev` starts; tests pass; lint at `error` for apps.
- **Relevant skills:** baseline.
- **Documentation updates:** `DEVELOPMENT_GUIDE.md` (running the server); `README.md`; `.env.example`.

### M5-T04 `Match` state machine and `MatchManager`

- **Objective:** the server's model of a race.
- **Description:** State-pattern `Match`, in-memory `MatchManager`, join codes.
- **Prerequisites:** M5-T03.
- **Implementation guidance:** `MatchState` implementations `LobbyState`, `CountdownState`, `PlayingState`, `FinishedState` (disconnect handling arrives in M6). `MatchManager.create(modeId, preset): Match` generates a short join code (unambiguous alphabet, 6 characters, collision-checked), `join(code, player): Match`, `get(code)`, `remove`. Inject `ServerClock { nowMs(): number }` and an RNG for seeds (`crypto.randomInt`) so tests are deterministic. Matches hold at most two players; extra joiners get an `error`. Settle D-03 as single-round in a comment and `DECISIONS.md`. Run `/system-design` first if the object model feels wrong.
- **Expected output:** `apps/server/src/match/` (`match.ts`, `states/*.ts`, `match-manager.ts`), tests.
- **Testing requirements:** legal and illegal transitions; third player rejected; join with an unknown code rejected; both ready moves to countdown; code collisions retried; completed matches removed after a configurable TTL.
- **Acceptance criteria:** tests pass with a fake clock; no timers left running after `remove`.
- **Relevant skills:** baseline; `/system-design`.
- **Documentation updates:** `ARCHITECTURE.md` (match lifecycle as implemented), `DECISIONS.md`.

### M5-T05 Authoritative command handling

- **Objective:** the heart of fairness and security.
- **Description:** validate and apply `cmd` messages, send deltas and progress, finish the match.
- **Prerequisites:** M5-T04.
- **Implementation guidance:** on `cmd`: decode, check the match is `Playing`, check `seq` is exactly the player's last `seq + 1` (duplicates are re-acked without effect; gaps rejected; full semantics hardened in M6-T01), stamp `t` from the server clock, call the player's `Game.apply`, send `delta` to the actor (events plus `ackSeq` and `tMs`) and `opponentProgress { revealed }` to the opponent. The opponent never receives cell values or indices. On a finish or DNF, compute `PlayerResult` via the mode and, once both are final (or one wins and the other is still playing, per ADR-010), call `decide` and send `result` to both, with the finished game's `exposedMines` only inside that player's own view and only once the release rule of D-14 (ADR-010) allows it; `delta` and `opponentProgress` never carry mine data, even after a DNF. Commands before `Playing` or after a player's game ended are rejected without state change (Review Focus #2). Do not log raw user input verbatim at info level.
- **Expected output:** `apps/server/src/match/command-handler.ts`, wiring into `PlayingState`, tests.
- **Testing requirements:** with `InMemoryTransport`, a scripted race completes with the expected `result`; **leak test:** serialize every outbound frame of a full game and assert that before the match result is final for both players (D-14) no frame to either client contains a mine index, including the `delta` that reports a player's own DNF or an unrevealed cell value (scan messages for fields beyond the allowed shape); commands before start rejected; commands after finish rejected; duplicate `seq` is idempotent; schema-invalid frames are dropped with an `error` and the connection survives; tie on equal `tMs` resolves per ADR-010.
- **Acceptance criteria:** tests pass; `/code-review` run with findings resolved.
- **Relevant skills:** baseline; `/code-review`; `/systematic-debugging`.
- **Documentation updates:** `ARCHITECTURE.md` (authoritative flow), spec cross-reference, TSDoc.

### M5-T06 `RemoteSession` and `ViewMirror`

- **Objective:** the client side of the same `GameSession` interface.
- **Description:** implement `RemoteSession` over `Transport`, with a view mirror that applies server events.
- **Prerequisites:** M5-T05.
- **Implementation guidance:** `new RemoteSession(transport: Transport, clock: Clock)`. `dispatch(action)` assigns the next `seq`, sends `cmd`, and keeps the command in a pending queue (pipelining: do not wait for acks). `ViewMirror` applies `CellsRevealed`, `FlagToggled`, `GameWon`, `GameLost` events to a local `GameView`; flags are applied locally immediately (they are not hidden information) and reconciled on `delta`. `elapsedMs()` uses an estimated offset from `welcome.serverTimeMs` and the countdown start. `subscribe`, `view`, `result` as in the interface. Errors from the server surface as a session event or callback (`onError`).
- **Expected output:** `apps/web/src/session/RemoteSession.ts`, `ViewMirror.ts`, tests.
- **Testing requirements:** with an in-memory server pair, a scripted game yields the same final `GameView` as `LocalSession` for the same seed; pipelined commands (five dispatches before any ack) are applied in order; out-of-order or duplicate deltas are ignored safely; `dispose()` closes the transport; the UI components from M3 run unchanged against `RemoteSession`.
- **Acceptance criteria:** tests pass; no UI file imports `RemoteSession` directly (only through `GameSession`).
- **Relevant skills:** baseline.
- **Documentation updates:** `ARCHITECTURE.md` (session adapters); TSDoc.

### M5-T07 Lobby UI

- **Objective:** a usable flow from menu to a live race.
- **Description:** create or join by code, ready up, countdown, race, result.
- **Prerequisites:** M5-T06.
- **Implementation guidance:** screens: "Create match", "Join match" (code input), lobby (players and ready state, copyable code), countdown overlay driven by `countdown.startsAtServerMs`, race screen reusing the ghost race layout with the opponent's `opponentProgress` as a bar, result screen from `result`. Connection status indicator. Copy written with `/ux-copy`. Server URL from build-time config.
- **Expected output:** `src/screens/lobby/`, `src/net/connect.ts`, tests.
- **Testing requirements:** component tests with an in-memory server; error states (invalid code, full match, connection refused) display useful messages; the race screen never shows opponent cell data.
- **Acceptance criteria:** manual two-tab race works.
- **Relevant skills:** baseline; `/frontend-design`; `/ux-copy`.
- **Documentation updates:** `README.md` (how to play a LAN race), `ARCHITECTURE.md`.

### M5-T08 LAN end-to-end test and latency measurement

- **Objective:** prove the first networked race works for real, and measure it.
- **Description:** Playwright two-context race plus a documented LAN run and latency numbers.
- **Prerequisites:** M5-T07.
- **Implementation guidance:** Playwright starts the server and the built client; two browser contexts create, join, ready, race with the engine-driven strategy from M3-T08 (one player clears the board, the other stops), and assert both see the same result. Add timing instrumentation: log round-trip `cmd` to `delta` latency per command; the test reports p50 and p95 on localhost. Manually run on a second device over Wi-Fi (server bound to `0.0.0.0`) and record results in `ARCHITECTURE.md` under "Known limits (D-10)".
- **Expected output:** `e2e/race.spec.ts`, CI job, latency note, LAN instructions.
- **Testing requirements:** the e2e test passes in CI; localhost p95 under 50 ms (a sanity bound, not the production target of 150 ms regional).
- **Acceptance criteria:** CI green; manual LAN run documented; tag `m5-complete` after review.
- **Relevant skills:** baseline; `/requesting-code-review`.
- **Documentation updates:** `ARCHITECTURE.md` (D-10 measurement), `DEVELOPMENT_GUIDE.md`, `ROADMAP.md`, `CHANGELOG.md`.
