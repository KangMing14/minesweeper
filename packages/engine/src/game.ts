import type { Board } from './board.js';
import { GameEventEmitter, type GameEvent } from './events.js';
import { buildGameView, CELL_HIDDEN, type GameStatus, type GameView } from './view.js';

/**
 * One game of Minesweeper on a fixed mine layout: the mutable aggregate that players act on.
 *
 * @remarks
 * A `Game` holds what the player has done (which cells are revealed or flagged) and where the game stands.
 * The mine layout lives in the immutable `Board`, so several games can share one board. Callers read the game
 * only through `view()`, which says nothing about hidden mines, and listen to it through `subscribe`.
 *
 * This task builds the state model. Commands (`apply`) arrive in M1-T04 to M1-T06, so a new game is
 * always `'ready'` with every cell hidden for now.
 *
 * @example
 * ```ts
 * const board = new Board({ width: 3, height: 3, mineCount: 1 }, [4]);
 * const game = new Game(board);
 * const stop = game.subscribe((event) => console.log(event.type));
 * game.view().status; // 'ready'
 * stop();
 * ```
 */
export class Game {
  /** The mine layout. Never exposed: reading it would show the mines. */
  readonly #board: Board;

  /** One state code per cell (hidden, revealed or flagged). Changed by commands from M1-T04. */
  readonly #cellStates: Uint8Array;

  /** Where the game stands. Changed by commands from M1-T04. */
  readonly #status: GameStatus = 'ready';

  /** Delivers events to subscribers. */
  readonly #events = new GameEventEmitter();

  /**
   * Starts a new game: every cell hidden, status `'ready'`.
   *
   * @param board - The mine layout to play on. It is shared, not copied; a `Board` never changes.
   *
   * @example
   * ```ts
   * const game = new Game(new Board({ width: 9, height: 9, mineCount: 10 }, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
   * game.view().cells.length; // 81
   * ```
   */
  constructor(board: Board) {
    this.#board = board;
    this.#cellStates = new Uint8Array(board.config.width * board.config.height).fill(CELL_HIDDEN);
  }

  /**
   * Starts delivering this game's events to `listener`.
   *
   * @remarks
   * Listeners are called in the order they subscribed, with each event after the state change it
   * describes. A listener that throws does not stop the others; the first error is rethrown once all of them
   * have run.
   *
   * @param listener - Called with every event from now on.
   * @returns A function that stops delivery. Calling it more than once is harmless.
   *
   * @example
   * ```ts
   * const game = new Game(new Board({ width: 3, height: 3, mineCount: 1 }, [4]));
   * const unsubscribe = game.subscribe((event) => console.log(event.type));
   * unsubscribe();
   * ```
   */
  subscribe(listener: (event: GameEvent) => void): () => void {
    return this.#events.subscribe(listener);
  }

  /**
   * A snapshot of the game as a player sees it.
   *
   * @remarks
   * Hidden cells carry no information about mines. `exposedMines` appears only after the game is won or
   * lost. Each call builds a new, deeply frozen object, so a snapshot never changes under the caller.
   *
   * @returns The current view.
   *
   * @example
   * ```ts
   * const game = new Game(new Board({ width: 3, height: 3, mineCount: 1 }, [4]));
   * const view = game.view();
   * view.status; // 'ready'
   * view.cells.every((cell) => cell.state === 'hidden'); // true
   * ```
   */
  view(): GameView {
    return buildGameView(this.#board, this.#cellStates, this.#status);
  }
}
