# ADR-003: Server-authoritative play

- Status: Accepted
- Date: 2026-11-09
- Task: M0-T06
- Settles: none

## Context

A race is only worth playing if neither player can cheat. In Minesweeper the strongest cheat is knowing where the mines are, and the next is sending results the server cannot check. If the browser held the real board during a networked match, anyone could read it from memory or the network. The design also has to be honest about what cannot be prevented: a program that plays by deduction looks like a very good human.

## Decision

The server holds the real board for every networked game and is the only authority on outcomes (spec section 4.1, principle 2).

- Clients receive only revealed cells. The acting player gets the newly revealed cells with their values; the opponent gets only a progress count. Mine positions never reach a client while a networked match is in progress (`CLAUDE.md`, rule 8).
- Every inbound message is validated against a Zod schema from `@minesweeper/protocol`, is size-limited and rate-limited, and is stamped with the server's receive time.
- Each player's commands go to that player's own `Game`, and the engine returns the events (the data flow in `ARCHITECTURE.md`, "Data flow: one race click").
- The server finalizes the result, persists the match with both command logs, and updates ratings. A ranked solo run is accepted only after the server replays its command log (ADR-002).

Local solo play is different by nature: `LocalSession` runs the engine in the browser (ADR-004), so that client knows its own board. In the ranked solo flow planned for M8-T02 the server issues the run and its seed at the start and the client plays it through `LocalSession`, so the protection there is replay validation, not secrecy: a result counts toward a leaderboard only after the server replays the command log. A client that precomputes or deduces its board is inside the solver-bot limit below.

## Consequences

- Mine positions cannot be read from a client during a networked match, and results cannot be forged, because the server derives them.
- Every click costs a round trip, so players with higher latency are at a disadvantage in a race (D-10). Command pipelining (the client sends without waiting for earlier acknowledgments) and server timestamps reduce this but do not remove it. It is an accepted limit for the MVP, measured in M5-T08 and M11-T02.
- A solver bot cannot be detected reliably. Hidden mines, rate limits, impossible-speed flags and replay audits make cheating harder, but this is a known limit and not a bug.
- The server must run the engine for every active match, which sets the capacity ceiling (D-11).
- Reconnection needs server-held state: resume tokens, acknowledged sequence numbers and snapshots (M6), because the client cannot rebuild a board it was never given.

## Alternatives

- **Peer-to-peer with the board shared between clients.** Rejected: mines would be known to both players.
- **A trusted client that reports its own result.** Rejected: nothing could be verified.
- **Authoritative server but full board sent and hidden by the UI.** Rejected: hiding in the UI is not secrecy.
- **A game-server framework with state synchronization (for example Colyseus).** Rejected for now: schema-based state sync fights a deterministic command-log engine (spec section 5).
