import { MAX_REPLAY_COMMANDS, createGame } from '@minesweeper/engine';
import type {
  BoardConfig,
  Clock,
  Game,
  GameEvent,
  GameResult,
  GameView,
  ReplayLog,
} from '@minesweeper/engine';
import type { GameSession, PlayerAction } from './GameSession.js';

type Listener = (event: GameEvent) => void;

/**
 * A `GameSession` that runs the engine inside the browser (ADR-004).
 *
 * @remarks
 * Time: `start()` creates the game with `createGame` and reads `clock.nowMs()` as t0. Each `dispatch`
 * stamps `t = Math.round(clock.nowMs() - t0)`, never below the previous `t` and never below 0, and never
 * a value the engine would refuse (a clock that returns `NaN` or `Infinity` counts as "no time has passed").
 * The engine never sees a clock. The timer starts at `start()`, which is race semantics; whether solo play
 * starts the clock on the first click is settled with the time-attack rules in M4.
 *
 * Events: every event the engine produces reaches every subscriber, in order. As in the engine, if
 * subscribers throw, the others are still called and the first error is rethrown from `dispatch` after the
 * game has already changed.
 *
 * The end: once the game is won or lost, or is stuck (see `isStuck`), `dispatch` does nothing, not even
 * throw for a bad index, and `elapsedMs()` stops. A stuck game is never retried: the session counts the
 * commands the engine accepted and stops calling it at `MAX_REPLAY_COMMANDS`.
 *
 * @example
 * ```ts
 * const session = new LocalSession(PRESETS.beginner, 1234, new SystemClock());
 * session.start();
 * session.dispatch({ type: 'reveal', index: 0 });
 * session.dispatch({ type: 'flag', index: 80 });
 * if (session.isStuck()) {
 *   // offer a new game
 * }
 * session.dispose();
 * ```
 */
export class LocalSession implements GameSession {
  readonly #config: BoardConfig;
  readonly #seed: number;
  readonly #clock: Clock;

  #game: Game | undefined;
  #stopListening: (() => void) | undefined;
  #t0 = 0;
  #lastT = 0;
  #accepted = 0;
  #ended = false;
  #disposed = false;
  #frozenMs: number | undefined;
  #listeners: { readonly listener: Listener }[] = [];

  /** True while the engine is working on the command that `dispatch` just gave it. */
  #tookEffect = false;

  /**
   * @param config - The board. Validated by the engine when `start()` creates the game.
   * @param seed - The seed of the board, a whole number from 0 to 4294967295.
   * @param clock - Where the session reads time from. `SystemClock` in the app, a fake in tests.
   */
  constructor(config: BoardConfig, seed: number, clock: Clock) {
    this.#config = config;
    this.#seed = seed;
    this.#clock = clock;
  }

  /**
   * Creates the game and reads t0. Does nothing if the session was already started or disposed.
   *
   * @throws `InvalidBoardConfigError` for a bad config and `RangeError` for a bad seed; the session stays
   * not started.
   */
  start(): void {
    if (this.#disposed || this.#game !== undefined) return;
    const game = createGame(this.#config, this.#seed);
    this.#t0 = this.#clock.nowMs();
    this.#game = game;
    this.#stopListening = game.subscribe((event) => this.#forward(event));
    // A board that the opening already clears is won at creation and has no gameWon event (M2-T03).
    if (game.view().status === 'won') this.#finish();
  }

  /** See `GameSession.dispatch`. A bad index throws the engine's `RangeError`; the session stays usable. */
  dispatch(action: PlayerAction): void {
    const game = this.#game;
    if (this.#disposed || game === undefined || this.#ended || this.isStuck()) return;

    const t = this.#stamp();
    this.#tookEffect = false;
    try {
      game.apply({ type: action.type, index: action.index, t });
    } finally {
      // Also when a subscriber threw: the engine has logged the command before it announced it.
      if (this.#tookEffect) this.#accepted += 1;
      if (this.isStuck() && this.#frozenMs === undefined) this.#frozenMs = this.#lastT;
    }
  }

  /** See `GameSession.subscribe`. After `dispose()` nothing is registered and the returned function is a no-op. */
  subscribe(listener: Listener): () => void {
    if (this.#disposed) return () => undefined;
    const entry = { listener };
    this.#listeners.push(entry);
    return () => {
      this.#listeners = this.#listeners.filter((candidate) => candidate !== entry);
    };
  }

  /** See `GameSession.view`. A disposed session still shows the last view it had. */
  view(): GameView {
    if (this.#game === undefined) {
      throw new Error('LocalSession.view() was called before start(): there is no game yet.');
    }
    return this.#game.view();
  }

  /** See `GameSession.elapsedMs`. */
  elapsedMs(): number {
    if (this.#game === undefined) return 0;
    if (this.#frozenMs !== undefined) return this.#frozenMs;
    return Math.max(this.#lastT, this.#sinceStart());
  }

  /** See `GameSession.result`. */
  result(): GameResult | undefined {
    return this.#game?.result();
  }

  /** See `GameSession.isStuck`. */
  isStuck(): boolean {
    return this.#game !== undefined && !this.#ended && this.#accepted >= MAX_REPLAY_COMMANDS;
  }

  /**
   * See `GameSession.replayLog`. Built from the engine's own command log on each call, so the caller gets a
   * new object whose config is a copy; the commands are the engine's frozen copies.
   */
  replayLog(): ReplayLog | undefined {
    const game = this.#game;
    // Asked of the engine and not of `#ended`: the last reveal of a win announces `cellsRevealed` before
    // `gameWon`, and a subscriber that reads the log on that first event must already get it.
    if (game === undefined || game.result() === undefined) return undefined;
    const { width, height, mineCount } = this.#config;
    return {
      version: 1,
      config: { width, height, mineCount },
      seed: this.#seed,
      commands: game.log(),
    };
  }

  /** See `GameSession.dispose`. */
  dispose(): void {
    if (this.#disposed) return;
    if (this.#game !== undefined && this.#frozenMs === undefined) this.#frozenMs = this.elapsedMs();
    this.#disposed = true;
    this.#stopListening?.();
    this.#stopListening = undefined;
    this.#listeners = [];
  }

  /** Whole milliseconds since t0, or 0 when the clock gives nothing usable. */
  #sinceStart(): number {
    const raw = Math.round(this.#clock.nowMs() - this.#t0);
    return Number.isSafeInteger(raw) && raw > 0 ? raw : 0;
  }

  /** The `t` for the next command: elapsed time, but never below the previous one. */
  #stamp(): number {
    const t = Math.max(this.#lastT, this.#sinceStart());
    this.#lastT = t;
    return t;
  }

  /** Freezes the timer at the time the game ended. */
  #finish(): void {
    this.#ended = true;
    this.#frozenMs = this.#game?.result()?.timeMs ?? this.#lastT;
  }

  /** Receives one engine event, notes what it means for the session, and passes it on to subscribers. */
  #forward(event: GameEvent): void {
    this.#tookEffect = true;
    if (event.type === 'gameWon' || event.type === 'gameLost') this.#finish();

    let firstError: unknown;
    let failed = false;
    for (const { listener } of [...this.#listeners]) {
      try {
        listener(event);
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
      }
    }
    if (failed) throw firstError;
  }
}
