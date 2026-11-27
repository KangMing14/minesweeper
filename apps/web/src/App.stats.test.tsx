import { PRESETS } from '@minesweeper/engine';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeClock, boardFacts, sessionFactory, stubCanvasContext } from '../test/sessionKit.js';
import { App } from './App.js';
import { createAppStore } from './state/appStore.js';
import { STATS_STORAGE_KEY } from './stats/LocalStorageStatsStore.js';
import { MemoryStatsStore } from './stats/MemoryStatsStore.js';

// M3-T07. The app records every finished game in its `StatsStore`, once, and shows the numbers on the menu.
beforeEach(() => {
  stubCanvasContext();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe.each([
  ['plain', false],
  ['StrictMode', true],
])('App statistics (%s)', (_name, strict) => {
  function setup() {
    const clock = new FakeClock();
    const factory = sessionFactory(clock);
    let seed = 100;
    const store = createAppStore({ newSeed: () => seed++ });
    const stats = new MemoryStatsStore();
    const ui = <App store={store} statsStore={stats} createSession={factory.create} />;
    render(strict ? <StrictMode>{ui}</StrictMode> : ui);
    return { clock, factory, store, stats };
  }
  const start = (name: RegExp): void => {
    fireEvent.click(screen.getByRole('button', { name }));
  };
  /** Wins the game on screen, `ms` after the board appeared; the board is the one of `seed`. */
  function win(ctx: ReturnType<typeof setup>, seed: number, ms: number): void {
    const session = ctx.factory.live()[0];
    const { safe } = boardFacts(PRESETS.beginner, seed);
    ctx.clock.advance(ms);
    act(() => {
      for (const index of safe) session?.dispatch({ type: 'reveal', index });
    });
  }
  function lose(ctx: ReturnType<typeof setup>, seed: number): void {
    const { mines } = boardFacts(PRESETS.beginner, seed);
    act(() => ctx.factory.live()[0]?.dispatch({ type: 'reveal', index: mines[0] as number }));
  }

  it('records a won game once, with its time', () => {
    const ctx = setup();
    start(/^Beginner/);
    win(ctx, 100, 8_000);
    expect(screen.getByRole('heading', { level: 2, name: 'You cleared the board' })).toBeTruthy();
    expect(ctx.stats.summary('beginner')).toMatchObject({ games: 1, wins: 1, bestTimeMs: 8_000 });
  });

  it('records a lost game as a game without a win', () => {
    const ctx = setup();
    start(/^Intermediate/);
    const { mines } = boardFacts(PRESETS.intermediate, 100);
    act(() => ctx.factory.live()[0]?.dispatch({ type: 'reveal', index: mines[0] as number }));
    expect(ctx.stats.summary('intermediate')).toMatchObject({
      games: 1,
      wins: 0,
      bestTimeMs: null,
    });
    expect(ctx.stats.summary('beginner').games).toBe(0);
  });

  it('does not count a retry of the same board, from the result screen button or from Shift+R', () => {
    const ctx = setup();
    start(/^Beginner/);
    lose(ctx, 100);
    expect(ctx.stats.summary('beginner').games).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Retry this board' }));
    win(ctx, 100, 6_000);
    expect(ctx.stats.summary('beginner')).toMatchObject({ games: 1, wins: 0, bestTimeMs: null });

    fireEvent.keyDown(window, { key: 'R', shiftKey: true });
    win(ctx, 100, 5_000);
    expect(ctx.stats.summary('beginner')).toMatchObject({ games: 1, wins: 0, bestTimeMs: null });
  });

  it('does not count a retry that follows a retry, and a game left by Shift+R in between records nothing', () => {
    const ctx = setup();
    start(/^Beginner/);
    fireEvent.keyDown(window, { key: 'R', shiftKey: true });
    fireEvent.keyDown(window, { key: 'R', shiftKey: true });
    lose(ctx, 100);
    expect(ctx.stats.summary('beginner').games).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Retry this board' }));
    lose(ctx, 100);
    expect(ctx.stats.summary('beginner').games).toBe(0);
  });

  it('counts the next new board again after retries, and its own retries stay out', () => {
    const ctx = setup();
    start(/^Beginner/);
    lose(ctx, 100);
    fireEvent.click(screen.getByRole('button', { name: 'Retry this board' }));
    lose(ctx, 100);
    fireEvent.click(screen.getByRole('button', { name: 'New board' }));
    win(ctx, 101, 7_000);
    expect(ctx.stats.summary('beginner')).toMatchObject({ games: 2, wins: 1, bestTimeMs: 7_000 });
    fireEvent.click(screen.getByRole('button', { name: 'Retry this board' }));
    win(ctx, 101, 3_000);
    expect(ctx.stats.summary('beginner')).toMatchObject({ games: 2, wins: 1, bestTimeMs: 7_000 });
  });

  it('counts a new board that happens to have the seed of the last one', () => {
    const clock = new FakeClock();
    const factory = sessionFactory(clock);
    const stats = new MemoryStatsStore();
    const store = createAppStore({ newSeed: () => 100 });
    const ui = <App store={store} statsStore={stats} createSession={factory.create} />;
    render(strict ? <StrictMode>{ui}</StrictMode> : ui);
    start(/^Beginner/);
    const { mines } = boardFacts(PRESETS.beginner, 100);
    act(() => factory.live()[0]?.dispatch({ type: 'reveal', index: mines[0] as number }));
    fireEvent.click(screen.getByRole('button', { name: 'New board' }));
    expect(store.getState().seed).toBe(100);
    act(() => factory.live()[0]?.dispatch({ type: 'reveal', index: mines[0] as number }));
    expect(stats.summary('beginner').games).toBe(2);
  });

  it('records nothing for a game that is left, by the menu or by a restart key', () => {
    const ctx = setup();
    start(/^Beginner/);
    fireEvent.keyDown(window, { key: 'r' });
    fireEvent.click(screen.getByRole('button', { name: 'Change difficulty' }));
    expect(ctx.stats.summary('beginner').games).toBe(0);
  });

  it('counts a board that the opening already cleared once, although StrictMode reports it twice', () => {
    const factory = sessionFactory(new FakeClock());
    const stats = new MemoryStatsStore();
    const ui = (
      <App
        store={createAppStore({ newSeed: () => 7 })}
        statsStore={stats}
        createSession={(_config, seed) =>
          factory.create({ width: 3, height: 3, mineCount: 0 }, seed)
        }
      />
    );
    render(strict ? <StrictMode>{ui}</StrictMode> : ui);
    start(/^Beginner/);
    expect(screen.getByRole('heading', { level: 2, name: 'You cleared the board' })).toBeTruthy();
    // A win at time 0 is a win, but not a best time.
    expect(stats.summary('beginner')).toMatchObject({ games: 1, wins: 1, bestTimeMs: null });
  });

  it('shows the records on the menu after a game, and only then', () => {
    const ctx = setup();
    expect(screen.queryByRole('table', { name: 'Your records' })).toBeNull();
    start(/^Beginner/);
    win(ctx, 100, 8_000);
    fireEvent.click(screen.getByRole('button', { name: 'Change difficulty' }));
    const table = screen.getByRole('table', { name: 'Your records' });
    const row = within(table).getByRole('row', { name: /^Beginner/ });
    expect(
      within(row)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['1', '1', '8.000 s', expect.stringMatching(/^\d+\.\d\d$/)]);
  });
});

describe('App statistics without a store of its own', () => {
  it('makes a store itself, so the app works with no props', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 2, name: 'Choose a difficulty' })).toBeTruthy();
  });

  // These two run in order: the second proves that test/setup.ts clears localStorage between tests, so
  // records of one test never show up on the menu of the next.
  it('keeps the records of a finished game in localStorage', () => {
    const factory = sessionFactory(new FakeClock());
    render(<App createSession={factory.create} />);
    fireEvent.click(screen.getByRole('button', { name: /^Beginner/ }));
    const session = factory.live()[0];
    // The seed is random here, so reveal cells in order until the game ends, by a win or by a mine.
    act(() => {
      for (
        let i = 0;
        i < 81 && session?.view().status !== 'lost' && session?.view().status !== 'won';
        i += 1
      )
        session?.dispatch({ type: 'reveal', index: i });
    });
    expect(window.localStorage.getItem(STATS_STORAGE_KEY)).not.toBeNull();
  });

  it('starts every test with an empty localStorage', () => {
    expect(window.localStorage.length).toBe(0);
  });
});
