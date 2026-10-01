import type { GameStatus } from "../types";
import { gameStateFromName, type GameStateBehavior } from "./GameStates";

export class GameStateMachine {
  #current: GameStateBehavior;

  constructor(initial: GameStatus = "ready") {
    this.#current = gameStateFromName(initial);
  }

  get current(): GameStateBehavior {
    return this.#current;
  }

  get status(): GameStatus {
    return this.#current.name;
  }

  canTransitionTo(next: GameStatus): boolean {
    return this.#current.allowedNext.includes(next);
  }

  transitionTo(next: GameStatus): void {
    if (!this.canTransitionTo(next)) {
      throw new Error(
        `Illegal game state transition: ${this.status} -> ${next}`,
      );
    }
    this.#current = gameStateFromName(next);
  }
}
