import { describe, expect, it } from "vitest";
import { GameStateMachine } from "../states/GameStateMachine";

describe("GameStateMachine", () => {
  it("starts in ready and is not finished", () => {
    const fsm = new GameStateMachine();
    expect(fsm.status).toBe("ready");
    expect(fsm.current.isFinished).toBe(false);
  });

  it("allows ready -> playing -> won", () => {
    const fsm = new GameStateMachine();
    fsm.transitionTo("playing");
    fsm.transitionTo("won");
    expect(fsm.status).toBe("won");
    expect(fsm.current.isFinished).toBe(true);
  });

  it("allows playing -> lost", () => {
    const fsm = new GameStateMachine("playing");
    fsm.transitionTo("lost");
    expect(fsm.status).toBe("lost");
  });

  it("rejects skipping a state (ready -> won)", () => {
    const fsm = new GameStateMachine();
    expect(fsm.canTransitionTo("won")).toBe(false);
    expect(() => fsm.transitionTo("won")).toThrow();
    expect(fsm.status).toBe("ready"); // unchanged after the failed attempt
  });

  it("won and lost are terminal", () => {
    for (const end of ["won", "lost"] as const) {
      const fsm = new GameStateMachine("playing");
      fsm.transitionTo(end);
      expect(() => fsm.transitionTo("playing")).toThrow();
      expect(() => fsm.transitionTo("ready")).toThrow();
    }
  });

  it("rejects an unknown initial status", () => {
    expect(() => new GameStateMachine("boom" as never)).toThrow();
  });
});
