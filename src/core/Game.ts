import { Board } from "./Board";
import { Emitter, type Unsubscribe } from "./Emitter";
import type { GameEvents } from "./events";
import { ClassicMode } from "./modes/ClassicMode";
import type { GameMode } from "./modes/GameMode";
import { GameStateMachine } from "./states/GameStateMachine";
import type { CellView, GameConfig, GameSnapshot, GameStatus } from "./types";

export interface GameOptions {
  readonly onListenerError?: (error: unknown) => void;
}

export class Game {
  readonly config: GameConfig;
  readonly mode: GameMode;
  #board: Board;
  #machine: GameStateMachine;
  #revealedCount = 0;
  #flagCount = 0;
  readonly #events: Emitter<GameEvents>;

  constructor(
    config: GameConfig,
    mode: GameMode = new ClassicMode(),
    options: GameOptions = {},
  ) {
    mode.validateConfig(config);
    this.config = { ...config };
    this.mode = mode;
    this.#board = new Board(config.width, config.height);
    this.#machine = new GameStateMachine();
    this.#events = new Emitter<GameEvents>(options.onListenerError);
  }

  get status(): GameStatus {
    return this.#machine.status;
  }
  get isFinished(): boolean {
    return this.#machine.current.isFinished;
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

  on<K extends keyof GameEvents>(
    event: K,
    listener: (payload: GameEvents[K]) => void,
  ): Unsubscribe {
    return this.#events.on(event, listener);
  }

  snapshot(): GameSnapshot {
    return {
      modeId: this.mode.id,
      config: { ...this.config },
      status: this.#machine.status,
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
    game.#machine = new GameStateMachine(snapshot.status);
    game.#revealedCount = snapshot.revealCnt;
    game.#flagCount = snapshot.flagCnt;
    return game;
  }
}
