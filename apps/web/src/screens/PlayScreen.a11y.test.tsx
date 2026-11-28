import type { BoardConfig } from '@minesweeper/engine';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeClock,
  boardFacts,
  sessionFactory,
  stubCanvasContext,
  stubFocusVisible,
} from '../../test/sessionKit.js';
import { AnnouncerContext } from '../a11y/Announcer.js';
import { PLAY_BOARD_HELP_ID, PLAY_BOARD_ID } from '../a11y/ids.js';
import { PlayScreen } from './PlayScreen.js';

// M3-T08. What the play screen gives to assistive technology: the role and name of the board, the key help
// it points to, and the messages it sends to the live region.

const CONFIG: BoardConfig = { width: 6, height: 6, mineCount: 6 };
const SEED = 11;

let clock: FakeClock;
let factory: ReturnType<typeof sessionFactory>;
let spoken: string[];

beforeEach(() => {
  vi.useFakeTimers();
  stubCanvasContext();
  stubFocusVisible(false); // a game started with the mouse; the keyboard start has its own test
  clock = new FakeClock();
  factory = sessionFactory(clock);
  spoken = [];
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function show(): void {
  render(
    <AnnouncerContext.Provider value={(text) => spoken.push(text)}>
      <PlayScreen
        presetName="Beginner"
        config={CONFIG}
        seed={SEED}
        createSession={factory.create}
        onFinish={() => {}}
        onNewGame={() => {}}
        onMenu={() => {}}
      />
    </AnnouncerContext.Provider>,
  );
}
const session = () => {
  const s = factory.made.at(-1);
  if (s === undefined) throw new Error('no session was made');
  return s;
};
const board = (): HTMLElement => screen.getByRole('application');

describe('the board of the play screen', () => {
  it('is an application with a name that gives the size, and not an image', () => {
    show();
    expect(board().tagName).toBe('CANVAS');
    expect(board().getAttribute('aria-label')).toBe('Minesweeper board, 6 by 6');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('has the id that the skip link points to and is described by the key help', () => {
    show();
    expect(board().id).toBe(PLAY_BOARD_ID);
    expect(board().getAttribute('aria-describedby')).toBe(PLAY_BOARD_HELP_ID);
    const help = document.getElementById(PLAY_BOARD_HELP_ID);
    expect(help).not.toBeNull();
    expect(help?.className).toContain('sr-only');
    for (const part of ['Arrow keys', 'Space', 'F', 'C', 'Enter', 'R', 'Shift+R'])
      expect(help?.textContent).toContain(part);
  });

  it('is focusable and takes the focus when the game starts', () => {
    show();
    expect(board().getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(board());
  });
});

describe('what the play screen says to the live region', () => {
  it('starts with the new game: difficulty, size, mines', () => {
    show();
    expect(spoken).toEqual(['New game: Beginner, 6 by 6, 6 mines.']);
  });

  it('says what a reveal opened', () => {
    show();
    const { safe } = boardFacts(CONFIG, SEED);
    spoken.length = 0;
    const target = safe.find((i) => !session().view().cells[i]?.state.startsWith('revealed'));
    act(() => session().dispatch({ type: 'reveal', index: target as number }));
    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toMatch(/^(Revealed .* at row \d, column \d\.|Opened \d+ cells\.)$/);
  });

  it('says where a flag was placed and removed', () => {
    show();
    spoken.length = 0;
    act(() => session().dispatch({ type: 'flag', index: 0 }));
    act(() => session().dispatch({ type: 'flag', index: 0 }));
    expect(spoken).toEqual(['Flag placed at row 1, column 1.', 'Flag removed at row 1, column 1.']);
  });

  it('says that the board is cleared, with the time', () => {
    show();
    const { safe } = boardFacts(CONFIG, SEED);
    clock.advance(4_000);
    spoken.length = 0;
    for (const index of safe) act(() => session().dispatch({ type: 'reveal', index }));
    expect(spoken.at(-1)).toBe('You cleared the board in 4.0 seconds.');
  });

  it('says that a mine was hit, and not where (D-14)', () => {
    show();
    const { mines } = boardFacts(CONFIG, SEED);
    spoken.length = 0;
    act(() => session().dispatch({ type: 'reveal', index: mines[0] as number }));
    expect(spoken).toEqual(['You hit a mine. Game over.']);
  });

  it('says nothing while the clock runs', () => {
    show();
    spoken.length = 0;
    act(() => {
      clock.advance(5_000);
      vi.advanceTimersByTime(5_000);
    });
    expect(spoken).toEqual([]);
  });

  it('says the cell under the cursor on the first key and on every move', () => {
    show();
    spoken.length = 0;
    fireEvent.keyDown(board(), { key: 'ArrowRight' }); // shows the ring in the middle: row 4, column 4
    fireEvent.keyDown(board(), { key: 'ArrowRight' });
    fireEvent.keyDown(board(), { key: 'ArrowDown' });
    expect(spoken).toHaveLength(3);
    expect(spoken[0]).toMatch(/^Row 4, column 4, /);
    expect(spoken[1]).toMatch(/^Row 4, column 5, /);
    expect(spoken[2]).toMatch(/^Row 5, column 5, /);
  });

  it('says the state of the cell: a flag shows as flagged', () => {
    show();
    fireEvent.keyDown(board(), { key: 'ArrowRight' });
    spoken.length = 0;
    fireEvent.keyDown(board(), { key: 'f' });
    expect(spoken).toEqual(['Flag placed at row 4, column 4.']);
    spoken.length = 0;
    fireEvent.keyDown(board(), { key: 'ArrowLeft' });
    fireEvent.keyDown(board(), { key: 'ArrowRight' });
    expect(spoken[1]).toBe('Row 4, column 4, flagged');
  });
});

describe('a game started from the keyboard', () => {
  it('keeps "New game" in the live region, because the start-up focus reports no cursor', () => {
    stubFocusVisible(true);
    show();
    expect(spoken).toEqual(['New game: Beginner, 6 by 6, 6 mines.']);
  });

  it('shows the ring at once, so the first arrow key moves from the middle and says the next cell', () => {
    stubFocusVisible(true);
    show();
    spoken.length = 0;
    fireEvent.keyDown(board(), { key: 'ArrowRight' });
    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toMatch(/^Row 4, column 5, /);
  });
});
