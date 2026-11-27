// Test kit for M3-T07: a hand-made `GameResult` and a storage whose failures the test controls.
import type { GameResult } from '@minesweeper/engine';
import type { StorageLike } from '../src/stats/LocalStorageStatsStore.js';

/** A finished game's record. Defaults to a win in ten seconds at 3 3BV per second; override what matters. */
export function gameResult(overrides: Partial<GameResult> = {}): GameResult {
  return {
    outcome: 'won',
    timeMs: 10_000,
    safeCellsRevealed: 71,
    totalSafeCells: 71,
    effectiveCommands: 20,
    threeBV: 30,
    threeBVPerSecond: 3,
    ...overrides,
  };
}

/** A game that was lost: only the outcome and the progress differ from a win. */
export function lostResult(overrides: Partial<GameResult> = {}): GameResult {
  return gameResult({ outcome: 'lost', safeCellsRevealed: 20, threeBVPerSecond: 1, ...overrides });
}

/** A `Storage` stand-in that can be made to throw, as a browser does when storage is blocked or full. */
export class FakeStorage implements StorageLike {
  readonly data = new Map<string, string>();
  failReads = false;
  failWrites = false;
  getItem(key: string): string | null {
    if (this.failReads) throw new Error('storage is blocked');
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('quota exceeded');
    this.data.set(key, value);
  }
}
