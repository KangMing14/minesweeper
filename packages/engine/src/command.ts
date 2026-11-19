import type { CellIndex } from './config.js';

/**
 * One thing a player does to a game: reveal a cell, toggle a flag, or chord on a number.
 *
 * @remarks
 * The command is the only way to change a `Game`, and the only way time reaches the engine: `t` is the
 * number of milliseconds since the game started, supplied by the caller (ADR-002). The engine never reads a
 * clock. A game's command log is its history, which replay and ranked validation rely on.
 *
 * `index` must be a whole number inside the board; `Game.apply` throws `RangeError` otherwise. `t` is taken
 * as given by this type, but `Game.apply` accepts it only if it is a non-negative safe integer that is not lower
 * than the `t` of the last accepted command (M2-T03); a command with any other `t` is invalid and returns `[]`.
 *
 * @example
 * ```ts
 * const reveal: Command = { type: 'reveal', index: 40, t: 1_250 };
 * const flag: Command = { type: 'flag', index: 12, t: 2_000 };
 * ```
 */
export interface Command {
  /** What to do: `'reveal'` a cell, toggle a `'flag'` on it, or `'chord'` on a revealed number. */
  readonly type: 'reveal' | 'flag' | 'chord';
  /** The cell the command acts on. */
  readonly index: CellIndex;
  /** Milliseconds since the game started, as measured by the caller. */
  readonly t: number;
}
