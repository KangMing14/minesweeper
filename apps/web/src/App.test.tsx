import { PRESETS } from '@minesweeper/engine';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeClock, boardFacts, sessionFactory, stubCanvasContext } from '../test/sessionKit.js';
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
    expect(screen.getByRole('img', { name: /30 by 16/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Change difficulty' }));
    expect(level2('Choose a difficulty')).toBeTruthy();
    expect(factory.live()).toHaveLength(0);
  });

  it('plays every difficulty from the menu on a board of the right size', () => {
    const { store } = setup();
    for (const [id, config] of Object.entries(PRESETS)) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${id}`, 'i') }));
      expect(
        screen.getByRole('img', { name: new RegExp(`${config.width} by ${config.height}`) }),
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
