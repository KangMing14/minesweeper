import { afterEach, describe, expect, it, vi } from 'vitest';
import { SystemClock } from './SystemClock.js';

describe('SystemClock', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the monotonic performance clock, not the calendar clock', () => {
    const perf = vi.spyOn(performance, 'now').mockReturnValue(1234.5);
    const wall = vi.spyOn(Date, 'now');
    expect(new SystemClock().nowMs()).toBe(1234.5);
    expect(perf).toHaveBeenCalledTimes(1);
    expect(wall).not.toHaveBeenCalled();
  });

  it('does not go backwards across real readings', () => {
    const clock = new SystemClock();
    const readings = Array.from({ length: 50 }, () => clock.nowMs());
    for (let i = 1; i < readings.length; i += 1) {
      expect(readings[i] as number).toBeGreaterThanOrEqual(readings[i - 1] as number);
    }
  });
});
