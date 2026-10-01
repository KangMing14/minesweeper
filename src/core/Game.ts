import { Board } from "./Board";
import { ClassicMode } from "./modes/ClassicMode";
import type { GameMode } from "./modes/GameMode";
import type { CellView, GameConfig, GameSnapshot, GameStatus } from "./types";

export class Game {
  readonly config: GameConfig;
  readonly mode: GameMode;
  #board: Board;
  #status: GameStatus = "ready";
  #revealedCount = 0;
  #flagCount = 0;

  constructor(config: GameConfig, mode: GameMode = new ClassicMode()) {
    mode.validateConfig(config);
    this.config = { ...config };
    this.mode = mode;
    this.#board = new Board(config.width, config.height);
  }

  get status(): GameStatus {
    return this.#status;
  }
  get revealedCount(): number {
    return this.#revealedCount;
  }
  get flagCount(): number {
    return this.#flagCount;
  }
  get minesRemaining(): number {
    return this.config.mines - this.#flagCount;
  }

  getCell(x: number, y: number): CellView | undefined {
    return this.#board.getCell(x, y);
  }

  snapshot(): GameSnapshot {
    return {
      modeId: this.mode.id,
      config: { ...this.config },
      status: this.#status,
      revealCnt: this.#revealedCount,
      flagCnt: this.#flagCount,
      board: this.#board.snapshot(),
    };
  }

  static fromSnapshot(
    snapshot: GameSnapshot,
    mode: GameMode = new ClassicMode(),
  ): Game {
    if (snapshot.modeId !== mode.id) {
      throw new Error(
        `Snapshot is for mode "${snapshot.modeId}", got "${mode.id}"`,
      );
    }
    const board = Board.fromSnapshot(snapshot.board);
    if (
      board.width !== snapshot.config.width ||
      board.height !== snapshot.config.height
    ) {
      throw new Error("Snapshot board size does not match its config");
    }
    const game = new Game(snapshot.config, mode);
    game.#board = board;
    game.#status = snapshot.status;
    game.#revealedCount = snapshot.revealCnt;
    game.#flagCount = snapshot.flagCnt;
    return game;
  }
}
