# ADR-001: Monorepo and modular monolith

- Status: Accepted
- Date: 2026-11-09
- Task: M0-T06
- Settles: none

## Context

The game is built by one developer and launches small before it scales (spec section 1). Four pieces of code have to stay in step: the pure game logic (`engine`), the wire-message schemas (`protocol`), the authoritative server and the browser client. The same engine code runs in three places: in the browser for solo play, on the server for races, and on the server again when a ranked solo run is validated by replay. A change to the engine or to a message schema therefore touches several consumers at once. Without a decision, the code could end up split across repositories that drift apart, or collapse into one package where nothing stops the engine from importing a browser API.

## Decision

One Git repository with pnpm workspaces and four packages, all ESM and strict TypeScript:

- `packages/engine` (`@minesweeper/engine`): pure, deterministic game logic; depends on nothing project-internal.
- `packages/protocol` (`@minesweeper/protocol`): wire schemas and shared types; depends only on engine types.
- `apps/server` (`@minesweeper/server`): the authoritative game server.
- `apps/web` (`@minesweeper/web`): the browser client.

Dependencies point inward only: `engine` <- `protocol` <- `apps/server` and `apps/web`, and the two apps never depend on each other. The rule is enforced twice: by each `package.json` together with TypeScript project references, and by lint rules with fixtures (M0-T02, M0-T03).

The server is a modular monolith. The REST API, the WebSocket gateway, the match manager and the matchmaker run in one process with one PostgreSQL database, and there is no Redis at the MVP. The module seams that matter later (`Transport`, the repositories, `RatingSystem`) are interfaces inside that one process.

## Consequences

- A change across engine, protocol, server and client is one pull request and one CI run, which fits the one-task-one-PR workflow (ADR-006).
- The engine can be proven pure by tooling (ADR-002) because it is its own package with its own TypeScript configuration.
- One deployable unit keeps operations small: one container, one database. The cost is that a fault in match handling can take down the REST API too, and scaling past one instance needs sticky routing or a broker (Redis) that is deliberately deferred. The capacity target (D-11, about 200 concurrent matches on one small instance) is measured in M11-T02.
- Build and test time grow with the repository. A task runner such as Turborepo is the planned answer if that becomes slow; it is not added now.
- Package names are a naming choice made in M0-T02 (the `@minesweeper/` scope); the canonical-names table in `ARCHITECTURE.md` covers symbols, not package names.

See [ARCHITECTURE.md](../../ARCHITECTURE.md) for the layout and the dependency rule, and the [design spec](../superpowers/specs/2026-11-04-competitive-minesweeper-design.md) sections 4.1 and 4.2.

## Alternatives

- **Several repositories (polyrepo).** Rejected: every cross-package change would need coordinated releases and version bumps, which is pure overhead for a solo developer and makes the shared engine harder to keep identical in client and server.
- **Microservices (separate game, auth and matchmaking services).** Rejected: network hops, deployment pipelines and distributed failure modes cost more than a small launch can justify. The module seams keep this option open without paying for it now.
- **One package, no workspaces.** Rejected: nothing would stop the engine from importing a DOM or Node API, and the boundary rules could not be expressed through package dependencies.
- **A monorepo build system (Turborepo, Nx) from day one.** Rejected as premature; plain pnpm workspaces and `tsc -b` are enough for four packages.
