import { InvalidBoardConfigError } from './errors.js';

/** Largest allowed `width` or `height`. Keeps a board (and the memory behind it) bounded. */
const MAX_DIMENSION = 100;

/**
 * Position of a cell on the board, counted row by row from the top-left: `y * width + x`.
 *
 * @remarks
 * A plain number rather than an `{ x, y }` object, so it is cheap to store, compare and put on the wire.
 * Whether an index is in range depends on the board it is used with; the type alone does not say.
 *
 * @example
 * ```ts
 * const width = 9;
 * const index: CellIndex = 2 * width + 4; // x = 4, y = 2 on a 9-wide board
 * ```
 */
export type CellIndex = number;

/**
 * The shape of a board: its size and how many mines it holds.
 *
 * @remarks
 * Any object of this shape is accepted by the type system; whether it describes a playable board is decided
 * by `validateBoardConfig`. The fields are `readonly` because a config is a value, not a thing to edit.
 *
 * @example
 * ```ts
 * const config: BoardConfig = { width: 9, height: 9, mineCount: 10 };
 * ```
 */
export interface BoardConfig {
  /** Number of columns. */
  readonly width: number;
  /** Number of rows. */
  readonly height: number;
  /** Number of mines on the board. */
  readonly mineCount: number;
}

/**
 * The three classic board sizes.
 *
 * @remarks
 * These are the working values of decision D-01: beginner 9x9 with 10 mines, intermediate 16x16 with 40 and
 * expert 30x16 with 99 (30 wide, 16 high). Which preset a ranked race uses is not decided yet (ADR-010). The
 * object and every preset in it are frozen, so no game can change the sizes for the next one.
 *
 * @example
 * ```ts
 * const config = PRESETS.expert; // { width: 30, height: 16, mineCount: 99 }
 * validateBoardConfig(config); // does not throw
 * ```
 */
export const PRESETS = Object.freeze({
  beginner: Object.freeze({ width: 9, height: 9, mineCount: 10 }),
  intermediate: Object.freeze({ width: 16, height: 16, mineCount: 40 }),
  expert: Object.freeze({ width: 30, height: 16, mineCount: 99 }),
});

/**
 * Checks that a config describes a board the engine can build, and throws if it does not.
 *
 * @remarks
 * The rules: `width` and `height` are integers from 1 to 100, and `mineCount` is an integer from 0 to
 * `width * height - 1`, so at least one safe cell always exists. One-row and one-column boards and a single
 * cell are legal. The checks run in the order width, height, mineCount and stop at the first problem.
 *
 * This is the basic check only. Generating a board with a guaranteed safe opening needs more safe cells than
 * one, so the generator adds a stricter limit of its own (M2-T02).
 *
 * @param config - The config to check.
 * @throws {@link InvalidBoardConfigError} if any rule is broken; its `reason` names the offending field.
 *
 * @example
 * ```ts
 * validateBoardConfig({ width: 9, height: 9, mineCount: 10 }); // ok
 * validateBoardConfig({ width: 9, height: 9, mineCount: 81 }); // throws InvalidBoardConfigError
 * ```
 */
export function validateBoardConfig(config: BoardConfig): void {
  const { width, height, mineCount } = config;
  if (!isIntegerInRange(width, 1, MAX_DIMENSION)) {
    throw new InvalidBoardConfigError(
      `width must be an integer from 1 to ${MAX_DIMENSION}, got ${String(width)}`,
    );
  }
  if (!isIntegerInRange(height, 1, MAX_DIMENSION)) {
    throw new InvalidBoardConfigError(
      `height must be an integer from 1 to ${MAX_DIMENSION}, got ${String(height)}`,
    );
  }
  const maxMines = width * height - 1;
  if (!isIntegerInRange(mineCount, 0, maxMines)) {
    throw new InvalidBoardConfigError(
      `mineCount must be an integer from 0 to ${maxMines} (cells minus one), got ${String(mineCount)}`,
    );
  }
}

/**
 * Total number of cells on a board.
 *
 * @remarks
 * Plain arithmetic: it does not validate. Call `validateBoardConfig` first when the config is not trusted.
 *
 * @param config - The board's config.
 * @returns `width * height`.
 *
 * @example
 * ```ts
 * cellCount(PRESETS.beginner); // 81
 * ```
 */
export function cellCount(config: BoardConfig): number {
  return config.width * config.height;
}

/**
 * Number of cells without a mine. A game is won when this many cells are revealed.
 *
 * @remarks
 * Plain arithmetic: it does not validate. Call `validateBoardConfig` first when the config is not trusted.
 *
 * @param config - The board's config.
 * @returns `width * height - mineCount`.
 *
 * @example
 * ```ts
 * safeCellCount(PRESETS.beginner); // 71
 * ```
 */
export function safeCellCount(config: BoardConfig): number {
  return cellCount(config) - config.mineCount;
}

/** True when `value` is a whole number in `min..max` (both included). False for NaN and the infinities. */
function isIntegerInRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}
