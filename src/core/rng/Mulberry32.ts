import type { Rng } from "./Rng";

export class Mulberry32 implements Rng {
  constructor(private state: number) {
    if (!Number.isInteger(state)) {
      throw new Error(`Seed must be an integer, got ${state}`);
    }
    this.state = state >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // 2^32
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
      throw new Error(
        `maxExclusive must be an integer >= 1, got ${maxExclusive}.`,
      );
    }
    return Math.floor(this.next() * maxExclusive);
  }
}
