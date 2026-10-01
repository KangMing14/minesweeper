import type { Coordinate } from "../types";
import type { MinePlacer, PlacementRequest } from "./MinePlacer";

export class RandomMinePlacer implements MinePlacer {
  choosePositions(req: PlacementRequest): Coordinate[] {
    const { width, height, mineCnt, rng, excluded } = req;

    const blocked = new Set<number>();
    for (const c of excluded) {
      if (c.x >= 0 && c.x < width && c.y >= 0 && c.y < height) {
        blocked.add(c.y * width + c.x);
      }
    }

    const candidates: number[] = [];
    for (let i = 0; i < width * height; i++) {
      if (!blocked.has(i)) candidates.push(i);
    }
    if (mineCnt > candidates.length) {
      throw new Error(
        `Cannot place ${mineCnt} mines: only ${candidates.length} cells are available`,
      );
    }

    for (let i = 0; i < mineCnt; i++) {
      const j = i + rng.nextInt(candidates.length - i);
      const a = candidates[i];
      const b = candidates[j];
      if (a === undefined || b === undefined) throw new Error("unreachable");
      candidates[i] = b;
      candidates[j] = a;
    }

    return candidates.slice(0, mineCnt).map((index) => ({
      x: index % width,
      y: Math.floor(index / width),
    }));
  }
}
