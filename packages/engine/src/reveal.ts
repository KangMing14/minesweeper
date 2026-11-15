import type { Board } from './board.js';
import type { CellIndex } from './config.js';
import type { CellsRevealed } from './events.js';
import { CELL_HIDDEN, CELL_REVEALED } from './view.js';

/**
 * What revealing one cell did.
 *
 * @remarks
 * `'none'`: nothing happened (the cell was already revealed or is flagged). `'mine'`: the cell holds a mine;
 * no state was changed, because ending the game is the caller's job. `'cells'`: these cells are now revealed.
 *
 * @internal
 */
export type RevealResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'mine' }
  | { readonly kind: 'cells'; readonly cells: CellsRevealed['cells'] };

const NONE: RevealResult = Object.freeze({ kind: 'none' });
const MINE: RevealResult = Object.freeze({ kind: 'mine' });

/**
 * Reveals one cell and, if it shows 0, every cell that opens up around it.
 *
 * @remarks
 * Works on the raw cell states, so it can be tested with flags before `Game` can place any. It changes
 * `cellStates` in place for the cells it reveals, and for no other reason.
 *
 * The fill is iterative: an explicit stack instead of recursion, so the largest legal board (100x100) cannot
 * overflow the call stack. A cell is marked revealed the moment it is found, which means each cell is
 * visited once. The result lists the clicked cell first and then the others in the order they were found,
 * with each cell's neighbors taken in ascending index order. That order is fixed so that replays, ghosts
 * and network updates always agree.
 *
 * The fill never reveals a flagged cell and never passes through one. A cell that shows 0 has no mine next
 * to it, so every hidden neighbor it opens is safe.
 *
 * Not part of the public API.
 *
 * @param board - The mine layout.
 * @param cellStates - One code per cell: `CELL_HIDDEN`, `CELL_REVEALED` or `CELL_FLAGGED`. Changed in place.
 * @param index - The cell to reveal.
 * @returns What happened; see `RevealResult`.
 * @throws `RangeError` if `index` is not a whole number inside the board.
 *
 * @internal
 */
export function revealCell(board: Board, cellStates: Uint8Array, index: CellIndex): RevealResult {
  // `isMine` also rejects an index that is not a whole number inside the board.
  const isMine = board.isMine(index);
  if (cellStates[index] !== CELL_HIDDEN) return NONE;
  if (isMine) return MINE;

  const revealed: { readonly index: CellIndex; readonly value: number }[] = [];
  const open = (cell: CellIndex): number => {
    cellStates[cell] = CELL_REVEALED;
    const value = board.adjacentMines(cell);
    revealed.push(Object.freeze({ index: cell, value }));
    return value;
  };

  if (open(index) === 0) {
    const stack: CellIndex[] = [index];
    for (let current = stack.pop(); current !== undefined; current = stack.pop()) {
      for (const neighbor of board.neighbors(current)) {
        if (cellStates[neighbor] === CELL_HIDDEN && open(neighbor) === 0) stack.push(neighbor);
      }
    }
  }
  return Object.freeze({ kind: 'cells', cells: Object.freeze(revealed) });
}
