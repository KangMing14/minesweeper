import { describe, expect, it } from "vitest";
import { FixedMinePlacer } from "../generation/FixedMinePlacer";
import { BoardGenerator } from "../generation/BoardGenerator";

const generator = new BoardGenerator();
const mineCount = (g: ReturnType<BoardGenerator["generate"]>): number =>
  [...g.cells()].filter((c) => c.isMine).length;

describe("BoardGenerator", () => {
  it("same config gives an identical board", () => {
    const config = { width: 16, height: 16, mines: 40, seed: 2024 };
    expect(generator.generate(config).snapshot()).toEqual(
      generator.generate(config).snapshot(),
    );
  });

  it("different seeds give different boards", () => {
    const a = generator.generate({ width: 16, height: 16, mines: 40, seed: 1 });
    const b = generator.generate({ width: 16, height: 16, mines: 40, seed: 2 });
    expect(a.snapshot()).not.toEqual(b.snapshot());
  });

  it("places the exact mine count on an Expert-size board", () => {
    expect(
      mineCount(
        generator.generate({ width: 30, height: 16, mines: 99, seed: 7 }),
      ),
    ).toBe(99);
  });

  it("keeps excluded cells mine-free", () => {
    const config = { width: 9, height: 9, mines: 70, seed: 3 };
    const board = generator.generate(config, [{ x: 4, y: 4 }]);
    expect(board.getCell(4, 4)?.isMine).toBe(false);
    expect(mineCount(board)).toBe(70);
  });

  it("works with an injected FixedMinePlacer", () => {
    const fixed = new BoardGenerator(new FixedMinePlacer([{ x: 1, y: 0 }]));
    const board = fixed.generate({ width: 3, height: 3, mines: 1, seed: 1 });
    expect(board.getCell(1, 0)?.isMine).toBe(true);
    expect(mineCount(board)).toBe(1);
  });

  it("leaves every cell hidden", () => {
    const board = generator.generate({
      width: 9,
      height: 9,
      mines: 10,
      seed: 1,
    });
    expect([...board.cells()].every((c) => c.state === "hidden")).toBe(true);
  });
});
