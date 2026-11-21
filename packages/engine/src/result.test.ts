import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Board } from './board.js';
import type { Command } from './command.js';
import { PRESETS, cellCount } from './config.js';
import type { BoardConfig } from './config.js';
import { createGame } from './create-game.js';
import { Game } from './game.js';
import { SeededBoardGenerator } from './generator.js';
import { replay } from './replay.js';
import type { ReplayLog } from './replay.js';
import { buildGameResult } from './result.js';
import type { GameResult } from './result.js';

// Results and scoring (M2-T05): `Game.result()` is `undefined` until the game ends, then one frozen record
// with the outcome, the time of the finishing command, how far the player got, how many commands took
// effect, and the board's 3BV with 3BV per second.

const UINT32_MAX = 4294967295;

const reveal = (index: number, t: number): Command => ({ type: 'reveal', index, t });
const flag = (index: number, t: number): Command => ({ type: 'flag', index, t });
const chord = (index: number, t: number): Command => ({ type: 'chord', index, t });

/** A 3x3 board with mines at 0 and 8; 7 safe cells, 3BV 2 (see `threebv.test.ts`). */
const diagonal = (): Board => new Board({ width: 3, height: 3, mineCount: 2 }, [0, 8]);

/** A 3x3 board with one mine in the middle; 8 safe cells, none a zero, so 3BV 8. */
const center = (): Board => new Board({ width: 3, height: 3, mineCount: 1 }, [4]);

/** The diagonal board with cell 2 already open, as `createGame` would start it (cells 1, 2, 4, 5 show). */
const diagonalOpened = (): Game => new Game(diagonal(), [2]);

describe('buildGameResult', () => {
  const parts = {
    outcome: 'won',
    timeMs: 30,
    safeCellsRevealed: 7,
    totalSafeCells: 7,
    effectiveCommands: 3,
    threeBV: 2,
  } as const;

  it('keeps the parts and adds 3BV per second', () => {
    expect(buildGameResult(parts)).toEqual({ ...parts, threeBVPerSecond: 2000 / 30 });
  });

  it('is frozen', () => {
    expect(Object.isFrozen(buildGameResult(parts))).toBe(true);
  });

  it('divides once, so the result is the correctly rounded quotient of whole numbers', () => {
    // 1 / (11 / 1000) gives 90.90909090909092 because the first division already rounds; 1000 / 11 does not.
    expect(buildGameResult({ ...parts, threeBV: 1, timeMs: 11 }).threeBVPerSecond).toBe(1000 / 11);
    expect(buildGameResult({ ...parts, threeBV: 1, timeMs: 11 }).threeBVPerSecond).not.toBe(
      1 / (11 / 1000),
    );
  });

  it('is 0, not Infinity or NaN, when the time is 0', () => {
    const result = buildGameResult({ ...parts, timeMs: 0 });
    expect(result.threeBVPerSecond).toBe(0);
    expect(Number.isFinite(result.threeBVPerSecond)).toBe(true);
  });

  it('is 0 for a 3BV of 0 at any time, without a negative zero', () => {
    expect(Object.is(buildGameResult({ ...parts, threeBV: 0 }).threeBVPerSecond, 0)).toBe(true);
    expect(
      Object.is(buildGameResult({ ...parts, threeBV: 0, timeMs: 0 }).threeBVPerSecond, 0),
    ).toBe(true);
  });
});

describe('Game.result: not before the end', () => {
  it('is undefined for a game that has not started', () => {
    expect(new Game(center()).result()).toBeUndefined();
    expect(diagonalOpened().result()).toBeUndefined();
    expect(createGame(PRESETS.beginner, 42).result()).toBeUndefined();
  });

  it('is undefined while the game is being played, even one cell from the end', () => {
    const game = diagonalOpened();
    game.apply(flag(0, 10));
    expect(game.result()).toBeUndefined();
    game.apply(chord(1, 20)); // opens 3; cells 6 and 7 are still closed
    expect(game.view().status).toBe('playing');
    expect(game.result()).toBeUndefined();
  });
});

describe('Game.result: a won game', () => {
  /** Flag the mine at 0, chord on 1 (opens 3), reveal 6 (a zero: cascades to 7, the last safe cell). */
  const won = (): Game => {
    const game = diagonalOpened();
    game.apply(flag(0, 10));
    game.apply(chord(1, 20));
    game.apply(reveal(6, 30));
    return game;
  };

  it('reports every field', () => {
    expect(won().result()).toEqual({
      outcome: 'won',
      timeMs: 30, // the t of the command that opened the last safe cell
      safeCellsRevealed: 7,
      totalSafeCells: 7,
      effectiveCommands: 3, // the flag, the chord and the reveal; the opening is not a command
      threeBV: 2,
      threeBVPerSecond: 2000 / 30,
    } satisfies GameResult);
  });

  it('has exactly these seven fields and nothing about where the mines are', () => {
    expect(Object.keys(won().result() as GameResult).sort()).toEqual([
      'effectiveCommands',
      'outcome',
      'safeCellsRevealed',
      'threeBV',
      'threeBVPerSecond',
      'timeMs',
      'totalSafeCells',
    ]);
  });

  it('is frozen, and every call gives the same record', () => {
    const game = won();
    const result = game.result() as GameResult;
    expect(Object.isFrozen(result)).toBe(true);
    expect(game.result()).toEqual(result);
    expect(game.result()).toBe(result);
  });

  it('does not change when later commands are refused', () => {
    const game = won();
    const before = game.result();
    expect(game.apply(reveal(3, 99))).toEqual([]);
    expect(game.apply(flag(0, 120))).toEqual([]);
    expect(game.result()).toEqual(before);
  });

  it('counts a flag put on and taken off again as two commands that took effect', () => {
    const game = diagonalOpened();
    game.apply(flag(3, 5));
    game.apply(flag(3, 6));
    game.apply(reveal(3, 7));
    game.apply(reveal(6, 8)); // a zero: opens 6 and 7, the last safe cells
    expect(game.result()).toMatchObject({ outcome: 'won', effectiveCommands: 4, timeMs: 8 });
  });

  it('does not count a command that changed nothing, or one that was refused', () => {
    const game = diagonalOpened();
    game.apply(reveal(1, 5)); // already open: changes nothing
    game.apply(reveal(3, 9)); // takes effect (shows 1); the last accepted t is now 9
    game.apply(reveal(6, 4)); // t is lower than 9: refused
    game.apply(reveal(6, 12)); // a zero: opens 6 and 7, the last safe cells
    expect(game.result()).toMatchObject({ outcome: 'won', effectiveCommands: 2, timeMs: 12 });
  });
});

describe('Game.result: a lost game', () => {
  it('reports how far the player got when they stepped on a mine', () => {
    const game = new Game(center());
    game.apply(reveal(0, 400)); // shows 1
    game.apply(reveal(4, 900)); // the mine
    expect(game.result()).toEqual({
      outcome: 'lost',
      timeMs: 900,
      safeCellsRevealed: 1,
      totalSafeCells: 8,
      effectiveCommands: 2,
      threeBV: 8,
      threeBVPerSecond: 8000 / 900,
    } satisfies GameResult);
  });

  it('counts the safe cells a losing chord opened before it reached the mines (D-02 progress)', () => {
    // Cells 3 and 7 are safe but flagged. The chord on 4 (shows 2, two flags) opens 6 (safe) and then hits the
    // mines 0 and 8. 1, 2, 4, 5 were open from the start, so the player has 5 of the 7 safe cells.
    const game = diagonalOpened();
    game.apply(flag(3, 10));
    game.apply(flag(7, 20));
    game.apply(chord(4, 30));
    expect(game.view().status).toBe('lost');
    expect(game.result()).toEqual({
      outcome: 'lost',
      timeMs: 30,
      safeCellsRevealed: 5,
      totalSafeCells: 7,
      effectiveCommands: 3,
      threeBV: 2,
      threeBVPerSecond: 2000 / 30,
    } satisfies GameResult);
  });

  it('can end on the very first command, at the time of that command', () => {
    const game = new Game(center());
    game.apply(reveal(4, 250));
    expect(game.result()).toMatchObject({
      outcome: 'lost',
      timeMs: 250,
      safeCellsRevealed: 0,
      effectiveCommands: 1,
    });
  });
});

describe('Game.result: time 0', () => {
  it('is a win at 0 ms with no commands when the opening already clears the board', () => {
    const game = createGame({ width: 1, height: 1, mineCount: 0 }, 0);
    expect(game.view().status).toBe('won');
    expect(game.result()).toEqual({
      outcome: 'won',
      timeMs: 0,
      safeCellsRevealed: 1,
      totalSafeCells: 1,
      effectiveCommands: 0,
      threeBV: 1,
      threeBVPerSecond: 0, // no division by zero
    } satisfies GameResult);
  });

  it('has 3BV per second 0 when a command at t = 0 finishes the game', () => {
    const game = new Game(new Board({ width: 2, height: 1, mineCount: 0 }, []));
    game.apply(reveal(0, 0)); // a zero: opens both cells
    const result = game.result() as GameResult;
    expect(result).toMatchObject({ outcome: 'won', timeMs: 0, effectiveCommands: 1, threeBV: 1 });
    expect(result.threeBVPerSecond).toBe(0);
  });
});

describe('Game.result: live play and replay agree', () => {
  // Tiny boards (down to one cell) are often cleared by the opening alone, so most of the sample must come
  // from boards with room for real mines; the guard below checks that the mix works.
  const tinyConfig: fc.Arbitrary<BoardConfig> = fc
    .record({ width: fc.integer({ min: 1, max: 8 }), height: fc.integer({ min: 1, max: 8 }) })
    .chain(({ width, height }) =>
      fc
        .integer({ min: 0, max: Math.max(0, width * height - 9) })
        .map((mineCount) => ({ width, height, mineCount })),
    );
  const roomyConfig: fc.Arbitrary<BoardConfig> = fc
    .record({ width: fc.integer({ min: 4, max: 9 }), height: fc.integer({ min: 4, max: 9 }) })
    .chain(({ width, height }) =>
      fc
        .integer({ min: 1, max: width * height - 9 })
        .map((mineCount) => ({ width, height, mineCount })),
    );
  const configArbitrary: fc.Arbitrary<BoardConfig> = fc.oneof(
    { weight: 1, arbitrary: tinyConfig },
    { weight: 3, arbitrary: roomyConfig },
  );

  interface Step {
    readonly type: Command['type'];
    readonly guided: boolean;
    readonly pick: number;
    readonly dt: number;
  }

  const stepArbitrary: fc.Arbitrary<Step> = fc.record({
    type: fc.constantFrom<Command['type']>('reveal', 'reveal', 'flag', 'chord'),
    guided: fc.boolean(),
    pick: fc.nat(),
    dt: fc.nat({ max: 40 }),
  });

  /** Random and guided commands on a game made by `createGame`, with a `t` that never goes down. */
  function playRandom(config: BoardConfig, seed: number, steps: readonly Step[]): Game {
    const { board } = new SeededBoardGenerator().generate(config, seed);
    const game = createGame(config, seed);
    const total = cellCount(config);
    let t = 0;
    for (const step of steps) {
      t += step.dt;
      let index = step.pick % total;
      let type = step.type;
      if (step.guided) {
        const hiddenSafe = game
          .view()
          .cells.map((cell, i) => (cell.state === 'hidden' && !board.isMine(i) ? i : -1))
          .filter((i) => i >= 0);
        if (hiddenSafe.length > 0) {
          index = hiddenSafe[step.pick % hiddenSafe.length] as number;
          type = 'reveal';
        }
      }
      game.apply({ type, index, t });
    }
    return game;
  }

  it('replay(log).result() equals the live result, field for field, for any game', () => {
    fc.assert(
      fc.property(
        configArbitrary,
        fc.integer({ min: 0, max: UINT32_MAX }),
        fc.array(stepArbitrary, { maxLength: 80 }),
        (config, seed, steps) => {
          const live = playRandom(config, seed, steps);
          const log: ReplayLog = { version: 1, config, seed, commands: live.log() };
          expect(replay(log).result()).toEqual(live.result());
          // Through JSON, which is how a log is stored and sent: the same record.
          const stored = JSON.parse(JSON.stringify(log)) as ReplayLog;
          expect(replay(stored).result()).toEqual(live.result());
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('keeps the result consistent with the final view and the log', () => {
    fc.assert(
      fc.property(
        configArbitrary,
        fc.integer({ min: 0, max: UINT32_MAX }),
        fc.array(stepArbitrary, { maxLength: 80 }),
        (config, seed, steps) => {
          const game = playRandom(config, seed, steps);
          const view = game.view();
          const result = game.result();
          if (view.status !== 'won' && view.status !== 'lost') {
            expect(result).toBeUndefined();
            return;
          }
          expect(result).toBeDefined();
          const done = result as GameResult;
          const log = game.log();
          expect(done.outcome).toBe(view.status);
          expect(done.safeCellsRevealed).toBe(view.revealedCount);
          expect(done.totalSafeCells).toBe(config.width * config.height - config.mineCount);
          expect(done.effectiveCommands).toBe(log.length);
          expect(done.timeMs).toBe(log.length > 0 ? (log[log.length - 1] as Command).t : 0);
          expect(done.threeBV).toBeGreaterThanOrEqual(1);
          expect(done.threeBVPerSecond).toBe(
            done.timeMs === 0 ? 0 : (done.threeBV * 1000) / done.timeMs,
          );
          if (done.outcome === 'won') expect(done.safeCellsRevealed).toBe(done.totalSafeCells);
          else expect(done.safeCellsRevealed).toBeLessThan(done.totalSafeCells);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('is exercised: the sample holds games of every kind (a guard on the two properties above)', () => {
    const counts = { wonByPlay: 0, wonAtCreation: 0, lost: 0, unfinished: 0 };
    const samples = fc.sample(
      fc.tuple(
        configArbitrary,
        fc.integer({ min: 0, max: UINT32_MAX }),
        fc.array(stepArbitrary, { maxLength: 80 }),
      ),
      { numRuns: 1000, seed: 20_261_120 },
    );
    for (const [config, seed, steps] of samples) {
      const game = playRandom(config, seed, steps);
      const { status } = game.view();
      if (status === 'won') counts[game.log().length > 0 ? 'wonByPlay' : 'wonAtCreation'] += 1;
      else if (status === 'lost') counts.lost += 1;
      else counts.unfinished += 1;
    }
    expect(counts.wonByPlay).toBeGreaterThanOrEqual(100);
    expect(counts.lost).toBeGreaterThanOrEqual(100);
    expect(counts.unfinished).toBeGreaterThanOrEqual(100);
    expect(counts.wonAtCreation).toBeGreaterThanOrEqual(10);
  });

  it('is the same for a preset game played to a win and replayed', () => {
    const { board } = new SeededBoardGenerator().generate(PRESETS.expert, 2024);
    const game = createGame(PRESETS.expert, 2024);
    let t = 0;
    for (let index = 0; index < cellCount(PRESETS.expert); index += 1) {
      if (board.isMine(index)) continue;
      t += 7;
      game.apply(reveal(index, t));
    }
    const live = game.result() as GameResult;
    expect(live.outcome).toBe('won');
    expect(live.totalSafeCells).toBe(381);
    expect(
      replay({ version: 1, config: PRESETS.expert, seed: 2024, commands: game.log() }).result(),
    ).toEqual(live);
  });
});
