import type { GameResult } from '@minesweeper/engine';

// M3-T07. Where the player's own numbers are kept. The client records finished solo games here; from M7 the
// server keeps the numbers that count, and this store stays a local convenience (see `ARCHITECTURE.md`,
// "Local statistics").

/** What the player has done on one preset. */
export interface PresetStats {
  /** Finished games, won or lost. A retried board is a new game and counts again. */
  readonly games: number;
  /** Games won. */
  readonly wins: number;
  /** The fastest win in milliseconds, or `null` if there is none yet. A win at time 0 never sets it. */
  readonly bestTimeMs: number | null;
  /** The mean 3BV per second of the wins that have a time, or 0 if there is none. */
  readonly averageThreeBVPerSecond: number;
}

/**
 * The player's numbers, per preset. A store never throws: if it cannot keep the numbers, it keeps them for
 * this visit only.
 *
 * @example
 * ```ts
 * store.record('beginner', session.result()!);
 * store.summary('beginner').bestTimeMs; // 12345
 * ```
 */
export interface StatsStore {
  /**
   * Adds one finished game. A result that is not `'won'` or `'lost'` is ignored.
   *
   * @param preset - The preset id the game was played on, for example `'beginner'`.
   * @param result - The engine's record of the finished game.
   */
  record(preset: string, result: GameResult): void;
  /**
   * What the player has done on a preset.
   *
   * @param preset - The preset id.
   * @returns The numbers; all zero (and no best time) for a preset never played.
   */
  summary(preset: string): PresetStats;
}
