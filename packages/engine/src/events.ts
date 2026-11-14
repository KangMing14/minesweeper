import type { CellIndex } from './config.js';

/**
 * One or more cells became revealed. Sent once per command, listing every cell that command revealed.
 *
 * @remarks
 * `value` is the number the cell shows (0 to 8). A cascade is a single event with many cells, in the order
 * the flood fill reached them. A mine is never listed here: stepping on one is reported by `GameLost`.
 *
 * @example
 * ```ts
 * const event: CellsRevealed = {
 *   type: 'cellsRevealed',
 *   cells: [
 *     { index: 40, value: 0 },
 *     { index: 41, value: 1 },
 *   ],
 * };
 * ```
 */
export interface CellsRevealed {
  /** Tells this event apart from the others in a `GameEvent`. */
  readonly type: 'cellsRevealed';
  /** Every newly revealed cell and the number it shows. */
  readonly cells: readonly { readonly index: CellIndex; readonly value: number }[];
}

/**
 * A flag was put on a hidden cell, or taken off a flagged one.
 *
 * @example
 * ```ts
 * const event: FlagToggled = { type: 'flagToggled', index: 12, flagged: true };
 * ```
 */
export interface FlagToggled {
  /** Tells this event apart from the others in a `GameEvent`. */
  readonly type: 'flagToggled';
  /** The cell whose flag changed. */
  readonly index: CellIndex;
  /** `true` if the cell is now flagged, `false` if the flag was removed. */
  readonly flagged: boolean;
}

/**
 * Every safe cell is revealed: the game is won.
 *
 * @example
 * ```ts
 * const event: GameWon = { type: 'gameWon', t: 48_250 };
 * ```
 */
export interface GameWon {
  /** Tells this event apart from the others in a `GameEvent`. */
  readonly type: 'gameWon';
  /** Milliseconds since the game started, taken from the winning command. */
  readonly t: number;
}

/**
 * A mine was revealed: the game is lost.
 *
 * @example
 * ```ts
 * const event: GameLost = { type: 'gameLost', t: 9_100, mineIndex: 33 };
 * ```
 */
export interface GameLost {
  /** Tells this event apart from the others in a `GameEvent`. */
  readonly type: 'gameLost';
  /** Milliseconds since the game started, taken from the losing command. */
  readonly t: number;
  /** The mine that was revealed. */
  readonly mineIndex: CellIndex;
}

/**
 * Everything a `Game` can announce to its subscribers.
 *
 * @remarks
 * A union discriminated by `type`, so a `switch` on it can be checked for completeness. The docs name the
 * four variants (`CellsRevealed`, `FlagToggled`, `GameWon`, `GameLost`) but do not fix the `type` strings;
 * they are camel case here, like the `type` strings of commands are lower case. Events describe what
 * happened, never where the mines are, except `GameLost`, which names the one mine that was hit.
 *
 * @example
 * ```ts
 * function describe(event: GameEvent): string {
 *   switch (event.type) {
 *     case 'cellsRevealed':
 *       return `${event.cells.length} cells revealed`;
 *     case 'flagToggled':
 *       return event.flagged ? 'flag placed' : 'flag removed';
 *     case 'gameWon':
 *       return 'won';
 *     case 'gameLost':
 *       return `hit a mine at ${event.mineIndex}`;
 *   }
 * }
 * ```
 */
export type GameEvent = CellsRevealed | FlagToggled | GameWon | GameLost;

/**
 * A small typed event emitter: the Observer behind `Game.subscribe`.
 *
 * @remarks
 * Listeners are called in the order they subscribed. `emit` works on a copy of the list, so a listener that
 * unsubscribes or subscribes while an event is being delivered changes who hears the next event, not this
 * one. If a listener throws, the others are still called, and the first error is rethrown after all of them
 * have run; one faulty listener must not stop the network or the renderer from hearing an event.
 *
 * Used only inside the engine. Not part of the public API.
 *
 * @internal
 */
export class GameEventEmitter {
  /** Registrations in subscription order. Each is its own object, so one function can subscribe twice. */
  #registrations: { readonly listener: (event: GameEvent) => void }[] = [];

  /**
   * Starts delivering events to `listener`.
   *
   * @param listener - Called with every event emitted from now on.
   * @returns A function that stops delivery. Calling it again does nothing.
   */
  subscribe(listener: (event: GameEvent) => void): () => void {
    const registration = { listener };
    // Copy on write, so a snapshot taken by `emit` is never changed by a later subscribe or unsubscribe.
    this.#registrations = [...this.#registrations, registration];
    return () => {
      this.#registrations = this.#registrations.filter((r) => r !== registration);
    };
  }

  /**
   * Delivers an event to every current listener.
   *
   * @param event - The event to deliver.
   * @throws The first error thrown by a listener, after every listener has been called.
   */
  emit(event: GameEvent): void {
    const snapshot = this.#registrations;
    let failed = false;
    let firstError: unknown;
    for (const { listener } of snapshot) {
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
