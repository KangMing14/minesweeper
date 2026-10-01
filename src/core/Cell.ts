import {
  cellStateFromName,
  HIDDEN,
  type CellStateBehavior,
} from "./states/CellStates";

import type { CellSnapshot, CellState, CellView } from "./types";

export class Cell implements CellView {
  #state: CellStateBehavior = HIDDEN;
  #isMine = false;
  #adjMine = 0;

  get state(): CellState {
    return this.#state.name;
  }
  get isMine(): boolean {
    return this.#isMine;
  }
  get adjMines(): number {
    return this.#adjMine;
  }

  placeMine(): void {
    if (this.state == "revealed") {
      throw new Error("Cannot place a mine on a revealed cell.");
    }
    this.#isMine = true;
  }
  setAdjacentMines(count: number): void {
    if (!Number.isInteger(count) || count < 0 || count > 8) {
      throw new Error(
        `Adjacent mine count must be an integer 0-8, got ${count}`,
      );
    }
    this.#adjMine = count;
  }

  reveal(): boolean {
    return this.#moveTo(this.#state.reveal());
  }
  toggleFlag(): boolean {
    return this.#moveTo(this.#state.toggleFlag());
  }

  #moveTo(next: CellStateBehavior): boolean {
    if (next === this.#state) return false;
    this.#state = next;
    return true;
  }

  snapshot(): CellSnapshot {
    return {
      state: this.#state.name,
      isMine: this.#isMine,
      adjMines: this.#adjMine,
    };
  }

  static fromSnapshot(snapshot: CellSnapshot): Cell {
    const cell = new Cell();
    cell.setAdjacentMines(snapshot.adjMines);
    cell.#state = cellStateFromName(snapshot.state);
    cell.#isMine = snapshot.isMine;
    return cell;
  }
}
