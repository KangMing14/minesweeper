import { Board } from './board.js';
import { cellCount, validateBoardConfig } from './config.js';
import type { BoardConfig, CellIndex } from './config.js';
import { InvalidBoardConfigError } from './errors.js';
import type { Prng } from './prng.js';

/** The largest opening zone there is: an interior cell and its 8 neighbors. */
const LARGEST_ZONE = 9;

/**
 * Chooses the cell where a game opens, so that the opening is safe and cascades.
 *
 * @remarks
 * The opening cell is picked so that it and every neighbor it has (its "opening zone", at most 9 cells) can
 * be kept free of mines. The cell then shows 0 and revealing it opens its neighbors and spreads on from
 * there. Corner and edge cells are allowed: a zone shrinks to the cells that exist, so a corner has a zone
 * of 4. This is the guaranteed shared opening of spec section 2.3.
 *
 * **Which cells can be picked.** A cell is a candidate when the cells outside its zone can hold all the
 * mines, that is `cellCount - zoneSize >= mineCount`. On an ordinary board every cell qualifies. On a very
 * dense board only the cells with a small zone (corners, then edges) do, and a config where no cell
 * qualifies is rejected. The test depends on the config alone, never on the seed, so a config is either
 * possible for every seed or for none.
 *
 * **The draw order is part of the stable contract of the generator.** `select` validates the config
 * first and then makes exactly one `nextInt` call, over the candidate cells in ascending index order (over
 * every cell when all qualify). A rejected config draws nothing. Changing this changes the board for an
 * existing seed; see `SeededBoardGenerator`.
 *
 * The class holds no state. A custom policy can replace it by providing the same `select` method.
 *
 * @example
 * ```ts
 * const policy = new SafeOpeningPolicy();
 * const [cell] = policy.select({ width: 9, height: 9, mineCount: 10 }, createPrng(42));
 * // `cell` is an index from 0 to 80; the generator keeps `cell` and its neighbors free of mines.
 * ```
 */
export class SafeOpeningPolicy {
  /**
   * Picks the opening cell for a board.
   *
   * @param config - The size and mine count of the board. Must pass `validateBoardConfig`.
   * @param prng - The generator to draw from. It is advanced by exactly one `nextInt` call.
   * @returns A frozen list with one cell index: the cell to reveal first.
   * @throws {@link InvalidBoardConfigError} if the config is invalid, or if the mines leave too few cells for
   * any opening zone (the reason starts with `mineCount` and says how many mines fit). Nothing is drawn
   * from `prng` in that case.
   *
   * @example
   * ```ts
   * new SafeOpeningPolicy().select({ width: 3, height: 3, mineCount: 5 }, createPrng(1)); // a corner: [0], [2], [6] or [8]
   * new SafeOpeningPolicy().select({ width: 3, height: 3, mineCount: 6 }, createPrng(1)); // throws InvalidBoardConfigError
   * ```
   */
  select(config: BoardConfig, prng: Prng): readonly CellIndex[] {
    validateBoardConfig(config);
    const total = cellCount(config);
    // Fast path. No zone is larger than 9 cells, so when the mines fit around the largest zone every cell is
    // a candidate and the index is the cell. The scan below would give the same list, only slower.
    if (total - LARGEST_ZONE >= config.mineCount) {
      return Object.freeze([prng.nextInt(total)]);
    }
    const candidates = centersWithRoom(config);
    return Object.freeze([candidates[prng.nextInt(candidates.length)] as CellIndex]);
  }
}

/**
 * The cells that an opening keeps free of mines: each opening cell and every neighbor it has.
 *
 * @remarks
 * Neighbors come from `Board`, so the zone follows exactly the neighbor rule that the game uses. The
 * result is the union over all opening cells. Throws `RangeError` for an opening cell that is not a whole
 * number inside the board.
 *
 * Not part of the public API.
 *
 * @param config - The board's size; its mine count is ignored.
 * @param opening - The opening cells.
 * @returns The set of cells that must hold no mine.
 *
 * @internal
 */
export function openingZone(
  config: BoardConfig,
  opening: readonly CellIndex[],
): ReadonlySet<CellIndex> {
  const neighborsOnly = new Board({ ...config, mineCount: 0 }, []);
  const zone = new Set<CellIndex>();
  for (const cell of opening) {
    // `neighbors` checks the cell first, so a bad cell throws before anything is added to the zone.
    for (const neighbor of neighborsOnly.neighbors(cell)) zone.add(neighbor);
    zone.add(cell);
  }
  return zone;
}

/**
 * Every cell whose opening zone leaves room for all the mines, in ascending order. Throws when there is none.
 *
 * @remarks
 * Used only for boards dense enough that some cells do not qualify. Not part of the public API.
 */
function centersWithRoom(config: BoardConfig): CellIndex[] {
  const total = cellCount(config);
  const neighborsOnly = new Board({ ...config, mineCount: 0 }, []);
  const candidates: CellIndex[] = [];
  let smallestZone = total;
  for (let cell = 0; cell < total; cell += 1) {
    const zoneSize = 1 + neighborsOnly.neighbors(cell).length;
    smallestZone = Math.min(smallestZone, zoneSize);
    if (total - zoneSize >= config.mineCount) candidates.push(cell);
  }
  if (candidates.length === 0) {
    throw new InvalidBoardConfigError(
      `mineCount must be at most ${String(total - smallestZone)} to leave a safe opening on a ` +
        `${String(config.width)}x${String(config.height)} board, got ${String(config.mineCount)}`,
    );
  }
  return candidates;
}
