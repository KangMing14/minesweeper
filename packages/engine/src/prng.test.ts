import { describe, expect, it } from 'vitest';
import golden from '../fixtures/prng-vectors.json' with { type: 'json' };
import { createPrng } from './prng.js';

const UINT32_MAX = 4294967295;
const TWO_POW_32 = 4294967296;

/** Calls `next` `count` times and returns the results in order. */
const draw = (count: number, next: () => number): number[] => Array.from({ length: count }, next);

// The golden file is written by a scratch script built on a third-party sfc32 and the published splitmix32
// (see its `generatedBy` note), so these expectations do not come from the code under test. A failure here
// means the sequence for an existing seed changed, which invalidates stored replays (ADR-002).
describe('createPrng: golden vectors', () => {
  it.each(golden.vectors)(
    'seed $seed: the first 20 nextUint32 outputs are the committed ones',
    ({ seed, uint32 }) => {
      const prng = createPrng(seed);
      expect(draw(20, () => prng.nextUint32())).toEqual(uint32);
    },
  );

  const nextIntCases = golden.vectors.flatMap(({ seed, nextInt }) =>
    Object.entries(nextInt).map(([n, expected]) => ({ seed, n: Number(n), expected })),
  );

  it.each(nextIntCases)(
    'seed $seed: the first 20 nextInt($n) results are the committed ones',
    ({ seed, n, expected }) => {
      const prng = createPrng(seed);
      expect(draw(20, () => prng.nextInt(n))).toEqual(expected);
    },
  );

  it('covers the four seeds the task names: 0, 1, 42 and the largest uint32', () => {
    expect(golden.vectors.map((vector) => vector.seed)).toEqual([0, 1, 42, UINT32_MAX]);
  });
});

// An exact reference in BigInt, where nothing can overflow or turn negative. It is written from the published
// sfc32 and splitmix32 text, with masks instead of `|0` and `Math.imul`, and checks seeds the golden file does
// not hold: above 2^31 (where a signed 32-bit slip shows up) and a spread of ordinary ones.
describe('createPrng against an exact BigInt reference', () => {
  const MASK = 0xffffffffn;

  /** The reference generator for a seed: `next()` is one sfc32 output after the 12-round warm-up. */
  function reference(seed: number): () => bigint {
    let s = BigInt(seed);
    const mix = (): bigint => {
      s = (s + 0x9e3779b9n) & MASK;
      let t = s ^ (s >> 16n);
      t = (t * 0x21f0aaadn) & MASK;
      t = t ^ (t >> 15n);
      t = (t * 0x735a2d97n) & MASK;
      return t ^ (t >> 15n);
    };
    let a = mix();
    let b = mix();
    let c = mix();
    let d = mix();
    const next = (): bigint => {
      const t = (a + b + d) & MASK;
      d = (d + 1n) & MASK;
      a = b ^ (b >> 9n);
      b = (c + (c << 3n)) & MASK;
      c = ((((c << 21n) | (c >> 11n)) & MASK) + t) & MASK;
      return t;
    };
    for (let i = 0; i < 12; i++) next();
    return next;
  }

  const seeds = [
    ...Array.from({ length: 100 }, (_, i) => i),
    2 ** 31 - 1,
    2 ** 31,
    2 ** 31 + 1,
    0xdeadbeef,
    0x9e3779b9,
    UINT32_MAX - 1,
    UINT32_MAX,
    ...Array.from({ length: 50 }, (_, i) => (i * 2654435761) % TWO_POW_32),
  ];

  it('gives the same 64 nextUint32 outputs for every seed', () => {
    for (const seed of seeds) {
      const prng = createPrng(seed);
      const expected = reference(seed);
      for (let i = 0; i < 64; i++) {
        expect([seed, i, prng.nextUint32()]).toEqual([seed, i, Number(expected())]);
      }
    }
  });

  it('gives the same nextInt results, rejections included, for every seed', () => {
    // 3_000_000_000 rejects about 30% of draws; 6 and 1000 almost never do.
    for (const n of [6, 1000, 3_000_000_000]) {
      const threshold = BigInt(TWO_POW_32) % BigInt(n);
      for (const seed of seeds) {
        const prng = createPrng(seed);
        const next = reference(seed);
        for (let i = 0; i < 30; i++) {
          let r = next();
          while (r < threshold) r = next();
          expect([seed, n, i, prng.nextInt(n)]).toEqual([seed, n, i, Number(r % BigInt(n))]);
        }
      }
    }
  });
});

describe('createPrng: seeds', () => {
  it('gives two generators with the same seed the same sequence', () => {
    const a = createPrng(2026);
    const b = createPrng(2026);
    expect(draw(1000, () => a.nextUint32())).toEqual(draw(1000, () => b.nextUint32()));
    expect(draw(1000, () => a.nextInt(97))).toEqual(draw(1000, () => b.nextInt(97)));
  });

  it('keeps generators independent: drawing from one never moves another', () => {
    const first = createPrng(7);
    const second = createPrng(7);
    draw(5, () => first.nextUint32());
    expect(second.nextUint32()).toBe(createPrng(7).nextUint32());
  });

  it('turns neighbouring seeds into unrelated sequences (2,000 seeds, 2,000 different first outputs)', () => {
    const firsts = new Set(
      Array.from({ length: 2000 }, (_, seed) => createPrng(seed).nextUint32()),
    );
    expect(firsts.size).toBe(2000);
  });

  it('accepts both ends of the uint32 range', () => {
    expect(() => createPrng(0)).not.toThrow();
    expect(() => createPrng(UINT32_MAX)).not.toThrow();
  });

  it('treats -0 as the seed 0, which is what a JSON round-trip would give', () => {
    const negativeZero = createPrng(-0);
    const zero = createPrng(0);
    expect(draw(10, () => negativeZero.nextUint32())).toEqual(draw(10, () => zero.nextUint32()));
  });

  it.each([-1, 1.5, TWO_POW_32, 2 ** 53, Number.NaN, Infinity, -Infinity])(
    'rejects the seed %s with a RangeError that names the seed',
    (seed) => {
      expect(() => createPrng(seed)).toThrow(RangeError);
      expect(() => createPrng(seed)).toThrow(/^seed must be an integer from 0 to 4294967295, got /);
    },
  );

  it.each([['5'], [null], [undefined], [10n]])(
    'rejects the seed %s that is not a number at all (untyped input)',
    (seed) => {
      expect(() => createPrng(seed as unknown as number)).toThrow(RangeError);
    },
  );
});

describe('nextUint32', () => {
  it('returns whole numbers from 0 to 4294967295, never negative', () => {
    const prng = createPrng(UINT32_MAX);
    const values = draw(10_000, () => prng.nextUint32());
    expect(values.every((v) => Number.isInteger(v) && v >= 0 && v <= UINT32_MAX)).toBe(true);
    // A signed 32-bit slip would put every second value below zero; here both halves must occur.
    expect(values.some((v) => v >= 2 ** 31)).toBe(true);
    expect(values.some((v) => v < 2 ** 31)).toBe(true);
  });

  it('has every one of the 32 bits set about half of the time, so no bit is stuck or weak', () => {
    const prng = createPrng(42);
    const draws = 20_000;
    const ones = Array.from({ length: 32 }, () => 0);
    for (let i = 0; i < draws; i++) {
      const value = prng.nextUint32();
      for (let bit = 0; bit < 32; bit++) {
        if (Math.floor(value / 2 ** bit) % 2 === 1) ones[bit] = (ones[bit] ?? 0) + 1;
      }
    }
    // Expected 10,000 per bit with a standard deviation of about 71: 5% is 14 deviations wide.
    for (const count of ones) {
      expect(count).toBeGreaterThan(draws * 0.45);
      expect(count).toBeLessThan(draws * 0.55);
    }
  });
});

describe('nextInt', () => {
  it('always returns 0 for nextInt(1)', () => {
    const prng = createPrng(5);
    expect(draw(1000, () => prng.nextInt(1)).every((v) => v === 0)).toBe(true);
  });

  it.each([2, 3, 7, 10, 100])('stays inside 0..%i-1 and reaches every value', (n) => {
    const prng = createPrng(n);
    const seen = new Set<number>();
    for (let i = 0; i < n * 200; i++) {
      const value = prng.nextInt(n);
      expect(Number.isInteger(value) && value >= 0 && value < n).toBe(true);
      seen.add(value);
    }
    expect(seen.size).toBe(n);
  });

  it('spreads nextInt(6) evenly: each face within 10% of its share over 60,000 rolls', () => {
    const prng = createPrng(2026);
    const counts = Array.from({ length: 6 }, () => 0);
    for (let i = 0; i < 60_000; i++) {
      const face = prng.nextInt(6);
      counts[face] = (counts[face] ?? 0) + 1;
    }
    for (const count of counts) {
      expect(count).toBeGreaterThan(9_000);
      expect(count).toBeLessThan(11_000);
    }
  });

  it('is not biased towards low values when n does not divide 2^32 (the rejection rule)', () => {
    // For n = 3,000,000,000, plain `draw % n` maps two draw ranges onto every value below
    // 1,294,967,296 (= 2^32 mod n) and one onto the rest: that share would be about 0.60.
    // Without bias it is 1,294,967,296 / 3,000,000,000 = 0.4317, with a standard deviation of 0.0035.
    const prng = createPrng(42);
    const draws = 20_000;
    let low = 0;
    for (let i = 0; i < draws; i++) {
      if (prng.nextInt(3_000_000_000) < 1_294_967_296) low++;
    }
    expect(low / draws).toBeGreaterThan(0.4);
    expect(low / draws).toBeLessThan(0.47);
  });

  it('skips a draw that would bias the result instead of reducing it', () => {
    // Seed 0 draws 548183886, 1097162541, 2219297441, ... (golden vectors). For n = 3,000,000,000 the
    // first two are below 2^32 mod n = 1,294,967,296 and are thrown away, so the first result is the third
    // draw. A plain `draw % n` would return 548183886.
    expect(createPrng(0).nextInt(3_000_000_000)).toBe(2219297441);
  });

  it('with nextInt(2^32) returns the nextUint32 stream unchanged', () => {
    const viaInt = createPrng(9);
    const viaUint = createPrng(9);
    expect(draw(50, () => viaInt.nextInt(TWO_POW_32))).toEqual(
      draw(50, () => viaUint.nextUint32()),
    );
  });

  it.each([0, -1, 1.5, Number.NaN, Infinity, TWO_POW_32 + 1, 2 ** 53])(
    'rejects maxExclusive %s with a RangeError that names it',
    (maxExclusive) => {
      const prng = createPrng(1);
      expect(() => prng.nextInt(maxExclusive)).toThrow(RangeError);
      expect(() => prng.nextInt(maxExclusive)).toThrow(
        /^maxExclusive must be an integer from 1 to 4294967296, got /,
      );
    },
  );

  it.each([['5'], [null], [undefined]])(
    'rejects the maxExclusive %s that is not a number at all (untyped input)',
    (maxExclusive) => {
      expect(() => createPrng(1).nextInt(maxExclusive as unknown as number)).toThrow(RangeError);
    },
  );

  it('does not consume a draw when it rejects its argument, so a caught mistake cannot desync a replay', () => {
    const touched = createPrng(3);
    const untouched = createPrng(3);
    expect(() => touched.nextInt(0)).toThrow(RangeError);
    expect(draw(10, () => touched.nextUint32())).toEqual(draw(10, () => untouched.nextUint32()));
  });
});
