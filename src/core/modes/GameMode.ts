import type { GameConfig } from "../types";

export interface GameMode {
  readonly id: string;
  validateConfig(config: GameConfig): void;
}
