# ADR-004: `GameSession` adapter

- Status: Accepted
- Date: 2026-11-09
- Task: M0-T06
- Settles: none

## Context

The same game screen must work three ways: solo in the browser, against a ghost, and against a human over a network (first on localhost or a LAN, later online). If the user interface called the engine directly for solo play and a network client for races, the screens would have to be rewritten when networking arrives, and the solo path could not exercise the same code as the online one. The server-authoritative design (ADR-003) also means the client must work with views of the game, not with the full board.

## Decision

The user interface talks only to one interface, `GameSession`, and never to the engine or the network directly (spec section 4.1, principle 3). It is an Adapter with two implementations:

- `LocalSession` runs the engine inside the browser. It serves solo play and the player's own side of the ghost race, where `GhostPlayer` supplies the opponent.
- `RemoteSession` speaks the `@minesweeper/protocol` messages to the server over a `Transport`, an Adapter over WebSocket. `InMemoryTransport` and `FaultyTransport` stand in for the network in tests and fault injection.

The UI sends a `PlayerAction` (`{ type: Command['type']; index: CellIndex }`) and renders what the session shows. `ViewMirror` keeps the client-side copy of what the server has revealed. Moving from local to LAN to online changes which session the UI is given, not the UI. The names above are the canonical names in `ARCHITECTURE.md`; their exact signatures are created in M3-T02, M5-T02 and M5-T06 and recorded there.

## Consequences

- The UI is built and tested once against `LocalSession` (M3) and then reused for networked play (M5), so the first network race is a change of session.
- The interface has to describe only what both sessions can provide, which is views of revealed cells and events, so the UI cannot come to depend on mine positions that a `RemoteSession` would never have.
- Network behavior such as latency, reordering and drops lives in `RemoteSession` and `Transport`, where `FaultyTransport` can exercise it without a browser.
- The seam adds one level of indirection to solo play. That cost is accepted because the alternative is a rewrite.
- Any change to the interface is an interface change: the task that makes it updates `ARCHITECTURE.md`.

## Alternatives

- **The UI calls the engine for solo play and a separate network client for races.** Rejected: two code paths in every screen, and online play would be a rewrite instead of a swap.
- **A shared client-side store synchronized to the server.** Rejected: it hides the command-and-event model that replay and validation depend on.
- **A framework with its own room and state-sync client.** Rejected for now (see ADR-003).
