import { describe, expect, it } from 'vitest';
import { Board } from './board.js';
import { chordCells } from './chord.js';
import { revealCell } from './reveal.js';
import { CELL_FLAGGED, CELL_HIDDEN, CELL_REVEALED } from './view.js';

/** A fresh state array for a board: every cell hidden. */
function hiddenStates(board: Board): Uint8Array {
  return new Uint8Array(board.config.width * board.config.height).fill(CELL_HIDDEN);
}

// 3x3, mines in the top corners. The centre (4) shows 2.
//   M . M
//   . 2 .
//   . . .
const topCorners = (): Board => new Board({ width: 3, height: 3, mineCount: 2 }, [0, 2]);

/** The board with the centre revealed and the given cells flagged. */
function centreOpen(flags: readonly number[]): { board: Board; states: Uint8Array } {
  const board = topCorners();
  const states = hiddenStates(board);
  revealCell(board, states, 4);
  for (const flag of flags) states[flag] = CELL_FLAGGED;
  return { board, states };
}

describe('chordCells: when nothing happens', () => {
  it('does nothing on a hidden cell', () => {
    const { board, states } = centreOpen([0, 2]);
    const before = Uint8Array.from(states);
    expect(chordCells(board, states, 1)).toEqual({ kind: 'none' });
    expect(states).toEqual(before);
  });

  it('does nothing on a flagged cell', () => {
    const { board, states } = centreOpen([0, 2, 4]);
    const before = Uint8Array.from(states);
    expect(chordCells(board, states, 4)).toEqual({ kind: 'none' });
    expect(states).toEqual(before);
  });

  it('does nothing on a revealed zero', () => {
    const board = new Board({ width: 3, height: 3, mineCount: 1 }, [8]);
    const states = hiddenStates(board);
    revealCell(board, states, 0); // cascades; cell 0 shows 0
    const before = Uint8Array.from(states);
    expect(chordCells(board, states, 0)).toEqual({ kind: 'none' });
    expect(states).toEqual(before);
  });

  it('does nothing with too few flags', () => {
    const { board, states } = centreOpen([0]);
    const before = Uint8Array.from(states);
    expect(chordCells(board, states, 4)).toEqual({ kind: 'none' });
    expect(states).toEqual(before);
  });

  it('does nothing with too many flags', () => {
    const { board, states } = centreOpen([0, 1, 2]);
    const before = Uint8Array.from(states);
    expect(chordCells(board, states, 4)).toEqual({ kind: 'none' });
    expect(states).toEqual(before);
  });

  it('does nothing when the flags match but no neighbor is left to open', () => {
    const { board, states } = centreOpen([0, 2]);
    chordCells(board, states, 4); // opens everything else
    const before = Uint8Array.from(states);
    expect(chordCells(board, states, 4)).toEqual({ kind: 'none' });
    expect(states).toEqual(before);
  });

  it('throws RangeError for an index that is not a whole number inside the board', () => {
    const { board, states } = centreOpen([]);
    for (const bad of [-1, 9, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => chordCells(board, states, bad)).toThrow(RangeError);
    }
  });
});

describe('chordCells: when it opens cells', () => {
  it('opens every hidden unflagged neighbor when the number of flags matches the number', () => {
    const { board, states } = centreOpen([0, 2]);
    const result = chordCells(board, states, 4);
    expect(result.kind).toBe('chorded');
    if (result.kind !== 'chorded') return;
    expect(result.mineIndex).toBeNull();
    // Neighbors 1, 3, 5, 6, 7, 8 are hidden and unflagged. 1, 3 and 5 touch the mines; the bottom row is zeros.
    expect(result.cells.map((cell) => cell.index).sort((a, b) => a - b)).toEqual([
      1, 3, 5, 6, 7, 8,
    ]);
    expect(states[1]).toBe(CELL_REVEALED);
    expect(states[0]).toBe(CELL_FLAGGED);
    expect(states[2]).toBe(CELL_FLAGGED);
  });

  it('lists each cell once, even when several neighbors cascade into the same area', () => {
    const board = new Board({ width: 4, height: 4, mineCount: 1 }, [15]);
    const states = hiddenStates(board);
    revealCell(board, states, 10);
    states[15] = CELL_FLAGGED;
    const result = chordCells(board, states, 10);
    if (result.kind !== 'chorded') throw new Error(`expected chorded, got ${result.kind}`);
    const indices = result.cells.map((cell) => cell.index);
    expect(new Set(indices).size).toBe(indices.length);
    expect(indices).toHaveLength(14); // everything except the flagged mine and the chorded cell
  });

  it('lists neighbors in ascending order, each followed by what it opened', () => {
    const { board, states } = centreOpen([1, 3]); // wrong flags: both safe
    const result = chordCells(board, states, 4);
    if (result.kind !== 'chorded') throw new Error(`expected chorded, got ${result.kind}`);
    // Targets in order: 0 (mine), 2 (mine), 5, 6, 7, 8. Cell 5 shows 1. Cell 6 shows 0 and opens 7, which opens 8.
    expect(result.cells).toEqual([
      { index: 5, value: 1 },
      { index: 6, value: 0 },
      { index: 7, value: 0 },
      { index: 8, value: 0 },
    ]);
  });

  it('opens the safe neighbors and reports the lowest mine when a wrong flag leaves mines unflagged', () => {
    const { board, states } = centreOpen([1, 3]);
    const result = chordCells(board, states, 4);
    if (result.kind !== 'chorded') throw new Error(`expected chorded, got ${result.kind}`);
    expect(result.mineIndex).toBe(0);
    expect(states[0]).toBe(CELL_HIDDEN); // a hit mine is not marked revealed, as in `revealCell`
    expect(states[2]).toBe(CELL_HIDDEN);
    expect(states[1]).toBe(CELL_FLAGGED);
  });

  it('reports a mine with an empty cell list when only a mine is left to open', () => {
    // 4x1: . 1 M .  with a wrong flag on cell 0. The 1 sees one flag, so it chords, and the only
    // hidden unflagged neighbor is the mine.
    const board = new Board({ width: 4, height: 1, mineCount: 1 }, [2]);
    const states = hiddenStates(board);
    revealCell(board, states, 1);
    states[0] = CELL_FLAGGED;
    expect(chordCells(board, states, 1)).toEqual({ kind: 'chorded', cells: [], mineIndex: 2 });
  });
});
