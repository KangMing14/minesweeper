import type { GameView } from '@minesweeper/engine';

// M3-T03. What is drawn in a cell, as one small number per cell. The renderer compares these numbers between
// two views to find the cells that changed, so two cells with the same number must look the same.

/**
 * The codes for what a cell shows. Revealed cells use one code per value, from `revealed(0)` to `revealed(8)`.
 *
 * @example
 * ```ts
 * VISUAL.HIDDEN; // 0
 * VISUAL.revealed(3); // 5
 * ```
 */
export const VISUAL = {
  /** A closed cell. */
  HIDDEN: 0,
  /** A flag on a closed cell (during play, or after the game on a mine). */
  FLAG: 1,
  /** A mine that was never flagged, shown after a loss. */
  MINE: 11,
  /** A flag on a cell that has no mine, shown after a loss. */
  WRONG_FLAG: 12,
  /** The code for an open cell that shows `value` (0 to 8) as its number. */
  revealed: (value: number): number => 2 + value,
} as const;

/**
 * Works out what each cell of a view shows.
 *
 * @remarks
 * During play the view says nothing about mines, so a flag is a flag and a closed cell is closed. When the
 * view carries `exposedMines` (a finished game, and only when the caller was allowed to have them; in a race
 * the server withholds them until the match is final), a closed mine shows as a mine after a loss and as a
 * flag after a win, a flag on a mine stays a flag, and a flag on a safe cell is wrong. A view without
 * `exposedMines` is drawn as it is, so the renderer never needs to know which game mode it is in.
 *
 * @param view - The view to read.
 * @param out - An array to fill instead of a new one; it must hold at least `width * height` entries.
 * @returns One code from `VISUAL` per cell, in index order (the first `width * height` entries of `out`).
 * @throws RangeError when `view.cells` does not hold `width * height` cells, or `out` is too small.
 * @example
 * ```ts
 * const codes = computeVisuals(session.view());
 * codes[0] === VISUAL.HIDDEN;
 * ```
 */
export function computeVisuals(view: GameView, out?: Uint8Array): Uint8Array {
  const count = view.width * view.height;
  if (view.cells.length !== count) {
    throw new RangeError(
      `view has ${view.cells.length} cells but is ${view.width} by ${view.height}`,
    );
  }
  const visuals = out ?? new Uint8Array(count);
  if (visuals.length < count) {
    throw new RangeError(`out holds ${visuals.length} entries but the view has ${count} cells`);
  }
  const mines = new Uint8Array(count);
  const finished = view.exposedMines !== undefined;
  for (const mine of view.exposedMines ?? []) {
    if (mine >= 0 && mine < count) mines[mine] = 1;
  }
  const won = view.status === 'won';
  for (let i = 0; i < count; i += 1) {
    const cell = view.cells[i];
    if (cell === undefined || cell.state === 'hidden') {
      visuals[i] = finished && mines[i] === 1 ? (won ? VISUAL.FLAG : VISUAL.MINE) : VISUAL.HIDDEN;
    } else if (cell.state === 'flagged') {
      visuals[i] = finished && mines[i] !== 1 ? VISUAL.WRONG_FLAG : VISUAL.FLAG;
    } else {
      visuals[i] = VISUAL.revealed(Math.min(8, Math.max(0, cell.value)));
    }
  }
  return visuals;
}
