import { describe, expect, it } from "vitest";
import { neighborCoordinates } from "../geometry";

describe("neighborCoordinates", () => {
  it("an interior cell has 8 distinct neighbors, never itself", () => {
    const n = neighborCoordinates(5, 5, 2, 2);
    expect(n).toHaveLength(8);
    expect(new Set(n.map((c) => `${c.x},${c.y}`)).size).toBe(8);
    expect(n.some((c) => c.x === 2 && c.y === 2)).toBe(false);
  });

  it("corners have 3, edges have 5", () => {
    expect(neighborCoordinates(5, 5, 0, 0)).toHaveLength(3);
    expect(neighborCoordinates(5, 5, 4, 4)).toHaveLength(3);
    expect(neighborCoordinates(5, 5, 2, 0)).toHaveLength(5);
    expect(neighborCoordinates(5, 5, 0, 3)).toHaveLength(5);
  });

  it("degenerate grids", () => {
    expect(neighborCoordinates(1, 1, 0, 0)).toHaveLength(0);
    expect(neighborCoordinates(1, 5, 0, 2)).toHaveLength(2);
    expect(neighborCoordinates(5, 1, 2, 0)).toHaveLength(2);
  });

  it("every neighbor is in bounds", () => {
    for (const c of neighborCoordinates(3, 3, 0, 0)) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThan(3);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThan(3);
    }
  });
});
