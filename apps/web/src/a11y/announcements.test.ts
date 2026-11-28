import type { CellView, GameEvent, GameView } from '@minesweeper/engine';
import { describe, expect, it } from 'vitest';
import { describeCell, describeEvent, describeStart, spokenDuration } from './announcements.js';

// M3-T08. The words that the live region speaks. Pure functions, so the wording is pinned here and the
// component tests only have to check that the right function is called at the right time.

const H: CellView = { state: 'hidden' };
const F: CellView = { state: 'flagged' };
const R = (value: number): CellView => ({ state: 'revealed', value });

function view(width: number, cells: readonly CellView[]): GameView {
  return {
    width,
    height: cells.length / width,
    status: 'playing',
    cells,
    revealedCount: 0,
    flagCount: 0,
    minesRemaining: 0,
  };
}

describe('describeCell', () => {
  const v = view(3, [H, F, R(2), R(0), H, H, H, H, H]);

  it('counts rows and columns from 1, row first', () => {
    expect(describeCell(v, 0)).toBe('Row 1, column 1, hidden');
    expect(describeCell(v, 5)).toBe('Row 2, column 3, hidden');
    expect(describeCell(v, 6)).toBe('Row 3, column 1, hidden');
  });

  it('says what the cell is: hidden, flagged, a number or empty', () => {
    expect(describeCell(v, 1)).toBe('Row 1, column 2, flagged');
    expect(describeCell(v, 2)).toBe('Row 1, column 3, revealed, 2');
    expect(describeCell(v, 3)).toBe('Row 2, column 1, revealed, empty');
  });

  it('always starts with the position, so a listener can find it', () => {
    for (let i = 0; i < 9; i += 1) expect(describeCell(v, i)).toMatch(/^Row \d+, column \d+, /);
  });
});

describe('describeEvent', () => {
  it('names the value and the place of a single revealed cell', () => {
    const event: GameEvent = { type: 'cellsRevealed', cells: [{ index: 5, value: 3 }] };
    expect(describeEvent(event, 3)).toBe('Revealed 3 at row 2, column 3.');
  });

  it('says "an empty cell" for a single zero', () => {
    const event: GameEvent = { type: 'cellsRevealed', cells: [{ index: 0, value: 0 }] };
    expect(describeEvent(event, 3)).toBe('Revealed an empty cell at row 1, column 1.');
  });

  it('counts the cells of a cascade instead of reading each one', () => {
    const cells = Array.from({ length: 14 }, (_, index) => ({ index, value: 0 }));
    expect(describeEvent({ type: 'cellsRevealed', cells }, 9)).toBe('Opened 14 cells.');
    const two = [
      { index: 0, value: 1 },
      { index: 1, value: 0 },
    ];
    expect(describeEvent({ type: 'cellsRevealed', cells: two }, 9)).toBe('Opened 2 cells.');
  });

  it('announces a flag placed and removed with its place', () => {
    expect(describeEvent({ type: 'flagToggled', index: 4, flagged: true }, 3)).toBe(
      'Flag placed at row 2, column 2.',
    );
    expect(describeEvent({ type: 'flagToggled', index: 4, flagged: false }, 3)).toBe(
      'Flag removed at row 2, column 2.',
    );
  });

  it('announces a win with the time', () => {
    expect(describeEvent({ type: 'gameWon', t: 12_345 }, 9)).toBe(
      'You cleared the board in 12.3 seconds.',
    );
  });

  it('announces a loss and never says where the mine was (D-14)', () => {
    const text = describeEvent({ type: 'gameLost', t: 5_000, mineIndex: 37 }, 9);
    expect(text).toBe('You hit a mine. Game over.');
    expect(text).not.toMatch(/\d|row|column/i);
  });
});

describe('describeStart', () => {
  it('names the difficulty, the size and the mines', () => {
    expect(describeStart('Beginner', { width: 9, height: 9, mineCount: 10 })).toBe(
      'New game: Beginner, 9 by 9, 10 mines.',
    );
  });

  it('says "1 mine" and "0 mines" correctly', () => {
    expect(describeStart('Tiny', { width: 3, height: 3, mineCount: 1 })).toBe(
      'New game: Tiny, 3 by 3, 1 mine.',
    );
    expect(describeStart('Tiny', { width: 3, height: 3, mineCount: 0 })).toBe(
      'New game: Tiny, 3 by 3, 0 mines.',
    );
  });
});

describe('spokenDuration', () => {
  it('uses tenths of a second below a minute', () => {
    expect(spokenDuration(0)).toBe('0.0 seconds');
    expect(spokenDuration(59_949)).toBe('59.9 seconds');
  });

  it('uses whole minutes and seconds from a minute on, with the right plurals', () => {
    expect(spokenDuration(60_000)).toBe('1 minute');
    expect(spokenDuration(61_000)).toBe('1 minute 1 second');
    expect(spokenDuration(62_900)).toBe('1 minute 2 seconds');
    expect(spokenDuration(120_000)).toBe('2 minutes');
    expect(spokenDuration(185_000)).toBe('3 minutes 5 seconds');
  });

  it('survives a time that is not a number', () => {
    expect(spokenDuration(Number.NaN)).toBe('0.0 seconds');
    expect(spokenDuration(-5)).toBe('0.0 seconds');
  });
});
