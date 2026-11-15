import { describe, expect, it } from 'vitest';
import { Board } from './board.js';
import type { BoardConfig } from './config.js';
import { revealCell } from './reveal.js';
import { CELL_FLAGGED, CELL_HIDDEN, CELL_REVEALED } from './view.js';

/** A board with no mines: every cell is a zero, so any reveal cascades over the whole board. */
function emptyBoard(width: number, height: number): Board {
  return new Board({ width, height, mineCount: 0 }, []);
}

/** A fresh state array for a board: every cell hidden. */
function hiddenStates(board: Board): Uint8Array {
  return new Uint8Array(board.config.width * board.config.height).fill(CELL_HIDDEN);
}

/** The indices of a reveal result's cells, in the order the result lists them. */
function indicesOf(result: ReturnType<typeof revealCell>): number[] {
  if (result.kind !== 'cells') throw new Error(`expected cells, got ${result.kind}`);
  return result.cells.map((cell) => cell.index);
}

// 5 wide, 5 tall. Column 2 is a wall of mines, so the left two columns form a closed zero region.
//   0 2 M . .
//   0 3 M . .
//   0 3 M . .
//   0 3 M . .
//   0 2 M . .
const WALL: BoardConfig = { width: 5, height: 5, mineCount: 5 };
const wallBoard = (): Board => new Board(WALL, [2, 7, 12, 17, 22]);

describe('revealCell: a single cell', () => {
  it('reveals only a numbered cell and reports its value', () => {
    const board = wallBoard();
    const states = hiddenStates(board);
    const result = revealCell(board, states, 6); // (1,1) touches 3 mines
    expect(result).toEqual({ kind: 'cells', cells: [{ index: 6, value: 3 }] });
    expect(states[6]).toBe(CELL_REVEALED);
    expect(states.filter((s) => s === CELL_REVEALED)).toHaveLength(1);
  });

  it('reports a mine without changing any state', () => {
    const board = wallBoard();
    const states = hiddenStates(board);
    const before = Uint8Array.from(states);
    expect(revealCell(board, states, 12)).toEqual({ kind: 'mine' });
    expect(states).toEqual(before);
  });

  it('does nothing on a cell that is already revealed', () => {
    const board = wallBoard();
    const states = hiddenStates(board);
    revealCell(board, states, 6);
    const before = Uint8Array.from(states);
    expect(revealCell(board, states, 6)).toEqual({ kind: 'none' });
    expect(states).toEqual(before);
  });

  it('does nothing on a flagged cell, even a flagged mine', () => {
    const board = wallBoard();
    const states = hiddenStates(board);
    states[6] = CELL_FLAGGED;
    states[12] = CELL_FLAGGED;
    const before = Uint8Array.from(states);
    expect(revealCell(board, states, 6)).toEqual({ kind: 'none' });
    expect(revealCell(board, states, 12)).toEqual({ kind: 'none' });
    expect(states).toEqual(before);
  });

  it('throws RangeError for an index that is not a whole number inside the board', () => {
    const board = wallBoard();
    const states = hiddenStates(board);
    for (const bad of [-1, 25, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => revealCell(board, states, bad)).toThrow(RangeError);
    }
    expect(states.every((s) => s === CELL_HIDDEN)).toBe(true);
  });
});

describe('revealCell: cascades', () => {
  it('opens a zero region and the numbers around it, and stops at the numbers', () => {
    const board = wallBoard();
    const states = hiddenStates(board);
    const result = revealCell(board, states, 0);
    const revealed = new Set(indicesOf(result));
    // Columns 0 and 1 (10 cells) and nothing from the far side of the mine wall.
    expect(revealed).toEqual(new Set([0, 1, 5, 6, 10, 11, 15, 16, 20, 21]));
    for (const mine of [2, 7, 12, 17, 22]) expect(states[mine]).toBe(CELL_HIDDEN);
    for (const far of [3, 4, 8, 9, 13, 14, 18, 19, 23, 24]) expect(states[far]).toBe(CELL_HIDDEN);
  });

  it('lists every revealed cell once, with the value it shows', () => {
    const board = wallBoard();
    const result = revealCell(board, hiddenStates(board), 0);
    if (result.kind !== 'cells') throw new Error('expected cells');
    const indices = result.cells.map((cell) => cell.index);
    expect(new Set(indices).size).toBe(indices.length);
    for (const cell of result.cells) expect(cell.value).toBe(board.adjacentMines(cell.index));
  });

  it('lists the clicked cell first, then cells in the order the fill discovered them', () => {
    // Pinned because later tasks (replay, ghosts, network deltas) rely on one fixed order.
    const board = emptyBoard(3, 3);
    const result = revealCell(board, hiddenStates(board), 4);
    expect(indicesOf(result)).toEqual([4, 0, 1, 2, 3, 5, 6, 7, 8]);
  });

  it('expands the most recently found zero cell first, like a stack', () => {
    // 5x1, no mines, click the middle. Found: 2, then 1 and 3. A stack expands 3 next (finding 4) and then
    // 1 (finding 0); a queue would expand 1 first and list 0 before 4. The order is part of the contract.
    const board = emptyBoard(5, 1);
    expect(indicesOf(revealCell(board, hiddenStates(board), 2))).toEqual([2, 1, 3, 4, 0]);
  });

  it('does not reveal a flagged cell, and the fill does not pass through it', () => {
    // 5x1 board with no mines; a flag on cell 2 cuts the row in two.
    const board = emptyBoard(5, 1);
    const states = hiddenStates(board);
    states[2] = CELL_FLAGGED;
    const result = revealCell(board, states, 0);
    expect(new Set(indicesOf(result))).toEqual(new Set([0, 1]));
    expect(states[2]).toBe(CELL_FLAGGED);
    expect(states[3]).toBe(CELL_HIDDEN);
    expect(states[4]).toBe(CELL_HIDDEN);
  });

  it('skips a cell that is already revealed: it is not listed again and the fill does not pass it', () => {
    // 5x1 board with no mines, cell 3 marked revealed by hand. In a real game a revealed zero has already
    // spread, so the fill has no reason to go through it.
    const board = emptyBoard(5, 1);
    const states = hiddenStates(board);
    states[3] = CELL_REVEALED;
    const result = revealCell(board, states, 0);
    expect(new Set(indicesOf(result))).toEqual(new Set([0, 1, 2]));
    expect(states[4]).toBe(CELL_HIDDEN);
  });

  it('stops at the value-1 cells of a one-row board', () => {
    // 5x1, mine at 2: values 0 1 M 1 0.
    const board = new Board({ width: 5, height: 1, mineCount: 1 }, [2]);
    const states = hiddenStates(board);
    expect(revealCell(board, states, 0)).toEqual({
      kind: 'cells',
      cells: [
        { index: 0, value: 0 },
        { index: 1, value: 1 },
      ],
    });
    expect(states[2]).toBe(CELL_HIDDEN);
  });
});

describe('revealCell: large boards', () => {
  it('cascades the whole expert board', () => {
    const board = emptyBoard(30, 16);
    const states = hiddenStates(board);
    const result = revealCell(board, states, 0);
    expect(indicesOf(result)).toHaveLength(480);
    expect(states.every((s) => s === CELL_REVEALED)).toBe(true);
  });

  it('cascades the largest legal board (100x100) without a stack overflow', () => {
    // The expert board has only 480 cells, which a recursive fill also survives (checked with a recursive
    // version of the fill). On this board, 10,000 cells, that version overflows the call stack.
    const board = emptyBoard(100, 100);
    const states = hiddenStates(board);
    const result = revealCell(board, states, 5050);
    const indices = indicesOf(result);
    expect(indices).toHaveLength(10_000);
    expect(new Set(indices).size).toBe(10_000);
    expect(states.every((s) => s === CELL_REVEALED)).toBe(true);
  });
});
