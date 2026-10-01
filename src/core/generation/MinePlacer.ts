import type { Coordinate } from "../types";
import type { Rng } from "../rng/Rng";

export interface PlacementRequest {
  readonly width: number;
  readonly height: number;
  readonly mineCnt: number;
  readonly rng: Rng;

  readonly excluded: readonly Coordinate[];
}

export interface MinePlacer {
  choosePositions(req: PlacementRequest): Coordinate[];
}
