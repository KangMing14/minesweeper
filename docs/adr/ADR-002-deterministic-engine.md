# ADR-002: Deterministic engine

- Status: Accepted
- Date: 2026-11-09
- Task: M0-T06
- Settles: none

## Context

Three features depend on the same game producing the same result every time it is given the same inputs: a ranked solo run is validated by replaying its command log on the server, a ghost race replays a recorded run, and a 1v1 race needs both players to face an identical board. If the engine reads a clock, a random source or any platform API, a replay can disagree with the original run in a different browser or on the server, and neither validation nor fair races can be trusted. The engine must also run in the browser and in Node without change.

## Decision

The engine is a pure function of its inputs: `(seed, config, commands) -> state` (spec section 4.1, principle 1).

- No clocks, no randomness from the platform, no DOM and no Node APIs inside `packages/engine`. The banned names are `Math.random`, `Date`, `performance`, `window`, `document` and `process`, also when reached through `globalThis`, and no Node built-in module may be imported.
- Time enters only as the `t` field of a `Command`, supplied by the caller. The server stamps its own receive time for network play.
- The pseudo-random generator is implemented inside the engine with integer arithmetic (`Prng`, `createPrng`), so every platform computes the same sequence.
- Every game is a command log. Ranked solo runs are verified by replaying the log through the same engine (`ReplayLog`, `replay`, `validateReplayLog`).
- Flood fill is iterative with an explicit stack, never recursive, so a large board cannot overflow the call stack and the result does not depend on engine limits.

This is enforced, not trusted: `packages/engine` is compiled with `lib: ["ES2023"]` and `types: []`, so using `document`, `window` or `process` is a compile error; ESLint bans the names above and any import that leaves the package; and fixtures in `tools/lint-fixtures/` prove each rule fires (M0-T03, M0-T04). Test files may read the clock.

## Consequences

- Replay validation, ghost races and shared seeded boards all rest on one property, and golden-seed tests (M2-T06) can pin it in Node and in a browser.
- Callers carry the burden of time: the client session and the server must pass `t` on every command, and the engine can never time itself. The engine declares a `Clock` interface (interface only, no implementation); the implementations (`SystemClock`) live in `apps/web` and `apps/server`.
- Integer arithmetic in the PRNG is a little more work than calling a library, and any future engine change that alters the sequence for an existing seed invalidates stored replays. A change like that needs a versioning decision of its own.
- The engine is easy to test: no mocks for time or randomness are needed.
- Determinism covers the engine only. It does not make play fair against a solver bot (see ADR-003).

## Alternatives

- **A seeded random library or `Math.random` with a shim.** Rejected: results can differ between platforms and library versions, and `Math.random` cannot be seeded at all.
- **Store full state snapshots instead of command logs.** Rejected: much larger, and the server could not re-derive the result itself; a command log lets the server check a run rather than believe it.
- **Trust the result the client reports.** Rejected: it makes leaderboards trivial to cheat.
- **Let the engine read the system clock.** Rejected: replays would depend on when they run.
