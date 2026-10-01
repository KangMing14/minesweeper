import { describe, expect, it } from "vitest";
import {
  cellStateFromName,
  FLAGGED,
  HIDDEN,
  REVEALED,
} from "../states/CellStates";

describe("cell state transitions", () => {
  it("hidden: reveal -> revealed, toggle -> flagged", () => {
    expect(HIDDEN.reveal()).toBe(REVEALED);
    expect(HIDDEN.toggleFlag()).toBe(FLAGGED);
  });

  it("flagged: reveal is blocked, toggle -> hidden", () => {
    expect(FLAGGED.reveal()).toBe(FLAGGED);
    expect(FLAGGED.toggleFlag()).toBe(HIDDEN);
  });

  it("revealed: nothing changes", () => {
    expect(REVEALED.reveal()).toBe(REVEALED);
    expect(REVEALED.toggleFlag()).toBe(REVEALED);
  });

  it("looks states up by name and returns the shared instance", () => {
    expect(cellStateFromName("hidden")).toBe(HIDDEN);
    expect(cellStateFromName("flagged").name).toBe("flagged");
  });

  it("rejects unknown names", () => {
    expect(() => cellStateFromName("boom")).toThrow();
    expect(() => cellStateFromName("toString")).toThrow(); // not a real state
  });
});
