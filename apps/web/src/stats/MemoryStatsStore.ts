import type { GameResult } from '@minesweeper/engine';
import { EMPTY_STATS, addResult, summarize, type StatsData } from './statsData.js';
import type { PresetStats, StatsStore } from './StatsStore.js';

/**
 * A `StatsStore` that keeps the numbers in memory: gone when the page is closed. It is the fallback when
 * `localStorage` is not available, and the store that tests use.
 *
 * @example
 * ```ts
 * const store = new MemoryStatsStore();
 * store.record('beginner', result);
 * ```
 */
export class MemoryStatsStore implements StatsStore {
  #data: StatsData = EMPTY_STATS;

  /** Adds one finished game; see `StatsStore.record`. */
  record(preset: string, result: GameResult): void {
    this.#data = addResult(this.#data, preset, result);
  }

  /** The numbers of one preset; see `StatsStore.summary`. */
  summary(preset: string): PresetStats {
    return summarize(this.#data, preset);
  }
}
