import { PRESETS } from '@minesweeper/engine';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { SMOKE_SEED } from './support/seed.js';
import { planWin, type WinningPlan } from './support/winningPlan.js';

// M3-T08. The browser smoke tests: the real production build, in Chromium, played to a win with the mouse and
// again with the keyboard alone, plus the keyboard behavior that WCAG asks for. The tests learn where the
// mines are from the engine (`planWin`), never from the page.
//
// The client draws its seed from `crypto.getRandomValues` (state/seed.ts). An init script makes that call
// answer SMOKE_SEED, so the board is known without a seed parameter in the product (which would be a way to
// pick a board in ranked play later).

const CONFIG = PRESETS.beginner;
const plan: WinningPlan = planWin(CONFIG, SMOKE_SEED);

// Every test also proves that the page threw nothing: uncaught errors are collected per page.
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  await page.addInitScript((seed: number) => {
    Object.defineProperty(crypto, 'getRandomValues', {
      configurable: true,
      value: <T extends ArrayBufferView | null>(array: T): T => {
        if (array instanceof Uint32Array) array.fill(seed);
        return array;
      },
    });
  }, SMOKE_SEED);
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.message));
});

test.afterEach(({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([]);
});

const board = (page: Page): Locator =>
  page.getByRole('application', { name: /^Minesweeper board/ });
const status = (page: Page): Locator => page.getByRole('status');
const nextFrame = (page: Page): Promise<unknown> =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

async function openBeginner(page: Page, how: 'mouse' | 'keyboard'): Promise<void> {
  await page.goto('/');
  const button = page.getByRole('button', { name: /^Beginner/ });
  if (how === 'mouse') {
    await button.click();
  } else {
    await button.focus();
    await page.keyboard.press('Enter');
  }
  await expect(board(page)).toBeVisible();
  await expect(board(page)).toBeFocused();
  await expect(status(page)).toHaveText('New game: Beginner, 9 by 9, 10 mines.');
}

async function expectWon(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { level: 2, name: 'You cleared the board' }),
  ).toBeVisible();
  await expect(page.getByText(`${plan.safeCells} of ${plan.safeCells}`)).toBeVisible();
  await expect(status(page)).toHaveText(/^You cleared the board in \d/);
  await expect(
    page.getByRole('img', { name: 'Finished board, 9 by 9. You cleared the board.' }),
  ).toBeVisible();
}

test('plays a seeded game to a win with the mouse', async ({ page }) => {
  await openBeginner(page, 'mouse');
  const canvas = board(page);
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('the board has no box');

  // The canvas is cells and one-pixel gaps: width = columns * side + (columns - 1). The side is read from the
  // box and not from the app's layout code, so a wrong layout cannot agree with the test by sharing a bug.
  const gap = 1;
  const side = (box.width - (CONFIG.width - 1) * gap) / CONFIG.width;
  expect(side).toBeGreaterThanOrEqual(16);
  expect(Number.isInteger(side)).toBe(true);

  for (const index of plan.clicks) {
    const column = index % CONFIG.width;
    const row = Math.floor(index / CONFIG.width);
    await page.mouse.click(
      box.x + column * (side + gap) + side / 2,
      box.y + row * (side + gap) + side / 2,
    );
  }
  await expectWon(page);
});

test('plays the same game to a win with the keyboard alone, reading the cursor from the live region', async ({
  page,
}) => {
  await openBeginner(page, 'keyboard');

  // Where is the cursor? After a keyboard start the ring may already be showing (a key moves it) or may wait
  // for a first key (which only shows it). Either way the first arrow key makes the live region say where
  // the cursor is, and that is what the test reads: the position comes from the page, as for a screen reader.
  await page.keyboard.press('ArrowRight');
  const first = await readCursor(page);
  let row = first.row;
  let column = first.column;

  for (const index of plan.clicks) {
    const targetColumn = (index % CONFIG.width) + 1;
    const targetRow = Math.floor(index / CONFIG.width) + 1;
    const moves = [
      ...steps(targetRow - row, 'ArrowDown', 'ArrowUp'),
      ...steps(targetColumn - column, 'ArrowRight', 'ArrowLeft'),
    ];
    row = targetRow;
    column = targetColumn;
    for (const move of moves) await page.keyboard.press(move);
    if (moves.length > 0) {
      await expect(status(page)).toHaveText(
        new RegExp(`^Row ${targetRow}, column ${targetColumn}, `),
      );
    }
    await page.keyboard.press('Space');
    await expect(status(page)).toHaveText(/^(Revealed |Opened |You cleared)/);
  }
  await expectWon(page);
});

/** `count` presses of `forward` when it is positive, of `back` when it is negative. */
function steps(count: number, forward: string, back: string): string[] {
  return Array.from({ length: Math.abs(count) }, () => (count > 0 ? forward : back));
}

async function readCursor(page: Page): Promise<{ row: number; column: number }> {
  const text = status(page);
  await expect(text).toHaveText(/^Row \d+, column \d+, /);
  const match = /^Row (\d+), column (\d+), /.exec((await text.textContent()) ?? '');
  if (match === null) throw new Error('the live region does not say where the cursor is');
  return { row: Number(match[1]), column: Number(match[2]) };
}

test('the skip link moves the focus to the board', async ({ page }) => {
  await openBeginner(page, 'mouse');
  const theme = page.getByRole('button', { name: /^Theme: / });
  await theme.focus();
  await page.keyboard.press('Shift+Tab'); // the skip link comes before the header
  const skip = page.getByRole('link', { name: 'Skip to board' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(board(page)).toBeFocused();
  expect(new URL(page.url()).hash).toBe('');
});

test('R and Shift+R restart only while the focus is in the game (WCAG 2.1.4)', async ({ page }) => {
  await openBeginner(page, 'keyboard');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect(status(page)).toHaveText(/^(Revealed |Opened |Row \d+, column \d+)/);

  // With the focus on the theme button, outside the game region, the letter does nothing.
  const theme = page.getByRole('button', { name: /^Theme: / });
  await theme.focus();
  const before = await status(page).textContent();
  await page.keyboard.press('r');
  await page.keyboard.press('Shift+R');
  await nextFrame(page);
  await expect(theme).toBeFocused();
  await expect(status(page)).toHaveText(before ?? '');

  // With the focus on the board, R starts another board and the live region says so.
  await board(page).focus();
  await page.keyboard.press('r');
  await expect(status(page)).toHaveText('New game: Beginner, 9 by 9, 10 mines.');
  await expect(board(page)).toBeFocused();

  // On the menu there is no game region, so the letter starts nothing.
  await page.getByRole('button', { name: 'Change difficulty' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Choose a difficulty' })).toBeVisible();
  await page.keyboard.press('r');
  await nextFrame(page);
  await expect(page.getByRole('heading', { level: 2, name: 'Choose a difficulty' })).toBeVisible();
  await expect(board(page)).toHaveCount(0);
});
