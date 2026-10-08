import { Cell } from "./Cell";
import type { BoardSnapshot, Coordinate } from "./types";
import { computeAdjacency } from "./adjacency";
import { neighborCoordinates } from "./geometry";

export class Board {
  readonly width: number;
  readonly height: number;
  readonly #cells: Cell[];

  constructor(width: number, height: number) {
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width < 1 ||
      height < 1
    ) {
      throw new Error(`Invalid board size: ${width}x${height}.`);
    }
    this.width = width;
    this.height = height;
    this.#cells = Array.from({ length: width * height }, () => new Cell());
  }

  get size(): number {
    return this.width * this.height;
  }

  inBound(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getCell(x: number, y: number): Cell | undefined {
    if (!this.inBound(x, y)) return undefined;
    return this.#cells[y * this.width + x];
  }

  *cells(): IterableIterator<Cell> {
    yield* this.#cells;
  }

  snapshot(): BoardSnapshot {
    return {
      width: this.width,
      height: this.height,
      cells: this.#cells.map((cell) => cell.snapshot()),
    };
  }

  static fromSnapshot(snapshot: BoardSnapshot): Board {
    const board = new Board(snapshot.width, snapshot.height);
    if (snapshot.cells.length !== board.size) {
      throw new Error(
        `Snapshot has ${snapshot.cells.length} cells, expected ${board.size}`,
      );
    }
    snapshot.cells.forEach((cellSnapshot, i) => {
      board.#cells[i] = Cell.fromSnapshot(cellSnapshot);
    });
    return board;
  }

  placeMines(positions: readonly Coordinate[]): void {
    const seen = new Set<number>();
    for (const { x, y } of positions) {
      const cell = this.getCell(x, y);
      if (cell === undefined) {
        throw new Error(`Mine position (${x}, ${y}) is outside the board`);
      }
      const index = y * this.width + x;
      if (cell.isMine || seen.has(index)) {
        throw new Error(`Duplicate mine at (${x}, ${y})`);
      }
      seen.add(index);
    }
    for (const { x, y } of positions) {
      this.getCell(x, y)?.placeMine();
    }
    this.#recomputeAdjacency();
  }

  neighborsOf(x: number, y: number): Coordinate[] {
    return neighborCoordinates(this.width, this.height, x, y);
  }

  #recomputeAdjacency(): void {
    const mines: Coordinate[] = [];
    this.#cells.forEach((cell, i) => {
      if (cell.isMine)
        mines.push({ x: i % this.width, y: Math.floor(i / this.width) });
    });
    const counts = computeAdjacency(this.width, this.height, mines);
    this.#cells.forEach((cell, i) => cell.setAdjacentMines(counts[i] ?? 0));
  }
}
