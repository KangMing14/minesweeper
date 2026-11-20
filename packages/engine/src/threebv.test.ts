import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Board } from './board.js';
import { PRESETS, cellCount, safeCellCount } from './config.js';
import type { BoardConfig } from './config.js';
import { Game } from './game.js';
import { SeededBoardGenerator } from './generator.js';
import { computeThreeBV } from './threebv.js';

// 3BV (Bechtel's Board Benchmark Value, M2-T05) is the least number of plain reveals that clears a board when
// the player knows where every mine is: one click for each connected group of zero cells (which also opens the
// numbered cells around it), plus one click for each numbered cell that touches no zero. Flags and chords play
// no part. Every expected value below that is not produced by a plain reference was worked out by hand, and the
// working is in the comment above it.

const UINT32_MAX = 4294967295;

/** A board of the given size with mines exactly at `mines`. */
const boardOf = (width: number, height: number, mines: readonly number[]): Board =>
  new Board({ width, height, mineCount: mines.length }, mines);

describe('computeThreeBV: boards worked out by hand', () => {
  it('is 1 for a board without mines: the whole board is one opening', () => {
    expect(computeThreeBV(boardOf(5, 5, []))).toBe(1);
    expect(computeThreeBV(boardOf(1, 6, []))).toBe(1);
    expect(computeThreeBV(boardOf(7, 1, []))).toBe(1);
  });

  it('is 1 for a single cell, which cannot hold a mine', () => {
    expect(computeThreeBV(boardOf(1, 1, []))).toBe(1);
  });

  it('is the number of safe cells when no cell is a zero (a mine in the middle of 3x3)', () => {
    // Every one of the 8 safe cells touches the mine, so none is a zero and each needs its own click.
    expect(computeThreeBV(boardOf(3, 3, [4]))).toBe(8);
  });

  it('counts one click per opening and none for the numbers around it (3x3, mines 0 and 8)', () => {
    // Cells 2 and 6 are the only zeros and they do not touch. Opening 2 covers 1, 2, 4, 5; opening 6 covers
    // 3, 4, 6, 7. All 7 safe cells are covered, so 3BV = 2 openings + 0 isolated numbers.
    expect(computeThreeBV(boardOf(3, 3, [0, 8]))).toBe(2);
  });

  it('is 1 when all the zeros of a 5x5 board with four corner mines are one connected opening', () => {
    // The nine zeros 2, 7, 10, 11, 12, 13, 14, 17, 22 form one group through the middle, and each of the 12
    // numbered cells (1, 3, 5, 6, 8, 9, 15, 16, 18, 19, 21, 23) touches one of them.
    expect(computeThreeBV(boardOf(5, 5, [0, 4, 20, 24]))).toBe(1);
  });

  it('counts two separate openings in a row (1x5, mine at 2)', () => {
    // Zeros: cell 0 (touches only cell 1) and cell 4 (touches only cell 3). They are not neighbors.
    // Opening 0 covers 0, 1; opening 4 covers 3, 4. 3BV = 2.
    expect(computeThreeBV(boardOf(5, 1, [2]))).toBe(2);
  });

  it('counts every number when mines alternate along a row (1x7, mines 1, 3, 5)', () => {
    // Safe cells 0, 2, 4, 6 show 1, 2, 2, 1; none is a zero, so 3BV = 4 isolated numbers.
    expect(computeThreeBV(boardOf(7, 1, [1, 3, 5]))).toBe(4);
  });

  it('adds openings and isolated numbers (1x9, mines 3 and 5)', () => {
    // Zeros: 0, 1 (one group, covering 0, 1, 2) and 7, 8 (one group, covering 6, 7, 8).
    // Cell 4 shows 2 and touches no zero. 3BV = 2 openings + 1 isolated number = 3.
    expect(computeThreeBV(boardOf(9, 1, [3, 5]))).toBe(3);
  });

  it('adds openings and isolated numbers on a 2D board (4x4, mines on the diagonal 0, 5, 10, 15)', () => {
    // Values: 1:2  2:1  3:0  4:2  6:2  7:1  8:1  9:2  11:2  12:0  13:1  14:2.
    // Zeros 3 and 12 are not neighbors: opening 3 covers 2, 3, 6, 7 and opening 12 covers 8, 9, 12, 13.
    // The numbers 1, 4, 11, 14 touch no zero. 3BV = 2 openings + 4 isolated numbers = 6.
    expect(computeThreeBV(boardOf(4, 4, [0, 5, 10, 15]))).toBe(6);
  });

  it('is 1 when the only safe cell is a number (1x2, one mine)', () => {
    expect(computeThreeBV(boardOf(2, 1, [0]))).toBe(1);
    expect(computeThreeBV(boardOf(2, 2, [0, 1, 2]))).toBe(1);
  });

  it('is the number of safe cells when mines sit in the middle of every edge (3x3, mines 1, 3, 5, 7)', () => {
    // The corners show 2 and the center shows 4; no cell is a zero, so each of the 5 safe cells is a click.
    expect(computeThreeBV(boardOf(3, 3, [1, 3, 5, 7]))).toBe(5);
  });
});

describe('computeThreeBV: large boards', () => {
  it('handles the largest legal board in one opening without recursion', () => {
    // 100x100 and no mines: one group of 10,000 zeros. A recursive search would overflow the stack.
    expect(computeThreeBV(boardOf(100, 100, []))).toBe(1);
  });

  it('is 1 for the same board with a single mine in a corner', () => {
    // One mine at 0 makes cells 1, 100 and 101 numbers; every other cell is a zero, all connected, and each
    // of the three numbers touches a zero.
    expect(computeThreeBV(boardOf(100, 100, [0]))).toBe(1);
  });

  it('works on a dense generated 100x100 board and agrees with the perfect player', () => {
    const config: BoardConfig = { width: 100, height: 100, mineCount: 2000 };
    const { board } = new SeededBoardGenerator().generate(config, 99);
    const value = computeThreeBV(board);
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(safeCellCount(config));
    expect(value).toBe(perfectPlayerClicks(board));
  });
});

describe('computeThreeBV: the preset boards', () => {
  it('stays between 1 and the number of safe cells for 30 seeds of every preset', () => {
    for (const config of Object.values(PRESETS)) {
      for (let seed = 1; seed <= 30; seed += 1) {
        const { board } = new SeededBoardGenerator().generate(config, seed);
        const value = computeThreeBV(board);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(safeCellCount(config));
      }
    }
  });

  it('is the same every time it is asked and for equal boards', () => {
    const { board } = new SeededBoardGenerator().generate(PRESETS.expert, 12345);
    const { board: same } = new SeededBoardGenerator().generate(PRESETS.expert, 12345);
    expect(computeThreeBV(board)).toBe(computeThreeBV(board));
    expect(computeThreeBV(same)).toBe(computeThreeBV(board));
  });
});

// ---- References ------------------------------------------------------------------------------------------

/**
 * The perfect player, played on the real engine: reveal each zero that is still closed (every such click
 * opens one new group of zeros), then every safe cell that is still closed (an isolated number), and count
 * the clicks that did something. The game must then be won. This uses `Game`'s own flood fill, so it
 * does not share any code with `computeThreeBV`.
 */
function perfectPlayerClicks(board: Board): number {
  const game = new Game(board);
  const total = cellCount(board.config);
  const open = new Set<number>();
  let clicks = 0;
  let t = 0;
  const click = (index: number): void => {
    if (open.has(index)) return;
    const events = game.apply({ type: 'reveal', index, t });
    t += 1;
    for (const event of events) {
      if (event.type === 'cellsRevealed') for (const cell of event.cells) open.add(cell.index);
    }
    if (events.length > 0) clicks += 1;
  };
  for (let index = 0; index < total; index += 1) {
    if (!board.isMine(index) && board.adjacentMines(index) === 0) click(index);
  }
  for (let index = 0; index < total; index += 1) {
    if (!board.isMine(index)) click(index);
  }
  expect(game.view().status).toBe('won');
  return clicks;
}

/**
 * A plain reading of the definition for small boards: label the zero cells by repeated relaxation until the
 * labels stop changing (no recursion, no stack), count the labels, then count the safe cells that are
 * neither a zero nor next to one.
 */
function referenceThreeBV(board: Board): number {
  const total = cellCount(board.config);
  const isZero = (i: number): boolean => !board.isMine(i) && board.adjacentMines(i) === 0;
  const label = new Map<number, number>();
  for (let i = 0; i < total; i += 1) if (isZero(i)) label.set(i, i);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [cell, current] of label) {
      for (const next of board.neighbors(cell)) {
        const other = label.get(next);
        if (other !== undefined && other < current) {
          label.set(cell, other);
          changed = true;
          break;
        }
      }
    }
  }
  let value = new Set(label.values()).size;
  for (let i = 0; i < total; i += 1) {
    if (board.isMine(i) || isZero(i)) continue;
    if (!board.neighbors(i).some((n) => isZero(n))) value += 1;
  }
  return value;
}

/** A small board with any mine layout that leaves at least one safe cell. */
const smallBoard: fc.Arbitrary<Board> = fc
  .record({ width: fc.integer({ min: 1, max: 8 }), height: fc.integer({ min: 1, max: 8 }) })
  .chain(({ width, height }) =>
    fc
      .uniqueArray(fc.nat({ max: width * height - 1 }), { maxLength: width * height - 1 })
      .map((mines) => boardOf(width, height, mines)),
  );

describe('computeThreeBV: properties', () => {
  it('equals the clicks of a perfect player on the real engine', () => {
    fc.assert(
      fc.property(smallBoard, (board) => {
        expect(computeThreeBV(board)).toBe(perfectPlayerClicks(board));
      }),
      { numRuns: 1000 },
    );
  });

  it('equals a plain reading of the definition', () => {
    fc.assert(
      fc.property(smallBoard, (board) => {
        expect(computeThreeBV(board)).toBe(referenceThreeBV(board));
      }),
      { numRuns: 1000 },
    );
  });

  it('is at least 1 and at most the number of safe cells; it equals that number when no cell is a zero', () => {
    fc.assert(
      fc.property(smallBoard, (board) => {
        const value = computeThreeBV(board);
        const safe = safeCellCount(board.config);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(safe);
        const anyZero = Array.from({ length: cellCount(board.config) }, (_, i) => i).some(
          (i) => !board.isMine(i) && board.adjacentMines(i) === 0,
        );
        if (!anyZero) expect(value).toBe(safe);
      }),
      { numRuns: 1000 },
    );
  });

  it('is the same for generated boards of any seed (the value is a property of the board only)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: UINT32_MAX }), (seed) => {
        const { board } = new SeededBoardGenerator().generate(PRESETS.intermediate, seed);
        expect(computeThreeBV(board)).toBe(perfectPlayerClicks(board));
      }),
      { numRuns: 100 },
    );
  });
});
