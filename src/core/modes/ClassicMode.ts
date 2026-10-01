import type { GameConfig } from "../types";
import type { GameMode } from "./GameMode";

export class ClassicMode implements GameMode {
  readonly id = "classic";

  validateConfig(config: GameConfig): void {
    const { width, height, mines, seed } = config;
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1
    ) {
      throw new Error(`Invalid board size: ${width}x${height}`);
    }
    if (!Number.isInteger(mines) || mines < 1) {
      throw new Error(`Mine count must be an integer >= 1, got ${mines}`);
    }
    if (mines > width * height - 1) {
      throw new Error(
        `Too many mines (${mines}) for a ${width}x${height} board`,
      );
    }
    if (!Number.isInteger(seed)) {
      throw new Error(`Seed must be an integer, got ${seed}`);
    }
  }
}
