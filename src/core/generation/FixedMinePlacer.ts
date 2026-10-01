import type { Coordinate } from "../types";
import type { MinePlacer, PlacementRequest } from "./MinePlacer";

export class FixedMinePlacer implements MinePlacer {
  constructor(private readonly positions: readonly Coordinate[]) {}

  choosePositions(req: PlacementRequest): Coordinate[] {
    if (this.positions.length !== req.mineCnt) {
      throw new Error(
        `Fixed layout has ${this.positions.length} mines, config wants ${req.mineCnt}`,
      );
    }
    for (const p of this.positions) {
      if (req.excluded.some((e) => e.x === p.x && e.y === p.y)) {
        throw new Error(
          `Fixed mine at (${p.x}, ${p.y}) is in an excluded cell`,
        );
      }
    }
    return this.positions.map((p) => ({ x: p.x, y: p.y }));
  }
}
