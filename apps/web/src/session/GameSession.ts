import type { CellIndex, Command, GameEvent, GameResult, GameView } from '@minesweeper/engine';

/**
 * What a player asks for: a command without a time.
 *
 * @remarks
 * The UI never stamps time. The session adds `t` when it turns an action into an engine `Command`
 * (ADR-002), so a screen cannot get time wrong and a `RemoteSession` can leave it to the server's clock.
 *
 * @example
 * ```ts
 * const action: PlayerAction = { type: 'reveal', index: 40 };
 * session.dispatch(action);
 * ```
 */
export type PlayerAction = { type: Command['type']; index: CellIndex };

/**
 * The one interface the user interface talks to (ADR-004, spec section 4.1, principle 3).
 *
 * @remarks
 * `LocalSession` runs the engine in the browser; `RemoteSession` (M5-T06) will speak the protocol to the
 * server. The interface offers only what both can give: views of revealed cells, events, time and a result.
 * It has no board and no mine position, so the UI cannot come to depend on data that a networked session
 * would never have (ADR-003). Screens import this interface and the engine's view types, never `Game`.
 *
 * Lifecycle: a session is created, `start`ed once, driven with `dispatch`, and `dispose`d. A session is not
 * restarted: a restart disposes it and creates the next one (M3-T06).
 *
 * @example
 * ```ts
 * const session: GameSession = new LocalSession(PRESETS.beginner, 42, new SystemClock());
 * const off = session.subscribe((event) => console.log(event.type));
 * session.start();
 * session.dispatch({ type: 'reveal', index: 0 });
 * session.view().status; // 'playing', or 'lost' if cell 0 was a mine
 * off();
 * session.dispose();
 * ```
 */
export interface GameSession {
  /** Creates the game and starts the clock. Does nothing if the session was already started or disposed. */
  start(): void;
  /**
   * Turns an action into a command stamped with the elapsed time and gives it to the game.
   * Ignored before `start`, after the game ends, once the game is stuck and after `dispose`.
   */
  dispatch(action: PlayerAction): void;
  /** Calls `listener` with every game event from now on. Returns a function that stops the calls. */
  subscribe(listener: (event: GameEvent) => void): () => void;
  /** A snapshot of what the player may see. Throws if the session was never started. */
  view(): GameView;
  /** Milliseconds since `start`, or the time of the last command once the game has ended or is stuck. */
  elapsedMs(): number;
  /** The record of a finished game, or `undefined` while it is not finished. */
  result(): GameResult | undefined;
  /**
   * True when the game has accepted the most commands it ever will (`MAX_REPLAY_COMMANDS`, M2-T07) without
   * finishing. It can no longer change, so the UI should offer a new game. Always false for a game that can
   * still change or has ended.
   */
  isStuck(): boolean;
  /** Stops all events and ignores everything that follows. Safe to call more than once. */
  dispose(): void;
}
