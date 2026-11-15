import type { Board } from './board.js';
import type { Command } from './command.js';
import type { CellIndex } from './config.js';
import { GameEventEmitter, type GameEvent } from './events.js';
import { revealCell } from './reveal.js';
import { buildGameView, CELL_HIDDEN, type GameStatus, type GameView } from './view.js';

/** What a command that changes nothing returns. Shared, because it is frozen. */
const NO_EVENTS: readonly GameEvent[] = Object.freeze([]);

/**
 * One game of Minesweeper on a fixed mine layout: the mutable aggregate that players act on.
 *
 * @remarks
 * A `Game` holds what the player has done (which cells are revealed or flagged) and where the game stands.
 * The mine layout lives in the immutable `Board`, so several games can share one board. Callers read the game
 * only through `view()`, which says nothing about hidden mines, and listen to it through `subscribe`.
 *
 * Players act through `apply`. So far it understands `reveal` (M1-T04); `flag` and `chord` follow in
 * M1-T05, and win detection and the full post-game rules in M1-T06.
 *
 * @example
 * ```ts
 * const board = new Board({ width: 3, height: 3, mineCount: 1 }, [4]);
 * const game = new Game(board);
 * const stop = game.subscribe((event) => console.log(event.type));
 * game.view().status; // 'ready'
 * game.apply({ type: 'reveal', index: 0, t: 350 }); // opens a corner of the board
 * game.view().status; // 'playing'
 * stop();
 * ```
 */
export class Game {
  /** The mine layout. Never exposed: reading it would show the mines. */
  readonly #board: Board;

  /** One state code per cell (hidden, revealed or flagged). Changed only by `apply`. */
  readonly #cellStates: Uint8Array;

  /** Where the game stands. */
  #status: GameStatus = 'ready';

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
   * Applies one command to the game.
   *
   * @remarks
   * A command that is not valid in the current state, or that changes nothing, returns `[]` and leaves the
   * game untouched: revealing a cell that is already revealed or flagged, and any command after the game
   * has been lost or won. Only an index outside the board is an error.
   *
   * `reveal` on a hidden, safe cell reveals it; if it shows 0 the reveal spreads to the cells around it
   * (an iterative flood fill, see `revealCell`). All of that is one `cellsRevealed` event, listing every
   * newly revealed cell. `reveal` on a mine loses the game with one `gameLost` event. The mine is not
   * marked revealed: a player's view shows it through `exposedMines` once the game is over. The first
   * command that takes effect moves the status from `'ready'` to `'playing'`, or straight to `'lost'` if it
   * hits a mine.
   *
   * `flag` and `chord` are accepted and ignored until M1-T05. Winning (every safe cell revealed) is
   * detected from M1-T06; until then a game with every safe cell open is still `'playing'`.
   *
   * The state is changed before the events are delivered to subscribers. If a subscriber throws, every
   * other subscriber still hears the event, and the first error is rethrown from `apply`; the game has
   * already changed by then.
   *
   * @param command - What to do and when (`t`, milliseconds since the game started).
   * @returns The events the command caused, in order. A frozen array, empty if nothing happened.
   * @throws `RangeError` if `command.index` is not a whole number inside the board, whatever the type of
   * the command and the status of the game.
   *
   * @example
   * ```ts
   * const game = new Game(new Board({ width: 3, height: 3, mineCount: 1 }, [8]));
   * game.apply({ type: 'reveal', index: 0, t: 400 });
   * // [{ type: 'cellsRevealed', cells: [{ index: 0, value: 0 }, ...] }]
   * game.apply({ type: 'reveal', index: 0, t: 900 }); // [] (already revealed)
   * game.apply({ type: 'reveal', index: 8, t: 1_200 }); // [{ type: 'gameLost', t: 1200, mineIndex: 8 }]
   * ```
   */
  apply(command: Command): readonly GameEvent[] {
    const { index } = command;
    const total = this.#cellStates.length;
    if (!Number.isInteger(index) || index < 0 || index >= total) {
      throw new RangeError(`index must be a whole number from 0 to ${total - 1}, got ${index}`);
    }
    if (this.#status === 'won' || this.#status === 'lost') return NO_EVENTS;
    // TODO(M1-T05): `flag` and `chord`. Until then they, like any unknown type, change nothing.
    if (command.type !== 'reveal') return NO_EVENTS;
    return this.#reveal(index, command.t);
  }

  /**
   * Reveals a cell, updates the status and announces what happened.
   *
   * @param index - A valid cell index.
   * @param t - Milliseconds since the game started.
   * @returns The events the reveal caused.
   */
  #reveal(index: CellIndex, t: number): readonly GameEvent[] {
    const result = revealCell(this.#board, this.#cellStates, index);
    if (result.kind === 'none') return NO_EVENTS;

    let event: GameEvent;
    if (result.kind === 'mine') {
      this.#status = 'lost';
      event = Object.freeze({ type: 'gameLost', t, mineIndex: index });
    } else {
      this.#status = 'playing';
      event = Object.freeze({ type: 'cellsRevealed', cells: result.cells });
    }
    this.#events.emit(event);
    return Object.freeze([event]);
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
