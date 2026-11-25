import { afterEach, describe, expect, it, vi } from 'vitest';
import { readBoardTheme } from './boardTheme.js';

/** Makes `getComputedStyle` answer from a plain object, because jsdom does not load the token stylesheet. */
function stubStyle(values: Record<string, string>): void {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    getPropertyValue: (name: string) => values[name] ?? '',
  } as unknown as CSSStyleDeclaration);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readBoardTheme', () => {
  it('reads the cell, text, danger and number colors and the font from the --ms tokens', () => {
    stubStyle({
      '--ms-color-cell-hidden': ' #010101 ',
      '--ms-color-cell-revealed': '#020202',
      '--ms-color-text': '#030303',
      '--ms-color-danger': '#040404',
      '--ms-font-sans': 'Test Sans, sans-serif',
      ...Object.fromEntries(
        [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`--ms-color-num-${n}`, `#0a0a0${n}`]),
      ),
    });
    const theme = readBoardTheme(document.body);
    expect(theme).toMatchObject({
      hidden: '#010101',
      revealed: '#020202',
      text: '#030303',
      danger: '#040404',
      fontFamily: 'Test Sans, sans-serif',
    });
    expect(theme.numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => `#0a0a0${n}`));
  });

  it('falls back to plain named colors and a generic font when the tokens are missing', () => {
    stubStyle({});
    const theme = readBoardTheme(document.body);
    expect(theme.numbers).toHaveLength(8);
    for (const color of [
      theme.hidden,
      theme.revealed,
      theme.text,
      theme.danger,
      ...theme.numbers,
    ]) {
      expect(color).not.toBe('');
    }
    expect(theme.hidden).not.toBe(theme.revealed);
    expect(theme.fontFamily).toMatch(/sans-serif/);
  });

  it('asks the element it was given', () => {
    const spy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration);
    const element = document.createElement('canvas');
    readBoardTheme(element);
    expect(spy).toHaveBeenCalledWith(element);
  });
});
