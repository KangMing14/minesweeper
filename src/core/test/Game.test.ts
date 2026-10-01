import { describe, expect, it } from "vitest";
import { Game } from "../Game";
import type { GameMode } from "../modes/GameMode";

const config = { width: 9, height: 9, mines: 10, seed: 1 };

describe("Game", () => {
  it("starts ready with zeroed counters", () => {
    const game = new Game(config);
    expect(game.status).toBe("ready");
    expect(game.revealedCount).toBe(0);
    expect(game.flagCount).toBe(0);
    expect(game.minesRemaining).toBe(10);
  });

  it("rejects an invalid config through its mode", () => {
    expect(
      () => new Game({ width: 3, height: 3, mines: 9, seed: 1 }),
    ).toThrow();
  });

  it("returns undefined for cells outside the board", () => {
    const game = new Game(config);
    expect(game.getCell(-1, 0)).toBeUndefined();
    expect(game.getCell(9, 0)).toBeUndefined();
    expect(game.getCell(0, 9)).toBeUndefined();
  });

  it("keeps its own copy of the config", () => {
    const mutable = { ...config };
    const game = new Game(mutable);
    mutable.width = 99;
    expect(game.config.width).toBe(9);
  });

  it("survives a JSON round trip of its snapshot", () => {
    const snapshot = new Game(config).snapshot();
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("restores from a snapshot", () => {
    const original = new Game(config);
    const restored = Game.fromSnapshot(
      JSON.parse(JSON.stringify(original.snapshot())),
    );
    expect(restored.snapshot()).toEqual(original.snapshot());
  });

  it("refuses a snapshot from a different mode", () => {
    const otherMode: GameMode = { id: "race", validateConfig: () => {} };
    const snapshot = new Game(config).snapshot();
    expect(() => Game.fromSnapshot(snapshot, otherMode)).toThrow();
  });
});
