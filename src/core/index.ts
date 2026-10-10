export const CORE_VERSION = "0.1.0";

export { Game } from "./Game";
export { ClassicMode } from "./modes/ClassicMode";
export type { GameMode } from "./modes/GameMode";
export type { Action } from "./actions";
export type {
  BoardSnapshot,
  CellSnapshot,
  CellState,
  CellView,
  GameConfig,
  GameSnapshot,
  GameStatus,
  Coordinate,
} from "./types";
export type { Unsubscribe } from "./Emitter";
export type { GameEvents, RevealedCell } from "./events";
export type { GameOptions } from "./Game";
