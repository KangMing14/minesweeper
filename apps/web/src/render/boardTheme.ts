// M3-T03. The colors and font the board is drawn in, read from the same `--ms-*` tokens as the rest of the
// page, so a theme switch (light, dark, forced) changes the board as well.

/**
 * The colors and the font that the board is drawn with.
 *
 * @example
 * ```ts
 * const theme: BoardTheme = readBoardTheme(canvas);
 * ctx.fillStyle = theme.numbers[2] ?? theme.text; // the color of a 3
 * ```
 */
export interface BoardTheme {
  /** A closed cell (`--ms-color-cell-hidden`). */
  readonly hidden: string;
  /** An open cell (`--ms-color-cell-revealed`). */
  readonly revealed: string;
  /** Flag pole, mine (`--ms-color-text`). */
  readonly text: string;
  /** Flag cloth, wrong-flag cross (`--ms-color-danger`). */
  readonly danger: string;
  /** The numbers 1 to 8, in order (`--ms-color-num-1` to `-8`). */
  readonly numbers: readonly string[];
  /** The font family for the numbers (`--ms-font-sans`). */
  readonly fontFamily: string;
}

// Used only when the stylesheet is missing (a broken build, a test page), so the board is still visible and
// legible. In the app every value comes from the tokens; these are plain named colors, not a second palette.
const FALLBACK = {
  hidden: 'gray',
  revealed: 'white',
  text: 'black',
  danger: 'red',
  number: 'black',
  fontFamily: 'sans-serif',
} as const;

/**
 * Reads the board's colors and font from the tokens in effect on an element.
 *
 * @remarks
 * Call it again after the theme changes: the values are read at the time of the call. A token that is not
 * defined gets a plain named fallback color.
 *
 * @param element - An element inside the page whose tokens apply (the canvas).
 * @returns A new theme.
 * @example
 * ```ts
 * const theme = readBoardTheme(document.body);
 * ```
 */
export function readBoardTheme(element: Element): BoardTheme {
  const style = window.getComputedStyle(element);
  const read = (token: string, fallback: string): string => {
    const value = style.getPropertyValue(token).trim();
    return value === '' ? fallback : value;
  };
  return {
    hidden: read('--ms-color-cell-hidden', FALLBACK.hidden),
    revealed: read('--ms-color-cell-revealed', FALLBACK.revealed),
    text: read('--ms-color-text', FALLBACK.text),
    danger: read('--ms-color-danger', FALLBACK.danger),
    numbers: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => read(`--ms-color-num-${n}`, FALLBACK.number)),
    fontFamily: read('--ms-font-sans', FALLBACK.fontFamily),
  };
}
