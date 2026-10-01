import { Board } from "../Board";
import { Mulberry32 } from "../rng/Mulberry32";
import type { Rng } from "../rng/Rng";
import type { Coordinate, GameConfig } from "../types";
import type { MinePlacer } from "./MinePlacer";
import { RandomMinePlacer } from "./RandomMinePlacer";

export class BoardGenerator {
  constructor(
    private readonly placer: MinePlacer = new RandomMinePlacer(),
    private readonly createRng: (seed: number) => Rng = (seed) =>
      new Mulberry32(seed),
  ) {}

  generate(config: GameConfig, excluded: readonly Coordinate[] = []): Board {
    const board = new Board(config.width, config.height);
    const positions = this.placer.choosePositions({
      width: config.width,
      height: config.height,
      mineCnt: config.mines,
      rng: this.createRng(config.seed),
      excluded,
    });
    board.placeMines(positions);
    return board;
  }
}
