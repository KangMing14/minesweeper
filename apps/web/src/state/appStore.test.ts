import { PRESETS } from '@minesweeper/engine';
import type { GameResult, GameView } from '@minesweeper/engine';
import { describe, expect, it } from 'vitest';
import { createAppStore, type FinishedGame } from './appStore.js';

// M3-T05. The store holds which screen is showing and what the next game is; invalid transitions are
// refused and leave the state exactly as it was.

const VIEW: GameView = {
  width: 2,
  height: 2,
  status: 'won',
  cells: [],
  revealedCount: 0,
  flagCount: 0,
  minesRemaining: 0,
  exposedMines: [],
};
const RESULT: GameResult = {
  outcome: 'won',
  timeMs: 1234,
  safeCellsRevealed: 3,
  totalSafeCells: 3,
  effectiveCommands: 2,
  threeBV: 2,
  threeBVPerSecond: 1.62,
};
const finished = (presetId: FinishedGame['presetId'], seed: number): FinishedGame => ({
  presetId,
  seed,
  view: VIEW,
  result: RESULT,
});

/** A seed source that hands out 100, 101, 102, ... */
function counter(): () => number {
  let next = 100;
  return () => next++;
}

describe('appStore', () => {
  it('starts on the menu with no game', () => {
    const state = createAppStore({ newSeed: counter() }).getState();
    expect(state.screen).toBe('menu');
    expect(state.presetId).toBeNull();
    expect(state.seed).toBeNull();
    expect(state.finished).toBeNull();
  });

  it('startGame moves to playing with the chosen preset and a fresh seed', () => {
    const store = createAppStore({ newSeed: counter() });
    expect(store.getState().startGame('expert')).toBe(true);
    const state = store.getState();
    expect(state.screen).toBe('playing');
    expect(state.presetId).toBe('expert');
    expect(state.seed).toBe(100);
    expect(state.gameId).toBe(1);
  });

  it('rejects an unknown preset and stays on the menu', () => {
    const store = createAppStore({ newSeed: counter() });
    expect(store.getState().startGame('nightmare' as 'expert')).toBe(false);
    expect(store.getState().screen).toBe('menu');
    expect(store.getState().seed).toBeNull();
  });

  it('rejects a second startGame while playing, without using a seed', () => {
    const store = createAppStore({ newSeed: counter() });
    store.getState().startGame('beginner');
    expect(store.getState().startGame('expert')).toBe(false);
    expect(store.getState().presetId).toBe('beginner');
    expect(store.getState().seed).toBe(100);
    expect(store.getState().gameId).toBe(1);
  });

  it('finishGame moves to result and keeps the finished game', () => {
    const store = createAppStore({ newSeed: counter() });
    store.getState().startGame('beginner');
    const game = finished('beginner', 100);
    expect(store.getState().finishGame(game)).toBe(true);
    expect(store.getState().screen).toBe('result');
    expect(store.getState().finished).toBe(game);
  });

  it('finishGame is refused on the menu and on the result screen, and changes nothing', () => {
    const store = createAppStore({ newSeed: counter() });
    expect(store.getState().finishGame(finished('beginner', 1))).toBe(false);
    expect(store.getState().screen).toBe('menu');
    expect(store.getState().finished).toBeNull();

    store.getState().startGame('beginner');
    const first = finished('beginner', 100);
    store.getState().finishGame(first);
    // A second finish (for instance from a double-run effect) must not replace the first.
    expect(store.getState().finishGame(finished('beginner', 999))).toBe(false);
    expect(store.getState().finished).toBe(first);
  });

  it('newGame from the result keeps the preset, draws a new seed, and clears the finished game', () => {
    const store = createAppStore({ newSeed: counter() });
    store.getState().startGame('intermediate');
    store.getState().finishGame(finished('intermediate', 100));
    expect(store.getState().newGame()).toBe(true);
    const state = store.getState();
    expect(state.screen).toBe('playing');
    expect(state.presetId).toBe('intermediate');
    expect(state.seed).toBe(101);
    expect(state.finished).toBeNull();
    expect(state.gameId).toBe(2);
  });

  it('newGame from playing starts another board of the same preset', () => {
    const store = createAppStore({ newSeed: counter() });
    store.getState().startGame('beginner');
    expect(store.getState().newGame()).toBe(true);
    expect(store.getState().seed).toBe(101);
    expect(store.getState().gameId).toBe(2);
  });

  it('newGame is refused on the menu', () => {
    const store = createAppStore({ newSeed: counter() });
    expect(store.getState().newGame()).toBe(false);
    expect(store.getState().screen).toBe('menu');
  });

  it('toMenu works from playing and from the result, and forgets the game', () => {
    const store = createAppStore({ newSeed: counter() });
    store.getState().startGame('beginner');
    expect(store.getState().toMenu()).toBe(true);
    expect(store.getState().screen).toBe('menu');
    expect(store.getState().presetId).toBeNull();

    store.getState().startGame('beginner');
    store.getState().finishGame(finished('beginner', 101));
    expect(store.getState().toMenu()).toBe(true);
    expect(store.getState().finished).toBeNull();
    expect(store.getState().toMenu()).toBe(false);
  });

  it('the gameId rises with every game, so a new board is a new screen even for the same seed', () => {
    const store = createAppStore({ newSeed: () => 7 });
    store.getState().startGame('beginner');
    store.getState().newGame();
    store.getState().newGame();
    expect(store.getState().seed).toBe(7);
    expect(store.getState().gameId).toBe(3);
  });

  it('offers every preset of the engine and no other', () => {
    expect(Object.keys(PRESETS)).toEqual(['beginner', 'intermediate', 'expert']);
    const store = createAppStore({ newSeed: counter() });
    for (const id of Object.keys(PRESETS)) {
      store.getState().toMenu();
      expect(store.getState().startGame(id as 'beginner')).toBe(true);
    }
  });
});
