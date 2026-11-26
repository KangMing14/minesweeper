import type { GameResult, GameView } from '@minesweeper/engine';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubCanvasContext } from '../../test/sessionKit.js';
import type { FinishedGame } from '../state/appStore.js';
import { ResultScreen } from './ResultScreen.js';

const VIEW: GameView = {
  width: 3,
  height: 3,
  status: 'won',
  cells: Array.from({ length: 9 }, () => ({ state: 'revealed', value: 0 }) as const),
  revealedCount: 8,
  flagCount: 0,
  minesRemaining: 1,
  exposedMines: [4],
};
const WON: GameResult = {
  outcome: 'won',
  timeMs: 12345,
  safeCellsRevealed: 8,
  totalSafeCells: 8,
  effectiveCommands: 5,
  threeBV: 7,
  threeBVPerSecond: 0.5670311,
};
const game = (result: Partial<GameResult>, status: GameView['status']): FinishedGame => ({
  presetId: 'beginner',
  seed: 5,
  view: { ...VIEW, status },
  result: { ...WON, ...result },
});

beforeEach(() => {
  stubCanvasContext();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('ResultScreen', () => {
  it('says the board was cleared after a win and lists time, 3BV and 3BV per second', () => {
    render(
      <ResultScreen
        finished={game({}, 'won')}
        onNewGame={() => undefined}
        onMenu={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'You cleared the board' })).toBeTruthy();
    const text = (term: string): string =>
      screen.getByText(term).closest('div')?.querySelector('dd')?.textContent ?? '';
    expect(text('Time')).toBe('12.345 s');
    expect(text('3BV')).toBe('7');
    expect(text('3BV per second')).toBe('0.57');
    expect(text('Cells cleared')).toBe('8 of 8');
  });

  it('says a mine was hit after a loss, and how far the player got', () => {
    render(
      <ResultScreen
        finished={game(
          { outcome: 'lost', safeCellsRevealed: 3, timeMs: 900, threeBVPerSecond: 0 },
          'lost',
        )}
        onNewGame={() => undefined}
        onMenu={() => undefined}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'You hit a mine' })).toBeTruthy();
    expect(screen.getByText('3 of 8')).toBeTruthy();
    expect(screen.getByText('0.900 s')).toBeTruthy();
  });

  it('names the difficulty and the board it was played on', () => {
    render(
      <ResultScreen
        finished={game({}, 'won')}
        onNewGame={() => undefined}
        onMenu={() => undefined}
      />,
    );
    expect(screen.getByText(/Beginner, 9 × 9, 10 mines/)).toBeTruthy();
  });

  it('offers a new board and a change of difficulty', () => {
    const onNewGame = vi.fn();
    const onMenu = vi.fn();
    render(<ResultScreen finished={game({}, 'won')} onNewGame={onNewGame} onMenu={onMenu} />);
    fireEvent.click(screen.getByRole('button', { name: 'New board' }));
    expect(onNewGame).toHaveBeenCalledTimes(1);
    expect(onMenu).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Change difficulty' }));
    expect(onMenu).toHaveBeenCalledTimes(1);
  });

  it('keeps the finished board on screen, read-only (no keyboard focus, no controls)', () => {
    render(
      <ResultScreen
        finished={game({}, 'won')}
        onNewGame={() => undefined}
        onMenu={() => undefined}
      />,
    );
    const board = screen.getByRole('img', { name: /minesweeper board.*3 by 3/i });
    expect(board.tagName).toBe('CANVAS');
    expect(board.hasAttribute('tabindex')).toBe(false);
  });

  it('puts the keyboard focus on its heading', () => {
    render(
      <ResultScreen
        finished={game({}, 'won')}
        onNewGame={() => undefined}
        onMenu={() => undefined}
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2 }));
  });
});
