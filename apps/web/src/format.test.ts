import { describe, expect, it } from 'vitest';
import { formatClock, formatDuration, formatRate } from './format.js';

describe('formatClock (HUD, tenths of a second)', () => {
  it.each([
    [0, '0.0'],
    [99, '0.0'],
    [100, '0.1'],
    [12345, '12.3'],
    [59999, '59.9'],
    [60000, '1:00.0'],
    [65432, '1:05.4'],
    [3599999, '59:59.9'],
    [3600000, '60:00.0'],
  ])('%i ms -> %s', (ms, text) => {
    expect(formatClock(ms)).toBe(text);
  });

  it('treats a negative or non-finite value as zero', () => {
    expect(formatClock(-5)).toBe('0.0');
    expect(formatClock(Number.NaN)).toBe('0.0');
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe('0.0');
  });
});

describe('formatDuration (result, milliseconds)', () => {
  it.each([
    [0, '0.000 s'],
    [7, '0.007 s'],
    [12345, '12.345 s'],
    [60000, '1:00.000'],
    [65432, '1:05.432'],
  ])('%i ms -> %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});

describe('formatRate', () => {
  it('shows two decimals', () => {
    expect(formatRate(0)).toBe('0.00');
    expect(formatRate(2.345)).toBe('2.35');
    expect(formatRate(90.90909090909092)).toBe('90.91');
  });
  it('shows zero for a value that is not a finite number', () => {
    expect(formatRate(Number.NaN)).toBe('0.00');
  });
});
