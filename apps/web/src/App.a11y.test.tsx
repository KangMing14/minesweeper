import { PRESETS } from '@minesweeper/engine';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeClock, boardFacts, sessionFactory, stubCanvasContext } from '../test/sessionKit.js';
import { App } from './App.js';
import { PLAY_BOARD_ID } from './a11y/ids.js';
import { createAppStore } from './state/appStore.js';

// M3-T08. The pieces of accessibility that live in the app shell: the one live region, the skip link and
// the names of the boards. Each runs against the real App with a hand-moved clock.

beforeEach(() => {
  stubCanvasContext();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function setup() {
  const factory = sessionFactory(new FakeClock());
  let next = 100;
  const store = createAppStore({ newSeed: () => next++ });
  render(<App store={store} createSession={factory.create} />);
  return { factory, store };
}
const start = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /^Beginner/ }));
};
const status = (): string => screen.getByRole('status').textContent ?? '';

describe('the live region of the app', () => {
  it('exists on the menu, before anything has been said, and outside the main region', () => {
    setup();
    const region = screen.getByRole('status');
    expect(region.textContent).toBe('');
    expect(screen.getByRole('main').contains(region)).toBe(false);
  });

  it('says that a game started', () => {
    setup();
    start();
    expect(status()).toBe('New game: Beginner, 9 by 9, 10 mines.');
  });

  it('keeps speaking after the play screen is gone: the loss is still in the region on the result screen', () => {
    const { factory } = setup();
    start();
    const { mines } = boardFacts(PRESETS.beginner, 100);
    act(() => factory.live()[0]?.dispatch({ type: 'reveal', index: mines[0] as number }));
    expect(screen.getByRole('heading', { level: 2, name: 'You hit a mine' })).toBeTruthy();
    expect(status()).toBe('You hit a mine. Game over.');
  });

  it('says that a new game started after a restart key', () => {
    setup();
    start();
    fireEvent.keyDown(screen.getByRole('application'), { key: 'r' });
    expect(status()).toBe('New game: Beginner, 9 by 9, 10 mines.');
  });
});

describe('the skip link', () => {
  const link = (): HTMLElement | null => screen.queryByRole('link', { name: 'Skip to board' });

  it('is not there on the menu, where there is no board to skip to', () => {
    setup();
    expect(link()).toBeNull();
  });

  it('is the first thing in the page during a game, hidden until it has the focus', () => {
    setup();
    start();
    const skip = link();
    expect(skip).not.toBeNull();
    expect(skip?.getAttribute('href')).toBe(`#${PLAY_BOARD_ID}`);
    expect(skip?.className).toContain('sr-only');
    expect(skip?.className).toContain('focus:not-sr-only');
    const first = document.body.querySelector('a, button');
    expect(first).toBe(skip);
  });

  it('moves the focus to the board that the controller is attached to', () => {
    setup();
    start();
    const board = screen.getByRole('application');
    screen.getByRole('button', { name: /^Theme: / }).focus();
    expect(document.activeElement).not.toBe(board);
    fireEvent.click(link() as HTMLElement);
    expect(document.activeElement).toBe(board);
    expect(board.id).toBe(PLAY_BOARD_ID);
  });

  it('does not change the address of the page', () => {
    setup();
    start();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link()?.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });

  it('is gone on the result screen', () => {
    const { factory } = setup();
    start();
    const { mines } = boardFacts(PRESETS.beginner, 100);
    act(() => factory.live()[0]?.dispatch({ type: 'reveal', index: mines[0] as number }));
    expect(link()).toBeNull();
  });
});

describe('the board on the result screen', () => {
  it('is a named image that says what happened, and is not focusable', () => {
    const { factory } = setup();
    start();
    const { mines } = boardFacts(PRESETS.beginner, 100);
    act(() => factory.live()[0]?.dispatch({ type: 'reveal', index: mines[0] as number }));
    const board = screen.getByRole('img', { name: 'Finished board, 9 by 9. You hit a mine.' });
    expect(board.hasAttribute('tabindex')).toBe(false);
    expect(screen.queryByRole('application')).toBeNull();
  });

  it('says that the board was cleared after a win', () => {
    const { factory } = setup();
    start();
    const { safe } = boardFacts(PRESETS.beginner, 100);
    for (const index of safe) act(() => factory.live()[0]?.dispatch({ type: 'reveal', index }));
    expect(
      screen.getByRole('img', { name: 'Finished board, 9 by 9. You cleared the board.' }),
    ).toBeTruthy();
  });
});
