import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomSeed } from './seed.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('randomSeed', () => {
  it('returns a whole number from 0 to 4294967295', () => {
    for (let i = 0; i < 200; i += 1) {
      const seed = randomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(4294967295);
    }
  });

  it('reads crypto.getRandomValues and passes the value through unchanged, also the extremes', () => {
    for (const value of [0, 1, 2147483648, 4294967295]) {
      vi.stubGlobal('crypto', {
        getRandomValues: (array: Uint32Array) => {
          array[0] = value;
          return array;
        },
      });
      expect(randomSeed()).toBe(value);
    }
  });

  it('does not use Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    randomSeed();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('differs between calls (a repeat of 200 draws is not plausible)', () => {
    const seeds = new Set(Array.from({ length: 200 }, () => randomSeed()));
    expect(seeds.size).toBeGreaterThan(190);
  });
});
