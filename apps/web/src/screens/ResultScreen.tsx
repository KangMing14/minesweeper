import type { JSX } from 'react';
import { BoardCanvas } from '../render/BoardCanvas.js';
import { formatDuration, formatRate } from '../format.js';
import type { FinishedGame } from '../state/appStore.js';
import { describeBoard, presetInfo } from './presets.js';
import { RestartHint } from './RestartHint.js';
import { PRIMARY_BUTTON, SCREEN_HEADING, SECONDARY_BUTTON } from './styles.js';
import { useFocusOnMount } from './useFocusOnMount.js';

/** Props of `ResultScreen`. */
export interface ResultScreenProps {
  /** The game that just ended. */
  readonly finished: FinishedGame;
  /** Called to play another board of the same difficulty. */
  readonly onNewGame: () => void;
  /** Called to play the same board again, with the same seed. */
  readonly onRetry: () => void;
  /** Called to go back to the menu. */
  readonly onMenu: () => void;
}

/**
 * The result of a finished game: the outcome as the heading, then time, 3BV, 3BV per second and how many
 * safe cells were cleared, with the finished board (read-only, mines shown) below. It offers another board (R), the same board again
 * (Shift+R) and a change of difficulty.
 *
 * @param props - The finished game and the three ways on.
 * @returns The screen.
 * @example
 * ```tsx
 * <ResultScreen finished={store.getState().finished} onNewGame={newGame} onRetry={retryGame} onMenu={toMenu} />
 * ```
 */
export function ResultScreen({
  finished,
  onNewGame,
  onRetry,
  onMenu,
}: ResultScreenProps): JSX.Element {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const { result, view, presetId } = finished;
  const preset = presetInfo(presetId);
  const rows: readonly (readonly [string, string])[] = [
    ['Time', formatDuration(result.timeMs)],
    ['3BV', String(result.threeBV)],
    ['3BV per second', formatRate(result.threeBVPerSecond)],
    ['Cells cleared', `${result.safeCellsRevealed} of ${result.totalSafeCells}`],
  ];
  return (
    <section className="flex flex-col gap-5">
      <div>
        <h2 ref={heading} tabIndex={-1} className={SCREEN_HEADING}>
          {result.outcome === 'won' ? 'You cleared the board' : 'You hit a mine'}
        </h2>
        <p className="mt-1 text-ink-muted">
          {preset.name}, {describeBoard(preset.config)}
        </p>
      </div>
      <dl className="flex flex-wrap gap-3">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="min-w-32 rounded-lg border border-cell-hidden bg-raised px-4 py-3"
          >
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="text-xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={PRIMARY_BUTTON} aria-keyshortcuts="R" onClick={onNewGame}>
          New board
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON}
          aria-keyshortcuts="Shift+R"
          onClick={onRetry}
        >
          Retry this board
        </button>
        <button type="button" className={SECONDARY_BUTTON} onClick={onMenu}>
          Change difficulty
        </button>
      </div>
      <RestartHint />
      <BoardCanvas
        view={view}
        label={`Finished board, ${view.width} by ${view.height}. ${
          result.outcome === 'won' ? 'You cleared the board.' : 'You hit a mine.'
        }`}
      />
    </section>
  );
}
