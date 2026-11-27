import type { GameResult } from '@minesweeper/engine';
import {
  EMPTY_STATS,
  addResult,
  parseStats,
  serializeStats,
  summarize,
  type StatsData,
} from './statsData.js';
import type { PresetStats, StatsStore } from './StatsStore.js';

/** The part of `Storage` that the store uses, so a test can give it a stand-in. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** The one key the numbers are stored under. */
export const STATS_STORAGE_KEY = 'minesweeper.stats';

/**
 * A `StatsStore` that keeps one versioned JSON blob in `localStorage`. It reads the storage again on every
 * call, so a second tab's games are not lost. It never throws: if the storage is blocked, full, empty,
 * corrupt or of another version, it carries on with the last numbers it knew (none at the start) and tries
 * to store them at the next record.
 *
 * @example
 * ```ts
 * const store = new LocalStorageStatsStore(window.localStorage);
 * ```
 */
export class LocalStorageStatsStore implements StatsStore {
  readonly #storage: StorageLike;
  readonly #key: string;
  /** The last numbers seen or written; what is used when the storage has nothing usable. */
  #known: StatsData = EMPTY_STATS;

  /**
   * @param storage - Where to keep the numbers, normally `window.localStorage`.
   * @param key - The storage key; the default is `STATS_STORAGE_KEY`.
   */
  constructor(storage: StorageLike, key: string = STATS_STORAGE_KEY) {
    this.#storage = storage;
    this.#key = key;
  }

  #read(): StatsData {
    try {
      const stored = parseStats(this.#storage.getItem(this.#key));
      if (stored !== null) this.#known = stored;
    } catch {
      // Blocked storage: keep what we know.
    }
    return this.#known;
  }

  /** Adds one finished game and stores the new numbers; see `StatsStore.record`. */
  record(preset: string, result: GameResult): void {
    const next = addResult(this.#read(), preset, result);
    if (next === this.#known) return;
    this.#known = next;
    try {
      this.#storage.setItem(this.#key, serializeStats(next));
    } catch {
      // Full or blocked: the numbers stay in memory for this visit.
    }
  }

  /** The numbers of one preset, read from the storage; see `StatsStore.summary`. */
  summary(preset: string): PresetStats {
    return summarize(this.#read(), preset);
  }
}
