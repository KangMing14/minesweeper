import { describe, expect, it } from "vitest";
import { Mulberry32 } from "../rng/Mulberry32";

const take = (rng: Mulberry32, n: number): number[] =>
  Array.from({ length: n }, () => rng.next());

describe("Mulberry32", () => {
  it("same seed gives the same sequence", () => {
    expect(take(new Mulberry32(12345), 20)).toEqual(
      take(new Mulberry32(12345), 20),
    );
  });

  it("different seeds give different sequences", () => {
    expect(take(new Mulberry32(1), 5)).not.toEqual(take(new Mulberry32(2), 5));
  });

  it("next() stays in [0, 1)", () => {
    const rng = new Mulberry32(99);
    for (let i = 0; i < 10000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("nextInt stays in range and reaches every value", () => {
    const rng = new Mulberry32(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      seen.add(v);
    }
    expect(seen.size).toBe(10);
  });

  it("nextInt(1) is always 0", () => {
    const rng = new Mulberry32(3);
    for (let i = 0; i < 20; i++) expect(rng.nextInt(1)).toBe(0);
  });

  it("nextInt rejects bad bounds", () => {
    const rng = new Mulberry32(3);
    expect(() => rng.nextInt(0)).toThrow();
    expect(() => rng.nextInt(-5)).toThrow();
    expect(() => rng.nextInt(2.5)).toThrow();
  });

  it("treats the seed as unsigned 32-bit", () => {
    expect(take(new Mulberry32(-1), 5)).toEqual(
      take(new Mulberry32(4294967295), 5),
    );
  });

  it("rejects non-integer seeds", () => {
    expect(() => new Mulberry32(1.5)).toThrow();
  });
});
