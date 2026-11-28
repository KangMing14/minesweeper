import type { BoardConfig, CellIndex, GameEvent, GameView } from '@minesweeper/engine';

// M3-T08. The words that the live region speaks, as pure functions of engine events and views.
//
// Rules for the wording: row first, then column, both counted from 1 (a player does not count from 0);
// a cell description always starts with `Row r, column c, ` so a listener (and the end-to-end test, which
// reads the cursor from this text) can find the position; no message says where a mine is. A `gameLost`
// event carries `mineIndex`, which in a race is withheld until the match is final for both players
// (D-14, CLAUDE.md rule 8); these functions never read it, so the live region needs no race-specific code.

const place = (index: CellIndex, width: number): string =>
  `row ${Math.floor(index / width) + 1}, column ${(index % width) + 1}`;

const sentenceCase = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The cell under the keyboard cursor: its position and what the player can know about it.
 *
 * @param view - The current view of the game.
 * @param index - The cell, as an index into `view.cells`.
 * @returns For example `Row 3, column 4, hidden`, `...flagged`, `...revealed, 2` or `...revealed, empty`.
 * @example
 * describeCell(view, 0); // 'Row 1, column 1, hidden'
 */
export function describeCell(view: GameView, index: CellIndex): string {
  const cell = view.cells[index];
  const where = sentenceCase(place(index, view.width));
  if (cell === undefined || cell.state === 'hidden') return `${where}, hidden`;
  if (cell.state === 'flagged') return `${where}, flagged`;
  return `${where}, revealed, ${cell.value === 0 ? 'empty' : cell.value}`;
}

/**
 * What one engine event sounds like.
 *
 * @param event - The event the session delivered.
 * @param width - The board's width, to turn an index into a row and a column.
 * @returns A short sentence. A loss never names a cell.
 * @example
 * ```ts
 * describeEvent({ type: 'flagToggled', index: 4, flagged: true }, 3); // 'Flag placed at row 2, column 2.'
 * ```
 */
export function describeEvent(event: GameEvent, width: number): string {
  switch (event.type) {
    case 'cellsRevealed': {
      const [only, ...rest] = event.cells;
      if (only !== undefined && rest.length === 0) {
        const what = only.value === 0 ? 'an empty cell' : `${only.value}`;
        return `Revealed ${what} at ${place(only.index, width)}.`;
      }
      return `Opened ${event.cells.length} cells.`;
    }
    case 'flagToggled':
      return `Flag ${event.flagged ? 'placed' : 'removed'} at ${place(event.index, width)}.`;
    case 'gameWon':
      return `You cleared the board in ${spokenDuration(event.t)}.`;
    case 'gameLost':
      return 'You hit a mine. Game over.';
  }
}

/**
 * The first thing said when a game begins.
 *
 * @param presetName - The difficulty's display name.
 * @param config - The board that was dealt.
 * @returns For example `New game: Beginner, 9 by 9, 10 mines.`
 * @example
 * ```ts
 * describeStart('Beginner', { width: 9, height: 9, mineCount: 10 }); // 'New game: Beginner, 9 by 9, 10 mines.'
 * ```
 */
export function describeStart(presetName: string, config: BoardConfig): string {
  const mines = config.mineCount === 1 ? '1 mine' : `${config.mineCount} mines`;
  return `New game: ${presetName}, ${config.width} by ${config.height}, ${mines}.`;
}

/**
 * A duration as a person says it.
 *
 * @param ms - Milliseconds. A value that is not a positive finite number counts as 0.
 * @returns `12.3 seconds` below a minute, `1 minute 2 seconds` from a minute on.
 * @example
 * spokenDuration(62_900); // '1 minute 2 seconds'
 */
export function spokenDuration(ms: number): string {
  const whole = Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : 0;
  if (whole < 60_000) return `${(Math.floor(whole / 100) / 10).toFixed(1)} seconds`;
  const minutes = Math.floor(whole / 60_000);
  const seconds = Math.floor((whole % 60_000) / 1000);
  const m = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  return seconds === 0 ? m : `${m} ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
}
