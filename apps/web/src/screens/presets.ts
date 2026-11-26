import { PRESETS } from '@minesweeper/engine';
import type { BoardConfig } from '@minesweeper/engine';
import type { PresetId } from '../state/appStore.js';

// M3-T05. How the engine's presets (D-01 working values) appear to the player.

/** One difficulty on the menu. */
export interface PresetInfo {
  /** The key in the engine's `PRESETS`. */
  readonly id: PresetId;
  /** The name the player sees. */
  readonly name: string;
  /** The board. */
  readonly config: BoardConfig;
}

const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/** The presets in the engine's order: easiest first. */
export const PRESET_LIST: readonly PresetInfo[] = (Object.keys(PRESETS) as PresetId[]).map(
  (id) => ({
    id,
    name: capitalize(id),
    config: PRESETS[id],
  }),
);

/**
 * Finds a preset by id.
 *
 * @param id - The preset id.
 * @returns Its name and board.
 * @example
 * ```ts
 * presetInfo('expert').name; // 'Expert'
 * ```
 */
export function presetInfo(id: PresetId): PresetInfo {
  const info = PRESET_LIST.find((preset) => preset.id === id);
  if (info === undefined) throw new RangeError(`unknown preset: ${String(id)}`);
  return info;
}

/**
 * The size of a board and its mines in words: `9 × 9, 10 mines`.
 *
 * @param config - The board.
 * @returns The text.
 * @example
 * ```ts
 * describeBoard({ width: 9, height: 9, mineCount: 1 }); // '9 × 9, 1 mine'
 * ```
 */
export function describeBoard(config: BoardConfig): string {
  const mines = config.mineCount === 1 ? 'mine' : 'mines';
  return `${config.width} × ${config.height}, ${config.mineCount} ${mines}`;
}
