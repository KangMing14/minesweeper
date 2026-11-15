# ADR-009: Cell rules: chording and flags

- Status: Accepted
- Date: 2026-11-15
- Task: M1-T05
- Settles: D-04

## Context

The engine already reveals cells and cascades (M1-T04). Two more player actions change a game: placing a flag and chording, which is opening all the neighbors of a number in one move. Their rules are not obvious. Players of the classic game expect chording to work the way it does there, including its risk: a wrong flag makes the chord open a mine. A race adds two pressures. Speed matters, so chording has to be one command and one event batch, not a chain of reveals. And every rule has to be deterministic, because replays, ghosts and the server's validation all run the same commands through the same engine (ADR-002).

Without a decision, three details would be left to whoever writes the code: whether a flag may be wrong, what a chord does when it reaches a mine, and which events a losing chord sends.

## Decision

**Flags.** `flag` toggles a hidden cell to flagged and a flagged cell back to hidden, and sends one `flagToggled` event. On a revealed cell it does nothing. A flag may be placed anywhere hidden, so there can be more flags than mines (`minesRemaining` then goes below zero). A flag looks the same on a mine and on a safe cell. There are no question marks: the third toggle is a flag again. Flags are never required to win; the game counts revealed safe cells only (win detection is M1-T06). A flag that takes effect is a command that takes effect, so it moves the status from `'ready'` to `'playing'`, as the M1-T04 rule says.

**Chording.** `chord` acts on a revealed cell that shows 1 or more. It takes effect only if the number of flagged neighbors equals the number on the cell and at least one neighbor is hidden and unflagged. Otherwise it does nothing: a hidden or flagged cell, a zero, too few flags, too many flags, or nothing left to open all return `[]` and change nothing. Flags are counted, never checked against the mines.

When a chord takes effect, every hidden unflagged neighbor is opened through the normal reveal path, in ascending index order. A neighbor that an earlier neighbor's cascade already opened is skipped, so no cell appears twice. The newly revealed cells of the whole chord are **one** `cellsRevealed` event.

**A chord that reaches a mine.** The safe neighbors are still opened, as in the classic game, and the game is lost. The events are `cellsRevealed` (only if at least one cell was opened) followed by one `gameLost`, whose `mineIndex` is the lowest-index mine the chord reached. The mine cells stay hidden in the cell states, as after a plain reveal, and show only through `exposedMines`. A chord therefore sends at most two events, and `gameLost` is always last.

**Subscribers.** Every event of a command reaches every subscriber, even if one subscriber throws on an earlier event. The first error is rethrown from `apply` after the last event has been delivered.

## Consequences

- Chording is one command, one `cellsRevealed`, so the network sends one update per chord and a replay applies one command.
- A wrong flag is a real risk, and it can end a run. That is the classic rule and the one fast players expect.
- `revealedCount` at the moment of a losing chord includes the safe neighbors it opened first. If ADR-010 (D-02) keeps "if both players hit a mine, the one with more safe cells revealed wins", this rule feeds the tie-break, and ADR-010 should say so. If ADR-010 prefers the other reading (a loss opens nothing), it must supersede this part of ADR-009.
- A flag that takes effect moves the status to `'playing'`, so a game can be `'playing'` with nothing revealed. M2-T02's safe opening is tied to the first reveal; it must not assume that the first command that takes effect is a reveal.
- The wire format (M5-T01) carries `flag` and `chord` as the same `Command` shape, and the server rate limit counts them like reveals.
- The mine layout still leaves the engine only through `exposedMines` after a game ends; the D-14 filter for races stays the server's job (M5-T05).
- `Game` announces a command's events through one internal step, so a future command with several events follows the same delivery rule.

## Alternatives

- **A chord only works when every flag is on a mine.** Rejected: it would reveal where the mines are, because a refused chord says that a flag is wrong. It also removes the risk that makes chording a skill.
- **A chord that hits a mine opens nothing.** Rejected: it differs from the classic game, and it would make the number of safe cells at a loss depend on a detail players cannot see. Kept open as a choice for ADR-010 (see the consequences).
- **One `cellsRevealed` per neighbor.** Rejected: more messages, and the task asks for one aggregated event.
- **Question marks.** Rejected under D-04: they do nothing for a race and cost a state in the view, the protocol and the renderer.
- **Flags required to win, or flags that must match the mines.** Rejected: it would punish a player who never flags, and it would make the flag count a hidden score.
- **A flag does not start the game.** Rejected: "the first accepted command" is one rule for all command types (M1-T04), and a special case would complicate replay without a benefit.
