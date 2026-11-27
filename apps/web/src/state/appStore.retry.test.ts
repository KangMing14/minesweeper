import { PRESETS } from '@minesweeper/engine';
import type { GameResult, GameView } from '@minesweeper/engine';
import { describe, expect, it } from 'vitest';
import { createAppStore, type FinishedGame } from './appStore.js';

// M3-T07. The store knows whether the game on screen is a retry of a board the player already played, so that
// the statistics can leave retries out. It is a flag of the state, set by `retryGame` and by nothing else:
// comparing seeds would also catch a new board that happens to draw the same seed.

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
const finished = (seed: number): FinishedGame => ({
  presetId: 'beginner',
  seed,
  view: VIEW,
  result: RESULT,
});

function counter(): () => number {
  let next = 100;
  return () => next++;
}

describe('AppState.isRetry', () => {
  it('is false on the menu and for a game that was just started', () => {
    const store = createAppStore({ newSeed: counter() });
    expect(store.getState().isRetry).toBe(false);
    store.getState().startGame('beginner');
    expect(store.getState().isRetry).toBe(false);
  });

  it('becomes true when the player retries the board, from a game in progress and from the result', () => {
    const store = createAppStore({ newSeed: counter() });
    store.getState().startGame('beginner');
    expect(store.getState().retryGame()).toBe(true);
    expect(store.getState().isRetry).toBe(true);

    const other = createAppStore({ newSeed: counter() });
    other.getState().startGame('beginner');
    other.getState().finishGame(finished(100));
    expect(other.getState().isRetry).toBe(false);
    other.getState().retryGame();
    expect(other.getState().isRetry).toBe(true);
  });

  it('stays true through repeated retries of the same board', () => {
    const store = createAppStore({ newSeed: counter() });
    store.getState().startGame('beginner');
    for (let i = 0; i < 5; i += 1) {
      store.getState().retryGame();
      expect(store.getState().isRetry).toBe(true);
      expect(store.getState().seed).toBe(100);
    }
  });

  it('stays true when a retried game finishes, so the result screen and its retry buttons agree', () => {
    const store = createAppStore({ newSeed: counter() });
    store.getState().startGame('beginner');
    store.getState().retryGame();
    store.getState().finishGame(finished(100));
    expect(store.getState().isRetry).toBe(true);
  });

  it('goes back to false for a new board, even one that draws the same seed again', () => {
    const store = createAppStore({ newSeed: () => 7 });
    store.getState().startGame('beginner');
    store.getState().retryGame();
    expect(store.getState().newGame()).toBe(true);
    expect(store.getState().seed).toBe(7);
    expect(store.getState().isRetry).toBe(false);
  });

  it('goes back to false for the menu and for the next game started from it', () => {
    const store = createAppStore({ newSeed: counter() });
    store.getState().startGame('beginner');
    store.getState().retryGame();
    store.getState().toMenu();
    expect(store.getState().isRetry).toBe(false);
    store.getState().startGame(Object.keys(PRESETS)[1] as 'intermediate');
    expect(store.getState().isRetry).toBe(false);
  });

  it('is not changed by an action that the screen table refuses', () => {
    const store = createAppStore({ newSeed: counter() });
    expect(store.getState().retryGame()).toBe(false);
    expect(store.getState().isRetry).toBe(false);
    store.getState().startGame('beginner');
    store.getState().retryGame();
    expect(store.getState().startGame('expert')).toBe(false);
    expect(store.getState().isRetry).toBe(true);
  });
});
