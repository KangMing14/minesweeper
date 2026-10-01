import { describe, expect, it } from "vitest";
import { Cell } from "../Cell";

describe("Cell", () => {
  it("starts hidden and safe", () => {
    const cell = new Cell();
    expect(cell.state).toBe("hidden");
    expect(cell.isMine).toBe(false);
    expect(cell.adjMines).toBe(0);
  });

  it("reveal changes a hidden cell once", () => {
    const cell = new Cell();
    expect(cell.reveal()).toBe(true);
    expect(cell.reveal()).toBe(false);
    expect(cell.state).toBe("revealed");
  });

  it("a flagged cell cannot be revealed", () => {
    const cell = new Cell();
    cell.toggleFlag();
    expect(cell.reveal()).toBe(false);
    expect(cell.state).toBe("flagged");
  });

  it("toggles flag on and off, but never on a revealed cell", () => {
    const cell = new Cell();
    expect(cell.toggleFlag()).toBe(true);
    expect(cell.state).toBe("flagged");
    expect(cell.toggleFlag()).toBe(true);
    expect(cell.state).toBe("hidden");
    cell.reveal();
    expect(cell.toggleFlag()).toBe(false);
    expect(cell.state).toBe("revealed");
  });

  it("rejects invalid adjacent counts", () => {
    const cell = new Cell();
    expect(() => cell.setAdjacentMines(9)).toThrow();
    expect(() => cell.setAdjacentMines(-1)).toThrow();
    expect(() => cell.setAdjacentMines(1.5)).toThrow();
  });

  it("cannot place a mine on a revealed cell", () => {
    const cell = new Cell();
    cell.reveal();
    expect(() => cell.placeMine()).toThrow();
  });

  it("round-trips through a snapshot", () => {
    const cell = new Cell();
    cell.placeMine();
    cell.toggleFlag();
    expect(Cell.fromSnapshot(cell.snapshot()).snapshot()).toEqual(
      cell.snapshot(),
    );
  });

  it("serializing the class itself yields nothing useful (#private)", () => {
    expect(JSON.stringify(new Cell())).toBe("{}");
  });
});
