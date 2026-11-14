import { describe, expect, it } from 'vitest';
import { Board } from './board.js';
import { PRESETS, type BoardConfig, type CellIndex } from './config.js';
import { InvalidBoardConfigError } from './errors.js';

/** A board with no mines. The layout is irrelevant for neighbor and coordinate tests. */
function emptyBoard(width: number, height: number): Board {
  return new Board({ width, height, mineCount: 0 }, []);
}

/** Runs `action` and returns what it threw, so a test can inspect the error and not only its type. */
function thrown(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  return undefined;
}

/** All cell indices of a board, in order. */
function allCells(board: Board): CellIndex[] {
  return Array.from({ length: board.config.width * board.config.height }, (_, i) => i);
}

describe('Board construction', () => {
  it('keeps the config it was given', () => {
    const board = new Board({ width: 3, height: 3, mineCount: 2 }, [0, 8]);
    expect(board.config).toEqual({ width: 3, height: 3, mineCount: 2 });
  });

  it('holds its own frozen copy of the config, so the caller cannot change the board afterwards', () => {
    const config = { width: 3, height: 3, mineCount: 2 };
    const board = new Board(config, [0, 8]);
    config.width = 9;
    config.mineCount = 0;
    expect(board.config).toEqual({ width: 3, height: 3, mineCount: 2 });
    expect(Object.isFrozen(board.config)).toBe(true);
  });

  it('copies the mine list, so changing the caller array afterwards changes nothing', () => {
    const mines = [0, 8];
    const board = new Board({ width: 3, height: 3, mineCount: 2 }, mines);
    mines[0] = 4;
    mines.push(5);
    expect(board.isMine(0)).toBe(true);
    expect(board.isMine(4)).toBe(false);
    expect(board.isMine(5)).toBe(false);
  });

  it('accepts any iterable of mines: arrays, sets and generators', () => {
    const config: BoardConfig = { width: 3, height: 3, mineCount: 2 };
    function* generated(): Generator<CellIndex> {
      yield 0;
      yield 8;
    }
    for (const mines of [[0, 8], new Set([0, 8]), generated()]) {
      const board = new Board(config, mines);
      expect(allCells(board).filter((i) => board.isMine(i))).toEqual([0, 8]);
    }
  });

  it('accepts every preset with a matching number of mines', () => {
    for (const config of Object.values(PRESETS)) {
      const mines = Array.from({ length: config.mineCount }, (_, i) => i);
      expect(() => new Board(config, mines)).not.toThrow();
    }
  });

  it('accepts a board with no mines and a 1x1 board', () => {
    expect(() => new Board({ width: 1, height: 1, mineCount: 0 }, [])).not.toThrow();
    expect(() => new Board({ width: 5, height: 5, mineCount: 0 }, [])).not.toThrow();
  });

  it('rejects an invalid config with InvalidBoardConfigError naming the field', () => {
    const error = thrown(() => new Board({ width: 0, height: 3, mineCount: 0 }, []));
    expect(error).toBeInstanceOf(InvalidBoardConfigError);
    expect((error as InvalidBoardConfigError).reason).toMatch(/^width /);
  });

  it('rejects a mine outside the board with RangeError', () => {
    const config: BoardConfig = { width: 9, height: 9, mineCount: 1 };
    for (const bad of [-1, 81, 1000]) {
      expect(thrown(() => new Board(config, [bad]))).toBeInstanceOf(RangeError);
    }
  });

  it('rejects a mine index that is not a whole number with RangeError', () => {
    const config: BoardConfig = { width: 3, height: 3, mineCount: 1 };
    for (const bad of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(thrown(() => new Board(config, [bad]))).toBeInstanceOf(RangeError);
    }
  });

  it('rejects a mine list shorter than mineCount, with a reason that starts with mineCount', () => {
    const error = thrown(() => new Board({ width: 3, height: 3, mineCount: 3 }, [0, 1]));
    expect(error).toBeInstanceOf(InvalidBoardConfigError);
    expect((error as InvalidBoardConfigError).reason).toMatch(/^mineCount /);
  });

  it('rejects a mine list longer than mineCount, with a reason that starts with mineCount', () => {
    const error = thrown(() => new Board({ width: 3, height: 3, mineCount: 1 }, [0, 1]));
    expect(error).toBeInstanceOf(InvalidBoardConfigError);
    expect((error as InvalidBoardConfigError).reason).toMatch(/^mineCount is 1 but .*more/);
  });

  it('rejects a repeated mine: it counts once, so the distinct count no longer matches', () => {
    const error = thrown(() => new Board({ width: 3, height: 3, mineCount: 2 }, [5, 5]));
    expect(error).toBeInstanceOf(InvalidBoardConfigError);
    expect((error as InvalidBoardConfigError).reason).toMatch(/^mineCount /);
  });

  it('collapses a repeated mine when the distinct count still matches', () => {
    const board = new Board({ width: 3, height: 3, mineCount: 2 }, [5, 5, 6]);
    expect(allCells(board).filter((i) => board.isMine(i))).toEqual([5, 6]);
  });

  it('stops reading a mine list as soon as it holds too many distinct cells', () => {
    // An endless generator would hang a constructor that read it to the end.
    function* endless(): Generator<CellIndex> {
      for (let i = 0; ; i = (i + 1) % 9) yield i;
    }
    const error = thrown(() => new Board({ width: 3, height: 3, mineCount: 2 }, endless()));
    expect(error).toBeInstanceOf(InvalidBoardConfigError);
  });
});

describe('Board.isMine', () => {
  it('reports exactly the cells it was built with', () => {
    const board = new Board({ width: 3, height: 3, mineCount: 3 }, [1, 4, 7]);
    expect(allCells(board).map((i) => board.isMine(i))).toEqual([
      false,
      true,
      false,
      false,
      true,
      false,
      false,
      true,
      false,
    ]);
  });

  it('throws RangeError for an index outside the board or not a whole number', () => {
    const board = emptyBoard(3, 3);
    for (const bad of [-1, 9, 1.5, Number.NaN]) {
      expect(thrown(() => board.isMine(bad))).toBeInstanceOf(RangeError);
    }
  });
});

describe('Board.neighbors', () => {
  it('gives 3 neighbors to a corner, 5 to an edge cell and 8 to an interior cell (Minesweeper rules)', () => {
    const board = emptyBoard(5, 5);
    expect(board.neighbors(0)).toHaveLength(3); // top-left
    expect(board.neighbors(4)).toHaveLength(3); // top-right
    expect(board.neighbors(20)).toHaveLength(3); // bottom-left
    expect(board.neighbors(24)).toHaveLength(3); // bottom-right
    expect(board.neighbors(2)).toHaveLength(5); // top edge
    expect(board.neighbors(10)).toHaveLength(5); // left edge
    expect(board.neighbors(14)).toHaveLength(5); // right edge
    expect(board.neighbors(22)).toHaveLength(5); // bottom edge
    expect(board.neighbors(12)).toHaveLength(8); // center
  });

  it('lists neighbors in ascending index order', () => {
    const board = emptyBoard(3, 3);
    expect(board.neighbors(4)).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
    expect(board.neighbors(0)).toEqual([1, 3, 4]);
    expect(board.neighbors(8)).toEqual([4, 5, 7]);
  });

  it('does not wrap around the left and right edges', () => {
    const board = emptyBoard(3, 3);
    // Cell 3 is the start of row 1; cell 2 (end of row 0) is not next to it.
    expect(board.neighbors(3)).toEqual([0, 1, 4, 6, 7]);
    // Cell 5 is the end of row 1; cell 6 (start of row 2) is not next to it.
    expect(board.neighbors(5)).toEqual([1, 2, 4, 7, 8]);
  });

  it('never lists the cell itself', () => {
    const board = emptyBoard(4, 4);
    for (const i of allCells(board)) expect(board.neighbors(i)).not.toContain(i);
  });

  it('handles one-row boards', () => {
    const board = emptyBoard(5, 1);
    expect(board.neighbors(0)).toEqual([1]);
    expect(board.neighbors(2)).toEqual([1, 3]);
    expect(board.neighbors(4)).toEqual([3]);
  });

  it('handles one-column boards', () => {
    const board = emptyBoard(1, 5);
    expect(board.neighbors(0)).toEqual([1]);
    expect(board.neighbors(2)).toEqual([1, 3]);
    expect(board.neighbors(4)).toEqual([3]);
  });

  it('gives a single cell no neighbors', () => {
    expect(emptyBoard(1, 1).neighbors(0)).toEqual([]);
  });

  it('is symmetric and has the expected number of links on several board sizes', () => {
    for (const [width, height] of [
      [2, 2],
      [3, 5],
      [5, 3],
      [9, 9],
      [30, 16],
      [1, 7],
    ] as const) {
      const board = emptyBoard(width, height);
      let links = 0;
      for (const i of allCells(board)) {
        for (const j of board.neighbors(i)) {
          links++;
          expect(board.neighbors(j)).toContain(i);
        }
      }
      // Every ordered pair of king-move neighbors on a width x height grid.
      expect(links).toBe(8 * width * height - 6 * width - 6 * height + 4);
    }
  });

  it('returns the same array on every call: nothing is allocated after the first', () => {
    const board = emptyBoard(9, 9);
    for (const i of [0, 4, 40, 80]) {
      expect(board.neighbors(i)).toBe(board.neighbors(i));
    }
  });

  it('returns a frozen array, so a caller cannot corrupt the cache', () => {
    const board = emptyBoard(3, 3);
    const list = board.neighbors(4) as CellIndex[];
    expect(Object.isFrozen(list)).toBe(true);
    expect(() => list.push(99)).toThrow(TypeError);
    expect(board.neighbors(4)).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
  });

  it('keeps caches of different boards apart', () => {
    const small = emptyBoard(3, 3);
    const wide = emptyBoard(5, 3);
    expect(small.neighbors(4)).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
    expect(wide.neighbors(4)).toEqual([3, 8, 9]);
  });

  it('throws RangeError for an index outside the board or not a whole number', () => {
    const board = emptyBoard(3, 3);
    for (const bad of [-1, 9, 2.5, Number.NaN]) {
      expect(thrown(() => board.neighbors(bad))).toBeInstanceOf(RangeError);
    }
  });
});

describe('Board.adjacentMines', () => {
  it('counts neighbor mines on a hand-built 3x3 layout (mines in opposite corners)', () => {
    // M . .      0 1 0
    // . . .  ->  1 2 1   (a mine cell shows the count of its neighbors, not itself)
    // . . M      0 1 0
    const board = new Board({ width: 3, height: 3, mineCount: 2 }, [0, 8]);
    expect(allCells(board).map((i) => board.adjacentMines(i))).toEqual([0, 1, 0, 1, 2, 1, 0, 1, 0]);
  });

  it('reaches 8 for a cell surrounded by mines', () => {
    const board = new Board({ width: 3, height: 3, mineCount: 8 }, [0, 1, 2, 3, 5, 6, 7, 8]);
    expect(board.adjacentMines(4)).toBe(8);
  });

  it('does not count the cell itself', () => {
    const board = new Board({ width: 3, height: 3, mineCount: 1 }, [4]);
    expect(board.adjacentMines(4)).toBe(0);
  });

  it('works on a one-row board', () => {
    const board = new Board({ width: 5, height: 1, mineCount: 2 }, [1, 3]);
    expect(allCells(board).map((i) => board.adjacentMines(i))).toEqual([1, 0, 2, 0, 1]);
  });

  it('does not count mines across a row wrap', () => {
    // Mine at the end of row 0 (index 2); cell 3 starts row 1 and is not next to it.
    const board = new Board({ width: 3, height: 3, mineCount: 1 }, [2]);
    expect(board.adjacentMines(3)).toBe(0);
    expect(board.adjacentMines(4)).toBe(1);
  });

  it('is zero everywhere on a board without mines', () => {
    const board = emptyBoard(9, 9);
    expect(allCells(board).every((i) => board.adjacentMines(i) === 0)).toBe(true);
  });

  it('throws RangeError for an index outside the board or not a whole number', () => {
    const board = emptyBoard(3, 3);
    for (const bad of [-1, 9, 0.5, Number.NaN]) {
      expect(thrown(() => board.adjacentMines(bad))).toBeInstanceOf(RangeError);
    }
  });
});

describe('Board.indexOf and Board.coordsOf', () => {
  it('uses y * width + x, counted row by row from the top-left', () => {
    const board = emptyBoard(9, 9);
    expect(board.indexOf(0, 0)).toBe(0);
    expect(board.indexOf(8, 0)).toBe(8);
    expect(board.indexOf(0, 1)).toBe(9);
    expect(board.indexOf(4, 2)).toBe(22);
    expect(board.indexOf(8, 8)).toBe(80);
    expect(board.coordsOf(22)).toEqual({ x: 4, y: 2 });
  });

  it('round-trips for every cell of the expert board', () => {
    const board = emptyBoard(PRESETS.expert.width, PRESETS.expert.height);
    expect(board.config.width * board.config.height).toBe(480);
    for (const i of allCells(board)) {
      const { x, y } = board.coordsOf(i);
      expect(board.indexOf(x, y)).toBe(i);
    }
  });

  it('round-trips from coordinates too, on a non-square board', () => {
    const board = emptyBoard(30, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 30; x++) {
        expect(board.coordsOf(board.indexOf(x, y))).toEqual({ x, y });
      }
    }
  });

  it('rejects coordinates outside the board instead of wrapping into the next row', () => {
    const board = emptyBoard(9, 9);
    // (9, 0) would give index 9, which is a real cell (0, 1): it must throw, not wrap.
    for (const [x, y] of [
      [9, 0],
      [-1, 0],
      [0, 9],
      [0, -1],
      [1.5, 0],
      [0, 1.5],
      [Number.NaN, 0],
    ] as const) {
      expect(thrown(() => board.indexOf(x, y))).toBeInstanceOf(RangeError);
    }
  });

  it('rejects an index outside the board or not a whole number in coordsOf', () => {
    const board = emptyBoard(9, 9);
    for (const bad of [-1, 81, 1.5, Number.NaN]) {
      expect(thrown(() => board.coordsOf(bad))).toBeInstanceOf(RangeError);
    }
  });

  it('works on one-row and one-column boards', () => {
    const row = emptyBoard(5, 1);
    expect(row.indexOf(3, 0)).toBe(3);
    expect(row.coordsOf(3)).toEqual({ x: 3, y: 0 });
    const column = emptyBoard(1, 5);
    expect(column.indexOf(0, 3)).toBe(3);
    expect(column.coordsOf(3)).toEqual({ x: 0, y: 3 });
  });
});

describe('Board immutability', () => {
  it('answers the same way before and after any number of queries', () => {
    const board = new Board({ width: 3, height: 3, mineCount: 2 }, [0, 8]);
    const before = allCells(board).map((i) => [board.isMine(i), board.adjacentMines(i)]);
    for (const i of allCells(board)) {
      board.neighbors(i);
      board.coordsOf(i);
    }
    const after = allCells(board).map((i) => [board.isMine(i), board.adjacentMines(i)]);
    expect(after).toEqual(before);
    expect(board.config).toEqual({ width: 3, height: 3, mineCount: 2 });
  });

  it('has no method that changes the mines', () => {
    const board = new Board({ width: 3, height: 3, mineCount: 1 }, [4]);
    const names = Object.getOwnPropertyNames(Object.getPrototypeOf(board) as object);
    expect(names.sort()).toEqual(
      ['adjacentMines', 'constructor', 'coordsOf', 'indexOf', 'isMine', 'neighbors'].sort(),
    );
  });
});
