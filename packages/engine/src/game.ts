import type { Board } from './board.js';
import { chordCells } from './chord.js';
import type { Command } from './command.js';
import { safeCellCount, type CellIndex } from './config.js';
import { GameEventEmitter, type CellsRevealed, type GameEvent } from './events.js';
import { buildGameResult, type GameResult } from './result.js';
import { revealCell } from './reveal.js';
import { computeThreeBV } from './threebv.js';
import {
  buildGameView,
  CELL_FLAGGED,
  CELL_HIDDEN,
  type GameStatus,
  type GameView,
} from './view.js';

/** What a command that changes nothing returns. Shared, because it is frozen. */
const NO_EVENTS: readonly GameEvent[] = Object.freeze([]);

/** The cells a command revealed when it revealed none (stepping on a mine). Shared, because it is frozen. */
const NO_CELLS: CellsRevealed['cells'] = Object.freeze([]);

/**
 * One game of Minesweeper on a fixed mine layout: the mutable aggregate that players act on.
 *
 * @remarks
 * A `Game` holds what the player has done (which cells are revealed or flagged) and where the game stands.
 * The mine layout lives in the immutable `Board`, so several games can share one board. Callers read the game
 * only through `view()`, which says nothing about hidden mines, and listen to it through `subscribe`.
 *
 * Players act through `apply`. It understands `reveal`, `flag` and `chord`. The game is won when every safe
 * cell is revealed and lost when a mine is revealed; both are final, and a finished game ignores every
 * further command. Every command that takes effect is written to the command log (`log()`), which is the
 * game's history: the same board and the same log give the same game again (ADR-002). When the game is over,
 * `result()` reports how it went.
 *
 * Games are normally made by `createGame`, which also reveals the safe opening.
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

  /** How many cells are not mines. Revealing all of them wins the game. */
  readonly #safeCells: number;

  /** How many cells are revealed. Counted here, so that detecting a win does not scan the board. */
  #revealedCount = 0;

  /** Delivers events to subscribers. */
  readonly #events = new GameEventEmitter();

  /** The commands that took effect, in order. Each entry is a frozen copy of what the caller passed. */
  readonly #log: Command[] = [];

  /** The `t` of the last command that took effect; 0 before any, which is the time of the opening. */
  #lastT = 0;

  /** The result, built the first time it is asked for after the game ends. A finished game never changes. */
  #result: GameResult | undefined;

  /**
   * Starts a new game: status `'ready'`, every cell hidden except the opening, if one is given.
   *
   * @remarks
   * The opening is how `createGame` starts a game on a generated board. Its cells are revealed (with the
   * usual cascade) as part of creating the game, at `t = 0`: no event is announced, nothing is logged, and
   * the status stays `'ready'`. If that opening already reveals every safe cell, the status is `'won'`
   * instead, because a game that is finished cannot be `'ready'`. Without an opening nothing is revealed.
   *
   * @param board - The mine layout to play on. It is shared, not copied; a `Board` never changes.
   * @param opening - The cells to reveal at the start. Each must be a safe cell inside the board.
   * @throws `RangeError` if an opening cell is not a whole number inside the board, or is a mine.
   *
   * @example
   * ```ts
   * const board = new Board({ width: 9, height: 9, mineCount: 10 }, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
   * new Game(board).view().cells.length; // 81, all hidden
   * new Game(board, [80]).view().status; // 'ready', with the cells around 80 already open
   * ```
   */
  constructor(board: Board, opening: readonly CellIndex[] = []) {
    this.#board = board;
    this.#cellStates = new Uint8Array(board.config.width * board.config.height).fill(CELL_HIDDEN);
    this.#safeCells = safeCellCount(board.config);
    for (const cell of opening) {
      const result = revealCell(board, this.#cellStates, cell);
      if (result.kind === 'mine') {
        throw new RangeError(`opening cell ${String(cell)} is a mine`);
      }
      if (result.kind === 'cells') this.#revealedCount += result.cells.length;
    }
    if (this.#revealedCount === this.#safeCells) this.#status = 'won';
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
   * has been lost or won (the status is final). Only an index outside the board is an error.
   *
   * **Time.** `command.t` must be a non-negative safe integer that is not lower than the `t` of the last
   * command that took effect (the opening counts as `t = 0`). Any other `t` makes the command invalid, so
   * it returns `[]` and changes nothing, like any other invalid command. The checks run in a fixed order:
   * the index (throws), then whether the game is over, then `t`, then the command itself. Only a command
   * that takes effect moves the last `t` forward, so a no-op or a rejected command does not.
   *
   * **The log.** A command that takes effect is appended to `log()` before its events are delivered, so
   * a subscriber that throws cannot lose it. Invalid and no-op commands are never logged.
   *
   * `reveal` on a hidden, safe cell reveals it; if it shows 0 the reveal spreads to the cells around it
   * (an iterative flood fill, see `revealCell`). All of that is one `cellsRevealed` event, listing every
   * newly revealed cell. `reveal` on a mine loses the game with one `gameLost` event. The mine is not
   * marked revealed: a player's view shows it through `exposedMines` once the game is over. The first
   * command that takes effect moves the status from `'ready'` to `'playing'`, or straight to `'lost'` if it
   * hits a mine.
   *
   * `flag` toggles a flag on a hidden cell (one `flagToggled` event) and back off a flagged one; on a
   * revealed cell it does nothing. A flag takes effect like any other command, so it also moves the status
   * from `'ready'` to `'playing'`. Flags are never required to win and there are no question marks (D-04,
   * ADR-009).
   *
   * `chord` on a revealed number whose count of flagged neighbors equals its value opens every other
   * hidden neighbor through the reveal path, as one `cellsRevealed` event listing each newly revealed cell
   * once. Flags are only counted, so a wrong flag can leave a mine unflagged: the safe neighbors are still
   * opened and the game is then lost, with `cellsRevealed` followed by one `gameLost` that names the
   * lowest-index mine. A chord on a hidden or flagged cell, on a zero, with a different number of flags,
   * or with nothing left to open, does nothing (`[]`).
   *
   * The game is won the moment the last safe cell is revealed, by a `reveal`, a cascade or a `chord`: the
   * status becomes `'won'` and the command's events end with one `gameWon`, after the `cellsRevealed` that
   * completed the board. Flags play no part: the game counts revealed safe cells only, and a flag on a safe
   * cell has to come off before that cell can be revealed. A chord that reaches a mine is lost, never won:
   * it can only reach a mine when a flag sits on a safe cell, and that cell is still closed.
   *
   * Once the game is won or lost, `view().exposedMines` lists every mine (the player's own finished game;
   * in a race the server decides when a client may see it, D-14).
   *
   * The state is changed before the events are delivered to subscribers. If a subscriber throws, every
   * other subscriber still hears every event of the command, and the first error is rethrown from
   * `apply`; the game has already changed by then.
   *
   * @param command - What to do and when (`t`, milliseconds since the game started).
   * @returns The events the command caused, in order. A frozen array, empty if nothing happened.
   * @throws `RangeError` if `command.index` is not a whole number inside the board, whatever the type of
   * the command, its `t` and the status of the game.
   *
   * @example
   * ```ts
   * const game = new Game(new Board({ width: 3, height: 3, mineCount: 1 }, [8]));
   * game.apply({ type: 'reveal', index: 0, t: 400 });
   * // [{ type: 'cellsRevealed', cells: [{ index: 0, value: 0 }, ...] }]
   * game.apply({ type: 'reveal', index: 0, t: 900 }); // [] (already revealed)
   * game.apply({ type: 'reveal', index: 8, t: 1_200 }); // [{ type: 'gameLost', t: 1200, mineIndex: 8 }]
   *
   * const other = new Game(new Board({ width: 3, height: 3, mineCount: 1 }, [8]));
   * other.apply({ type: 'flag', index: 1, t: 500 }); // [{ type: 'flagToggled', ... }]
   * other.apply({ type: 'flag', index: 2, t: 499 }); // [] (earlier than 500: rejected)
   * other.log(); // [{ type: 'flag', index: 1, t: 500 }]
   * ```
   */
  apply(command: Command): readonly GameEvent[] {
    const { index } = command;
    const total = this.#cellStates.length;
    if (!Number.isInteger(index) || index < 0 || index >= total) {
      throw new RangeError(`index must be a whole number from 0 to ${total - 1}, got ${index}`);
    }
    if (this.#status === 'won' || this.#status === 'lost') return NO_EVENTS;
    // Time never goes backwards, and only whole milliseconds count; `Number.isSafeInteger` is false for
    // NaN, the infinities and fractions, and keeps every logged `t` exact in JSON.
    if (!Number.isSafeInteger(command.t) || command.t < this.#lastT) return NO_EVENTS;
    switch (command.type) {
      case 'reveal':
        return this.#reveal(command, index);
      case 'flag':
        return this.#flag(command, index);
      case 'chord':
        return this.#chord(command, index);
      default:
        // An unknown `type` (only possible from untyped input, such as a message from the network) changes nothing.
        return NO_EVENTS;
    }
  }

  /**
   * Toggles the flag on a cell and announces it.
   *
   * @param command - The command being applied, for the log.
   * @param index - A valid cell index.
   * @returns One `flagToggled` event, or none if the cell is revealed.
   */
  #flag(command: Command, index: CellIndex): readonly GameEvent[] {
    const state = this.#cellStates[index];
    if (state !== CELL_HIDDEN && state !== CELL_FLAGGED) return NO_EVENTS;

    const flagged = state === CELL_HIDDEN;
    this.#cellStates[index] = flagged ? CELL_FLAGGED : CELL_HIDDEN;
    this.#status = 'playing';
    return this.#announce(command, [Object.freeze({ type: 'flagToggled', index, flagged })]);
  }

  /**
   * Chords on a cell, updates the status and announces what happened.
   *
   * @param command - The command being applied; its `t` is the time of the events.
   * @param index - A valid cell index.
   * @returns The events the chord caused: nothing, `cellsRevealed`, `gameLost`, `cellsRevealed` then
   * `gameLost`, or `cellsRevealed` then `gameWon`.
   */
  #chord(command: Command, index: CellIndex): readonly GameEvent[] {
    const result = chordCells(this.#board, this.#cellStates, index);
    if (result.kind === 'none') return NO_EVENTS;
    return this.#settle(command, result.cells, result.mineIndex);
  }

  /**
   * Records what a command that took effect revealed, decides where the game stands and announces it.
   *
   * @remarks
   * The one place where the game's lifecycle changes, so that `reveal` and `chord` cannot disagree about it.
   * A mine reached means the game is lost. Otherwise it is won exactly when every safe cell is revealed, and
   * playing if not. A loss wins over a win only on paper: a command that reaches a mine always leaves a safe
   * cell closed (see `apply`), so both can never be true at once.
   *
   * The events are `cellsRevealed` (only if a cell was opened), then at most one of `gameLost` and `gameWon`.
   *
   * @param command - The command being applied; its `t` is the time of a win or a loss.
   * @param cells - The cells the command revealed, possibly none.
   * @param mineIndex - The mine the command reached, or `null` if it reached none.
   * @returns The announced events, a frozen array.
   */
  #settle(
    command: Command,
    cells: CellsRevealed['cells'],
    mineIndex: CellIndex | null,
  ): readonly GameEvent[] {
    const { t } = command;
    const events: GameEvent[] = [];
    if (cells.length > 0) {
      this.#revealedCount += cells.length;
      events.push(Object.freeze({ type: 'cellsRevealed', cells }));
    }
    if (mineIndex !== null) {
      this.#status = 'lost';
      events.push(Object.freeze({ type: 'gameLost', t, mineIndex }));
    } else if (this.#revealedCount === this.#safeCells) {
      this.#status = 'won';
      events.push(Object.freeze({ type: 'gameWon', t }));
    } else {
      this.#status = 'playing';
    }
    return this.#announce(command, events);
  }

  /**
   * Logs a command that took effect, then delivers its events to the subscribers, in order, and returns them.
   *
   * @remarks
   * Every event reaches every subscriber even if one of them throws; the first error is rethrown once the
   * last event has been delivered. The command is logged first, because the game has already changed and
   * the log must say so even if a subscriber fails. Every command that reaches this step took effect: a
   * command with no events is returned as `[]` earlier and never gets here.
   *
   * @param command - The command that took effect. A frozen copy of it goes into the log.
   * @param events - The events to deliver, in order. Not empty.
   * @returns The same events as a frozen array.
   */
  #announce(command: Command, events: readonly GameEvent[]): readonly GameEvent[] {
    // Copy only the three fields: the caller keeps its own object and may change it (or have added fields).
    this.#log.push(Object.freeze({ type: command.type, index: command.index, t: command.t }));
    this.#lastT = command.t;
    let failed = false;
    let firstError: unknown;
    for (const event of events) {
      try {
        this.#events.emit(event);
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
      }
    }
    if (failed) throw firstError;
    return Object.freeze([...events]);
  }

  /**
   * Reveals a cell, updates the status and announces what happened.
   *
   * @param command - The command being applied; its `t` is the time of the events.
   * @param index - A valid cell index.
   * @returns The events the reveal caused: `gameLost`, or `cellsRevealed`, followed by `gameWon` if that
   * reveal opened the last safe cell.
   */
  #reveal(command: Command, index: CellIndex): readonly GameEvent[] {
    const result = revealCell(this.#board, this.#cellStates, index);
    if (result.kind === 'none') return NO_EVENTS;
    if (result.kind === 'mine') return this.#settle(command, NO_CELLS, index);
    return this.#settle(command, result.cells, null);
  }

  /**
   * The commands that took effect, in the order they were applied: the game's history.
   *
   * @remarks
   * Together with the board (`config` and `seed`) this is everything needed to play the game again: applying
   * the log to a new game made by `createGame` gives the same view and the same events (ADR-002; replay and
   * validation arrive in M2-T04). The opening is not in the log, because `createGame` makes it. A command
   * that was invalid, changed nothing, came after the end of the game, or had a bad `t` is not in it, and
   * neither is one that threw `RangeError`. The `t` values never decrease.
   *
   * Each call returns a new frozen list of frozen commands holding only `type`, `index` and `t`, copied when
   * the command was applied: later commands do not change a list you already hold, and neither can the
   * caller's own command objects. The log holds no information about mines.
   *
   * @returns The accepted commands, oldest first.
   *
   * @example
   * ```ts
   * const game = new Game(new Board({ width: 3, height: 3, mineCount: 1 }, [8]));
   * game.apply({ type: 'reveal', index: 0, t: 400 });
   * game.apply({ type: 'reveal', index: 0, t: 900 }); // already revealed: not logged
   * game.log(); // [{ type: 'reveal', index: 0, t: 400 }]
   * ```
   */
  log(): readonly Command[] {
    return Object.freeze([...this.#log]);
  }

  /**
   * The record of the finished game, or `undefined` while it is still going.
   *
   * @remarks
   * A game is finished when it is `'won'` or `'lost'`; before that there is nothing to report, so a game
   * that is `'ready'` or `'playing'` returns `undefined`, however close it is to the end. Once the game is
   * over the result never changes and every call returns the same frozen object.
   *
   * `timeMs` is the `t` of the command that ended the game: the last accepted command, because nothing is
   * accepted after the end. A game that the opening cleared at creation (see `createGame`) has no such
   * command and `timeMs` is 0, with `effectiveCommands` 0. `safeCellsRevealed` is the number of revealed
   * cells, the opening included; `effectiveCommands` is the length of `log()`. The 3BV is worked out from
   * the board the first time the result is asked for.
   *
   * The result is derived from the commands alone, so `replay(log).result()` equals the result of the game
   * that made the log (ADR-002). Its `threeBV` is computed from the whole mine layout. That is an aggregate
   * and not a position, but it is still information about the mines: in a race it falls under the same
   * release rule as `exposedMines` and `GameLost.mineIndex`, and the server decides when a client may see it
   * (D-14, M4-T03, M5-T05).
   *
   * @returns The result of the finished game, or `undefined` if it has not ended.
   *
   * @example
   * ```ts
   * const game = new Game(new Board({ width: 3, height: 3, mineCount: 1 }, [4]));
   * game.result(); // undefined
   * game.apply({ type: 'reveal', index: 0, t: 400 });
   * game.apply({ type: 'reveal', index: 4, t: 900 }); // the mine
   * game.result();
   * // { outcome: 'lost', timeMs: 900, safeCellsRevealed: 1, totalSafeCells: 8,
   * //   effectiveCommands: 2, threeBV: 8, threeBVPerSecond: 8000 / 900 }
   * ```
   */
  result(): GameResult | undefined {
    if (this.#status !== 'won' && this.#status !== 'lost') return undefined;
    this.#result ??= buildGameResult({
      outcome: this.#status,
      timeMs: this.#lastT,
      safeCellsRevealed: this.#revealedCount,
      totalSafeCells: this.#safeCells,
      effectiveCommands: this.#log.length,
      threeBV: computeThreeBV(this.#board),
    });
    return this.#result;
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
