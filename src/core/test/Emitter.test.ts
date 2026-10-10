import { describe, expect, it } from "vitest";
import { Emitter } from "../Emitter";

interface TestEvents {
  ping: { readonly n: number };
  pong: { readonly s: string };
}

describe("Emitter", () => {
  it("delivers the payload to subscribers of that event only", () => {
    const emitter = new Emitter<TestEvents>();
    const pings: number[] = [];
    const pongs: string[] = [];
    emitter.on("ping", (p) => pings.push(p.n));
    emitter.on("pong", (p) => pongs.push(p.s));
    emitter.emit("ping", { n: 1 });
    expect(pings).toEqual([1]);
    expect(pongs).toEqual([]);
  });

  it("calls listeners in subscription order", () => {
    const emitter = new Emitter<TestEvents>();
    const order: string[] = [];
    emitter.on("ping", () => order.push("a"));
    emitter.on("ping", () => order.push("b"));
    emitter.emit("ping", { n: 0 });
    expect(order).toEqual(["a", "b"]);
  });

  it("stops delivering after unsubscribe, and unsubscribing twice is harmless", () => {
    const emitter = new Emitter<TestEvents>();
    let calls = 0;
    const off = emitter.on("ping", () => calls++);
    emitter.emit("ping", { n: 0 });
    off();
    off();
    emitter.emit("ping", { n: 0 });
    expect(calls).toBe(1);
    expect(emitter.listenerCount("ping")).toBe(0);
  });

  it("allows the same function twice; unsubscribing one keeps the other", () => {
    const emitter = new Emitter<TestEvents>();
    let calls = 0;
    const listener = (): void => {
      calls++;
    };
    const offFirst = emitter.on("ping", listener);
    emitter.on("ping", listener);
    emitter.emit("ping", { n: 0 });
    expect(calls).toBe(2);
    offFirst();
    emitter.emit("ping", { n: 0 });
    expect(calls).toBe(3);
  });

  it("skips a listener that an earlier listener unsubscribed during the emit", () => {
    const emitter = new Emitter<TestEvents>();
    const calls: string[] = [];
    let offSecond: () => void = () => {};
    emitter.on("ping", () => {
      calls.push("first");
      offSecond();
    });
    offSecond = emitter.on("ping", () => calls.push("second"));
    emitter.emit("ping", { n: 0 });
    expect(calls).toEqual(["first"]);
  });

  it("does not call a listener added during the same emit", () => {
    const emitter = new Emitter<TestEvents>();
    const calls: string[] = [];
    emitter.on("ping", () => {
      calls.push("first");
      emitter.on("ping", () => calls.push("late"));
    });
    emitter.emit("ping", { n: 0 });
    expect(calls).toEqual(["first"]);
  });

  it("isolates a throwing listener and reports the error", () => {
    const errors: unknown[] = [];
    const emitter = new Emitter<TestEvents>((e) => errors.push(e));
    let reached = false;
    emitter.on("ping", () => {
      throw new Error("boom");
    });
    emitter.on("ping", () => {
      reached = true;
    });
    emitter.emit("ping", { n: 0 });
    expect(reached).toBe(true);
    expect(errors).toHaveLength(1);
  });

  it("emitting with no listeners does nothing", () => {
    expect(() =>
      new Emitter<TestEvents>().emit("pong", { s: "x" }),
    ).not.toThrow();
  });
});
