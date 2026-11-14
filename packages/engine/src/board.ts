import { validateBoardConfig, type BoardConfig, type CellIndex } from './config.js';
import { InvalidBoardConfigError } from './errors.js';

/**
 * Throws `RangeError` unless `value` is a whole number from 0 to `limit - 1`.
 *
 * @remarks
 * One check for every index and coordinate that enters `Board`, so no method can accept a fractional value
 * or `NaN` by accident. `label` names the argument in the message.
 */
function assertWholeNumberBelow(value: number, limit: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value >= limit) {
    throw new RangeError(
      `${label} must be an integer from 0 to ${limit - 1}, got ${String(value)}`,
    );
  }
}

/**
 * An immutable mine layout on a rectangular grid, with fast neighbor and adjacency lookups.
 *
 * @remarks
 * A `Board` only knows where the mines are. It has no idea what the player has revealed or flagged: that
 * state belongs to `Game`. Nothing on a `Board` changes after construction, so one board can be shared by
 * any number of games, for example both players of a race.
 *
 * Cells are addressed by `CellIndex`, `y * width + x`, counted row by row from the top-left. Methods that
 * take an index or a coordinate throw `RangeError` when it is not a whole number inside the board, so a
 * bad index fails loudly instead of reading a neighboring row.
 *
 * Neighbor lists are computed the first time they are asked for and cached after that, so `neighbors` does
 * not allocate on later calls.
 *
 * A `Board` holds mine positions. It must never be sent to a client while a game is in progress (spec
 * section 4.1, `CLAUDE.md` rule 8); clients see `GameView`, not `Board`.
 *
 * @example
 * ```ts
 * // M . .
 * // . . .
 * // . . M
 * const board = new Board({ width: 3, height: 3, mineCount: 2 }, [0, 8]);
 * board.isMine(0); // true
 * board.adjacentMines(4); // 2
 * board.neighbors(0); // [1, 3, 4]
 * board.indexOf(2, 1); // 5
 * ```
 */
export class Board {
  /** The size and mine count of this board. A frozen copy: later changes to the object passed in do not reach it. */
  readonly config: BoardConfig;

  /** One byte per cell: 1 for a mine, 0 otherwise. */
  readonly #mineFlags: Uint8Array;

  /** Neighbor list per cell, filled on first use. `undefined` means not computed yet. */
  readonly #neighborCache: (readonly CellIndex[] | undefined)[];

  /**
   * Builds a board from a config and the positions of its mines.
   *
   * @remarks
   * The checks run in this order: the config (`validateBoardConfig`), then every mine index, then the number
   * of distinct mines. Repeated indices collapse into one mine before the count is compared with
   * `config.mineCount`, so a list such as `[5, 5]` for two mines is rejected, while `[5, 5, 6]` for two mines
   * is accepted as the mines 5 and 6. Reading stops as soon as the list holds more distinct mines than
   * `config.mineCount`.
   *
   * The mines are copied, so changing the iterable afterwards does not change the board. Pass a finite
   * iterable.
   *
   * @param config - The size and mine count. Must pass `validateBoardConfig`.
   * @param mines - The cell index of every mine.
   * @throws {@link InvalidBoardConfigError} if the config is invalid, or if the number of distinct mines
   * differs from `config.mineCount` (the reason then starts with `mineCount`).
   * @throws `RangeError` if a mine index is not a whole number inside the board.
   *
   * @example
   * ```ts
   * const board = new Board({ width: 9, height: 9, mineCount: 2 }, new Set([3, 40]));
   * board.isMine(40); // true
   * ```
   */
  constructor(config: BoardConfig, mines: Iterable<CellIndex>) {
    validateBoardConfig(config);
    const { width, height, mineCount } = config;
    const total = width * height;

    const flags = new Uint8Array(total);
    let distinct = 0;
    for (const index of mines) {
      assertWholeNumberBelow(index, total, 'mine index');
      if (flags[index] === 0) {
        flags[index] = 1;
        distinct++;
        // Stop early so an endless iterable cannot hang the constructor.
        if (distinct > mineCount) {
          throw new InvalidBoardConfigError(
            `mineCount is ${mineCount} but the mine list holds more distinct cells`,
          );
        }
      }
    }
    if (distinct !== mineCount) {
      throw new InvalidBoardConfigError(
        `mineCount is ${mineCount} but the mine list holds ${distinct} distinct cells`,
      );
    }

    this.config = Object.freeze({ width, height, mineCount });
    this.#mineFlags = flags;
    this.#neighborCache = new Array<readonly CellIndex[] | undefined>(total).fill(undefined);
  }

  /**
   * Tells whether a cell holds a mine.
   *
   * @param index - The cell to look at.
   * @returns `true` for a mine, `false` for a safe cell.
   * @throws `RangeError` if `index` is not a whole number inside the board.
   *
   * @example
   * ```ts
   * const board = new Board({ width: 3, height: 3, mineCount: 1 }, [4]);
   * board.isMine(4); // true
   * board.isMine(0); // false
   * ```
   */
  isMine(index: CellIndex): boolean {
    assertWholeNumberBelow(index, this.#mineFlags.length, 'index');
    return this.#mineFlags[index] === 1;
  }

  /**
   * The cells that touch a cell, sideways and diagonally, in ascending index order.
   *
   * @remarks
   * A corner has 3 neighbors, an edge cell 5 and an interior cell 8; on a one-row or one-column board an
   * end cell has 1 and the others 2, and a single cell has none. The cell itself is never listed, and a cell
   * at the end of a row does not touch the first cell of the next row.
   *
   * The returned array is computed once per cell, frozen, and returned again on every later call: the same
   * array each time, so the call allocates nothing after the first one. Do not rely on it being a new array.
   *
   * @param index - The cell whose neighbors to list.
   * @returns The neighbor indices, ascending.
   * @throws `RangeError` if `index` is not a whole number inside the board.
   *
   * @example
   * ```ts
   * const board = new Board({ width: 3, height: 3, mineCount: 0 }, []);
   * board.neighbors(0); // [1, 3, 4]
   * board.neighbors(4); // [0, 1, 2, 3, 5, 6, 7, 8]
   * ```
   */
  neighbors(index: CellIndex): readonly CellIndex[] {
    assertWholeNumberBelow(index, this.#mineFlags.length, 'index');
    let list = this.#neighborCache[index];
    if (list === undefined) {
      list = this.#computeNeighbors(index);
      this.#neighborCache[index] = list;
    }
    return list;
  }

  /**
   * How many of a cell's neighbors are mines: the number a revealed cell shows.
   *
   * @remarks
   * The cell's own mine, if it has one, is not counted. For a safe cell the result is its displayed value,
   * from 0 to 8.
   *
   * @param index - The cell to count around.
   * @returns The number of neighboring mines.
   * @throws `RangeError` if `index` is not a whole number inside the board.
   *
   * @example
   * ```ts
   * const board = new Board({ width: 3, height: 3, mineCount: 2 }, [0, 8]);
   * board.adjacentMines(4); // 2
   * board.adjacentMines(1); // 1
   * ```
   */
  adjacentMines(index: CellIndex): number {
    let count = 0;
    for (const neighbor of this.neighbors(index)) {
      if (this.#mineFlags[neighbor] === 1) count++;
    }
    return count;
  }

  /**
   * Converts a column and a row into a cell index: `y * width + x`.
   *
   * @remarks
   * Both coordinates are checked against the board, so `x` equal to `width` is rejected instead of
   * silently pointing at the first cell of the next row.
   *
   * @param x - Column, from 0 at the left.
   * @param y - Row, from 0 at the top.
   * @returns The cell index.
   * @throws `RangeError` if `x` or `y` is not a whole number inside the board.
   *
   * @example
   * ```ts
   * const board = new Board({ width: 9, height: 9, mineCount: 0 }, []);
   * board.indexOf(4, 2); // 22
   * ```
   */
  indexOf(x: number, y: number): CellIndex {
    assertWholeNumberBelow(x, this.config.width, 'x');
    assertWholeNumberBelow(y, this.config.height, 'y');
    return y * this.config.width + x;
  }

  /**
   * Converts a cell index into its column and row. The reverse of `indexOf`.
   *
   * @param index - The cell index.
   * @returns The column `x` (from 0 at the left) and the row `y` (from 0 at the top).
   * @throws `RangeError` if `index` is not a whole number inside the board.
   *
   * @example
   * ```ts
   * const board = new Board({ width: 9, height: 9, mineCount: 0 }, []);
   * board.coordsOf(22); // { x: 4, y: 2 }
   * ```
   */
  coordsOf(index: CellIndex): { readonly x: number; readonly y: number } {
    assertWholeNumberBelow(index, this.#mineFlags.length, 'index');
    const x = index % this.config.width;
    return { x, y: (index - x) / this.config.width };
  }

  /** Builds the frozen neighbor list of one cell. Rows go top to bottom and columns left to right, so the result is ascending. */
  #computeNeighbors(index: CellIndex): readonly CellIndex[] {
    const { width, height } = this.config;
    const x = index % width;
    const y = (index - x) / width;
    const list: CellIndex[] = [];
    for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
      for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
        if (nx !== x || ny !== y) list.push(ny * width + nx);
      }
    }
    return Object.freeze(list);
  }
}
