import { PRESETS, createGame } from '@minesweeper/engine';
import { expect, test } from '@playwright/test';
import { planWin } from './winningPlan.js';
import { SMOKE_SEED } from './seed.js';

// M3-T08. No browser in this file: it checks the plan that the browser tests rely on, and it also proves
// that the engine can be imported from `e2e/` on a fresh clone (no `dist/` needed).

test.describe('planWin', () => {
  test('wins the board of the smoke seed, with clicks that all do something', () => {
    const plan = planWin(PRESETS.beginner, SMOKE_SEED);
    const game = createGame(plan.config, plan.seed);
    expect(game.view().status).toBe('ready');
    for (const [i, index] of plan.clicks.entries()) {
      expect(game.view().cells[index]?.state, `click ${i} is still hidden`).toBe('hidden');
      expect(game.apply({ type: 'reveal', index, t: i }).length).toBeGreaterThan(0);
    }
    expect(game.view().status).toBe('won');
    expect(plan.safeCells).toBe(81 - 10);
  });

  test('is a real game, long enough to be worth a browser: several clicks, not the whole board', () => {
    const plan = planWin(PRESETS.beginner, SMOKE_SEED);
    expect(plan.clicks.length).toBeGreaterThanOrEqual(8);
    expect(plan.clicks.length).toBeLessThan(plan.safeCells);
  });

  test('never clicks a mine', () => {
    const plan = planWin(PRESETS.beginner, SMOKE_SEED);
    const game = createGame(plan.config, plan.seed);
    for (const [i, index] of plan.clicks.entries()) game.apply({ type: 'reveal', index, t: i });
    expect(game.view().status).toBe('won'); // a mine would have made it 'lost'
  });

  test('is the same plan every time', () => {
    expect(planWin(PRESETS.beginner, SMOKE_SEED)).toEqual(planWin(PRESETS.beginner, SMOKE_SEED));
  });
});
