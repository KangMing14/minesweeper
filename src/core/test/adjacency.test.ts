import { describe, expect, it } from "vitest";
import { computeAdjacency } from "../adjacency";
import { RandomMinePlacer } from "../generation/RandomMinePlacer";
import { Mulberry32 } from "../rng/Mulberry32";
import { parseLayout, renderCounts } from "./tools/ascii";
import { referenceAdjacency } from "./tools/reference";

const cases = [
  {
    name: "single mine in the middle",
    rows: ["...", ".*.", "..."],
    expected: ["111", "1*1", "111"],
  },
  {
    name: "mines in opposite corners",
    rows: ["*..", "...", "..*"],
    expected: ["*1.", "121", ".1*"],
  },
  {
    name: "a fully surrounded cell sees 8",
    rows: ["***", "*.*", "***"],
    expected: ["***", "*8*", "***"],
  },
  {
    name: "a corner cell sees only 3 neighbors",
    rows: [".*.", "**.", "..."],
    expected: ["3*2", "**2", "221"],
  },
  {
    name: "a top-edge cell sees only 5 neighbors",
    rows: [".....", ".***.", "....."],
    expected: ["12321", "1***1", "12321"],
  },
  { name: "a single row", rows: ["..*.."], expected: [".1*1."] },
  { name: "a single column", rows: [".", "*", "."], expected: ["1", "*", "1"] },
  {
    name: "no mines at all",
    rows: ["....", "...."],
    expected: ["....", "...."],
  },
];

describe("computeAdjacency", () => {
  it.each(cases)("$name", ({ rows, expected }) => {
    const layout = parseLayout(rows);
    const counts = computeAdjacency(layout.width, layout.height, layout.mines);
    expect(renderCounts(layout, counts)).toEqual(expected);
  });

  it("rejects duplicate mines", () => {
    expect(() =>
      computeAdjacency(3, 3, [
        { x: 1, y: 1 },
        { x: 1, y: 1 },
      ]),
    ).toThrow();
  });

  it("rejects out-of-bounds and non-integer mines", () => {
    expect(() => computeAdjacency(3, 3, [{ x: 3, y: 0 }])).toThrow();
    expect(() => computeAdjacency(3, 3, [{ x: -1, y: 0 }])).toThrow();
    expect(() => computeAdjacency(3, 3, [{ x: 1.5, y: 0 }])).toThrow();
  });

  it("rejects invalid sizes", () => {
    expect(() => computeAdjacency(0, 3, [])).toThrow();
  });

  it("agrees with an independent brute-force implementation", () => {
    const sizes = [
      [9, 9, 10],
      [16, 16, 40],
      [30, 16, 99],
      [1, 12, 3],
      [12, 1, 3],
      [2, 2, 3],
    ] as const;
    const placer = new RandomMinePlacer();
    for (const [width, height, mineCnt] of sizes) {
      for (let seed = 1; seed <= 20; seed++) {
        const mines = placer.choosePositions({
          width,
          height,
          mineCnt,
          rng: new Mulberry32(seed),
          excluded: [],
        });
        expect(computeAdjacency(width, height, mines)).toEqual(
          referenceAdjacency(width, height, mines),
        );
      }
    }
  });
});
