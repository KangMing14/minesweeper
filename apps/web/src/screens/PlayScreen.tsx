import type { BoardConfig, GameResult, GameView, ReplayLog } from '@minesweeper/engine';
import { useEffect, useRef, useState, type JSX } from 'react';
import { useAnnounce } from '../a11y/Announcer.js';
import { describeCell, describeEvent, describeStart } from '../a11y/announcements.js';
import { PLAY_BOARD_HELP_ID, PLAY_BOARD_ID } from '../a11y/ids.js';
import { formatClock } from '../format.js';
import { InputController } from '../input/InputController.js';
import { BoardCanvas } from '../render/BoardCanvas.js';
import type { BoardRenderer } from '../render/BoardRenderer.js';
import type { GameSession } from '../session/GameSession.js';
import { LocalSession } from '../session/LocalSession.js';
import { SystemClock } from '../session/SystemClock.js';
import { describeBoard } from './presets.js';
import { RestartHint } from './RestartHint.js';
import { PRIMARY_BUTTON, SCREEN_HEADING, SECONDARY_BUTTON } from './styles.js';

/** Props of `PlayScreen`. */
export interface PlayScreenProps {
  /** The name of the difficulty, for the heading. */
  readonly presetName: string;
  /** The board to play. */
  readonly config: BoardConfig;
  /** The seed of the board. */
  readonly seed: number;
  /**
   * Called once, when the game is won or lost, with the final view, the result record and the game's replay
   * log (M3-T06; `undefined` only if the session has none).
   */
  readonly onFinish: (view: GameView, result: GameResult, replayLog: ReplayLog | undefined) => void;
  /** Called when the player asks for another board, which is offered only when the game is stuck. */
  readonly onNewGame: () => void;
  /** Called when the player goes back to the menu. */
  readonly onMenu: () => void;
  /** Makes the session. Defaults to a `LocalSession` on the system clock; tests give their own. */
  readonly createSession?: (config: BoardConfig, seed: number) => GameSession;
}

/** How often the clock and the stuck check are read. A tenth of a second matches the HUD's precision. */
const CLOCK_TICK_MS = 100;

/** What the screen shows of the game, read from the session. */
interface Snapshot {
  readonly view: GameView;
  readonly elapsedMs: number;
  readonly stuck: boolean;
}

const defaultCreateSession = (config: BoardConfig, seed: number): GameSession =>
  new LocalSession(config, seed, new SystemClock());

/**
 * The play screen: it starts one `GameSession` for the board it is given, shows the HUD (clock, mines left)
 * and the board, listens to the mouse and the keyboard, and tells its parent once when the game ends. The
 * session is disposed when the screen leaves. The parent gives the screen a new `key` for each new board.
 *
 * @remarks
 * The clock is read on a timer and on every game event. A stuck game (the engine's command limit, M2-T07) has
 * no event of its own, and the session only counts a command after its events were delivered, so the timer is
 * what notices it; the timer then stops, and the screen offers a new board.
 *
 * @param props - The board, the seed and the three ways out.
 * @returns The screen.
 * @example
 * ```tsx
 * <PlayScreen key={gameId} presetName="Beginner" config={PRESETS.beginner} seed={seed}
 *   onFinish={finish} onNewGame={newGame} onMenu={toMenu} />
 * ```
 */
export function PlayScreen(props: PlayScreenProps): JSX.Element {
  const { presetName, config, seed, onNewGame, onMenu } = props;
  const { width, height, mineCount } = config;
  const [session, setSession] = useState<GameSession | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [renderer, setRenderer] = useState<BoardRenderer | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  // The effects below must see the latest callbacks without running again when the parent re-renders.
  const latest = useRef(props);
  latest.current = props;
  // The live region (M3-T08). Read through a ref, like the callbacks, so a new function never restarts a game.
  const announce = useAnnounce();
  const announceRef = useRef(announce);
  announceRef.current = announce;

  useEffect(() => {
    // Rebuilt from its numbers: the effect must restart for a different board and never for a new object.
    const board: BoardConfig = { width, height, mineCount };
    const current = (latest.current.createSession ?? defaultCreateSession)(board, seed);
    current.start();
    let timer: ReturnType<typeof setInterval> | undefined;
    let reported = false;

    const sync = (): void => {
      const view = current.view();
      const stuck = current.isStuck();
      setSnapshot({ view, elapsedMs: current.elapsedMs(), stuck });
      const ended = view.status === 'won' || view.status === 'lost';
      if (ended || stuck) {
        clearInterval(timer);
        timer = undefined;
      }
      if (ended && !reported) {
        const result = current.result();
        if (result !== undefined) {
          reported = true;
          latest.current.onFinish(view, result, current.replayLog());
        }
      }
    };

    const unsubscribe = current.subscribe(sync);
    // Words for the live region come from the session's events only: no mine position, in any mode (D-14).
    const unsubscribeSpeech = current.subscribe((event) => {
      announceRef.current(describeEvent(event, width));
    });
    announceRef.current(describeStart(latest.current.presetName, board));
    setSession(current);
    timer = setInterval(sync, CLOCK_TICK_MS);
    // A board that the opening already clears is won before any command: nothing will send an event.
    sync();

    return () => {
      clearInterval(timer);
      unsubscribe();
      unsubscribeSpeech();
      current.dispose();
    };
  }, [width, height, mineCount, seed]);

  // Mouse and keyboard: the controller needs the session, the renderer and the canvas element, so it is
  // created once all three exist and let go of when any of them goes.
  useEffect(() => {
    if (session === null || renderer === null || canvas === null) return undefined;
    // The focus that starts a game shows the ring after a keyboard start, but its cursor report must not be
    // spoken: it would replace "New game: ..." in the live region before it was read. The screen reader
    // reads the board's own name on that focus, and the first arrow key says the cell.
    let starting = true;
    const controller = new InputController({
      session,
      renderer,
      onCursorChange: (index) => {
        if (!starting) announceRef.current(describeCell(session.view(), index));
      },
    });
    controller.attach(canvas);
    // Arrow keys work at once, without a click first. The focus event of this call is what shows the ring
    // when the game was started from the keyboard (`:focus-visible`), and shows nothing after a mouse click.
    canvas.focus({ preventScroll: true });
    starting = false;
    return () => {
      controller.detach();
    };
  }, [session, renderer, canvas]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={SCREEN_HEADING}>{presetName}</h2>
          <p className="mt-1 text-sm text-ink-muted">{describeBoard(config)}</p>
        </div>
        <dl className="flex gap-3">
          <Readout label="Time" value={formatClock(snapshot?.elapsedMs ?? 0)} />
          <Readout
            label="Mines left"
            value={String(snapshot?.view.minesRemaining ?? config.mineCount)}
          />
        </dl>
      </div>

      {snapshot?.stuck === true && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger px-4 py-3"
        >
          <p>
            This game has reached its move limit and can’t go on. Start a new board to keep playing.
          </p>
          <button type="button" className={PRIMARY_BUTTON} onClick={onNewGame}>
            New board
          </button>
        </div>
      )}

      {snapshot !== null && (
        <BoardCanvas
          view={snapshot.view}
          onRenderer={setRenderer}
          onCanvas={setCanvas}
          interactive
          canvasId={PLAY_BOARD_ID}
          describedBy={PLAY_BOARD_HELP_ID}
        />
      )}
      <p id={PLAY_BOARD_HELP_ID} className="sr-only">
        Arrow keys move around the board. Space reveals a cell, F flags it, C or Enter chords. R
        starts a new board and Shift+R retries this one, while the focus is in the game.
      </p>

      <RestartHint />

      <div>
        <button type="button" className={SECONDARY_BUTTON} onClick={onMenu}>
          Change difficulty
        </button>
      </div>
    </section>
  );
}

/** One figure of the HUD: a small label over a large number in tabular figures, so it does not jitter. */
function Readout(props: { readonly label: string; readonly value: string }): JSX.Element {
  return (
    <div className="min-w-28 rounded-lg border border-cell-hidden bg-raised px-4 py-2">
      <dt className="text-sm text-ink-muted">{props.label}</dt>
      <dd className="text-2xl font-bold tabular-nums">{props.value}</dd>
    </div>
  );
}
