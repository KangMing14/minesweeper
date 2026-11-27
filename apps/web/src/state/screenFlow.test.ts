import { describe, expect, it } from 'vitest';
import { SCREEN_EVENTS, SCREENS, nextScreen, type Screen, type ScreenEvent } from './screenFlow.js';

// M3-T05. The screen flow is a table, and the table is the whole truth: every pair of (screen, event) that
// is not listed here must be refused.

const ALLOWED: readonly (readonly [Screen, ScreenEvent, Screen])[] = [
  ['menu', 'start', 'playing'],
  ['playing', 'finish', 'result'],
  ['playing', 'newGame', 'playing'],
  ['playing', 'retry', 'playing'],
  ['playing', 'toMenu', 'menu'],
  ['result', 'newGame', 'playing'],
  ['result', 'retry', 'playing'],
  ['result', 'toMenu', 'menu'],
];

describe('nextScreen', () => {
  it.each(ALLOWED)('%s + %s -> %s', (from, event, to) => {
    expect(nextScreen(from, event)).toBe(to);
  });

  it('refuses every pair that is not in the table', () => {
    const allowed = new Set(ALLOWED.map(([from, event]) => `${from}/${event}`));
    let refused = 0;
    for (const from of SCREENS) {
      for (const event of SCREEN_EVENTS) {
        if (allowed.has(`${from}/${event}`)) continue;
        expect(nextScreen(from, event), `${from} + ${event}`).toBeUndefined();
        refused += 1;
      }
    }
    expect(refused).toBe(SCREENS.length * SCREEN_EVENTS.length - ALLOWED.length);
  });

  it('refuses an unknown screen or event from untyped input', () => {
    expect(nextScreen('settings' as Screen, 'start')).toBeUndefined();
    expect(nextScreen('menu', 'explode' as ScreenEvent)).toBeUndefined();
    expect(nextScreen('menu', 'constructor' as ScreenEvent)).toBeUndefined();
    expect(nextScreen('toString' as Screen, 'start')).toBeUndefined();
  });
});
