import type { Coordinate, GameStatus } from "./types";

/**
 * THE EVENT CONTRACT
 * 1. Public information only: no payload may reveal a hidden mine. Anyone who
 *    can see these events (an opponent, a spectator) learns only what a player
 *    at the board could see.
 * 2. Events are emitted AFTER the game has finished applying an action, so
 *    listeners always see a consistent game.
 * 3. Payloads are plain, readonly data (serializable). Never class instances.
 * 4. Listeners only observe. They must not mutate the game.
 */

export interface RevealedCell extends Coordinate {
  readonly adjacentMines: number;
}

export interface GameEvents {
  cellsRevealed: { readonly cells: readonly RevealedCell[] };
  cellFlagChanged: {
    readonly x: number;
    readonly y: number;
    readonly flagged: boolean;
  };
  statusChanged: { readonly from: GameStatus; readonly to: GameStatus };
  minesExposed: {
    readonly mines: readonly Coordinate[];
    readonly exploded: Coordinate | null;
  };
}
