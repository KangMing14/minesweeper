import type { Clock } from '@minesweeper/engine';

/**
 * The browser's real clock, as a `Clock`.
 *
 * @remarks
 * It reads `performance.now()`, which never goes backwards and does not jump when the user or the network
 * changes the date. That is what a game timer needs; a calendar clock (`Date.now()`) is the wrong tool. Only
 * differences between two readings mean anything. Tests use a fake `Clock` instead.
 *
 * @example
 * ```ts
 * const clock: Clock = new SystemClock();
 * const t0 = clock.nowMs();
 * const elapsed = clock.nowMs() - t0; // milliseconds, with a fraction
 * ```
 */
export class SystemClock implements Clock {
  /** Milliseconds from a fixed, arbitrary starting point of the page. */
  nowMs(): number {
    return performance.now();
  }
}
