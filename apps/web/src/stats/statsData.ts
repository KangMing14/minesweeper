import type { GameResult } from '@minesweeper/engine';
import type { PresetStats } from './StatsStore.js';

// M3-T07. The numbers behind a `StatsStore`, as plain immutable data, and the one place that knows how they
// are added up, summed into a summary, written as JSON and read back. Internal to `src/stats`.

/** The version of the stored blob. A blob with another version is ignored and then replaced. */
export const STATS_VERSION = 1;

/** What is added up for one preset. The mean is `rateSum / rateCount`, kept as two numbers so it stays exact. */
export interface PresetTally {
  readonly games: number;
  readonly wins: number;
  readonly bestTimeMs: number | null;
  /** Sum of the 3BV per second of the wins that have a time. */
  readonly rateSum: number;
  /** How many wins went into `rateSum`. */
  readonly rateCount: number;
}

/** All presets. A `Map`, so a name such as `__proto__` is an ordinary key. */
export type StatsData = ReadonlyMap<string, PresetTally>;

const NONE: PresetTally = { games: 0, wins: 0, bestTimeMs: null, rateSum: 0, rateCount: 0 };

/** No games at all. */
export const EMPTY_STATS: StatsData = new Map();

/** Adds one game and returns the new data, or the same data if the result is not a finished game. */
export function addResult(data: StatsData, preset: string, result: GameResult): StatsData {
  if (result.outcome !== 'won' && result.outcome !== 'lost') return data;
  const old = data.get(preset) ?? NONE;
  let next: PresetTally = { ...old, games: old.games + 1 };
  if (result.outcome === 'won') {
    // A win at time 0 (the opening cleared the board, M2-T03) is a win but says nothing about speed.
    const timed = Number.isFinite(result.timeMs) && result.timeMs > 0;
    const hasRate =
      timed && Number.isFinite(result.threeBVPerSecond) && result.threeBVPerSecond >= 0;
    next = {
      ...next,
      wins: old.wins + 1,
      bestTimeMs: timed ? Math.min(old.bestTimeMs ?? result.timeMs, result.timeMs) : old.bestTimeMs,
      rateSum: hasRate ? old.rateSum + result.threeBVPerSecond : old.rateSum,
      rateCount: hasRate ? old.rateCount + 1 : old.rateCount,
    };
  }
  return new Map(data).set(preset, next);
}

/** What the player sees for one preset. */
export function summarize(data: StatsData, preset: string): PresetStats {
  const tally = data.get(preset) ?? NONE;
  return {
    games: tally.games,
    wins: tally.wins,
    bestTimeMs: tally.bestTimeMs,
    averageThreeBVPerSecond: tally.rateCount === 0 ? 0 : tally.rateSum / tally.rateCount,
  };
}

/** The blob to store: `{ version, presets }` as JSON. */
export function serializeStats(data: StatsData): string {
  return JSON.stringify({ version: STATS_VERSION, presets: Object.fromEntries(data) });
}

const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parseTally(value: unknown): PresetTally | null {
  if (!isRecord(value)) return null;
  const { games, wins, bestTimeMs, rateSum, rateCount } = value;
  if (!isCount(games) || !isCount(wins) || !isCount(rateCount)) return null;
  if (wins > games || rateCount > wins) return null;
  if (typeof rateSum !== 'number' || !Number.isFinite(rateSum) || rateSum < 0) return null;
  if (bestTimeMs !== null) {
    if (typeof bestTimeMs !== 'number' || !Number.isFinite(bestTimeMs) || bestTimeMs <= 0)
      return null;
    if (wins === 0) return null;
  }
  return { games, wins, bestTimeMs, rateSum, rateCount };
}

/**
 * Reads a stored blob. Returns `null` for anything that is not a valid blob of the current version: no text,
 * text that is not JSON, another version, or a shape that does not add up. One bad entry rejects the whole
 * blob, because numbers that do not add up cannot be trusted.
 */
export function parseStats(text: string | null): StatsData | null {
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw) || raw['version'] !== STATS_VERSION || !isRecord(raw['presets'])) return null;
  const data = new Map<string, PresetTally>();
  for (const [preset, value] of Object.entries(raw['presets'])) {
    const tally = parseTally(value);
    if (tally === null) return null;
    data.set(preset, tally);
  }
  return data;
}
