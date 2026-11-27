import type { JSX } from 'react';
import { formatDuration, formatRate } from '../format.js';
import type { PresetId } from '../state/appStore.js';
import type { PresetStats } from '../stats/StatsStore.js';
import { PRESET_LIST, describeBoard } from './presets.js';
import { SCREEN_HEADING } from './styles.js';
import { useFocusOnMount } from './useFocusOnMount.js';

/** Props of `MenuScreen`. */
export interface MenuScreenProps {
  /** Called with the preset the player picked. */
  readonly onStart: (presetId: PresetId) => void;
  /**
   * What the player has done on a preset (M3-T07). Without it, or while no game has been played, the menu
   * shows no records.
   */
  readonly stats?: (presetId: PresetId) => PresetStats;
}

/** Pixels per cell of the small board drawings, so the three sizes can be compared by eye. */
const SKETCH_CELL_PX = 6;

/** One row of the records table. A dash stands for a number that does not exist yet. */
function RecordsRow({ name, stats }: { name: string; stats: PresetStats }): JSX.Element {
  const cell = 'px-3 py-2 text-right tabular-nums';
  return (
    <tr className="border-t border-cell-hidden">
      <th scope="row" className="px-3 py-2 text-left font-semibold">
        {name}
      </th>
      <td className={cell}>{stats.games}</td>
      <td className={cell}>{stats.wins}</td>
      <td className={cell}>{stats.bestTimeMs === null ? '–' : formatDuration(stats.bestTimeMs)}</td>
      <td className={cell}>
        {stats.averageThreeBVPerSecond === 0 ? '–' : formatRate(stats.averageThreeBVPerSecond)}
      </td>
    </tr>
  );
}

/**
 * The menu: one button per preset, each with a drawing of its board to scale, a short note on the clock
 * and the controls, and, once a game has been played, the player's records.
 *
 * @param props - The handler for a chosen preset, and optionally the records.
 * @returns The screen.
 * @example
 * ```tsx
 * <MenuScreen onStart={(id) => store.getState().startGame(id)} />
 * ```
 */
export function MenuScreen({ onStart, stats }: MenuScreenProps): JSX.Element {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const records =
    stats === undefined ? [] : PRESET_LIST.map((preset) => ({ preset, stats: stats(preset.id) }));
  const hasRecords = records.some((record) => record.stats.games > 0);
  return (
    <section className="mx-auto max-w-xl">
      <h2 ref={heading} tabIndex={-1} className={SCREEN_HEADING}>
        Choose a difficulty
      </h2>
      <p className="mt-2 text-ink-muted">
        Clear every safe cell as fast as you can. The clock starts as soon as the board appears.
      </p>
      <ul role="list" aria-label="Difficulties" className="mt-5 flex flex-col gap-3">
        {PRESET_LIST.map(({ id, name, config }) => (
          <li key={id}>
            <button
              type="button"
              className="grid w-full grid-cols-[11.5rem_1fr] items-center gap-4 rounded-lg border border-cell-hidden bg-raised p-4 text-left hover:border-accent"
              onClick={() => {
                onStart(id);
              }}
            >
              <span className="flex h-24 items-center" aria-hidden="true">
                <span
                  data-board-sketch=""
                  aria-hidden="true"
                  className="block shrink-0 rounded-sm"
                  style={{
                    width: `${config.width * SKETCH_CELL_PX}px`,
                    height: `${config.height * SKETCH_CELL_PX}px`,
                    backgroundColor: 'var(--ms-color-cell-hidden)',
                    backgroundImage:
                      'linear-gradient(to right, var(--ms-color-surface-raised) 1px, transparent 1px), linear-gradient(to bottom, var(--ms-color-surface-raised) 1px, transparent 1px)',
                    backgroundSize: `${SKETCH_CELL_PX}px ${SKETCH_CELL_PX}px`,
                  }}
                />
              </span>
              <span>
                <span className="block text-lg font-semibold">{name}</span>{' '}
                <span className="block text-ink-muted">{describeBoard(config)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-5 max-w-prose text-sm text-ink-muted">
        Click to reveal a cell and right-click to flag a mine. On the keyboard, use the arrow keys
        to move, Space to reveal, F to flag and Enter to open the cells around a number.
      </p>
      {hasRecords ? (
        <div className="mt-8">
          <table className="w-full border-collapse text-base">
            <caption className="pb-2 text-left text-lg font-semibold">Your records</caption>
            <thead className="text-sm text-ink-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-normal">
                  Difficulty
                </th>
                <th scope="col" className="px-3 py-2 text-right font-normal">
                  Games
                </th>
                <th scope="col" className="px-3 py-2 text-right font-normal">
                  Wins
                </th>
                <th scope="col" className="px-3 py-2 text-right font-normal">
                  Best time
                </th>
                <th scope="col" className="px-3 py-2 text-right font-normal">
                  3BV/s
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map(({ preset, stats: presetStats }) => (
                <RecordsRow key={preset.id} name={preset.name} stats={presetStats} />
              ))}
            </tbody>
          </table>
          <p className="mt-2 max-w-prose text-sm text-ink-muted">
            3BV/s is the average of your wins. Retries of the same board are not counted. Records
            are kept in this browser only.
          </p>
        </div>
      ) : null}
    </section>
  );
}
