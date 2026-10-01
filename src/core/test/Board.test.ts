import { describe, expect, it } from "vitest";
import { Board } from "../Board";

describe("Board", () => {
  it("creates width*height hidden cells", () => {
    const board = new Board(5, 3);
    expect(board.size).toBe(15);
    expect([...board.cells()].every((c) => c.state === "hidden")).toBe(true);
  });

  it("cells are independent objects", () => {
    const board = new Board(2, 2);
    board.getCell(0, 0)?.reveal();
    expect(board.getCell(1, 0)?.state).toBe("hidden");
  });

  it("maps (x, y) to index y * width + x", () => {
    const board = new Board(5, 3);
    board.getCell(2, 1)?.placeMine();
    expect(board.snapshot().cells[7]?.isMine).toBe(true);
  });

  it("returns undefined out of bounds, including row wrap-around", () => {
    const board = new Board(5, 3);
    expect(board.getCell(-1, 1)).toBeUndefined();
    expect(board.getCell(5, 0)).toBeUndefined();
    expect(board.getCell(0, 3)).toBeUndefined();
    expect(board.getCell(4, 2)).toBeDefined();
  });

  it("rejects invalid sizes", () => {
    expect(() => new Board(0, 5)).toThrow();
    expect(() => new Board(2.5, 5)).toThrow();
  });

  it("round-trips through a snapshot", () => {
    const board = new Board(4, 4);
    board.getCell(1, 2)?.placeMine();
    board.getCell(3, 3)?.reveal();
    expect(Board.fromSnapshot(board.snapshot()).snapshot()).toEqual(
      board.snapshot(),
    );
  });

  it("rejects a snapshot with the wrong cell count", () => {
    const snap = new Board(2, 2).snapshot();
    expect(() =>
      Board.fromSnapshot({ ...snap, cells: snap.cells.slice(1) }),
    ).toThrow();
  });
});
