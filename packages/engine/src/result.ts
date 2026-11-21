/**
 * The record of one finished game: how it ended, how long it took and how well it went.
 *
 * @remarks
 * `Game.result()` returns one of these once a game is won or lost, and nothing before. It is a plain,
 * frozen record, so it can be stored, sent and compared.
 *
 * - `outcome`: `'won'` when every safe cell was revealed, `'lost'` when a mine was reached.
 * - `timeMs`: the `t` of the command that ended the game, in milliseconds since the start signal (`t = 0`).
 *   A game that the opening already cleared at creation has no finishing command and `timeMs` is 0.
 * - `safeCellsRevealed`: how many safe cells were open at the end, the opening included. For a lost game
 *   this is how far the player got (race rule D-02, ADR-010): a losing chord counts the safe neighbors it
 *   opened before it reached a mine.
 * - `totalSafeCells`: the cells that are not mines. `safeCellsRevealed` equals it exactly when the game was won.
 * - `effectiveCommands`: how many commands took effect, which is the length of `Game.log()`: reveals, chords
 *   and every flag put on or taken off. Commands that were refused or changed nothing are not counted, and
 *   neither is the opening.
 * - `threeBV`: the board's 3BV (Bechtel's Board Benchmark Value), the fewest plain reveals that clear it.
 *   It is a property of the board, not of how the game was played, and it counts the free opening.
 * - `threeBVPerSecond`: `threeBV` divided by the time in seconds, the usual speed measure. It is 0 when
 *   `timeMs` is 0, including a win by a command at `t = 0`. It is computed as `threeBV * 1000 / timeMs`, a
 *   single division of whole numbers, so every platform gives the same value for the same log.
 *
 * The record says nothing about where the mines are except through `threeBV`, a number derived from the
 * whole layout. In a race the server decides when a client may see it (D-14, M4-T03).
 *
 * @example
 * ```ts
 * const game = createGame(PRESETS.beginner, 42);
 * game.result(); // undefined: the game has not ended
 * // ... play until the game is won or lost, then:
 * const result: GameResult | undefined = game.result();
 * if (result?.outcome === 'won') console.log(`${result.timeMs} ms, ${result.threeBVPerSecond} 3BV/s`);
 * ```
 */
export interface GameResult {
  /** How the game ended. */
  readonly outcome: 'won' | 'lost';
  /** The `t` of the finishing command in milliseconds; 0 if there was none. */
  readonly timeMs: number;
  /** Safe cells open at the end, the opening included. */
  readonly safeCellsRevealed: number;
  /** Cells that are not mines. */
  readonly totalSafeCells: number;
  /** Commands that took effect: the length of the command log. */
  readonly effectiveCommands: number;
  /** The board's 3BV. */
  readonly threeBV: number;
  /** `threeBV` per second of `timeMs`; 0 when `timeMs` is 0. */
  readonly threeBVPerSecond: number;
}

/**
 * Builds a `GameResult` from the measured parts and derives the rate.
 *
 * @remarks
 * A pure function, so the arithmetic (the rate, the zero-time rule) is tested without playing a game, and
 * `Game.result()` is a thin call to it. The rate is `threeBV * 1000 / timeMs`: one division of two exact
 * integers (the product is far below 2^53), which IEEE 754 rounds once and identically everywhere. Dividing
 * by `timeMs / 1000` instead would round twice and could differ in the last digit.
 *
 * Not part of the public API.
 *
 * @param parts - Everything in a `GameResult` except the rate.
 * @returns A new, frozen record.
 *
 * @example
 * ```ts
 * buildGameResult({
 *   outcome: 'won',
 *   timeMs: 30,
 *   safeCellsRevealed: 7,
 *   totalSafeCells: 7,
 *   effectiveCommands: 3,
 *   threeBV: 2,
 * }).threeBVPerSecond; // 2000 / 30
 * ```
 *
 * @internal
 */
export function buildGameResult(parts: Omit<GameResult, 'threeBVPerSecond'>): GameResult {
  // No time has passed: the rate is 0 by definition, and dividing would give Infinity or NaN.
  const threeBVPerSecond = parts.timeMs === 0 ? 0 : (parts.threeBV * 1000) / parts.timeMs;
  return Object.freeze({ ...parts, threeBVPerSecond });
}
