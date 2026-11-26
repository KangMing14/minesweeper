// Test kit for M3-T05: a hand-moved clock, the facts about a seeded board, a canvas that has a 2D context,
// and a session whose "stuck" flag can be set. Used by the screen tests only.
import { SeededBoardGenerator } from '@minesweeper/engine';
import type { BoardConfig, Clock } from '@minesweeper/engine';
import { vi } from 'vitest';
import { LocalSession } from '../src/session/LocalSession.js';
import { FakeContext2D } from './fakeCanvas.js';

/** A clock that only moves when the test says so. */
export class FakeClock implements Clock {
  now = 1000;
  nowMs(): number {
    return this.now;
  }
  advance(ms: number): void {
    this.now += ms;
  }
}

/** The safe cells and the mines of a board, from the same generator the session uses. */
export function boardFacts(
  config: BoardConfig,
  seed: number,
): { safe: number[]; mines: number[]; opening: readonly number[] } {
  const { board, opening } = new SeededBoardGenerator().generate(config, seed);
  const safe: number[] = [];
  const mines: number[] = [];
  for (let i = 0; i < config.width * config.height; i += 1)
    (board.isMine(i) ? mines : safe).push(i);
  return { safe, mines, opening };
}

/** Gives every canvas a recording 2D context for the test, so the real renderer can run in jsdom. */
export function stubCanvasContext(): FakeContext2D {
  const ctx = new FakeContext2D();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  return ctx;
}

/** A `LocalSession` that can be told it is stuck, and that counts how it is used. */
export class TestSession extends LocalSession {
  stuck = false;
  disposed = 0;
  override isStuck(): boolean {
    return this.stuck || super.isStuck();
  }
  override dispose(): void {
    this.disposed += 1;
    super.dispose();
  }
}

/** A session factory that remembers every session it made. */
export function sessionFactory(clock: Clock = new FakeClock()): {
  create: (config: BoardConfig, seed: number) => TestSession;
  made: TestSession[];
  live: () => TestSession[];
} {
  const made: TestSession[] = [];
  return {
    create: (config, seed) => {
      const session = new TestSession(config, seed, clock);
      made.push(session);
      return session;
    },
    made,
    live: () => made.filter((s) => s.disposed === 0),
  };
}

/**
 * Counts the intervals that are set and not yet cleared. Call it after `vi.useFakeTimers()`. React keeps a
 * timer of its own under fake timers, so `vi.getTimerCount()` cannot tell whether a component left one behind.
 */
export function trackIntervals(): { live: () => number; restore: () => void } {
  const set = globalThis.setInterval;
  const clear = globalThis.clearInterval;
  const open = new Set<unknown>();
  globalThis.setInterval = ((handler: () => void, ms?: number) => {
    const id = set(handler, ms);
    open.add(id);
    return id;
  }) as typeof setInterval;
  globalThis.clearInterval = ((id?: Parameters<typeof clearInterval>[0]) => {
    open.delete(id);
    clear(id);
  }) as typeof clearInterval;
  return {
    live: () => open.size,
    restore: () => {
      globalThis.setInterval = set;
      globalThis.clearInterval = clear;
    },
  };
}
