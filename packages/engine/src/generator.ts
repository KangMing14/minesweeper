import { Board } from './board.js';
import { cellCount, validateBoardConfig } from './config.js';
import type { BoardConfig, CellIndex } from './config.js';
import { InvalidBoardConfigError } from './errors.js';
import { SafeOpeningPolicy, openingZone } from './opening.js';
import { createPrng } from './prng.js';

/**
 * A freshly generated board and the cells to reveal at the start of every game played on it.
 *
 * @remarks
 * `opening` is the list of cells that are revealed when a game starts. For the same board it is the same for
 * every player, which is the shared safe opening of a race (spec section 2.3). Revealing it is part of
 * creating a game, not a move, so it is not a logged command (M2-T03).
 *
 * `board` holds the mine positions. It stays on the server or inside the local engine and is never sent to
 * a client while a game is in progress (`CLAUDE.md`, rule 8, and decision D-14 for races).
 *
 * @example
 * ```ts
 * const { board, opening } = new SeededBoardGenerator().generate(PRESETS.beginner, 42);
 * board.isMine(opening[0]); // false: the opening cell is safe
 * board.adjacentMines(opening[0]); // 0: and it shows no number, so revealing it cascades
 * ```
 */
export interface GeneratedBoard {
  /** The mine layout. */
  readonly board: Board;
  /** The cells to reveal at the start, as a frozen list. */
  readonly opening: readonly CellIndex[];
}

/**
 * Makes a board from a config and a seed.
 *
 * @remarks
 * The seam that lets a smarter generator (for example one that never forces a guess) replace the seeded one
 * later without touching the game. An implementation must be a pure function of its arguments: the same
 * `(config, seed)` always gives the same board and opening, on every platform, because replays and races
 * rebuild the board this way.
 *
 * @example
 * ```ts
 * const generator: BoardGenerator = new SeededBoardGenerator();
 * const { board, opening } = generator.generate({ width: 9, height: 9, mineCount: 10 }, 42);
 * ```
 */
export interface BoardGenerator {
  /**
   * Generates the board for a config and a seed.
   *
   * @param config - The size and mine count of the board.
   * @param seed - An unsigned 32-bit integer.
   * @returns The board and the cells to reveal at the start.
   * @throws {@link InvalidBoardConfigError} if the config cannot give a playable board with a safe opening.
   * @throws `RangeError` if the seed is not an integer from 0 to 4294967295.
   */
  generate(config: BoardConfig, seed: number): GeneratedBoard;
}

/**
 * Generates boards from a seed, with a safe opening that is the same for everyone who plays the board.
 *
 * @remarks
 * **The algorithm.** (1) Check the config, then create a `Prng` from the seed. (2) Ask the opening policy
 * for the opening cell; it draws once. (3) The cells outside the opening zone (the opening cell and its
 * neighbors) are the eligible cells, in ascending index order. (4) Place the mines by a partial
 * Fisher-Yates shuffle over the eligible cells: for each mine `k` from 0 to `mineCount - 1`, draw
 * `r = nextInt(eligible - k)` and swap the cell at position `k` with the one at position `k + r`; the first
 * `mineCount` positions are the mines. Because the draw for mine `k` is uniform over what is left, every
 * set of mines is equally likely. The loop runs `mineCount` times, so nothing can hang.
 *
 * **Safe opening.** The opening cell has no mine on it or next to it, so it shows 0 and cascades (on a
 * board with more than one cell). A config whose mines do not fit around any opening zone is rejected with
 * `InvalidBoardConfigError`, whatever the seed. This is the opening-aware limit that
 * `validateBoardConfig` leaves to the generator.
 *
 * **Stable contract.** The board and opening that a seed gives are fixed forever. Stored replays, ghosts
 * and races rebuild a board from `(config, seed)` (ADR-002), so changing any step above, including the order
 * of draws, silently breaks them. The golden fixture `fixtures/boards.json` fails when that happens. A
 * change needs a new generator version, recorded where the replay is (`ReplayLog.version`, M2-T04), and an
 * ADR. Do not edit the fixture to make a test pass.
 *
 * @example
 * ```ts
 * const generator = new SeededBoardGenerator();
 * const first = generator.generate(PRESETS.expert, 2026);
 * const again = generator.generate(PRESETS.expert, 2026);
 * first.opening; // the same cells as again.opening
 * first.board.isMine(first.opening[0]); // false
 * ```
 */
export class SeededBoardGenerator implements BoardGenerator {
  readonly #policy: SafeOpeningPolicy;

  /**
   * Creates a generator.
   *
   * @param policy - Chooses the opening. Defaults to `SafeOpeningPolicy`. A policy that returns an opening
   * whose zone leaves too few cells for the mines makes `generate` throw `InvalidBoardConfigError`.
   */
  constructor(policy: SafeOpeningPolicy = new SafeOpeningPolicy()) {
    this.#policy = policy;
  }

  /**
   * Generates the board for a config and a seed.
   *
   * @remarks
   * The config is checked before the seed, so a call with both wrong reports the config.
   *
   * @param config - The size and mine count. Must pass `validateBoardConfig`, and the mines must fit
   * outside an opening zone.
   * @param seed - An unsigned 32-bit integer.
   * @returns A frozen `GeneratedBoard`.
   * @throws {@link InvalidBoardConfigError} if the config is invalid or leaves no room for a safe opening;
   * the reason starts with the field name (`width`, `height` or `mineCount`).
   * @throws `RangeError` if the seed is not an integer from 0 to 4294967295 (the message starts with `seed`).
   *
   * @example
   * ```ts
   * new SeededBoardGenerator().generate({ width: 9, height: 9, mineCount: 78 }, 1); // throws: only 77 mines fit
   * ```
   */
  generate(config: BoardConfig, seed: number): GeneratedBoard {
    validateBoardConfig(config);
    const prng = createPrng(seed);
    const opening = this.#policy.select(config, prng);
    const zone = openingZone(config, opening);

    const pool: CellIndex[] = [];
    const total = cellCount(config);
    for (let cell = 0; cell < total; cell += 1) {
      if (!zone.has(cell)) pool.push(cell);
    }
    // The built-in policy never gets here with too few cells; a custom one can.
    if (pool.length < config.mineCount) {
      throw new InvalidBoardConfigError(
        `mineCount must be at most ${String(pool.length)} to leave the opening zone free, got ${String(config.mineCount)}`,
      );
    }

    // Partial Fisher-Yates: after step k, positions 0..k hold the mines chosen so far. `pick` is always
    // inside the pool, so the two reads cannot be undefined.
    for (let k = 0; k < config.mineCount; k += 1) {
      const pick = k + prng.nextInt(pool.length - k);
      const chosen = pool[pick] as CellIndex;
      pool[pick] = pool[k] as CellIndex;
      pool[k] = chosen;
    }

    return Object.freeze({
      board: new Board(config, pool.slice(0, config.mineCount)),
      opening: Object.freeze([...opening]),
    });
  }
}
