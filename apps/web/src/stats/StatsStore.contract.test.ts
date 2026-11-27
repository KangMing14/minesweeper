import { describe, expect, it } from 'vitest';
import { FakeStorage, gameResult, lostResult } from '../../test/statsKit.js';
import { LocalStorageStatsStore } from './LocalStorageStatsStore.js';
import { MemoryStatsStore } from './MemoryStatsStore.js';
import type { StatsStore } from './StatsStore.js';

// M3-T07. What every `StatsStore` must do, whatever it keeps the numbers in.
describe.each<[string, () => StatsStore]>([
  ['MemoryStatsStore', () => new MemoryStatsStore()],
  ['LocalStorageStatsStore', () => new LocalStorageStatsStore(new FakeStorage())],
])('%s (the StatsStore contract)', (_name, make) => {
  it('has nothing to say about a preset that was never played', () => {
    expect(make().summary('beginner')).toEqual({
      games: 0,
      wins: 0,
      bestTimeMs: null,
      averageThreeBVPerSecond: 0,
    });
  });

  it('counts a win as a game and a win, and keeps its time as the best', () => {
    const store = make();
    store.record('beginner', gameResult({ timeMs: 12_345, threeBVPerSecond: 2.5 }));
    expect(store.summary('beginner')).toEqual({
      games: 1,
      wins: 1,
      bestTimeMs: 12_345,
      averageThreeBVPerSecond: 2.5,
    });
  });

  it('counts a loss as a game only: no win, no best time, no 3BV rate', () => {
    const store = make();
    store.record('beginner', lostResult({ timeMs: 3_000, threeBVPerSecond: 9 }));
    expect(store.summary('beginner')).toEqual({
      games: 1,
      wins: 0,
      bestTimeMs: null,
      averageThreeBVPerSecond: 0,
    });
  });

  it('moves the best time only for a faster win, never for a slower win or for a loss', () => {
    const store = make();
    store.record('beginner', gameResult({ timeMs: 20_000 }));
    store.record('beginner', gameResult({ timeMs: 25_000 }));
    expect(store.summary('beginner').bestTimeMs).toBe(20_000);
    store.record('beginner', lostResult({ timeMs: 1_000 }));
    expect(store.summary('beginner').bestTimeMs).toBe(20_000);
    store.record('beginner', gameResult({ timeMs: 15_000 }));
    expect(store.summary('beginner').bestTimeMs).toBe(15_000);
    expect(store.summary('beginner').games).toBe(4);
    expect(store.summary('beginner').wins).toBe(3);
  });

  it('averages the 3BV per second of the wins only', () => {
    const store = make();
    store.record('expert', gameResult({ threeBVPerSecond: 2 }));
    store.record('expert', gameResult({ threeBVPerSecond: 4 }));
    store.record('expert', lostResult({ threeBVPerSecond: 100 }));
    expect(store.summary('expert').averageThreeBVPerSecond).toBe(3);
  });

  it('counts a win at time 0 (the opening cleared the board) as a win, but not as a best time or a rate', () => {
    const store = make();
    store.record('beginner', gameResult({ timeMs: 0, threeBVPerSecond: 0 }));
    expect(store.summary('beginner')).toEqual({
      games: 1,
      wins: 1,
      bestTimeMs: null,
      averageThreeBVPerSecond: 0,
    });
    store.record('beginner', gameResult({ timeMs: 9_000, threeBVPerSecond: 4 }));
    expect(store.summary('beginner').bestTimeMs).toBe(9_000);
    expect(store.summary('beginner').averageThreeBVPerSecond).toBe(4);
  });

  it('keeps each preset apart', () => {
    const store = make();
    store.record('beginner', gameResult({ timeMs: 8_000 }));
    store.record('expert', lostResult());
    expect(store.summary('beginner').games).toBe(1);
    expect(store.summary('beginner').bestTimeMs).toBe(8_000);
    expect(store.summary('expert').wins).toBe(0);
    expect(store.summary('intermediate').games).toBe(0);
  });

  it('counts the same board played again as a new game (a retry is a game)', () => {
    const store = make();
    store.record('beginner', gameResult());
    store.record('beginner', gameResult());
    expect(store.summary('beginner').games).toBe(2);
  });

  it('survives a preset name that is also a property of Object', () => {
    const store = make();
    store.record('__proto__', gameResult({ timeMs: 5_000 }));
    store.record('constructor', lostResult());
    expect(store.summary('__proto__').bestTimeMs).toBe(5_000);
    expect(store.summary('constructor').games).toBe(1);
    expect(store.summary('toString').games).toBe(0);
    expect(({} as Record<string, unknown>)['games']).toBeUndefined();
  });

  it('ignores a result that is not a finished game or has no usable numbers, without throwing', () => {
    const store = make();
    store.record('beginner', gameResult({ outcome: 'playing' as never }));
    expect(store.summary('beginner').games).toBe(0);
    store.record('beginner', gameResult({ timeMs: Number.NaN, threeBVPerSecond: Number.NaN }));
    expect(store.summary('beginner')).toEqual({
      games: 1,
      wins: 1,
      bestTimeMs: null,
      averageThreeBVPerSecond: 0,
    });
  });
});
