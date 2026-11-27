import { afterEach, describe, expect, it } from 'vitest';
import { FakeStorage, gameResult } from '../../test/statsKit.js';
import { createStatsStore } from './createStatsStore.js';
import { STATS_STORAGE_KEY } from './LocalStorageStatsStore.js';

describe('createStatsStore', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('uses the storage it is given', () => {
    const storage = new FakeStorage();
    createStatsStore(() => storage).record('beginner', gameResult());
    expect(storage.data.has(STATS_STORAGE_KEY)).toBe(true);
  });

  it('uses the browser localStorage by default', () => {
    createStatsStore().record('beginner', gameResult({ timeMs: 6_000 }));
    expect(window.localStorage.getItem(STATS_STORAGE_KEY)).not.toBeNull();
    expect(createStatsStore().summary('beginner').bestTimeMs).toBe(6_000);
  });

  it('falls back to memory when asking for the storage throws (blocked cookies)', () => {
    const store = createStatsStore(() => {
      throw new Error('SecurityError');
    });
    store.record('beginner', gameResult());
    expect(store.summary('beginner').games).toBe(1);
  });

  it('falls back to memory when there is no storage at all', () => {
    const store = createStatsStore(() => null);
    store.record('beginner', gameResult());
    expect(store.summary('beginner').games).toBe(1);
  });
});
