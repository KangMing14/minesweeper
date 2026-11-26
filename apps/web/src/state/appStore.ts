import { PRESETS } from '@minesweeper/engine';
import type { GameResult, GameView } from '@minesweeper/engine';
import { createContext, useContext } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import { randomSeed } from './seed.js';
import { nextScreen, type Screen, type ScreenEvent } from './screenFlow.js';

// M3-T05. The state of the client that is not the game itself: which screen is showing, which board comes
// next, and the game that just ended. The running game lives in the play screen's `GameSession`, never here.

/** The name of one of the engine's presets. */
export type PresetId = keyof typeof PRESETS;

/** A game that has ended: what the result screen shows. Copied out of the session, so it outlives it. */
export interface FinishedGame {
  /** The preset that was played. */
  readonly presetId: PresetId;
  /** The seed of the board. */
  readonly seed: number;
  /** The final view, with the mines exposed (a solo game exposes its own mines, `CLAUDE.md` rule 8). */
  readonly view: GameView;
  /** The result record of the engine. */
  readonly result: GameResult;
}

/** What the store holds, and the only ways to change it. */
export interface AppState {
  /** The screen that is showing. */
  readonly screen: Screen;
  /** The preset of the current or last game; `null` on the menu. */
  readonly presetId: PresetId | null;
  /** The seed of the current game; `null` on the menu. */
  readonly seed: number | null;
  /** Counts the games started, so a new board is a new screen even when the seed repeats. */
  readonly gameId: number;
  /** The game that just ended, while the result screen shows; otherwise `null`. */
  readonly finished: FinishedGame | null;
  /** Menu to playing, on the given preset, with a new seed. Returns `false` and changes nothing if refused. */
  startGame(presetId: PresetId): boolean;
  /** Playing or result to playing: the same preset, a new seed. Returns `false` if refused. */
  newGame(): boolean;
  /** Playing to result, with the game that ended. Returns `false` if refused, and then keeps the old state. */
  finishGame(game: FinishedGame): boolean;
  /** Playing or result to the menu. Returns `false` if refused. */
  toMenu(): boolean;
}

/** The store of the client. */
export type AppStore = StoreApi<AppState>;

/** Options of `createAppStore`. */
export interface AppStoreOptions {
  /** Where seeds come from. Defaults to `randomSeed`; tests give a fixed source. */
  readonly newSeed?: () => number;
}

const isPresetId = (value: unknown): value is PresetId =>
  typeof value === 'string' && Object.hasOwn(PRESETS, value);

/**
 * Makes the store of the client. Every action goes through the screen table (`nextScreen`): one that the table
 * does not allow returns `false` and leaves the state exactly as it was.
 *
 * @param options - Optional seed source.
 * @returns A new store, on the menu.
 * @example
 * ```ts
 * const store = createAppStore();
 * store.getState().startGame('beginner'); // true, screen is now 'playing'
 * ```
 */
export function createAppStore(options: AppStoreOptions = {}): AppStore {
  const newSeed = options.newSeed ?? randomSeed;
  return createStore<AppState>()((set, get) => {
    /** Applies `event` if the table allows it; `patch` is only called, and a seed only drawn, then. */
    const move = (event: ScreenEvent, patch: (state: AppState) => Partial<AppState>): boolean => {
      const state = get();
      const to = nextScreen(state.screen, event);
      if (to === undefined) return false;
      set({ ...patch(state), screen: to });
      return true;
    };
    return {
      screen: 'menu',
      presetId: null,
      seed: null,
      gameId: 0,
      finished: null,
      startGame: (presetId) =>
        isPresetId(presetId) &&
        move('start', (s) => ({
          presetId,
          seed: newSeed(),
          gameId: s.gameId + 1,
          finished: null,
        })),
      newGame: () =>
        get().presetId !== null &&
        move('newGame', (s) => ({ seed: newSeed(), gameId: s.gameId + 1, finished: null })),
      finishGame: (game) => move('finish', () => ({ finished: game })),
      toMenu: () => move('toMenu', () => ({ presetId: null, seed: null, finished: null })),
    };
  });
}

/** Gives the store to the screens. `App` provides it; a screen never creates one. */
export const AppStoreContext = createContext<AppStore | null>(null);

/**
 * Reads a part of the state of the client's store, and re-renders when it changes.
 *
 * @param selector - Picks what the component needs.
 * @returns The selected value.
 * @example
 * ```tsx
 * const screen = useAppStore((s) => s.screen);
 * ```
 */
export function useAppStore<T>(selector: (state: AppState) => T): T {
  const store = useContext(AppStoreContext);
  if (store === null)
    throw new Error('useAppStore must be used inside an AppStoreContext provider.');
  return useStore(store, selector);
}
