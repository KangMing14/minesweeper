/** Largest seed: the biggest unsigned 32-bit integer. */
const UINT32_MAX = 0xffffffff;

/** 2^32, the number of values `nextUint32` can return and the largest `maxExclusive` that `nextInt` accepts. */
const TWO_POW_32 = 0x100000000;

/** Throws `RangeError` unless `value` is a whole number from `min` to `max`. `label` names the argument. */
function assertIntegerBetween(value: number, min: number, max: number, label: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be an integer from ${min} to ${max}, got ${String(value)}`);
  }
}

/**
 * A source of random whole numbers whose sequence depends only on the seed it was created with.
 *
 * @remarks
 * Every method moves the generator forward, so two calls in a row give two different draws, and two
 * generators created with the same seed give the same draws in the same order, on every platform. That is
 * what makes a board, a replay and a ghost reproducible (ADR-002). There is no way to read or restore the
 * internal state: to start over, create a new generator from the same seed.
 *
 * Get one from `createPrng`; the engine never reads randomness from anywhere else.
 *
 * @example
 * ```ts
 * const prng = createPrng(42);
 * const raw = prng.nextUint32(); // a whole number from 0 to 4294967295
 * const cell = prng.nextInt(81); // a whole number from 0 to 80, for example a cell of a 9x9 board
 * ```
 */
export interface Prng {
  /**
   * Returns the next draw: a whole number from 0 to 4294967295, every value equally likely.
   *
   * @returns An unsigned 32-bit integer, never negative and never fractional.
   */
  nextUint32(): number;

  /**
   * Returns a whole number from 0 up to but not including `maxExclusive`, every value equally likely.
   *
   * @remarks
   * Unbiased: a plain remainder (`draw % maxExclusive`) favours the small results whenever
   * `maxExclusive` does not divide 2^32, so draws from the short final stretch of the range are thrown
   * away and the next one is used instead (rejection sampling). This takes fewer than two draws on
   * average, and the number of draws used depends only on the seed, so it is reproducible too. The
   * argument is checked before anything is drawn, so a rejected call does not move the generator.
   *
   * @param maxExclusive - The number of possible results: a whole number from 1 to 4294967296.
   * @returns A whole number from 0 to `maxExclusive - 1`.
   * @throws `RangeError` if `maxExclusive` is not a whole number from 1 to 4294967296.
   */
  nextInt(maxExclusive: number): number;
}

/**
 * The generator behind `createPrng`: sfc32, with its state expanded from the seed by a 32-bit SplitMix.
 *
 * @remarks
 * Kept private so that the only way to get a `Prng` is `createPrng`, which checks the seed.
 */
class Sfc32Prng implements Prng {
  // The four 32-bit words of sfc32 state. Each is a signed 32-bit integer in storage (`| 0` keeps it so);
  // only `nextUint32` turns a word into an unsigned number.
  #a: number;
  #b: number;
  #c: number;
  #d: number;

  constructor(seed: number) {
    // Four consecutive SplitMix32 outputs become the sfc32 state. SplitMix is a counter (stepped by the
    // golden-ratio constant 0x9e3779b9) passed through a bijective mixer, so close seeds such as 1 and 2
    // still start from unrelated states.
    let counter = seed | 0;
    const splitmix32 = (): number => {
      counter = (counter + 0x9e3779b9) | 0;
      let t = counter ^ (counter >>> 16);
      t = Math.imul(t, 0x21f0aaad);
      t = t ^ (t >>> 15);
      t = Math.imul(t, 0x735a2d97);
      return (t ^ (t >>> 15)) | 0;
    };
    this.#a = splitmix32();
    this.#b = splitmix32();
    this.#c = splitmix32();
    this.#d = splitmix32();

    // sfc32 needs a few rounds before the words stop reflecting how they were filled; PractRand's own
    // seeding discards 12 outputs, so we do the same.
    for (let round = 0; round < 12; round++) this.nextUint32();
  }

  nextUint32(): number {
    // One sfc32 step ("Small Fast Counting", Chris Doty-Humphrey, PractRand). Every operation wraps at 32
    // bits through `| 0`, `<<` and `>>>`, so the result is the same in every JavaScript engine.
    const t = (((this.#a + this.#b) | 0) + this.#d) | 0;
    this.#d = (this.#d + 1) | 0; // the counter: it guarantees a period of at least 2^32
    this.#a = this.#b ^ (this.#b >>> 9);
    this.#b = (this.#c + (this.#c << 3)) | 0;
    this.#c = (((this.#c << 21) | (this.#c >>> 11)) + t) | 0;
    return t >>> 0;
  }

  nextInt(maxExclusive: number): number {
    assertIntegerBetween(maxExclusive, 1, TWO_POW_32, 'maxExclusive');

    // 2^32 mod n, the size of the short stretch at the top of the range that would make some results more
    // likely than others. `(-n) >>> 0` is 2^32 - n, which has the same remainder as 2^32 and fits in 32
    // bits; for n = 2^32 it is 0, so nothing is ever rejected and the draw is returned as it is.
    const biasedBelow = (-maxExclusive >>> 0) % maxExclusive;

    // Draws below `biasedBelow` are skipped: what is left, 2^32 - biasedBelow values, is an exact multiple
    // of n, so `draw % n` then hits every result equally often. More than half of all draws are kept, so
    // this loop ends after two draws on average.
    let draw = this.nextUint32();
    while (draw < biasedBelow) draw = this.nextUint32();
    return draw % maxExclusive;
  }
}

/**
 * Creates a random number generator that always produces the same sequence for the same seed.
 *
 * @remarks
 * The algorithm is sfc32 (Chris Doty-Humphrey's "Small Fast Counting" generator from the PractRand test
 * suite), with its four 32-bit state words taken from a 32-bit SplitMix of the seed and its first 12
 * outputs discarded. The SplitMix used here is a MurmurHash3 `fmix32`-style finalizer with improved
 * constants, stepped by a Weyl sequence, as collected by bryc in "PRNGs in JavaScript"; it is not the
 * 64-bit SplitMix of the Java library.
 *
 * Why only integer arithmetic: floating-point results can differ between engines and compilers, and a
 * floating-point state would make a board depend on the machine that generated it. Everything here is
 * `Math.imul`, shifts, xor and `| 0` or `>>> 0` on 32-bit values, which the language defines exactly.
 * Nothing in the state is a floating-point number, and no clock or `Math.random` is read.
 *
 * The sequence for a seed is a stable contract. Boards (M2-T02), replays and ghosts are all derived from
 * it, so changing a single constant or the warm-up would silently invalidate every stored replay. The
 * committed vectors in `fixtures/prng-vectors.json` pin it; a change needs a new generator version and an
 * ADR (ADR-002).
 *
 * @param seed - A whole number from 0 to 4294967295 (an unsigned 32-bit integer). `-0` counts as 0.
 * @returns A new generator. Generators never share state, so drawing from one never moves another.
 * @throws `RangeError` if `seed` is not a whole number from 0 to 4294967295; the message starts with `seed`.
 *
 * @example
 * ```ts
 * const a = createPrng(42);
 * const b = createPrng(42);
 * a.nextUint32() === b.nextUint32(); // true: same seed, same sequence
 * createPrng(4294967296); // throws RangeError: the seed does not fit in 32 bits
 * ```
 */
export function createPrng(seed: number): Prng {
  assertIntegerBetween(seed, 0, UINT32_MAX, 'seed');
  return new Sfc32Prng(seed);
}
