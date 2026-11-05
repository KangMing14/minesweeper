# M6 Match Lifecycle and Reconnection

**Goal:** a networked race that survives dropped connections, duplicate tabs, retransmissions and disconnects at awkward moments.
**Depends on:** M5. **Brief phases:** 5 and 6 (disconnect/reconnection, match lifecycle).
**Baseline skills for every task:** `/test-driven-development`, `/verification-before-completion`. Use `/systematic-debugging` heavily. Run `/requesting-code-review` at milestone end.

## Conversation Handoff Package

1. **Project context.** Browser-based competitive Minesweeper in TypeScript, OOP, pnpm monorepo (`packages/engine`, `packages/protocol`, `apps/server`, `apps/web`). MVP: 1v1 race on an identical seeded board. The server is authoritative; clients pipeline commands with sequence numbers. The race clock never pauses: a player who disconnects keeps their slot for a grace period but loses time while away (spec section 4.4).
2. **Tasks:** M6-T01 to M6-T05, in order.
3. **Prerequisites and baseline:** tag `m5-complete`. Copy the actual exported signatures of `Match`, `MatchState`, `MatchManager`, the protocol message schemas, `Transport`, `InMemoryTransport`, `RemoteSession`, `ViewMirror` before starting.
4. **Locked decisions:** ADR-001..010; message vocabulary from M5; grace period working value 30 s (D-05, ADR-011 is written in M6-T03); the match state diagram in the spec (`PlayerDisconnected` state); single live connection per player.
5. **Deliverables:** acks and idempotent commands, resume tokens and snapshots, disconnect grace and forfeit, ready/countdown hardening, `FaultyTransport` and the fault-injection suite, ADR-011.
6. **Acceptance:** the fault-injection suite passes repeatedly (run 50 times in CI without flakes); a manual test of killing and restoring the network mid-race resumes correctly.
7. **Skills:** baseline; `/systematic-debugging`; `/code-review` on T02.
8. **Documents:** spec sections 4.4 and 4.7; `ARCHITECTURE.md`. Update: `ARCHITECTURE.md` (reconnection protocol), `DECISIONS.md` (ADR-011), `ROADMAP.md`, `CHANGELOG.md`.

**Protocol additions fixed for this milestone:** client `resume { resumeToken: string; lastAckSeq: number }`; server `snapshot { view: GameView; nextSeq: number; startedAtServerMs: number; opponentRevealed: number; matchState: string }`, `opponentStatus { connected: boolean }`, `ack { ackSeq: number }`.

---

### M6-T01 Sequencing, acks and pipelining semantics

- **Objective:** exact, tested rules for command ordering and retransmission.
- **Description:** harden `seq` handling on both sides.
- **Prerequisites:** M5.
- **Implementation guidance:** server rules: `seq` must equal `lastAppliedSeq + 1`; `seq <= lastAppliedSeq` is a duplicate (no effect, re-send `ack`); `seq > lastAppliedSeq + 1` is a gap (reject with `error { code: 'seq-gap' }`, do not apply); a burst limit applies later in M9-T03. Client rules: `RemoteSession` keeps unacked commands in order and, after reconnect, resends those above the server's `nextSeq`. Document that flags and reveals share one `seq` stream.
- **Expected output:** server and client changes, tests.
- **Testing requirements:** duplicate is idempotent; gap rejected and state unchanged (Review Focus #2); out-of-order delivery over a reordering transport results in either correct application or a clean error, never corrupted state; client resend after reconnect applies each command exactly once.
- **Acceptance criteria:** tests pass.
- **Relevant skills:** baseline; `/systematic-debugging`.
- **Documentation updates:** `ARCHITECTURE.md` (sequence rules); TSDoc.

### M6-T02 Resume tokens, snapshots and single-connection takeover

- **Objective:** let a player rejoin an in-progress match with consistent state.
- **Description:** implement `resume`, `snapshot`, and takeover.
- **Prerequisites:** M6-T01.
- **Implementation guidance:** `welcome.resumeToken` is a random, unguessable token bound to one player in one match, invalidated when the match ends. On `resume`, validate the token and `lastAckSeq`, send `snapshot` (the player's own `GameView`, never the opponent's cell data), then continue. If a live connection exists for that player (for example a second tab), close the old socket with code 4000 (`replaced`) and accept the new one (Review Focus #5). Tokens are compared in constant time. Use `/code-review` because this is security-sensitive.
- **Expected output:** `apps/server/src/match/resume.ts`, client reconnect logic in `RemoteSession` (backoff: 250 ms doubling to 4 s, with jitter), tests.
- **Testing requirements:** reconnect mid-game restores the identical view; stale or forged tokens rejected; reuse after match end rejected; second connection takes over and exactly one socket remains open; the replaced client shows a clear message and does not reconnect-loop.
- **Acceptance criteria:** tests pass; code review findings resolved.
- **Relevant skills:** baseline; `/code-review`.
- **Documentation updates:** `ARCHITECTURE.md` (resume flow diagram), `DEVELOPMENT_GUIDE.md`.

### M6-T03 Disconnect grace period and forfeit (ADR-011)

- **Objective:** deterministic handling of players who drop.
- **Description:** add the `PlayerDisconnected` handling and forfeit rules.
- **Prerequisites:** M6-T02.
- **Implementation guidance:** when a player's transport closes during `Playing`, mark the slot held and start a grace timer (default 30 s, configurable), notify the opponent with `opponentStatus { connected: false }`; the race clock keeps running. If the player resumes in time, send `snapshot` and `opponentStatus { connected: true }` to the opponent. On expiry, forfeit: that player's `PlayerResult.outcome` is `'forfeit'` and `RaceMode.decide` produces the outcome. If both players are gone, end the match as a draw after the grace period. Disconnect in `Lobby` removes the player; in `Countdown` it is covered by T04. Record the grace value and reasoning in ADR-011 (D-05).
- **Expected output:** `PlayerDisconnected` handling in `PlayingState`, config value, `docs/adr/ADR-011-disconnect-policy.md`, tests with a fake clock.
- **Testing requirements:** resume at 29 s keeps the match alive; at 31 s the match ended in forfeit; opponent notifications; both disconnected gives a draw; a player who wins while the opponent is disconnected gets the win; no timers leak after the match ends.
- **Acceptance criteria:** tests pass; ADR-011 committed.
- **Relevant skills:** baseline; `/architecture`.
- **Documentation updates:** `DECISIONS.md`, `ARCHITECTURE.md`, `PROJECT_OVERVIEW.md` (player-facing rules).

### M6-T04 Ready and countdown hardening

- **Objective:** a start sequence that cannot be exploited or broken.
- **Description:** synchronized countdown, early-command rejection, lobby edge cases.
- **Prerequisites:** M6-T03.
- **Implementation guidance:** the server sets `startsAtServerMs = now + 3000` when both players are ready and broadcasts `countdown`; commands received before `startsAtServerMs` are rejected with `error { code: 'not-started' }` and do not consume a `seq` (Review Focus #2). Clients render the countdown from the server timestamp. If a player disconnects during the countdown and resumes before it ends, they continue; if they do not return by start time plus the grace period, forfeit. A player un-readying cancels the countdown. Leaving the lobby deletes an empty match after a TTL (Review Focus #5 for reconnect during countdown).
- **Expected output:** `CountdownState` changes, client countdown component updates, tests.
- **Testing requirements:** command at `startsAt - 1 ms` rejected, at `startsAt` accepted; un-ready cancels; disconnect and resume during countdown; two ready signals arriving simultaneously start exactly one countdown.
- **Acceptance criteria:** tests pass.
- **Relevant skills:** baseline.
- **Documentation updates:** `ARCHITECTURE.md`.

### M6-T05 `FaultyTransport` and the fault-injection suite

- **Objective:** repeatable proof that lifecycle logic survives bad networks.
- **Description:** wrap `Transport` with controllable faults and write the scenario suite.
- **Prerequisites:** M6-T04.
- **Implementation guidance:** `FaultyTransport` (in `protocol`) wraps a `Transport` with deterministic, seedable faults: drop probability, duplicate probability, reordering window, added delay, and `disconnectAt(n)` after n messages. Scenarios: mid-game drop and resume; drop exactly at the finishing command (Review Focus #5); both players finish within 1 ms of server time with a tie (Review Focus #3); duplicate and reordered `cmd` frames; second tab takeover; flapping connection (five drops in 10 s); resume after the match ended. Run the suite 50 times with different fault seeds in a nightly CI job.
- **Expected output:** `protocol/src/faulty-transport.ts`, `apps/server/test/faults/*.spec.ts`, nightly workflow.
- **Testing requirements:** the suite itself; each scenario asserts the final `result` is identical to a fault-free run (except forfeits) and that exactly one result is emitted per match.
- **Acceptance criteria:** 50 consecutive seeded runs pass in CI; tag `m6-complete` after review.
- **Relevant skills:** baseline; `/testing-strategy`; `/systematic-debugging`; `/requesting-code-review`.
- **Documentation updates:** `DEVELOPMENT_GUIDE.md` (running fault tests), `ROADMAP.md`, `CHANGELOG.md`.
