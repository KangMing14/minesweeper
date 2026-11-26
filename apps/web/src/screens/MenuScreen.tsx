import type { JSX } from 'react';
import type { PresetId } from '../state/appStore.js';
import { PRESET_LIST, describeBoard } from './presets.js';
import { SCREEN_HEADING } from './styles.js';
import { useFocusOnMount } from './useFocusOnMount.js';

/** Props of `MenuScreen`. */
export interface MenuScreenProps {
  /** Called with the preset the player picked. */
  readonly onStart: (presetId: PresetId) => void;
}

/** Pixels per cell of the small board drawings, so the three sizes can be compared by eye. */
const SKETCH_CELL_PX = 6;

/**
 * The menu: one button per preset, each with a drawing of its board to scale, and a short note on the clock
 * and the controls.
 *
 * @param props - The handler for a chosen preset.
 * @returns The screen.
 * @example
 * ```tsx
 * <MenuScreen onStart={(id) => store.getState().startGame(id)} />
 * ```
 */
export function MenuScreen({ onStart }: MenuScreenProps): JSX.Element {
  const heading = useFocusOnMount<HTMLHeadingElement>();
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
    </section>
  );
}
