export type GameStatus = "ready" | "playing" | "won" | "lost";
export type CellState = "hidden" | "revealed" | "flagged";

export interface GameConfig {
  readonly width: number;
  readonly height: number;
  readonly mines: number;

  readonly seed: number;
}

export interface CellView {
  readonly state: CellState;
  readonly isMine: boolean;
  readonly adjMines: number;
}

export type CellSnapshot = CellView;

export interface BoardSnapshot {
  readonly width: number;
  readonly height: number;

  readonly cells: readonly CellSnapshot[];
}

export interface GameSnapshot {
  readonly modeId: string;
  readonly config: GameConfig;
  readonly status: GameStatus;

  readonly revealCnt: number;
  readonly flagCnt: number;

  readonly board: BoardSnapshot;
}
