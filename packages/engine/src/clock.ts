/**
 * A source of the current time, in milliseconds, supplied by whoever drives a game.
 *
 * @remarks
 * This is an interface only, on purpose. The engine never reads a clock (ADR-002): time enters a game as
 * the `t` of a `Command`, measured by the caller. A caller that needs the time (the client session, the
 * server's match) implements `Clock` (`SystemClock` in `apps/web` and `apps/server`) and tests use a fake
 * one, so a replay never depends on when it runs. Only differences between two readings are meaningful:
 * `nowMs` need not be a calendar time and need not start at 0.
 *
 * @example
 * ```ts
 * let now = 1_000;
 * const fake: Clock = { nowMs: () => now };
 * const t0 = fake.nowMs();
 * now = 1_250;
 * const t = fake.nowMs() - t0; // 250, the `t` for the next command
 * ```
 */
export interface Clock {
  /** The current time in milliseconds. Non-decreasing for a well-behaved clock; callers do not rely on it. */
  nowMs(): number;
}
