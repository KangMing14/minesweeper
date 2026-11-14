import { describe, expect, it } from 'vitest';
import { Board } from './board.js';
import { PRESETS, type CellIndex } from './config.js';
import {
  CELL_FLAGGED,
  CELL_HIDDEN,
  CELL_REVEALED,
  buildGameView,
  type GameStatus,
  type GameView,
} from './view.js';

// M . .
// . . .
// . . M
const diagonal = (): Board => new Board({ width: 3, height: 3, mineCount: 2 }, [0, 8]);

/** A cell-state array with the given cells set and every other cell hidden. */
function states(
  length: number,
  revealed: readonly CellIndex[] = [],
  flagged: readonly CellIndex[] = [],
): Uint8Array {
  const result = new Uint8Array(length).fill(CELL_HIDDEN);
  for (const i of revealed) result[i] = CELL_REVEALED;
  for (const i of flagged) result[i] = CELL_FLAGGED;
  return result;
}

describe('buildGameView', () => {
  it('shows an untouched board as all hidden, with the config size and zero counts', () => {
    const view = buildGameView(diagonal(), states(9), 'ready');
    expect(view.width).toBe(3);
    expect(view.height).toBe(3);
    expect(view.status).toBe('ready');
    expect(view.cells).toHaveLength(9);
    expect(view.cells.every((cell) => cell.state === 'hidden')).toBe(true);
    expect(view.revealedCount).toBe(0);
    expect(view.flagCount).toBe(0);
    expect(view.minesRemaining).toBe(2);
  });

  it('gives a revealed cell the number of mines around it', () => {
    const view = buildGameView(diagonal(), states(9, [1, 2, 4]), 'playing');
    expect(view.cells[1]).toEqual({ state: 'revealed', value: 1 });
    expect(view.cells[2]).toEqual({ state: 'revealed', value: 0 });
    expect(view.cells[4]).toEqual({ state: 'revealed', value: 2 });
    expect(view.revealedCount).toBe(3);
  });

  it('shows a flag as flagged, whether or not the cell is a mine', () => {
    const view = buildGameView(diagonal(), states(9, [], [0, 4]), 'playing');
    expect(view.cells[0]).toEqual({ state: 'flagged' });
    expect(view.cells[4]).toEqual({ state: 'flagged' });
    expect(view.flagCount).toBe(2);
  });

  it('counts mines remaining as the mine count minus the flags, which can go below zero', () => {
    expect(buildGameView(diagonal(), states(9, [], [4]), 'playing').minesRemaining).toBe(1);
    expect(buildGameView(diagonal(), states(9, [], [1, 2, 3]), 'playing').minesRemaining).toBe(-1);
  });

  it('counts revealed and flagged cells separately', () => {
    const view = buildGameView(diagonal(), states(9, [1, 2], [3]), 'playing');
    expect(view.revealedCount).toBe(2);
    expect(view.flagCount).toBe(1);
  });

  it('lists the cells row by row, so cell i of the view is cell index i', () => {
    const view = buildGameView(diagonal(), states(9, [5], [6]), 'playing');
    view.cells.forEach((cell, i) => {
      if (i === 5) expect(cell.state).toBe('revealed');
      else if (i === 6) expect(cell.state).toBe('flagged');
      else expect(cell.state).toBe('hidden');
    });
  });

  it('works on the expert board', () => {
    const board = new Board(
      PRESETS.expert,
      Array.from({ length: 99 }, (_, i) => i),
    );
    const view = buildGameView(board, states(480), 'ready');
    expect(view.width).toBe(30);
    expect(view.height).toBe(16);
    expect(view.cells).toHaveLength(480);
    expect(view.minesRemaining).toBe(99);
  });

  it('rejects a cell-state array of the wrong length', () => {
    expect(() => buildGameView(diagonal(), states(8), 'ready')).toThrow(RangeError);
    expect(() => buildGameView(diagonal(), states(10), 'ready')).toThrow(RangeError);
  });
});

describe('buildGameView: exposedMines', () => {
  it.each<GameStatus>(['ready', 'playing'])('is absent while the status is %s', (status) => {
    const view = buildGameView(diagonal(), states(9, [4]), status);
    expect('exposedMines' in view).toBe(false);
    expect(view.exposedMines).toBeUndefined();
  });

  it.each<GameStatus>(['won', 'lost'])(
    'lists every mine, ascending, once the status is %s',
    (status) => {
      const view = buildGameView(diagonal(), states(9, [1, 2, 3, 4, 5, 6, 7]), status);
      expect(view.exposedMines).toEqual([0, 8]);
    },
  );

  it('lists mines that were flagged or hidden alike', () => {
    const view = buildGameView(diagonal(), states(9, [1], [0]), 'lost');
    expect(view.exposedMines).toEqual([0, 8]);
  });

  it('is an empty list, not absent, for a finished game with no mines', () => {
    const board = new Board({ width: 1, height: 1, mineCount: 0 }, []);
    const view = buildGameView(board, states(1, [0]), 'won');
    expect(view.exposedMines).toEqual([]);
  });
});

describe('buildGameView: hidden cells carry no mine information', () => {
  /** Same size, same mine count, different mine positions. */
  const layoutA = new Board({ width: 4, height: 4, mineCount: 3 }, [0, 5, 15]);
  const layoutB = new Board({ width: 4, height: 4, mineCount: 3 }, [3, 6, 12]);

  it.each<GameStatus>(['ready', 'playing'])(
    'gives the same serialized view for two different layouts when nothing is revealed (%s)',
    (status) => {
      const cells = states(16, [], [0, 1, 3, 5]);
      const a = JSON.stringify(buildGameView(layoutA, cells, status));
      const b = JSON.stringify(buildGameView(layoutB, cells, status));
      expect(a).toBe(b);
    },
  );

  it('does not let a flag on a mine look different from a flag on a safe cell', () => {
    const flagOnMine = JSON.stringify(
      buildGameView(layoutA, states(16, [], [0]), 'playing').cells[0],
    );
    const flagOnSafe = JSON.stringify(
      buildGameView(layoutA, states(16, [], [1]), 'playing').cells[1],
    );
    expect(flagOnMine).toBe(flagOnSafe);
  });

  it('shows only a number for a revealed cell: layouts with the same count look identical', () => {
    // Cell 10 (x=2, y=2) touches exactly one mine in both layouts, but a different cell each time.
    const oneNear = new Board({ width: 4, height: 4, mineCount: 1 }, [5]);
    const otherNear = new Board({ width: 4, height: 4, mineCount: 1 }, [11]);
    const a = buildGameView(oneNear, states(16, [10]), 'playing');
    const b = buildGameView(otherNear, states(16, [10]), 'playing');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('serializes an in-progress view with only the documented keys', () => {
    const view = buildGameView(layoutA, states(16, [2, 7], [0, 1]), 'playing');
    const parsed = JSON.parse(JSON.stringify(view)) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual(
      ['cells', 'flagCount', 'height', 'minesRemaining', 'revealedCount', 'status', 'width'].sort(),
    );
    for (const cell of parsed['cells'] as Record<string, unknown>[]) {
      expect(Object.keys(cell).sort()).toEqual(
        cell['state'] === 'revealed' ? ['state', 'value'] : ['state'],
      );
    }
  });
});

describe('buildGameView: snapshot and immutability', () => {
  it('is deeply frozen', () => {
    const view = buildGameView(diagonal(), states(9, [1], [0]), 'lost');
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.cells)).toBe(true);
    expect(view.cells.every((cell) => Object.isFrozen(cell))).toBe(true);
    expect(Object.isFrozen(view.exposedMines)).toBe(true);
  });

  it('rejects changes in strict mode', () => {
    const view = buildGameView(diagonal(), states(9), 'ready');
    const writable = view as { -readonly [K in keyof GameView]: GameView[K] };
    expect(() => {
      writable.status = 'won';
    }).toThrow(TypeError);
    expect(() => {
      (view.cells as unknown[]).push({ state: 'hidden' });
    }).toThrow(TypeError);
  });

  it('does not change when the cell-state array it was built from changes afterwards', () => {
    const cells = states(9);
    const view = buildGameView(diagonal(), cells, 'ready');
    const before = JSON.stringify(view);
    cells[4] = CELL_REVEALED;
    cells[0] = CELL_FLAGGED;
    expect(JSON.stringify(view)).toBe(before);
  });

  it('returns a new object on every call, equal in content', () => {
    const cells = states(9, [1], [0]);
    const first = buildGameView(diagonal(), cells, 'playing');
    const second = buildGameView(diagonal(), cells, 'playing');
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});
