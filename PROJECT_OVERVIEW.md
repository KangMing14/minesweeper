# Project Overview

The one-page picture of the project. Authoritative detail lives in the design spec (`docs/superpowers/specs/2026-11-04-competitive-minesweeper-design.md`); the plan and task list are in [ROADMAP.md](ROADMAP.md).

## Concept

An independent, browser-based competitive Minesweeper, inspired by the competitive experience of TETR.IO (real-time multiplayer, profiles, ranking, leaderboards, a polished interface), not a copy of it. Two players race on the same board; a solo mode ranks players by clear time.

- **Built by:** one developer, in many short conversations with Claude, one task at a time.
- **Scale:** a small public launch first, then scaling up seriously. No infrastructure beyond what a small launch needs, but clean seams so scaling later does not force rewrites.
- **Technology direction:** TypeScript everywhere, an object-oriented and modular design, and a game engine that is independent of the UI and of networking.

## MVP

What the first public launch contains (spec sections 2.2 and 8):

- **1v1 Race.** Both players get the same seeded board and the same guaranteed safe opening. The fastest clear wins.
- **Solo Time-Attack.** Timed single-player runs with leaderboards. Ranked runs are validated by replaying the submitted command log on the server.
- **Fairness rule.** The seeded generator reveals a fixed safe opening to every player at the start. No luck at the start, and no per-player mine relocation.
- **Play modes around the core:** the three classic presets, racing a recorded ghost, guest play and registered accounts, match history, rated 1v1 matchmaking.
- **Quality bars:** the engine is deterministic across browsers and Node; mine positions never reach a client during a game; every inbound message is validated and rate-limited; keyboard play and screen-reader basics from M3, a full accessibility pass in M10.

## Scope and deferred work

Deliberately **not** in the MVP (spec section 2.4, plan "Post-launch backlog"):

- Versus-with-attacks mode (the first post-MVP mode), shared-board play, spectating, a replay viewer.
- Social features, tournaments and community systems.
- No-guess board generation (the generator sits behind the `BoardGenerator` interface so it can be added later).
- Scale-out: Redis, several server instances, binary protocol.

A new mode needs an ADR and a `/brainstorming` session before it is planned.

## How the system fits together

Four packages in a pnpm monorepo, with dependencies pointing only inward: `engine`, then `protocol`, then the `server` and `web` apps. The server is authoritative; the client talks to a `GameSession` that is local (`LocalSession`) or remote (`RemoteSession`). The full picture, diagrams and canonical names are in [ARCHITECTURE.md](ARCHITECTURE.md).

## Where the project stands

Progress is tracked in one place: [ROADMAP.md](ROADMAP.md) (12 milestones, 83 tasks). Decisions and open questions are in [DECISIONS.md](DECISIONS.md). How work is done, task by task, is in [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) and [CLAUDE.md](CLAUDE.md).

## Glossary

- **ADR** (architecture decision record): a short, append-only document that records one decision with its context, consequences and alternatives. Superseded, never edited.
- **Canonical names:** the exact names of the main types and classes, fixed in the master plan and copied into `ARCHITECTURE.md`. Tasks use them verbatim.
- **Chord:** revealing all hidden neighbors of a revealed number at once, allowed only when the number of adjacent flags equals that number. A wrong flag count changes nothing. The final rules are recorded in ADR-009 (M1-T05).
- **Command:** one player action on a game: `reveal`, `flag` or `chord`, at a cell index, with a time `t` in milliseconds since the game started.
- **Command log:** the ordered list of commands of one game. With the seed and the board configuration it is the whole game.
- **DNF** (did not finish): a run that ended without a clear. In a race, hitting a mine ends your run as a DNF (working rule D-02, settled in M4).
- **Ghost:** a recorded earlier run that plays back next to you, so you can race yourself before online play exists.
- **GameSession:** the one interface the interface talks to. `LocalSession` runs the engine in the browser; `RemoteSession` speaks the network protocol.
- **Handoff package:** the fixed-format summary at the top of each milestone file that lets a fresh conversation start a task without earlier chat history.
- **Preset:** a named board size: beginner 9x9 with 10 mines, intermediate 16x16 with 40, expert 30x16 with 99 (working values, D-01).
- **Race:** the 1v1 mode on an identical seeded board.
- **Replay:** running a command log through the engine again to reproduce a game. The server uses it to validate ranked solo runs.
- **Safe opening:** the region around the first reveal that is guaranteed free of mines, identical for both players of a race.
- **Seed:** the number that, with the board configuration, fully determines where the mines are.
- **Server-authoritative:** the server holds the real board and decides every outcome; clients only receive the cells they have revealed.
- **Time-Attack:** the solo timed mode with leaderboards.
