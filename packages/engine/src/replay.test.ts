import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Board } from './board.js';
import type { Command } from './command.js';
import { PRESETS, cellCount } from './config.js';
import type { BoardConfig } from './config.js';
import { createGame } from './create-game.js';
import { InvalidBoardConfigError, InvalidReplayError } from './errors.js';
import type { Game } from './game.js';
import { SeededBoardGenerator } from './generator.js';
import type { BoardGenerator } from './generator.js';
import { MAX_REPLAY_COMMANDS, replay, validateReplayLog } from './replay.js';
import type { ReplayLog } from './replay.js';

// Replay (M2-T04): a `ReplayLog` is `(config, seed, commands)`, and `replay` plays it again on a fresh game.
// `validateReplayLog` checks the log on its own (shape, ranges, order of `t`); `replay` also finds out whether
// the game accepts every command, which only playing it can tell.

const UINT32_MAX = 4294967295;

const reveal = (index: number, t: number): Command => ({ type: 'reveal', index, t });
const flag = (index: number, t: number): Command => ({ type: 'flag', index, t });
const chord = (index: number, t: number): Command => ({ type: 'chord', index, t });

/** A 3x3 board, mines at 0 and 8, cell 2 as the opening: see `scripted` below. */
const diagonal = (): Board => new Board({ width: 3, height: 3, mineCount: 2 }, [0, 8]);
const diagonalGenerator: BoardGenerator = {
  generate: () => ({ board: diagonal(), opening: Object.freeze([2]) }),
};

/**
 * A valid log of the 3x3 board above that uses every command type and wins. The opening (cell 2) shows 0 and
 * opens 1, 2, 4 and 5; flag 0 (a mine); chord on 1 (shows 1, one flag) opens 3; reveal 6 (shows 0) cascades
 * to 7, the last safe cell.
 */
const scripted = (): ReplayLog => ({
  version: 1,
  config: { width: 3, height: 3, mineCount: 2 },
  seed: 7,
  commands: [flag(0, 10), chord(1, 20), reveal(6, 30)],
});

const valid = (): ReplayLog => ({
  version: 1,
  config: { width: 3, height: 3, mineCount: 1 },
  seed: 7,
  commands: [reveal(0, 100), flag(8, 100), reveal(1, 250)],
});

/** The valid log with some fields replaced by anything at all, as untyped input could do. */
const broken = (patch: Record<string, unknown>): ReplayLog =>
  ({ ...valid(), ...patch }) as unknown as ReplayLog;

/** The reason of the `InvalidReplayError` that `action` throws; fails the test if it throws anything else. */
function reasonOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidReplayError);
    return (error as InvalidReplayError).reason;
  }
  throw new Error('expected an InvalidReplayError, but nothing was thrown');
}

describe('validateReplayLog: a log that is fine', () => {
  it('accepts an empty log, a log of every command type and equal values of t', () => {
    expect(() => validateReplayLog({ ...valid(), commands: [] })).not.toThrow();
    expect(() => validateReplayLog(scripted())).not.toThrow();
    expect(() => validateReplayLog(valid())).not.toThrow(); // t = 100, 100, 250
  });

  it('accepts the smallest and the largest seed', () => {
    expect(() => validateReplayLog({ ...valid(), seed: 0 })).not.toThrow();
    expect(() => validateReplayLog({ ...valid(), seed: UINT32_MAX })).not.toThrow();
  });

  it('accepts exactly the maximum number of commands', () => {
    const commands = Array.from({ length: MAX_REPLAY_COMMANDS }, () => reveal(0, 0));
    expect(() => validateReplayLog({ ...valid(), commands })).not.toThrow();
  });

  it('has a documented maximum of 100,000 commands', () => {
    expect(MAX_REPLAY_COMMANDS).toBe(100_000);
  });

  it('does not change the log', () => {
    const log = scripted();
    const before = JSON.stringify(log);
    validateReplayLog(log);
    expect(JSON.stringify(log)).toBe(before);
  });
});

describe('validateReplayLog: version', () => {
  it.each([2, 0, -1, '1', null, undefined, 1.5])('rejects version %j', (version) => {
    expect(reasonOf(() => validateReplayLog(broken({ version })))).toMatch(/^version /);
  });
});

describe('validateReplayLog: config', () => {
  it('wraps an invalid config, keeping the original error as the cause', () => {
    const log = broken({ config: { width: 0, height: 9, mineCount: 10 } });
    let caught: unknown;
    try {
      validateReplayLog(log);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InvalidReplayError);
    expect(caught).not.toBeInstanceOf(InvalidBoardConfigError);
    const error = caught as InvalidReplayError;
    expect(error.reason).toMatch(/^config /);
    expect(error.reason).toContain('width');
    expect(error.cause).toBeInstanceOf(InvalidBoardConfigError);
  });

  it.each([
    ['too many mines', { width: 3, height: 3, mineCount: 9 }],
    ['a fractional height', { width: 3, height: 2.5, mineCount: 1 }],
    ['a board above the size limit', { width: 101, height: 1, mineCount: 0 }],
    ['nothing at all', null],
    ['a number', 5],
    ['no config', undefined],
  ])('rejects %s', (_name, config) => {
    expect(reasonOf(() => validateReplayLog(broken({ config })))).toMatch(/^config /);
  });
});

describe('validateReplayLog: an error that is not about the log', () => {
  it('lets an unexpected error through instead of reporting it as a bad log', () => {
    const failure = new Error('the config object blew up');
    const config = {
      get width(): number {
        throw failure;
      },
      height: 9,
      mineCount: 10,
    };
    expect(() => validateReplayLog(broken({ config }))).toThrow(failure);
  });
});

describe('validateReplayLog: seed', () => {
  it.each([
    -1,
    1.5,
    UINT32_MAX + 1,
    2 ** 53,
    Number.NaN,
    Infinity,
    -Infinity,
    '5',
    null,
    undefined,
  ])('rejects seed %j', (seed) => {
    expect(reasonOf(() => validateReplayLog(broken({ seed })))).toMatch(/^seed /);
  });
});

describe('validateReplayLog: the list of commands', () => {
  it.each([null, undefined, 'reveal', {}, { length: 1 }])(
    'rejects commands that are %j',
    (commands) => {
      expect(reasonOf(() => validateReplayLog(broken({ commands })))).toMatch(/^commands /);
    },
  );

  it('rejects more than the maximum number of commands, before looking at any of them', () => {
    // Every entry is garbage: a check that went through them first would name entry 0 instead.
    const commands = Array.from({ length: MAX_REPLAY_COMMANDS + 1 }, () => null);
    const reason = reasonOf(() => validateReplayLog(broken({ commands })));
    expect(reason).toMatch(/^commands has 100001 entries/);
    expect(reason).toContain('100000');
  });

  it.each([null, undefined, 5, 'reveal'])('rejects an entry that is %j', (entry) => {
    const commands = [reveal(0, 1), entry];
    expect(reasonOf(() => validateReplayLog(broken({ commands })))).toMatch(/^commands\[1\] /);
  });
});

describe('validateReplayLog: each command', () => {
  it.each(['click', '', 'REVEAL', null, undefined, 3])('rejects type %j', (type) => {
    const commands = [reveal(0, 1), { type, index: 0, t: 2 }];
    expect(reasonOf(() => validateReplayLog(broken({ commands })))).toMatch(
      /^commands\[1\]\.type /,
    );
  });

  // The valid board is 3x3: 9 cells, indices 0 to 8.
  it.each([-1, 9, 1000, 1.5, Number.NaN, Infinity, '3', null, undefined])(
    'rejects index %j',
    (index) => {
      const commands = [reveal(0, 1), { type: 'flag', index, t: 2 }];
      expect(reasonOf(() => validateReplayLog(broken({ commands })))).toMatch(
        /^commands\[1\]\.index /,
      );
    },
  );

  it('measures the index against the board of this log, not against a fixed size', () => {
    const wide = { ...valid(), config: PRESETS.expert }; // 480 cells
    expect(() => validateReplayLog({ ...wide, commands: [reveal(479, 0)] })).not.toThrow();
    expect(() => validateReplayLog({ ...wide, commands: [reveal(480, 0)] })).toThrow(
      InvalidReplayError,
    );
    expect(() => validateReplayLog({ ...valid(), commands: [reveal(9, 0)] })).toThrow(
      InvalidReplayError,
    );
  });

  it.each([
    -1,
    0.5,
    Number.NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '5',
    null,
    undefined,
  ])('rejects t = %j', (t) => {
    const commands = [reveal(0, 1), { type: 'flag', index: 1, t }];
    expect(reasonOf(() => validateReplayLog(broken({ commands })))).toMatch(/^commands\[1\]\.t /);
  });

  it('says "non-negative" for a negative t, even though the order check would also reject it', () => {
    // The opening counts as t = 0, so a negative t is also lower than "the t before it"; the message that
    // names the real problem must win.
    const commands = [{ type: 'reveal', index: 0, t: -5 }];
    expect(reasonOf(() => validateReplayLog(broken({ commands })))).toMatch(
      /^commands\[0\]\.t must be a non-negative safe integer/,
    );
  });

  it('accepts the largest safe integer as t', () => {
    const commands = [reveal(0, Number.MAX_SAFE_INTEGER)];
    expect(() => validateReplayLog(broken({ commands }))).not.toThrow();
  });

  it('rejects a t that is lower than the one before, and says where', () => {
    const commands = [reveal(0, 5), flag(1, 9), reveal(2, 8)];
    const reason = reasonOf(() => validateReplayLog(broken({ commands })));
    expect(reason).toMatch(/^commands\[2\]\.t /);
    expect(reason).toContain('8');
    expect(reason).toContain('9');
  });

  it('names the first problem when there are several', () => {
    const commands = [reveal(0, 5), { type: 'nope', index: 99, t: -1 }, reveal(1, 0)];
    expect(reasonOf(() => validateReplayLog(broken({ commands })))).toMatch(
      /^commands\[1\]\.type /,
    );
  });

  it('checks the whole log in a fixed order: version, config, seed, commands', () => {
    const everythingWrong = { version: 2, config: null, seed: -1, commands: null };
    expect(reasonOf(() => validateReplayLog(broken(everythingWrong)))).toMatch(/^version /);
    expect(reasonOf(() => validateReplayLog(broken({ ...everythingWrong, version: 1 })))).toMatch(
      /^config /,
    );
    expect(
      reasonOf(() =>
        validateReplayLog(broken({ ...everythingWrong, version: 1, config: valid().config })),
      ),
    ).toMatch(/^seed /);
  });

  it('rejects a log that is not an object at all', () => {
    for (const log of [null, undefined, 5, 'log']) {
      expect(() => validateReplayLog(log as unknown as ReplayLog)).toThrow(InvalidReplayError);
    }
  });
});

describe('replay: the game it builds', () => {
  it('replays an empty log to the game that createGame makes: opening open, status ready', () => {
    const log: ReplayLog = { version: 1, config: PRESETS.beginner, seed: 42, commands: [] };
    const game = replay(log);
    expect(game.view()).toEqual(createGame(PRESETS.beginner, 42).view());
    expect(game.view().status).toBe('ready');
    expect(game.view().revealedCount).toBeGreaterThan(0);
    expect(game.log()).toEqual([]);
  });

  it('replays an empty log to won when the opening already clears the board', () => {
    const log: ReplayLog = {
      version: 1,
      config: { width: 1, height: 1, mineCount: 0 },
      seed: 3,
      commands: [],
    };
    const view = replay(log).view();
    expect(view.status).toBe('won');
    expect(view.exposedMines).toEqual([]);
  });

  it('replays a won game, using every command type, to the same view and the same log', () => {
    const log = scripted();
    const game = replay(log, diagonalGenerator);
    const live = playLive(diagonalGenerator, log);
    expect(game.view().status).toBe('won');
    expect(game.view()).toEqual(live.view());
    expect(game.view().exposedMines).toEqual([0, 8]);
    expect(game.log()).toEqual(log.commands);
  });

  it('replays a lost game, with the mines it exposes', () => {
    const log: ReplayLog = {
      version: 1,
      config: { width: 3, height: 3, mineCount: 2 },
      seed: 7,
      commands: [reveal(3, 40), reveal(0, 90)], // 3 is safe; 0 is a mine
    };
    const game = replay(log, diagonalGenerator);
    expect(game.view().status).toBe('lost');
    expect(game.view().exposedMines).toEqual([0, 8]);
    expect(game.log()).toEqual(log.commands);
  });

  it('replays a played preset game to exactly the view of the live game', () => {
    const { game, log } = playPreset(PRESETS.beginner, 42);
    expect(game.view().status).toBe('won');
    expect(replay(log).view()).toEqual(game.view());
    expect(replay(log).log()).toEqual(game.log());
  });

  it('gives the same game every time, and a game that is its own', () => {
    const { log } = playPreset(PRESETS.intermediate, 1234);
    const first = replay(log);
    const second = replay(log);
    expect(second.view()).toEqual(first.view());
    first.apply(reveal(0, Number.MAX_SAFE_INTEGER)); // changes only `first` (and does nothing if over)
    expect(replay(log).view()).toEqual(second.view());
  });

  it('works on a frozen log, without changing it', () => {
    const log = scripted();
    const frozen: ReplayLog = Object.freeze({
      ...log,
      config: Object.freeze({ ...log.config }),
      commands: Object.freeze(log.commands.map((command) => Object.freeze({ ...command }))),
    });
    const before = JSON.stringify(frozen);
    expect(replay(frozen, diagonalGenerator).view().status).toBe('won');
    expect(JSON.stringify(frozen)).toBe(before);
  });
});

describe('replay: the generator', () => {
  it('uses SeededBoardGenerator when none is given', () => {
    const { log } = playPreset(PRESETS.beginner, 99);
    expect(replay(log).view()).toEqual(replay(log, new SeededBoardGenerator()).view());
  });

  it('asks the generator once, with the config and the seed of the log', () => {
    const calls: { config: BoardConfig; seed: number }[] = [];
    const spyGenerator: BoardGenerator = {
      generate: (config, seed) => {
        calls.push({ config, seed });
        return diagonalGenerator.generate(config, seed);
      },
    };
    const log = scripted();
    replay(log, spyGenerator);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.seed).toBe(7);
    expect(calls[0]?.config).toEqual(log.config);
  });

  it('never reaches the generator with a log that is invalid', () => {
    const neverCalled: BoardGenerator = {
      generate: () => {
        throw new Error('the generator must not be called for an invalid log');
      },
    };
    expect(() => replay(broken({ seed: -1 }), neverCalled)).toThrow(InvalidReplayError);
    expect(() => replay(broken({ version: 2 }), neverCalled)).toThrow(InvalidReplayError);
  });

  it('reports a config that leaves no room for a safe opening as an invalid log, with the cause', () => {
    // 78 mines on 9x9: a valid config, but 77 is the most that fits around an opening zone (M2-T02).
    const log: ReplayLog = {
      version: 1,
      config: { width: 9, height: 9, mineCount: 78 },
      seed: 5,
      commands: [],
    };
    expect(() => validateReplayLog(log)).not.toThrow(); // the log is well-formed; the generator decides
    let caught: unknown;
    try {
      replay(log);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InvalidReplayError);
    expect((caught as InvalidReplayError).reason).toMatch(/^config /);
    expect((caught as InvalidReplayError).cause).toBeInstanceOf(InvalidBoardConfigError);
  });

  it('lets any other error of a generator through unchanged', () => {
    const failure = new Error('disk on fire');
    const failing: BoardGenerator = {
      generate: () => {
        throw failure;
      },
    };
    expect(() => replay(valid(), failing)).toThrow(failure);
  });
});

describe('replay: a command that the game does not accept', () => {
  it('throws for a command that changes nothing, naming its position', () => {
    // Revealing 6 twice: the second time the cell is already open.
    const log = { ...scripted(), commands: [reveal(6, 10), reveal(6, 20)] };
    const reason = reasonOf(() => replay(log, diagonalGenerator));
    expect(reason).toMatch(/^commands\[1\] /);
  });

  it.each([
    ['a flag on a revealed cell', flag(2, 10)], // the opening cell is revealed
    ['a chord on a zero', chord(2, 10)],
    ['a chord on a hidden cell', chord(3, 10)],
    ['a chord with no flags around a number', chord(1, 10)],
  ])('throws for %s', (_name, command) => {
    const log = { ...scripted(), commands: [command] };
    expect(reasonOf(() => replay(log, diagonalGenerator))).toMatch(/^commands\[0\] /);
  });

  it('throws for a command after the game was won, and says that the game was over', () => {
    const log = { ...scripted(), commands: [...scripted().commands, flag(3, 40)] };
    const reason = reasonOf(() => replay(log, diagonalGenerator));
    expect(reason).toMatch(/^commands\[3\] /);
    expect(reason).toContain('won');
  });

  it('throws for a command after the game was lost, and says that the game was over', () => {
    const log = { ...scripted(), commands: [reveal(0, 10), reveal(6, 20)] };
    const reason = reasonOf(() => replay(log, diagonalGenerator));
    expect(reason).toMatch(/^commands\[1\] /);
    expect(reason).toContain('lost');
  });

  it('throws for any command when the opening already cleared the board', () => {
    const log: ReplayLog = {
      version: 1,
      config: { width: 1, height: 1, mineCount: 0 },
      seed: 3,
      commands: [reveal(0, 0)],
    };
    expect(reasonOf(() => replay(log))).toMatch(/^commands\[0\] /);
  });

  it('throws before playing anything when the log fails validation', () => {
    const log = { ...scripted(), commands: [reveal(6, 10), reveal(7, 5)] }; // t goes down
    expect(reasonOf(() => replay(log, diagonalGenerator))).toMatch(/^commands\[1\]\.t /);
  });
});

/**
 * Plays a log on a live game, command by command, built the way `createGame` builds one. This is the other
 * side of the comparison with `replay`, so it does not call `replay`.
 */
function playLive(generator: BoardGenerator, log: ReplayLog): Game {
  const game = createGame(log.config, log.seed, generator);
  for (const command of log.commands) {
    if (game.apply(command).length === 0) throw new Error('the scripted command was not accepted');
  }
  return game;
}

/** Plays a preset board to a win: reveals every safe cell in ascending order, one command per millisecond. */
function playPreset(config: BoardConfig, seed: number): { game: Game; log: ReplayLog } {
  const { board } = new SeededBoardGenerator().generate(config, seed);
  const game = createGame(config, seed);
  let t = 0;
  for (let index = 0; index < cellCount(config); index += 1) {
    if (board.isMine(index)) continue;
    t += 1;
    game.apply(reveal(index, t)); // [] for a cell that an earlier cascade opened
  }
  return { game, log: { version: 1, config, seed, commands: game.log() } };
}

// ---- Property: any game that is played can be replayed ---------------------------------------------------

/** A board config that always has room for the opening zone (at most 9 cells). */
const configArbitrary: fc.Arbitrary<BoardConfig> = fc
  .record({ width: fc.integer({ min: 1, max: 8 }), height: fc.integer({ min: 1, max: 8 }) })
  .chain(({ width, height }) =>
    fc
      .integer({ min: 0, max: Math.max(0, width * height - 9) })
      .map((mineCount) => ({ width, height, mineCount })),
  );

interface Step {
  readonly type: Command['type'];
  /** `true`: reveal a safe cell that is still hidden, so that long games and wins are reached. */
  readonly guided: boolean;
  readonly pick: number;
  /** Milliseconds added to `t` before this step; 0 is allowed, so equal values of `t` occur. */
  readonly dt: number;
}

const stepArbitrary: fc.Arbitrary<Step> = fc.record({
  type: fc.constantFrom<Command['type']>('reveal', 'reveal', 'flag', 'chord'),
  guided: fc.boolean(),
  pick: fc.nat(),
  dt: fc.nat({ max: 40 }),
});

/** Plays random and guided commands on a game made by `createGame`, with t that never goes down. */
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
      const view = game.view();
      const hiddenSafe = view.cells
        .map((cell, i) => (cell.state === 'hidden' && !board.isMine(i) ? i : -1))
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

describe('replay: properties', () => {
  it('replays the log of any game to the same view and the same log (round trip)', () => {
    fc.assert(
      fc.property(
        configArbitrary,
        fc.integer({ min: 0, max: UINT32_MAX }),
        fc.array(stepArbitrary, { maxLength: 80 }),
        (config, seed, steps) => {
          const game = playRandom(config, seed, steps);
          const log: ReplayLog = { version: 1, config, seed, commands: game.log() };
          expect(() => validateReplayLog(log)).not.toThrow();
          const again = replay(log);
          expect(again.view()).toEqual(game.view());
          expect(again.log()).toEqual(game.log());
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('survives a trip through JSON, which is how a log is stored and sent', () => {
    fc.assert(
      fc.property(
        configArbitrary,
        fc.integer({ min: 0, max: UINT32_MAX }),
        fc.array(stepArbitrary, { maxLength: 60 }),
        (config, seed, steps) => {
          const game = playRandom(config, seed, steps);
          const log: ReplayLog = { version: 1, config, seed, commands: game.log() };
          const stored = JSON.parse(JSON.stringify(log)) as ReplayLog;
          expect(replay(stored).view()).toEqual(game.view());
        },
      ),
      { numRuns: 300 },
    );
  });

  it('rejects a log where an accepted reveal is repeated right after itself, at that position', () => {
    fc.assert(
      fc.property(
        configArbitrary,
        fc.integer({ min: 0, max: UINT32_MAX }),
        fc.array(stepArbitrary, { minLength: 1, maxLength: 60 }),
        fc.nat(),
        (config, seed, steps, pick) => {
          const commands = playRandom(config, seed, steps).log();
          const reveals = commands.flatMap((command, i) => (command.type === 'reveal' ? [i] : []));
          fc.pre(reveals.length > 0);
          const at = reveals[pick % reveals.length] as number;
          const repeated = [
            ...commands.slice(0, at + 1),
            commands[at] as Command,
            ...commands.slice(at + 1),
          ];
          // The cell is now open, or the game is over: either way the second reveal does nothing.
          const reason = reasonOf(() => replay({ version: 1, config, seed, commands: repeated }));
          expect(reason).toMatch(new RegExp(`^commands\\[${String(at + 1)}\\] `));
        },
      ),
      { numRuns: 500 },
    );
  });
});
