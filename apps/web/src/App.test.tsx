import { PRESETS, replay, validateReplayLog } from '@minesweeper/engine';
import type { BoardConfig } from '@minesweeper/engine';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeClock,
  boardFacts,
  sessionFactory,
  stubCanvasContext,
  trackIntervals,
  trackListeners,
} from '../test/sessionKit.js';
import { App } from './App.js';
import { createAppStore } from './state/appStore.js';
import { THEME_ATTRIBUTE } from './theme.js';

beforeEach(() => {
  stubCanvasContext();
});
afterEach(() => {
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
  vi.restoreAllMocks();
});

/** Seeds 100, 101, 102, ... so a test knows the board of each game. */
function counter(): () => number {
  let next = 100;
  return () => next++;
}

describe('App shell', () => {
  it('has a header with the game name as the page heading, and a main region', () => {
    render(<App />);
    expect(within(screen.getByRole('banner')).getByRole('heading', { level: 1 }).textContent).toBe(
      'Minesweeper',
    );
    expect(screen.getByRole('main')).toBeTruthy();
  });

  it('opens on the menu, with the three difficulties', () => {
    render(<App />);
    const main = within(screen.getByRole('main'));
    expect(main.getByRole('heading', { level: 2, name: 'Choose a difficulty' })).toBeTruthy();
    expect(main.getAllByRole('button')).toHaveLength(3);
  });

  it('cycles the theme from the header button: system, light, dark, system', () => {
    render(<App />);
    const root = document.documentElement;
    const button = screen.getByRole('button', { name: /^Theme: / });
    expect(button.textContent).toBe('Theme: system');
    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);

    fireEvent.click(button);
    expect(button.textContent).toBe('Theme: light');
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('light');

    fireEvent.click(button);
    expect(button.textContent).toBe('Theme: dark');
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('dark');

    fireEvent.click(button);
    expect(button.textContent).toBe('Theme: system');
    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });
});

describe.each([
  ['plain', false],
  ['StrictMode', true],
])('App flow (%s)', (_name, strict) => {
  function setup() {
    const factory = sessionFactory(new FakeClock());
    const store = createAppStore({ newSeed: counter() });
    const ui = <App store={store} createSession={factory.create} />;
    render(strict ? <StrictMode>{ui}</StrictMode> : ui);
    return { factory, store };
  }
  const level2 = (name: string): HTMLElement => screen.getByRole('heading', { level: 2, name });

  it('goes from the menu through a won game to the result, and on to a new board', () => {
    const { factory, store } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Beginner/ }));
    expect(level2('Beginner')).toBeTruthy();
    expect(store.getState().screen).toBe('playing');
    expect(factory.live()).toHaveLength(1);

    const session = factory.live()[0];
    const { safe } = boardFacts(PRESETS.beginner, 100);
    act(() => {
      for (const index of safe) session?.dispatch({ type: 'reveal', index });
    });

    expect(level2('You cleared the board')).toBeTruthy();
    expect(store.getState().screen).toBe('result');
    expect(store.getState().finished?.seed).toBe(100);
    expect(factory.live()).toHaveLength(0);
    expect(screen.getByText(/Beginner, 9 × 9, 10 mines/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'New board' }));
    expect(level2('Beginner')).toBeTruthy();
    expect(store.getState().seed).toBe(101);
    expect(factory.live()).toHaveLength(1);
    expect(factory.live()[0]?.view().revealedCount).toBeGreaterThan(0);
  });

  it('shows a lost game as a result, then returns to the menu with nothing left running', () => {
    const { factory, store } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Intermediate/ }));
    const { mines } = boardFacts(PRESETS.intermediate, 100);
    act(() => factory.live()[0]?.dispatch({ type: 'reveal', index: mines[0] as number }));
    expect(level2('You hit a mine')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Change difficulty' }));
    expect(level2('Choose a difficulty')).toBeTruthy();
    expect(store.getState().screen).toBe('menu');
    expect(store.getState().finished).toBeNull();
    expect(factory.live()).toHaveLength(0);
  });

  it('leaves a game in progress for the menu, and disposes the session', () => {
    const { factory } = setup();
    fireEvent.click(screen.getByRole('button', { name: /^Expert/ }));
    expect(screen.getByRole('application', { name: /30 by 16/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Change difficulty' }));
    expect(level2('Choose a difficulty')).toBeTruthy();
    expect(factory.live()).toHaveLength(0);
  });

  it('plays every difficulty from the menu on a board of the right size', () => {
    const { store } = setup();
    for (const [id, config] of Object.entries(PRESETS)) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${id}`, 'i') }));
      expect(
        screen.getByRole('application', {
          name: new RegExp(`${config.width} by ${config.height}`),
        }),
      ).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Change difficulty' }));
    }
    expect(store.getState().gameId).toBe(3);
  });

  it('starts a fresh session for a new board even when the seed repeats', () => {
    vi.useFakeTimers();
    try {
      const factory = sessionFactory(new FakeClock());
      const store = createAppStore({ newSeed: () => 7 });
      const ui = <App store={store} createSession={factory.create} />;
      render(strict ? <StrictMode>{ui}</StrictMode> : ui);
      fireEvent.click(screen.getByRole('button', { name: /^Beginner/ }));
      const first = factory.live()[0];
      if (first === undefined) throw new Error('no session');
      first.stuck = true;
      act(() => {
        vi.advanceTimersByTime(100);
      });
      fireEvent.click(screen.getByRole('button', { name: 'New board' }));
      expect(store.getState().seed).toBe(7);
      expect(first.disposed).toBeGreaterThan(0);
      expect(factory.live()).toHaveLength(1);
      expect(factory.live()[0]).not.toBe(first);
      expect(screen.queryByRole('alert')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('goes straight to the result for a board that the opening already won', () => {
    const factory = sessionFactory(new FakeClock());
    const store = createAppStore({ newSeed: counter() });
    const ui = (
      <App
        store={store}
        createSession={(_config, seed) =>
          factory.create({ width: 3, height: 3, mineCount: 0 }, seed)
        }
      />
    );
    render(strict ? <StrictMode>{ui}</StrictMode> : ui);
    fireEvent.click(screen.getByRole('button', { name: /^Beginner/ }));
    expect(level2('You cleared the board')).toBeTruthy();
    expect(store.getState().finished?.result.timeMs).toBe(0);
    expect(factory.live()).toHaveLength(0);
  });
});

// M3-T06. R starts another board of the same difficulty, Shift+R retries the same board, from the play screen
// and from the result screen, and a restart leaves nothing of the old game running.
describe.each([
  ['plain', false],
  ['StrictMode', true],
])('App restart keys (%s)', (_name, strict) => {
  function setup() {
    const factory = sessionFactory(new FakeClock());
    const store = createAppStore({ newSeed: counter() });
    const seeds: number[] = [];
    const configs: BoardConfig[] = [];
    const ui = (
      <App
        store={store}
        createSession={(config, seed) => {
          seeds.push(seed);
          configs.push(config);
          return factory.create(config, seed);
        }}
      />
    );
    render(strict ? <StrictMode>{ui}</StrictMode> : ui);
    return { factory, store, seeds, configs };
  }
  const level2 = (name: string): HTMLElement => screen.getByRole('heading', { level: 2, name });
  // M3-T08: the restart keys work while the focus is inside the game region (WCAG 2.1.4), so a key goes to the
  // element that has the focus, as a real key does: the board during play, the heading on the result screen.
  const key = (
    init: KeyboardEventInit,
    target: Element | Window = document.activeElement ?? document.body,
  ): void => {
    fireEvent.keyDown(target, init);
  };
  const R = { key: 'r' };
  const SHIFT_R = { key: 'R', shiftKey: true };
  const start = (name: RegExp = /^Beginner/): void => {
    fireEvent.click(screen.getByRole('button', { name }));
  };

  it('R during a game starts another board of the same difficulty, and disposes the old session', () => {
    const { factory, store, seeds } = setup();
    start(/^Intermediate/);
    const first = factory.live()[0];
    key(R);
    expect(store.getState().screen).toBe('playing');
    expect(store.getState().presetId).toBe('intermediate');
    expect(store.getState().seed).toBe(101);
    expect(seeds.at(-1)).toBe(101);
    expect(first?.disposed).toBeGreaterThan(0);
    expect(factory.live()).toHaveLength(1);
  });

  it('works when the board has the focus: the key bubbles from the canvas to the game region', () => {
    const { store } = setup();
    start();
    const board = screen.getByRole('application');
    expect(document.activeElement).toBe(board);
    key(R, board);
    expect(store.getState().seed).toBe(101);
    key(SHIFT_R, screen.getByRole('application'));
    expect(store.getState().seed).toBe(101);
    expect(store.getState().gameId).toBe(3);
  });

  it('Shift+R during a game retries the same board: same seed, same size, an identical opening', () => {
    const { factory, store, seeds, configs } = setup();
    start();
    const firstView = factory.live()[0]?.view();
    key(SHIFT_R);
    expect(store.getState().seed).toBe(100);
    expect(store.getState().gameId).toBe(2);
    expect(seeds.filter((seed) => seed === 100).length).toBeGreaterThanOrEqual(2);
    expect(configs.at(-1)).toEqual(PRESETS.beginner);
    expect(factory.live()).toHaveLength(1);
    expect(factory.live()[0]?.view()).toEqual(firstView);
    // And it is a fresh game: a flag put on the first board is gone.
    expect(factory.live()[0]?.view().flagCount).toBe(0);
  });

  it('a retry has the identical mine layout: losing on the same cell shows the same mines', () => {
    const { factory, store } = setup();
    start();
    const { mines } = boardFacts(PRESETS.beginner, 100);
    act(() => factory.live()[0]?.dispatch({ type: 'reveal', index: mines[0] as number }));
    expect(level2('You hit a mine')).toBeTruthy();
    const firstMines = store.getState().finished?.view.exposedMines;
    expect(firstMines).toEqual(mines);

    key(SHIFT_R);
    expect(level2('Beginner')).toBeTruthy();
    act(() => factory.live()[0]?.dispatch({ type: 'reveal', index: mines[0] as number }));
    expect(level2('You hit a mine')).toBeTruthy();
    expect(store.getState().finished?.view.exposedMines).toEqual(firstMines);
    expect(store.getState().finished?.seed).toBe(100);
  });

  it('R on the result screen is a new board whose mines differ from the last one', () => {
    const { factory, store } = setup();
    start();
    const { mines } = boardFacts(PRESETS.beginner, 100);
    act(() => factory.live()[0]?.dispatch({ type: 'reveal', index: mines[0] as number }));
    expect(level2('You hit a mine')).toBeTruthy();
    key(R);
    expect(level2('Beginner')).toBeTruthy();
    expect(store.getState().seed).toBe(101);
    expect(boardFacts(PRESETS.beginner, 101).mines).not.toEqual(mines);
    expect(store.getState().finished).toBeNull();
  });

  it('the result screen button "Retry this board" does what Shift+R does', () => {
    const { factory, store } = setup();
    start();
    const { mines } = boardFacts(PRESETS.beginner, 100);
    act(() => factory.live()[0]?.dispatch({ type: 'reveal', index: mines[0] as number }));
    expect(level2('You hit a mine')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry this board' }));
    expect(level2('Beginner')).toBeTruthy();
    expect(store.getState().seed).toBe(100);
    expect(store.getState().gameId).toBe(2);
    expect(factory.live()).toHaveLength(1);
  });

  // M3-T08, WCAG 2.1.4 (Character Key Shortcuts): a shortcut made of one printable character is active only
  // while a component of the page has the focus. Here that component is the game region.
  it('ignores R and Shift+R when the focus is outside the game region', () => {
    const { store } = setup();
    start();
    const theme = screen.getByRole('button', { name: /^Theme: / });
    theme.focus();
    key(R, theme);
    key(SHIFT_R, theme);
    key(R, document.body);
    key(SHIFT_R, window);
    key(R, document.documentElement);
    expect(store.getState().gameId).toBe(1);
    expect(store.getState().seed).toBe(100);
  });

  it('has no listener on the window at all, so a screen reader that takes the letter loses nothing', () => {
    const listeners = trackListeners();
    try {
      setup();
      start();
      expect(listeners.live('keydown', window)).toBe(0);
      expect(listeners.live('keydown', document)).toBe(0);
    } finally {
      listeners.restore();
    }
  });

  it('works from a button inside the game region, on the play and the result screens', () => {
    const { store, factory } = setup();
    start();
    const change = screen.getByRole('button', { name: 'Change difficulty' });
    key(R, change);
    expect(store.getState().gameId).toBe(2);
    const { mines } = boardFacts(PRESETS.beginner, 101);
    act(() => factory.live()[0]?.dispatch({ type: 'reveal', index: mines[0] as number }));
    key(SHIFT_R, screen.getByRole('button', { name: 'New board' }));
    expect(store.getState().gameId).toBe(3);
    expect(store.getState().seed).toBe(101);
  });

  it('works again once the focus returns to the board', () => {
    const { store } = setup();
    start();
    const theme = screen.getByRole('button', { name: /^Theme: / });
    theme.focus();
    key(R, theme);
    expect(store.getState().gameId).toBe(1);
    screen.getByRole('application').focus();
    key(R);
    expect(store.getState().gameId).toBe(2);
  });

  it('has a region named Game on the play and result screens, and none on the menu', () => {
    const { factory } = setup();
    expect(screen.queryByRole('region', { name: 'Game' })).toBeNull();
    start();
    expect(screen.getByRole('region', { name: 'Game' })).toBeTruthy();
    const { mines } = boardFacts(PRESETS.beginner, 100);
    act(() => factory.live()[0]?.dispatch({ type: 'reveal', index: mines[0] as number }));
    expect(screen.getByRole('region', { name: 'Game' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Change difficulty' }));
    expect(screen.queryByRole('region', { name: 'Game' })).toBeNull();
  });

  it('does nothing on the menu', () => {
    const { factory, store } = setup();
    key(R);
    key(SHIFT_R);
    expect(store.getState().screen).toBe('menu');
    expect(store.getState().gameId).toBe(0);
    expect(factory.made).toHaveLength(0);
  });

  it('stops listening when the player goes back to the menu', () => {
    const { store } = setup();
    start();
    fireEvent.click(screen.getByRole('button', { name: 'Change difficulty' }));
    key(R);
    expect(store.getState().screen).toBe('menu');
    expect(store.getState().gameId).toBe(1);
  });

  it('leaves Ctrl+R to the browser and does not restart a held key', () => {
    const { store } = setup();
    start();
    key({ key: 'r', ctrlKey: true });
    key({ key: 'r', metaKey: true });
    expect(store.getState().gameId).toBe(1);
    key(R);
    for (let i = 0; i < 4; i += 1) key({ key: 'r', repeat: true });
    expect(store.getState().gameId).toBe(2);
  });

  it('keeps the replay log of the game that finished, through a restart and the menu', () => {
    const { factory, store } = setup();
    start();
    const { safe } = boardFacts(PRESETS.beginner, 100);
    act(() => {
      for (const index of safe) factory.live()[0]?.dispatch({ type: 'reveal', index });
    });
    expect(level2('You cleared the board')).toBeTruthy();
    const log = store.getState().lastReplayLog;
    if (log === null) throw new Error('no replay log was kept');
    expect(() => validateReplayLog(log)).not.toThrow();
    expect(log.seed).toBe(100);
    expect(replay(log).view()).toEqual(store.getState().finished?.view);
    expect(replay(log).result()).toEqual(store.getState().finished?.result);

    key(R);
    expect(store.getState().lastReplayLog).toBe(log);
    fireEvent.click(screen.getByRole('button', { name: 'Change difficulty' }));
    expect(store.getState().lastReplayLog).toBe(log);
  });

  it('rapid restarts leave no session, timer or listener of an old game behind', () => {
    vi.useFakeTimers();
    const intervals = trackIntervals();
    const listeners = trackListeners();
    try {
      const { factory, store } = setup();
      start();
      const oneGameListeners = listeners.live();
      const oneGameKeyListeners = listeners.live('keydown');
      // Sanity: the restart keys are listened for on the game region, and the controller on the canvas.
      const region = screen.getByRole('region', { name: 'Game' });
      expect(listeners.live('keydown', region)).toBe(1);
      expect(listeners.live('keydown', window)).toBe(0);
      expect(oneGameListeners).toBeGreaterThan(1);
      expect(intervals.live()).toBe(1);

      for (let i = 0; i < 30; i += 1) key(i % 3 === 0 ? SHIFT_R : R);

      expect(store.getState().gameId).toBe(31);
      expect(factory.live()).toHaveLength(1);
      for (const made of factory.made.slice(0, -1)) expect(made.disposed).toBeGreaterThan(0);
      expect(intervals.live()).toBe(1);
      expect(listeners.live()).toBe(oneGameListeners);
      expect(listeners.live('keydown')).toBe(oneGameKeyListeners);
      expect(listeners.live('keydown', region)).toBe(1);
      expect(listeners.live('keydown', window)).toBe(0);

      fireEvent.click(screen.getByRole('button', { name: 'Change difficulty' }));
      expect(factory.live()).toHaveLength(0);
      expect(intervals.live()).toBe(0);
      expect(listeners.live('keydown', region)).toBe(0);
      expect(listeners.live('keydown', window)).toBe(0);
    } finally {
      listeners.restore();
      intervals.restore();
      vi.useRealTimers();
    }
  });
});
