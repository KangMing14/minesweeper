import type { Board } from './board.js';
import type { CellIndex } from './config.js';

/**
 * Where a game stands: `'ready'` before the first command, `'playing'` after it, `'won'` or `'lost'` at the end.
 *
 * @remarks
 * `'won'` and `'lost'` are final: no command changes a finished game.
 *
 * @example
 * ```ts
 * const status: GameStatus = 'ready';
 * const finished = status === 'won' || status === 'lost'; // false
 * ```
 */
export type GameStatus = 'ready' | 'playing' | 'won' | 'lost';

/**
 * What a player sees of one cell.
 *
 * @remarks
 * A hidden cell is just `{ state: 'hidden' }`: no mine flag, no number. A flagged cell looks the same
 * whether or not it holds a mine. Only a revealed cell carries a `value`, the number of mines around it.
 *
 * @example
 * ```ts
 * const cell: CellView = { state: 'revealed', value: 3 };
 * if (cell.state === 'revealed') console.log(cell.value); // 3
 * ```
 */
export type CellView =
  | { readonly state: 'hidden' }
  | { readonly state: 'flagged' }
  | { readonly state: 'revealed'; readonly value: number };

/**
 * A read-only snapshot of a game, safe to hand to a client.
 *
 * @remarks
 * `cells` is in index order (`y * width + x`). `minesRemaining` is the mine count minus the flags placed;
 * it goes below zero when more flags are placed than there are mines. `exposedMines` is present only when
 * `status` is `'won'` or `'lost'`, and then lists every mine, ascending. While a game is in progress no
 * field of the view says anything about where the mines are (`CLAUDE.md`, rule 8).
 *
 * Each call of `Game.view()` returns a new snapshot. A snapshot is deeply frozen and never changes.
 *
 * In a race, a player's finished game may end before the match result is final for both players. Until
 * decision D-14 is settled (M4-T03), the server must not pass `exposedMines` on to a client before that
 * point, even though the engine fills it in.
 *
 * @example
 * ```ts
 * const view = new Game(new Board({ width: 3, height: 3, mineCount: 1 }, [4])).view();
 * view.status; // 'ready'
 * view.cells[4]; // { state: 'hidden' }
 * view.minesRemaining; // 1
 * ```
 */
export interface GameView {
  /** Number of columns. */
  readonly width: number;
  /** Number of rows. */
  readonly height: number;
  /** Where the game stands. */
  readonly status: GameStatus;
  /** One entry per cell, in index order. */
  readonly cells: readonly CellView[];
  /** How many cells are revealed. The game is won when this equals the number of safe cells. */
  readonly revealedCount: number;
  /** How many cells are flagged. */
  readonly flagCount: number;
  /** The mine count minus `flagCount`. Negative when there are more flags than mines. */
  readonly minesRemaining: number;
  /** Every mine, ascending. Present only when `status` is `'won'` or `'lost'`. */
  readonly exposedMines?: readonly CellIndex[];
}

/**
 * Cell-state code: not revealed and not flagged.
 *
 * @internal
 */
export const CELL_HIDDEN = 0;

/**
 * Cell-state code: revealed.
 *
 * @internal
 */
export const CELL_REVEALED = 1;

/**
 * Cell-state code: flagged.
 *
 * @internal
 */
export const CELL_FLAGGED = 2;

// The two states that carry no data are shared, so a view of a mostly hidden board allocates little.
const HIDDEN: CellView = Object.freeze({ state: 'hidden' });
const FLAGGED: CellView = Object.freeze({ state: 'flagged' });

/**
 * Builds the `GameView` of a game from its raw state.
 *
 * @remarks
 * A pure function, so every kind of view (revealed cells, flags, finished games) can be tested without
 * playing a game. `Game.view()` is a thin call to it. The counts are derived from `cellStates` instead of
 * being passed in, so they cannot disagree with the cells.
 *
 * Hidden and flagged cells are copied as the shared `hidden` and `flagged` objects, and no mine data is read
 * for them. Mines are read only for `exposedMines`, and only when `status` is `'won'` or `'lost'`.
 *
 * Not part of the public API.
 *
 * @param board - The mine layout.
 * @param cellStates - One code per cell: `CELL_HIDDEN`, `CELL_REVEALED` or `CELL_FLAGGED`. Not kept.
 * @param status - The game status to report.
 * @returns A new, deeply frozen view.
 * @throws `RangeError` if `cellStates` does not have one entry per cell of the board.
 *
 * @internal
 */
export function buildGameView(board: Board, cellStates: Uint8Array, status: GameStatus): GameView {
  const { width, height, mineCount } = board.config;
  const total = width * height;
  if (cellStates.length !== total) {
    throw new RangeError(`cellStates must have ${total} entries, got ${cellStates.length}`);
  }

  const cells: CellView[] = new Array<CellView>(total);
  let revealedCount = 0;
  let flagCount = 0;
  for (let i = 0; i < total; i++) {
    const code = cellStates[i];
    if (code === CELL_REVEALED) {
      cells[i] = Object.freeze({ state: 'revealed', value: board.adjacentMines(i) });
      revealedCount++;
    } else if (code === CELL_FLAGGED) {
      cells[i] = FLAGGED;
      flagCount++;
    } else {
      cells[i] = HIDDEN;
    }
  }

  const base = {
    width,
    height,
    status,
    cells: Object.freeze(cells),
    revealedCount,
    flagCount,
    minesRemaining: mineCount - flagCount,
  };
  if (status !== 'won' && status !== 'lost') return Object.freeze(base);

  const exposedMines: CellIndex[] = [];
  for (let i = 0; i < total; i++) {
    if (board.isMine(i)) exposedMines.push(i);
  }
  return Object.freeze({ ...base, exposedMines: Object.freeze(exposedMines) });
}
