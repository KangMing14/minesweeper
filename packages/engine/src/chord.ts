import type { Board } from './board.js';
import type { CellIndex } from './config.js';
import type { CellsRevealed } from './events.js';
import { revealCell } from './reveal.js';
import { CELL_FLAGGED, CELL_HIDDEN, CELL_REVEALED } from './view.js';

/**
 * What chording on one cell did.
 *
 * @remarks
 * `'none'`: nothing happened and no state changed. `'chorded'`: the chord took effect; `cells` lists every
 * cell it revealed (possibly none), and `mineIndex` is the lowest-index mine among the cells it tried to
 * open, or `null` if there was none. A mine is not marked revealed, as in `revealCell`: ending the game is
 * the caller's job.
 *
 * @internal
 */
export type ChordResult =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'chorded';
      readonly cells: CellsRevealed['cells'];
      readonly mineIndex: CellIndex | null;
    };

const NONE: ChordResult = Object.freeze({ kind: 'none' });

/**
 * Chords on a revealed number: opens all its other neighbors at once, if the flags around it match it.
 *
 * @remarks
 * A chord takes effect only on a revealed cell that shows 1 or more, when the number of flagged neighbors
 * equals that number and at least one neighbor is still hidden and unflagged. Otherwise it does nothing.
 * The flags are only counted, never checked against the mines, so a wrong flag can make the chord open a
 * mine (decision D-04, ADR-009).
 *
 * Each hidden, unflagged neighbor is opened through `revealCell`, in ascending index order, which is the
 * order `Board.neighbors` returns. A neighbor already opened by the cascade of an earlier neighbor is
 * skipped, so no cell is listed twice. A neighbor that holds a mine is not opened; the lowest-index one is
 * reported in `mineIndex`, and the remaining safe neighbors are still opened, as in the classic game.
 * Not part of the public API.
 *
 * @param board - The mine layout.
 * @param cellStates - One code per cell: `CELL_HIDDEN`, `CELL_REVEALED` or `CELL_FLAGGED`. Changed in place.
 * @param index - The cell to chord on.
 * @returns What happened; see `ChordResult`.
 * @throws `RangeError` if `index` is not a whole number inside the board.
 *
 * @internal
 */
export function chordCells(board: Board, cellStates: Uint8Array, index: CellIndex): ChordResult {
  // `adjacentMines` also rejects an index that is not a whole number inside the board.
  const value = board.adjacentMines(index);
  if (cellStates[index] !== CELL_REVEALED || value === 0) return NONE;

  const neighbors = board.neighbors(index);
  let flags = 0;
  for (const neighbor of neighbors) {
    if (cellStates[neighbor] === CELL_FLAGGED) flags += 1;
  }
  if (flags !== value) return NONE;

  // Decide what to open before opening anything, so that a chord with nothing to open is a clean no-op.
  const targets = neighbors.filter((neighbor) => cellStates[neighbor] === CELL_HIDDEN);
  if (targets.length === 0) return NONE;

  const cells: { readonly index: CellIndex; readonly value: number }[] = [];
  let mineIndex: CellIndex | null = null;
  for (const target of targets) {
    const result = revealCell(board, cellStates, target);
    if (result.kind === 'cells') {
      for (const cell of result.cells) cells.push(cell);
    } else if (result.kind === 'mine' && mineIndex === null) {
      mineIndex = target;
    }
  }
  return Object.freeze({ kind: 'chorded', cells: Object.freeze(cells), mineIndex });
}
