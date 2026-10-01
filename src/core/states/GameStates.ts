import type { GameStatus } from "../types";

export interface GameStateBehavior {
  readonly name: GameStatus;
  readonly allowedNext: readonly GameStatus[];
  readonly isFinished: boolean;
}

class ReadyState implements GameStateBehavior {
  readonly name: GameStatus = "ready";
  readonly allowedNext: readonly GameStatus[] = ["playing"];
  readonly isFinished = false;
}

class PlayingState implements GameStateBehavior {
  readonly name: GameStatus = "playing";
  readonly allowedNext: readonly GameStatus[] = ["won", "lost"];
  readonly isFinished = false;
}

class WonState implements GameStateBehavior {
  readonly name: GameStatus = "won";
  readonly allowedNext: readonly GameStatus[] = [];
  readonly isFinished = true;
}

class LostState implements GameStateBehavior {
  readonly name: GameStatus = "lost";
  readonly allowedNext: readonly GameStatus[] = [];
  readonly isFinished = true;
}

export const READY: GameStateBehavior = new ReadyState();
export const PLAYING: GameStateBehavior = new PlayingState();
export const WON: GameStateBehavior = new WonState();
export const LOST: GameStateBehavior = new LostState();

const BY_NAME: Record<GameStatus, GameStateBehavior> = {
  ready: READY,
  playing: PLAYING,
  won: WON,
  lost: LOST,
};

export function gameStateFromName(name: string): GameStateBehavior {
  if (!Object.hasOwn(BY_NAME, name)) {
    throw new Error(`Unknown game state "${name}"`);
  }
  return BY_NAME[name as GameStatus];
}
