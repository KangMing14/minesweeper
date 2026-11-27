import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PresetStats } from '../stats/StatsStore.js';
import { MenuScreen } from './MenuScreen.js';

// M3-T07. The records table on the menu.
const NONE: PresetStats = { games: 0, wins: 0, bestTimeMs: null, averageThreeBVPerSecond: 0 };

function renderMenu(stats: Record<string, PresetStats>): void {
  render(<MenuScreen onStart={() => undefined} stats={(id) => stats[id] ?? NONE} />);
}

describe('MenuScreen records', () => {
  it('shows no table when it is given no statistics', () => {
    render(<MenuScreen onStart={() => undefined} />);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows no table before the first game, so a new player sees no empty grid', () => {
    renderMenu({});
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows one row per difficulty once a game has been played, with the numbers in words the player knows', () => {
    renderMenu({
      beginner: { games: 5, wins: 3, bestTimeMs: 65_432, averageThreeBVPerSecond: 2.345 },
      expert: { games: 1, wins: 0, bestTimeMs: null, averageThreeBVPerSecond: 0 },
    });
    const table = screen.getByRole('table', { name: 'Your records' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Difficulty', 'Games', 'Wins', 'Best time', '3BV/s']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((c) => c.textContent),
      ),
    ).toEqual([
      ['5', '3', '1:05.432', '2.35'],
      ['0', '0', '–', '–'],
      ['1', '0', '–', '–'],
    ]);
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual([
      'Beginner',
      'Intermediate',
      'Expert',
    ]);
  });

  it('explains what the numbers count', () => {
    renderMenu({ beginner: { games: 1, wins: 1, bestTimeMs: 9_000, averageThreeBVPerSecond: 3 } });
    expect(screen.getByText(/average of your wins/i)).toBeTruthy();
    expect(screen.getByText(/retries of the same board are not counted/i)).toBeTruthy();
  });

  it('leaves the difficulty buttons as they were: three buttons named by difficulty and size', () => {
    renderMenu({ beginner: { games: 1, wins: 1, bestTimeMs: 9_000, averageThreeBVPerSecond: 3 } });
    const buttons = within(screen.getByRole('list', { name: 'Difficulties' })).getAllByRole(
      'button',
    );
    expect(buttons).toHaveLength(3);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});
