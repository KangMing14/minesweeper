import { LocalStorageStatsStore, type StorageLike } from './LocalStorageStatsStore.js';
import { MemoryStatsStore } from './MemoryStatsStore.js';
import type { StatsStore } from './StatsStore.js';

/**
 * Makes the store the app uses: `localStorage` if the browser gives it, otherwise memory. Asking for
 * `window.localStorage` can itself throw (blocked cookies), so it is asked inside a try.
 *
 * @param getStorage - Where the storage comes from. Defaults to `window.localStorage`; tests give another.
 * @returns A store that never throws.
 * @example
 * ```ts
 * const stats = createStatsStore();
 * ```
 */
export function createStatsStore(
  getStorage: () => StorageLike | null = () => window.localStorage,
): StatsStore {
  try {
    const storage = getStorage();
    if (storage !== null) return new LocalStorageStatsStore(storage);
  } catch {
    // Fall through to memory.
  }
  return new MemoryStatsStore();
}
