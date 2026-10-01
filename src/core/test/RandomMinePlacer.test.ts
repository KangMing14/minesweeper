import { describe, expect, it } from "vitest";
import { Mulberry32 } from "../rng/Mulberry32";
import type { Coordinate } from "../types";
import { RandomMinePlacer } from "../generation/RandomMinePlacer";

const placer = new RandomMinePlacer();
const key = (c: Coordinate): string => `${c.x},${c.y}`;

function choose(
  seed: number,
  width: number,
  height: number,
  mineCnt: number,
  excluded: Coordinate[] = [],
): Coordinate[] {
  return placer.choosePositions({
    width,
    height,
    mineCnt,
    rng: new Mulberry32(seed),
    excluded,
  });
}

describe("RandomMinePlacer", () => {
  it("returns exactly mineCount distinct, in-bounds positions", () => {
    const positions = choose(1, 9, 9, 10);
    expect(positions).toHaveLength(10);
    expect(new Set(positions.map(key)).size).toBe(10);
    for (const p of positions) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(9);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(9);
    }
  });

  it("is deterministic for the same seed", () => {
    expect(choose(42, 16, 16, 40)).toEqual(choose(42, 16, 16, 40));
  });

  it("differs between seeds", () => {
    expect(choose(1, 16, 16, 40)).not.toEqual(choose(2, 16, 16, 40));
  });

  it("never uses excluded cells", () => {
    const excluded: Coordinate[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) excluded.push({ x: 4 + dx, y: 4 + dy });
    }
    const blocked = new Set(excluded.map(key));
    for (let seed = 1; seed <= 200; seed++) {
      for (const p of choose(seed, 9, 9, 10, excluded)) {
        expect(blocked.has(key(p))).toBe(false);
      }
    }
  });

  it("can fill every available cell", () => {
    const positions = choose(5, 3, 3, 8, [{ x: 1, y: 1 }]);
    expect(positions).toHaveLength(8);
    expect(positions.map(key)).not.toContain("1,1");
  });

  it("throws when there is no room", () => {
    expect(() => choose(1, 3, 3, 9, [{ x: 0, y: 0 }])).toThrow();
  });

  it("ignores out-of-bounds excluded cells", () => {
    expect(() => choose(1, 3, 3, 9, [{ x: -1, y: -1 }])).not.toThrow();
  });

  it("can pick every cell eventually (rough coverage check)", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 500; seed++) {
      for (const p of choose(seed, 3, 3, 1)) seen.add(key(p));
    }
    expect(seen.size).toBe(9);
  });
});
