// M3-T05. Turning numbers into the text the player reads.

const pad = (n: number, width: number): string => String(n).padStart(width, '0');

/** Whole milliseconds, or 0 for a value that is negative or not a finite number. */
function wholeMs(ms: number): number {
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : 0;
}

/**
 * The running clock of the HUD, in tenths of a second: `12.3`, and from one minute `1:05.4`. It rounds down,
 * so the clock never shows a time that has not been reached.
 *
 * @param ms - Elapsed milliseconds.
 * @returns The text.
 * @example
 * ```ts
 * formatClock(65432); // '1:05.4'
 * ```
 */
export function formatClock(ms: number): string {
  const tenths = Math.floor(wholeMs(ms) / 100);
  const seconds = Math.floor(tenths / 10);
  const minutes = Math.floor(seconds / 60);
  const rest = `${seconds % 60}.${tenths % 10}`;
  return minutes === 0 ? rest : `${minutes}:${seconds % 60 < 10 ? '0' : ''}${rest}`;
}

/**
 * A finished time to the millisecond: `12.345 s`, and from one minute `1:05.432`.
 *
 * @param ms - The time of the game in milliseconds.
 * @returns The text.
 * @example
 * ```ts
 * formatDuration(12345); // '12.345 s'
 * ```
 */
export function formatDuration(ms: number): string {
  const whole = wholeMs(ms);
  const seconds = Math.floor(whole / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) return `${seconds}.${pad(whole % 1000, 3)} s`;
  return `${minutes}:${pad(seconds % 60, 2)}.${pad(whole % 1000, 3)}`;
}

/**
 * A rate such as 3BV per second, with two decimals.
 *
 * @param value - The rate.
 * @returns The text, `0.00` for a value that is not a finite number.
 * @example
 * ```ts
 * formatRate(2.345); // '2.35'
 * ```
 */
export function formatRate(value: number): string {
  return (Number.isFinite(value) ? value : 0).toFixed(2);
}
