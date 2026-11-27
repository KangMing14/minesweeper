import { afterEach, describe, expect, it } from 'vitest';
import { FakeStorage, gameResult, lostResult } from '../../test/statsKit.js';
import { LocalStorageStatsStore, STATS_STORAGE_KEY } from './LocalStorageStatsStore.js';

// M3-T07. The parts that only a storage-backed store has: one versioned blob under one key, other tabs,
// and everything that can go wrong with the storage.
const blob = (storage: FakeStorage): unknown =>
  JSON.parse(storage.data.get(STATS_STORAGE_KEY) ?? 'null');

describe('LocalStorageStatsStore', () => {
  afterEach(() => {
    expect(Object.hasOwn(Object.prototype, 'games')).toBe(false);
  });

  it('keeps everything in one versioned JSON blob under one key', () => {
    const storage = new FakeStorage();
    const store = new LocalStorageStatsStore(storage);
    store.record('beginner', gameResult());
    store.record('expert', lostResult());
    expect([...storage.data.keys()]).toEqual([STATS_STORAGE_KEY]);
    expect(blob(storage)).toMatchObject({ version: 1, presets: { beginner: {}, expert: {} } });
  });

  it('shows the numbers again to a new store on the same storage (a reload)', () => {
    const storage = new FakeStorage();
    new LocalStorageStatsStore(storage).record(
      'beginner',
      gameResult({ timeMs: 7_000, threeBVPerSecond: 5 }),
    );
    expect(new LocalStorageStatsStore(storage).summary('beginner')).toEqual({
      games: 1,
      wins: 1,
      bestTimeMs: 7_000,
      averageThreeBVPerSecond: 5,
    });
  });

  it('adds to what another tab wrote since this store last looked', () => {
    const storage = new FakeStorage();
    const a = new LocalStorageStatsStore(storage);
    const b = new LocalStorageStatsStore(storage);
    a.record('beginner', gameResult());
    b.record('beginner', gameResult());
    expect(a.summary('beginner').games).toBe(2);
    expect(b.summary('beginner').games).toBe(2);
  });

  it('ignores a blob that is not JSON, and the next record replaces it', () => {
    const storage = new FakeStorage();
    storage.data.set(STATS_STORAGE_KEY, '{not json');
    const store = new LocalStorageStatsStore(storage);
    expect(store.summary('beginner').games).toBe(0);
    store.record('beginner', gameResult());
    expect(store.summary('beginner').games).toBe(1);
    expect(blob(storage)).toMatchObject({ version: 1 });
  });

  it.each([
    ['null', 'null'],
    ['an array', '[]'],
    ['a number', '7'],
    ['no presets', '{"version":1}'],
    ['presets that is a list', '{"version":1,"presets":[]}'],
    ['an entry that is not an object', '{"version":1,"presets":{"beginner":3}}'],
    [
      'negative games',
      '{"version":1,"presets":{"beginner":{"games":-1,"wins":0,"bestTimeMs":null,"rateSum":0,"rateCount":0}}}',
    ],
    [
      'more wins than games',
      '{"version":1,"presets":{"beginner":{"games":1,"wins":2,"bestTimeMs":null,"rateSum":0,"rateCount":0}}}',
    ],
    [
      'a fractional count',
      '{"version":1,"presets":{"beginner":{"games":1.5,"wins":0,"bestTimeMs":null,"rateSum":0,"rateCount":0}}}',
    ],
    [
      'a best time that is a string',
      '{"version":1,"presets":{"beginner":{"games":1,"wins":1,"bestTimeMs":"fast","rateSum":0,"rateCount":0}}}',
    ],
    [
      'a rate sample without a win',
      '{"version":1,"presets":{"beginner":{"games":1,"wins":0,"bestTimeMs":null,"rateSum":3,"rateCount":1}}}',
    ],
  ])('ignores a blob of the right version with the wrong shape: %s', (_name, text) => {
    const storage = new FakeStorage();
    storage.data.set(STATS_STORAGE_KEY, text);
    const store = new LocalStorageStatsStore(storage);
    expect(store.summary('beginner').games).toBe(0);
    store.record('beginner', gameResult());
    expect(store.summary('beginner').games).toBe(1);
  });

  it('resets safely when the version is not the one it knows', () => {
    const storage = new FakeStorage();
    storage.data.set(
      STATS_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        presets: { beginner: { games: 50, wins: 50, bestTimeMs: 1, rateSum: 1, rateCount: 1 } },
      }),
    );
    const store = new LocalStorageStatsStore(storage);
    expect(store.summary('beginner').games).toBe(0);
    store.record('beginner', gameResult());
    expect(blob(storage)).toMatchObject({ version: 1, presets: { beginner: { games: 1 } } });
  });

  it('does not let a stored "__proto__" entry reach Object.prototype', () => {
    const storage = new FakeStorage();
    storage.data.set(
      STATS_STORAGE_KEY,
      '{"version":1,"presets":{"__proto__":{"games":4,"wins":1,"bestTimeMs":900,"rateSum":2,"rateCount":1}}}',
    );
    const store = new LocalStorageStatsStore(storage);
    expect(store.summary('__proto__').games).toBe(4);
    expect(store.summary('beginner').games).toBe(0);
    expect(({} as Record<string, unknown>)['games']).toBeUndefined();
  });

  it('works in memory when reading the storage throws, and does not throw', () => {
    const storage = new FakeStorage();
    storage.failReads = true;
    const store = new LocalStorageStatsStore(storage);
    expect(store.summary('beginner').games).toBe(0);
    store.record('beginner', gameResult({ timeMs: 4_000 }));
    store.record('beginner', lostResult());
    expect(store.summary('beginner')).toMatchObject({ games: 2, wins: 1, bestTimeMs: 4_000 });
  });

  it('keeps counting in memory when writing throws (storage full or blocked)', () => {
    const storage = new FakeStorage();
    storage.failWrites = true;
    const store = new LocalStorageStatsStore(storage);
    store.record('beginner', gameResult());
    store.record('beginner', gameResult());
    expect(store.summary('beginner').games).toBe(2);
    expect(storage.data.size).toBe(0);
  });

  it('keeps the last numbers it knew when the storage starts to throw later', () => {
    const storage = new FakeStorage();
    const store = new LocalStorageStatsStore(storage);
    store.record('beginner', gameResult());
    storage.failReads = true;
    expect(store.summary('beginner').games).toBe(1);
    store.record('beginner', gameResult());
    expect(store.summary('beginner').games).toBe(2);
  });

  it('writes again once a failing storage works, so nothing counted meanwhile is lost', () => {
    const storage = new FakeStorage();
    storage.failWrites = true;
    const store = new LocalStorageStatsStore(storage);
    store.record('beginner', gameResult());
    storage.failWrites = false;
    store.record('beginner', gameResult());
    expect(new LocalStorageStatsStore(storage).summary('beginner').games).toBe(2);
  });
});
