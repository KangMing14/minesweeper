import { describe, expect, it } from "vitest";
import { Mulberry32 } from "../rng/Mulberry32";
import { FixedMinePlacer } from "../generation/FixedMinePlacer";

const request = (
  mineCnt: number,
  excluded: { x: number; y: number }[] = [],
) => ({
  width: 3,
  height: 3,
  mineCnt,
  rng: new Mulberry32(1),
  excluded,
});

describe("FixedMinePlacer", () => {
  it("returns the layout it was given", () => {
    const placer = new FixedMinePlacer([
      { x: 0, y: 0 },
      { x: 2, y: 1 },
    ]);
    expect(placer.choosePositions(request(2))).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 1 },
    ]);
  });

  it("rejects a count mismatch", () => {
    expect(() =>
      new FixedMinePlacer([{ x: 0, y: 0 }]).choosePositions(request(2)),
    ).toThrow();
  });

  it("rejects a mine on an excluded cell", () => {
    const placer = new FixedMinePlacer([{ x: 1, y: 1 }]);
    expect(() =>
      placer.choosePositions(request(1, [{ x: 1, y: 1 }])),
    ).toThrow();
  });
});
