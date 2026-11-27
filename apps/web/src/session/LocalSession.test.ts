import {
  MAX_REPLAY_COMMANDS,
  SeededBoardGenerator,
  createGame,
  replay,
  validateReplayLog,
} from '@minesweeper/engine';
import type { BoardConfig, Clock, Command, GameEvent } from '@minesweeper/engine';
import { describe, expect, it } from 'vitest';
import { LocalSession } from './LocalSession.js';
import type { GameSession, PlayerAction } from './GameSession.js';

// M3-T02. The session is tested against a fake clock and a board whose mines the test can read: the test
// asks the same generator the session will use, so "the safe cells" and "a mine" are facts, not guesses.

const CONFIG: BoardConfig = { width: 6, height: 6, mineCount: 6 };
const SEED = 11;

/** A clock the test moves by hand. */
class FakeClock implements Clock {
  now: number;
  constructor(start: number) {
    this.now = start;
  }
  nowMs(): number {
    return this.now;
  }
}

/** The board the session will play on, read through the engine's public API. */
function boardFacts(
  config: BoardConfig,
  seed: number,
): { safe: number[]; mines: number[]; opening: number } {
  const { board, opening } = new SeededBoardGenerator().generate(config, seed);
  const safe: number[] = [];
  const mines: number[] = [];
  for (let i = 0; i < config.width * config.height; i += 1)
    (board.isMine(i) ? mines : safe).push(i);
  return { safe, mines, opening: opening[0] as number };
}

const FACTS = boardFacts(CONFIG, SEED);
const reveal = (index: number): PlayerAction => ({ type: 'reveal', index });
const flag = (index: number): PlayerAction => ({ type: 'flag', index });

function started(startMs = 10_000): {
  session: LocalSession;
  clock: FakeClock;
  events: GameEvent[];
} {
  const clock = new FakeClock(startMs);
  const session = new LocalSession(CONFIG, SEED, clock);
  const events: GameEvent[] = [];
  session.subscribe((event) => events.push(event));
  session.start();
  return { session, clock, events };
}

/** A hidden safe cell, so that a reveal on it takes effect. */
function hiddenSafeCell(session: GameSession): number {
  const cells = session.view().cells;
  const found = FACTS.safe.find((index) => cells[index]?.state === 'hidden');
  if (found === undefined) throw new Error('test setup: no hidden safe cell left');
  return found;
}

describe('LocalSession: start and view', () => {
  it('creates the game at start(): same opening as createGame, status ready', () => {
    const { session } = started();
    const expected = createGame(CONFIG, SEED).view();
    expect(session.view()).toEqual(expected);
    expect(session.view().status).toBe('ready');
    expect(session.view().revealedCount).toBeGreaterThan(0);
  });

  it('has no view before start(): asking for one is a programming error', () => {
    const session = new LocalSession(CONFIG, SEED, new FakeClock(0));
    expect(() => session.view()).toThrow(Error);
  });

  it('reports no time, no result and not stuck before start()', () => {
    const session = new LocalSession(CONFIG, SEED, new FakeClock(500));
    expect(session.elapsedMs()).toBe(0);
    expect(session.result()).toBeUndefined();
    expect(session.isStuck()).toBe(false);
  });

  it('ignores a second start(): the game and t0 stay as they were', () => {
    const { session, clock } = started(1_000);
    clock.now = 1_400;
    session.dispatch(flag(FACTS.mines[0] as number));
    const before = session.view();
    clock.now = 9_000;
    session.start();
    expect(session.view()).toEqual(before);
    expect(session.elapsedMs()).toBe(8_000); // still measured from the first start, 1_000
  });

  it('throws the engine error for a bad config or seed and stays not started', () => {
    const badConfig = new LocalSession(
      { width: 0, height: 5, mineCount: 1 },
      SEED,
      new FakeClock(0),
    );
    expect(() => badConfig.start()).toThrow(/width/);
    expect(() => badConfig.view()).toThrow(Error);
    const badSeed = new LocalSession(CONFIG, -1, new FakeClock(0));
    expect(() => badSeed.start()).toThrow(RangeError);
    expect(badSeed.elapsedMs()).toBe(0);
  });
});

describe('LocalSession: dispatch', () => {
  it('ignores dispatch before start()', () => {
    const clock = new FakeClock(0);
    const session = new LocalSession(CONFIG, SEED, clock);
    const events: GameEvent[] = [];
    session.subscribe((event) => events.push(event));
    session.dispatch(reveal(FACTS.safe[0] as number));
    session.start();
    expect(events).toEqual([]);
    expect(session.view().status).toBe('ready');
  });

  it('forwards exactly the events the engine produces, in order', () => {
    const { session, clock, events } = started(0);
    const twin = createGame(CONFIG, SEED);
    const expected: GameEvent[] = [];
    twin.subscribe((event) => expected.push(event));

    const script: [number, Command['type'], number][] = [
      [100, 'flag', FACTS.mines[0] as number],
      [250, 'reveal', hiddenSafeCell(session)],
      [250, 'flag', FACTS.mines[0] as number],
    ];
    for (const [t, type, index] of script) {
      clock.now = t;
      session.dispatch({ type, index });
      twin.apply({ type, index, t });
    }
    expect(events.length).toBeGreaterThan(0);
    expect(events).toEqual(expected);
    expect(session.view()).toEqual(twin.view());
  });

  it('stamps t as the rounded time since start()', () => {
    const { session, clock } = started(1_000);
    clock.now = 1_250.6; // 250.6 ms after t0 -> 251
    const mine = FACTS.mines[0] as number;
    session.dispatch(reveal(mine));
    expect(session.result()).toMatchObject({ outcome: 'lost', timeMs: 251 });
  });

  it('never stamps a t below the previous one when the clock goes backwards', () => {
    const { session, clock, events } = started(1_000);
    clock.now = 1_500;
    session.dispatch(flag(FACTS.mines[1] as number)); // t = 500
    clock.now = 1_200; // the clock stepped back
    session.dispatch(reveal(FACTS.mines[0] as number)); // would be 200; must be 500
    const lost = events.find((event) => event.type === 'gameLost');
    expect(lost).toMatchObject({ type: 'gameLost', t: 500 });
  });

  it('never stamps a negative t when the clock reads before t0', () => {
    const { session, clock } = started(1_000);
    clock.now = 400;
    session.dispatch(reveal(FACTS.mines[0] as number));
    expect(session.result()).toMatchObject({ outcome: 'lost', timeMs: 0 });
  });

  it('treats a clock that returns NaN or Infinity as "no time has passed"', () => {
    const { session, clock } = started(1_000);
    clock.now = 1_300;
    session.dispatch(flag(FACTS.mines[1] as number)); // t = 300
    clock.now = Number.NaN;
    session.dispatch(flag(FACTS.mines[1] as number)); // the flag comes off again; t stays 300, so it is accepted
    expect(session.view().flagCount).toBe(0);
    clock.now = Number.POSITIVE_INFINITY;
    session.dispatch(reveal(FACTS.mines[0] as number));
    expect(session.result()).toMatchObject({ outcome: 'lost', timeMs: 300 });
  });

  it('lets the engine RangeError for a bad index through, and the session stays usable', () => {
    const { session } = started();
    expect(() => session.dispatch(reveal(-1))).toThrow(RangeError);
    expect(() => session.dispatch(reveal(CONFIG.width * CONFIG.height))).toThrow(RangeError);
    session.dispatch(flag(FACTS.mines[0] as number));
    expect(session.view().flagCount).toBe(1);
  });

  it('plays a whole game to a win and records the time of the last command', () => {
    const { session, clock, events } = started(2_000);
    let step = 0;
    for (const index of FACTS.safe) {
      step += 10;
      clock.now = 2_000 + step;
      session.dispatch(reveal(index));
    }
    expect(session.view().status).toBe('won');
    const won = events.find((event) => event.type === 'gameWon');
    expect(won).toBeDefined();
    const result = session.result();
    expect(result).toMatchObject({ outcome: 'won' });
    // The last command that took effect finishes the game, so the result's time is that command's t.
    expect(result?.timeMs).toBe((won as { t: number }).t);
  });
});

describe('LocalSession: the end of a game', () => {
  function lost(): ReturnType<typeof started> {
    const setup = started(5_000);
    setup.clock.now = 5_700;
    setup.session.dispatch(reveal(FACTS.mines[0] as number));
    return setup;
  }

  it('ignores every dispatch once the game is over, even a bad index', () => {
    const { session, clock, events } = lost();
    const count = events.length;
    clock.now = 9_000;
    session.dispatch(reveal(hiddenSafeCell(session)));
    session.dispatch(reveal(-5));
    expect(events).toHaveLength(count);
    expect(session.result()).toMatchObject({ outcome: 'lost', timeMs: 700 });
  });

  it('freezes elapsedMs at the time of the finishing command', () => {
    const { session, clock } = lost();
    expect(session.elapsedMs()).toBe(700);
    clock.now = 60_000;
    expect(session.elapsedMs()).toBe(700);
  });

  it('shows a result of 0 time for a board that the opening already clears', () => {
    const clock = new FakeClock(3_000);
    const session = new LocalSession({ width: 1, height: 1, mineCount: 0 }, 5, clock);
    session.start();
    clock.now = 8_000;
    expect(session.view().status).toBe('won');
    expect(session.result()).toMatchObject({ outcome: 'won', timeMs: 0 });
    expect(session.elapsedMs()).toBe(0);
  });
});

describe('LocalSession: elapsedMs while playing', () => {
  it('measures from start() and follows the clock', () => {
    const { session, clock } = started(1_000);
    expect(session.elapsedMs()).toBe(0);
    clock.now = 1_499.4;
    expect(session.elapsedMs()).toBe(499);
    clock.now = 4_000;
    expect(session.elapsedMs()).toBe(3_000);
  });

  it('never goes below 0 or below the last stamped t if the clock steps back', () => {
    const { session, clock } = started(1_000);
    clock.now = 500;
    expect(session.elapsedMs()).toBe(0);
    clock.now = 1_800;
    session.dispatch(flag(FACTS.mines[0] as number)); // t = 800
    clock.now = 1_100;
    expect(session.elapsedMs()).toBe(800);
  });
});

describe('LocalSession: subscribe and dispose', () => {
  it('stops delivering to a listener that unsubscribed, and keeps the others', () => {
    const { session } = started();
    const heard: string[] = [];
    const off = session.subscribe((event) => heard.push(`a:${event.type}`));
    session.subscribe((event) => heard.push(`b:${event.type}`));
    session.dispatch(flag(FACTS.mines[0] as number));
    off();
    session.dispatch(flag(FACTS.mines[0] as number));
    expect(heard).toEqual(['a:flagToggled', 'b:flagToggled', 'b:flagToggled']);
  });

  it('delivers to every listener even if one throws, then rethrows the first error', () => {
    const { session } = started();
    const heard: string[] = [];
    session.subscribe(() => {
      throw new Error('first');
    });
    session.subscribe((event) => heard.push(event.type));
    session.subscribe(() => {
      throw new Error('second');
    });
    expect(() => session.dispatch(flag(FACTS.mines[0] as number))).toThrow('first');
    expect(heard).toEqual(['flagToggled']);
    expect(session.view().flagCount).toBe(1); // the game had already changed
  });

  it('lets a listener unsubscribe itself while it is being called', () => {
    const { session } = started();
    let calls = 0;
    const off = session.subscribe(() => {
      calls += 1;
      off();
    });
    session.dispatch(flag(FACTS.mines[0] as number));
    session.dispatch(flag(FACTS.mines[0] as number));
    expect(calls).toBe(1);
  });

  it('stops events after dispose() and ignores dispatch, start and subscribe', () => {
    const { session, events } = started();
    session.dispatch(flag(FACTS.mines[0] as number));
    const count = events.length;
    const viewBefore = session.view();
    session.dispose();
    session.dispatch(flag(FACTS.mines[1] as number));
    expect(events).toHaveLength(count);
    expect(session.view()).toEqual(viewBefore); // a disposed session still shows its last view
    session.start();
    const late: GameEvent[] = [];
    const off = session.subscribe((event) => late.push(event));
    session.dispatch(flag(FACTS.mines[1] as number));
    expect(late).toEqual([]);
    expect(() => off()).not.toThrow();
  });

  it('can be disposed twice, and before start()', () => {
    const session = new LocalSession(CONFIG, SEED, new FakeClock(0));
    session.dispose();
    expect(() => session.dispose()).not.toThrow();
    session.start();
    expect(() => session.view()).toThrow(Error); // a disposed session never started
  });

  it('freezes elapsedMs when disposed', () => {
    const { session, clock } = started(1_000);
    clock.now = 1_600;
    session.dispose();
    clock.now = 9_999;
    expect(session.elapsedMs()).toBe(600);
  });
});

describe('LocalSession: the command limit (M2-T07)', () => {
  /** Plays `count` flag toggles on one mine cell with the clock standing still. */
  function toggle(session: LocalSession, count: number): void {
    const index = FACTS.mines[0] as number;
    for (let i = 0; i < count; i += 1) session.dispatch(flag(index));
  }

  it('is not stuck one command before the limit, and is stuck at the limit', () => {
    const { session } = started();
    toggle(session, MAX_REPLAY_COMMANDS - 1);
    expect(session.isStuck()).toBe(false);
    toggle(session, 1);
    expect(session.isStuck()).toBe(true);
    expect(session.view().status).toBe('playing');
    expect(session.result()).toBeUndefined();
  });

  it('counts only commands that took effect, not no-ops', () => {
    const { session } = started();
    toggle(session, MAX_REPLAY_COMMANDS - 1);
    const revealedCell = FACTS.safe.find(
      (index) => session.view().cells[index]?.state === 'revealed',
    );
    for (let i = 0; i < 5; i += 1) session.dispatch(reveal(revealedCell as number)); // no-ops
    expect(session.isStuck()).toBe(false);
    toggle(session, 1);
    expect(session.isStuck()).toBe(true);
  });

  it('stops forwarding anything once stuck: no events, no retry, no throw, even for a bad index', () => {
    const { session, events } = started();
    toggle(session, MAX_REPLAY_COMMANDS);
    expect(events).toHaveLength(MAX_REPLAY_COMMANDS);
    session.dispatch(flag(FACTS.mines[0] as number));
    session.dispatch(reveal(hiddenSafeCell(session)));
    session.dispatch(reveal(-1));
    expect(events).toHaveLength(MAX_REPLAY_COMMANDS);
  });

  it('freezes elapsedMs when stuck, because the game can no longer change', () => {
    const { session, clock } = started(0);
    clock.now = 1_234;
    toggle(session, MAX_REPLAY_COMMANDS);
    clock.now = 99_999;
    expect(session.elapsedMs()).toBe(1_234);
  });

  it('is not stuck when the command that reaches the limit finishes the game', () => {
    const { session } = started();
    toggle(session, MAX_REPLAY_COMMANDS - 2); // an even count: the cell is unflagged again
    session.dispatch(flag(FACTS.mines[1] as number)); // command 99,999
    session.dispatch(reveal(FACTS.mines[0] as number)); // command 100,000: a mine, the game is lost
    expect(session.view().status).toBe('lost');
    expect(session.isStuck()).toBe(false);
    expect(session.result()).toMatchObject({
      outcome: 'lost',
      effectiveCommands: MAX_REPLAY_COMMANDS,
    });
  });
});

// M3-T06. The replay log of a finished game leaves the session through `replayLog()`, so that a screen can
// keep it (ghosts, M4). It exists only once the game has ended, and it plays back to the same game.
describe('LocalSession: replayLog', () => {
  /** Reveals every safe cell that is still hidden, which wins the game. */
  function winIt(session: LocalSession, clock: FakeClock): void {
    for (const index of FACTS.safe) {
      clock.now += 10;
      session.dispatch(reveal(index));
    }
  }

  it('is undefined before start(), while the game is ready and while it is playing', () => {
    const fresh = new LocalSession(CONFIG, SEED, new FakeClock(0));
    expect(fresh.replayLog()).toBeUndefined();
    const { session, clock } = started();
    expect(session.replayLog()).toBeUndefined();
    clock.now += 50;
    session.dispatch(reveal(hiddenSafeCell(session)));
    expect(session.view().status).toBe('playing');
    expect(session.replayLog()).toBeUndefined();
  });

  it('after a win holds version 1, the config, the seed and the commands that took effect', () => {
    const { session, clock } = started();
    winIt(session, clock);
    expect(session.view().status).toBe('won');
    const log = session.replayLog();
    if (log === undefined) throw new Error('no replay log after a win');
    expect(log.version).toBe(1);
    expect(log.config).toEqual(CONFIG);
    expect(log.seed).toBe(SEED);
    expect(log.commands.length).toBe(session.result()?.effectiveCommands);
    expect(() => validateReplayLog(log)).not.toThrow();
  });

  it('plays back to the same game: same view and same result record', () => {
    const { session, clock } = started();
    winIt(session, clock);
    const log = session.replayLog();
    if (log === undefined) throw new Error('no replay log after a win');
    const again = replay(log);
    expect(again.view()).toEqual(session.view());
    expect(again.result()).toEqual(session.result());
  });

  it('is there after a loss too, and leaves out a command the engine refused', () => {
    const { session, clock } = started();
    const safe = hiddenSafeCell(session);
    clock.now += 20;
    session.dispatch(reveal(safe));
    clock.now += 20;
    session.dispatch(reveal(safe)); // already revealed: no effect, not logged
    clock.now += 20;
    session.dispatch(reveal(FACTS.mines[0] as number));
    expect(session.view().status).toBe('lost');
    const log = session.replayLog();
    if (log === undefined) throw new Error('no replay log after a loss');
    expect(log.commands.map((c) => c.index)).toEqual([safe, FACTS.mines[0]]);
    expect(replay(log).view()).toEqual(session.view());
  });

  it('exists at once for a board that the opening clears at creation, with no commands', () => {
    const session = new LocalSession({ width: 1, height: 1, mineCount: 0 }, 3, new FakeClock(0));
    session.start();
    expect(session.view().status).toBe('won');
    const log = session.replayLog();
    expect(log?.commands).toEqual([]);
    if (log === undefined) throw new Error('no replay log');
    expect(replay(log).result()).toEqual(session.result());
  });

  it('is already there for a subscriber that reads it on the event that wins the game', () => {
    const { session, clock } = started();
    const seen: (number | undefined)[] = [];
    session.subscribe(() => {
      seen.push(session.replayLog()?.commands.length);
    });
    winIt(session, clock);
    // The winning command announces cellsRevealed and then gameWon: both must already see the log.
    expect(seen.at(-1)).toBeDefined();
    expect(seen.at(-2)).toBeDefined();
    expect(seen.at(-1)).toBe(seen.at(-2));
  });

  it('is a plain copy: changing the config it returned does not change the session or the next log', () => {
    const { session, clock } = started();
    winIt(session, clock);
    const first = session.replayLog();
    const second = session.replayLog();
    expect(second).toEqual(first);
    expect(second?.config).not.toBe(CONFIG);
  });

  it('is still there after dispose()', () => {
    const { session, clock } = started();
    winIt(session, clock);
    session.dispose();
    expect(session.replayLog()?.commands.length).toBeGreaterThan(0);
  });
});
