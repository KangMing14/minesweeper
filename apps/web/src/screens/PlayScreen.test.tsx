import { replay, validateReplayLog } from '@minesweeper/engine';
import type { BoardConfig, GameResult, GameView, ReplayLog } from '@minesweeper/engine';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  FakeClock,
  boardFacts,
  sessionFactory,
  stubCanvasContext,
  trackIntervals,
} from '../../test/sessionKit.js';
import { PlayScreen } from './PlayScreen.js';

// M3-T05. The play screen owns one session: it starts it, shows the HUD, wires the keyboard and the mouse,
// reports the end of the game once, and disposes the session when it leaves.

const CONFIG: BoardConfig = { width: 6, height: 6, mineCount: 6 };
const SEED = 11;

let clock: FakeClock;
let factory: ReturnType<typeof sessionFactory>;
let intervals: ReturnType<typeof trackIntervals>;

beforeEach(() => {
  vi.useFakeTimers();
  intervals = trackIntervals();
  stubCanvasContext();
  clock = new FakeClock();
  factory = sessionFactory(clock);
});
afterEach(() => {
  intervals.restore();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

interface Handlers {
  onFinish: (view: GameView, result: GameResult, replayLog: ReplayLog | undefined) => void;
  onNewGame: () => void;
  onMenu: () => void;
}
function handlers(): Handlers & { onFinish: Mock<Handlers['onFinish']> } {
  return { onFinish: vi.fn<Handlers['onFinish']>(), onNewGame: vi.fn(), onMenu: vi.fn() };
}
function show(h: Handlers, config: BoardConfig = CONFIG, strict = false): void {
  const ui = (
    <PlayScreen
      presetName="Beginner"
      config={config}
      seed={SEED}
      createSession={factory.create}
      {...h}
    />
  );
  render(strict ? <StrictMode>{ui}</StrictMode> : ui);
}
const readout = (label: string): string =>
  screen.getByText(label).closest('div')?.querySelector('dd')?.textContent ?? '';
const tick = (ms: number): void => {
  act(() => {
    clock.advance(ms);
    vi.advanceTimersByTime(ms);
  });
};
const session = () => {
  const s = factory.made.at(-1);
  if (s === undefined) throw new Error('no session was made');
  return s;
};

describe('PlayScreen: HUD', () => {
  it('shows the difficulty, the time at zero and every mine still to find', () => {
    show(handlers());
    expect(screen.getByRole('heading', { level: 2, name: 'Beginner' })).toBeTruthy();
    expect(readout('Time')).toBe('0.0');
    expect(readout('Mines left')).toBe('6');
    expect(screen.getByRole('img', { name: /minesweeper board.*6 by 6/i })).toBeTruthy();
  });

  it('runs the clock in tenths of a second, from the moment the board appears', () => {
    show(handlers());
    tick(3400);
    expect(readout('Time')).toBe('3.4');
    tick(61000);
    expect(readout('Time')).toBe('1:04.4');
  });

  it('counts mines left from the flags, also below zero', () => {
    show(handlers());
    const { safe, mines } = boardFacts(CONFIG, SEED);
    act(() => session().dispatch({ type: 'flag', index: mines[0] as number }));
    expect(readout('Mines left')).toBe('5');
    for (const index of safe.slice(0, 6)) act(() => session().dispatch({ type: 'flag', index }));
    expect(readout('Mines left')).toBe('-1');
    act(() => session().dispatch({ type: 'flag', index: safe[0] as number }));
    expect(readout('Mines left')).toBe('0');
  });

  it('does not announce the clock: it is not a live region', () => {
    show(handlers());
    const clockNode = screen.getByText('Time').closest('div');
    expect(clockNode?.closest('[aria-live]')).toBeNull();
    expect(clockNode?.querySelector('[aria-live]')).toBeNull();
  });
});

describe('PlayScreen: input', () => {
  it('puts the keyboard focus on the board, so the arrow keys work at once', () => {
    show(handlers());
    expect(document.activeElement).toBe(screen.getByRole('img'));
  });

  it('plays from the keyboard: the first key shows the cursor, F flags the cell under it', () => {
    show(handlers());
    const board = screen.getByRole('img');
    fireEvent.keyDown(board, { key: 'ArrowUp' });
    fireEvent.keyDown(board, { key: 'f' });
    expect(readout('Mines left')).toBe('5');
    expect(session().view().flagCount).toBe(1);
  });

  it('plays from the mouse: the controller listens on the same canvas', () => {
    show(handlers());
    const board = screen.getByRole('img');
    // jsdom has no layout, so `hitTest` answers null; what matters is that the controller is attached:
    // the context menu is suppressed on exactly this element.
    expect(fireEvent.contextMenu(board)).toBe(false);
  });
});

describe('PlayScreen: the end of a game', () => {
  it('reports a win once, with the final view and the result', () => {
    const h = handlers();
    show(h);
    const { safe } = boardFacts(CONFIG, SEED);
    for (const index of safe) act(() => session().dispatch({ type: 'reveal', index }));
    expect(h.onFinish).toHaveBeenCalledTimes(1);
    const [view, result] = h.onFinish.mock.calls[0] ?? [];
    if (view === undefined || result === undefined) throw new Error('onFinish was not called');
    expect(view.status).toBe('won');
    expect(view.exposedMines).toEqual(boardFacts(CONFIG, SEED).mines);
    expect(result.outcome).toBe('won');
    expect(result).toEqual(session().result());
  });

  it('reports a loss once', () => {
    const h = handlers();
    show(h);
    const { mines } = boardFacts(CONFIG, SEED);
    act(() => session().dispatch({ type: 'reveal', index: mines[0] as number }));
    expect(h.onFinish).toHaveBeenCalledTimes(1);
    expect(h.onFinish.mock.calls[0]?.[1].outcome).toBe('lost');
  });

  it('stops the clock at the time of the result, and stops its timer', () => {
    const h = handlers();
    show(h);
    tick(2000);
    const { mines } = boardFacts(CONFIG, SEED);
    act(() => session().dispatch({ type: 'reveal', index: mines[0] as number }));
    tick(30000);
    expect(readout('Time')).toBe('2.0');
    expect(intervals.live()).toBe(0);
  });

  it('reports a game that the opening already won, at once and once, also in StrictMode', () => {
    const h = handlers();
    // No mines: the opening clears the whole board when the game is created.
    show(h, { width: 3, height: 3, mineCount: 0 }, true);
    expect(h.onFinish).toHaveBeenCalled();
    for (const call of h.onFinish.mock.calls) {
      expect(call[1].outcome).toBe('won');
      expect(call[1].timeMs).toBe(0);
    }
    // StrictMode runs the effect twice, so two sessions report; the store refuses the second (appStore.test).
    expect(h.onFinish.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

describe('PlayScreen: leaving', () => {
  it('offers a change of difficulty at any time', () => {
    const h = handlers();
    show(h);
    fireEvent.click(screen.getByRole('button', { name: 'Change difficulty' }));
    expect(h.onMenu).toHaveBeenCalledTimes(1);
    expect(h.onNewGame).not.toHaveBeenCalled();
  });

  it('disposes its session when it leaves, and leaves no timer behind', () => {
    const { unmount } = render(
      <PlayScreen
        presetName="Beginner"
        config={CONFIG}
        seed={SEED}
        createSession={factory.create}
        {...handlers()}
      />,
    );
    expect(factory.live()).toHaveLength(1);
    unmount();
    expect(factory.live()).toHaveLength(0);
    expect(session().disposed).toBe(1);
    expect(intervals.live()).toBe(0);
  });

  it('ends StrictMode with exactly one live session', () => {
    show(handlers(), CONFIG, true);
    expect(factory.made.length).toBe(2);
    expect(factory.live()).toHaveLength(1);
    expect(intervals.live()).toBe(1);
  });
});

describe('PlayScreen: a new config object is not a new board', () => {
  it('keeps its session when the parent passes an equal config object again', () => {
    const h = handlers();
    const ui = (config: BoardConfig): React.JSX.Element => (
      <PlayScreen
        presetName="Beginner"
        config={config}
        seed={SEED}
        createSession={factory.create}
        {...h}
      />
    );
    const { rerender } = render(ui({ ...CONFIG }));
    rerender(ui({ ...CONFIG }));
    rerender(ui({ ...CONFIG }));
    expect(factory.made).toHaveLength(1);
    rerender(ui({ ...CONFIG, mineCount: 5 }));
    expect(factory.made).toHaveLength(2);
    expect(factory.live()).toHaveLength(1);
    expect(intervals.live()).toBe(1);
  });
});

describe('PlayScreen: a stuck game', () => {
  it('offers a new board and stops the clock, with no event to wait for', () => {
    const h = handlers();
    show(h);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'New board' })).toBeNull();

    tick(1500);
    session().stuck = true;
    tick(100);

    expect(screen.getByRole('alert').textContent).toMatch(/move limit/i);
    fireEvent.click(screen.getByRole('button', { name: 'New board' }));
    expect(h.onNewGame).toHaveBeenCalledTimes(1);
    // The clock the screen shows stops where it was when the stuck game was noticed.
    const shown = readout('Time');
    tick(5000);
    expect(readout('Time')).toBe(shown);
    expect(intervals.live()).toBe(0);
  });
});

// M3-T06. The play screen reads the replay log from the session when the game ends and hands it to its
// parent with the result; it also says which keys restart the game.
describe('PlayScreen: restart hint and the replay log', () => {
  it('says which keys start a new board and retry this one', () => {
    show(handlers());
    expect(
      screen.getByText(
        (_content, node) =>
          node?.tagName === 'P' &&
          node.textContent === 'Press R for a new board, or Shift+R to retry this one.',
      ),
    ).toBeTruthy();
  });

  it('hands over the replay log of a won game, and it plays back to the same game', () => {
    const h = handlers();
    show(h);
    const { safe } = boardFacts(CONFIG, SEED);
    act(() => {
      for (const index of safe) session().dispatch({ type: 'reveal', index });
    });
    expect(h.onFinish).toHaveBeenCalledTimes(1);
    const [view, result, log] = h.onFinish.mock.calls[0] ?? [];
    if (view === undefined || result === undefined || log === undefined)
      throw new Error('onFinish was not called with a log');
    expect(() => validateReplayLog(log)).not.toThrow();
    expect(log.seed).toBe(SEED);
    expect(log.config).toEqual(CONFIG);
    expect(replay(log).view()).toEqual(view);
    expect(replay(log).result()).toEqual(result);
  });

  it('hands over the replay log of a lost game too', () => {
    const h = handlers();
    show(h);
    const { mines } = boardFacts(CONFIG, SEED);
    act(() => session().dispatch({ type: 'reveal', index: mines[0] as number }));
    expect(h.onFinish.mock.calls[0]?.[2]?.commands.map((c) => c.index)).toEqual([mines[0]]);
  });
});
