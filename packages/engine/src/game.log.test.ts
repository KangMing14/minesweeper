import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Board } from './board.js';
import type { Command } from './command.js';
import { cellCount } from './config.js';
import { createGame } from './create-game.js';
import { PRESETS } from './config.js';
import { Game } from './game.js';

// The command log and the rule for `t` (M2-T03, Review Focus #2). A command is accepted when it takes
// effect; only accepted commands are logged, and `t` of an accepted command never goes down.

// 4x4, one mine in the bottom-right corner (see lifecycle.test.ts): a reveal at 0 opens everything but 15.
const corner = (): Board => new Board({ width: 4, height: 4, mineCount: 1 }, [15]);
// 3x3 with mines at 0 and 8: only cells 2 and 6 cascade.
const diagonal = (): Board => new Board({ width: 3, height: 3, mineCount: 2 }, [0, 8]);

const reveal = (index: number, t: number): Command => ({ type: 'reveal', index, t });
const flag = (index: number, t: number): Command => ({ type: 'flag', index, t });
const chord = (index: number, t: number): Command => ({ type: 'chord', index, t });

describe('Game.log: what is logged', () => {
  it('is empty for a new game', () => {
    expect(new Game(diagonal()).log()).toEqual([]);
  });

  it('holds accepted commands in the order they were applied, of every type', () => {
    const game = new Game(diagonal());
    game.apply(flag(0, 5));
    game.apply(reveal(2, 10));
    game.apply(chord(1, 20));
    expect(game.log()).toEqual([flag(0, 5), reveal(2, 10), chord(1, 20)]);
  });

  it('leaves out a command that changes nothing', () => {
    const game = new Game(diagonal());
    game.apply(reveal(2, 10));
    expect(game.apply(reveal(2, 11))).toEqual([]); // already revealed
    expect(game.apply(flag(2, 12))).toEqual([]); // flag on a revealed cell
    expect(game.apply(chord(2, 13))).toEqual([]); // chord on a zero
    expect(game.apply(reveal(0, 14))).not.toEqual([]); // the mine: accepted, and it ends the game
    expect(game.log()).toEqual([reveal(2, 10), reveal(0, 14)]);
  });

  it('leaves out every command after the game has ended', () => {
    const game = new Game(corner());
    game.apply(reveal(0, 1)); // wins: one cascade opens every safe cell
    expect(game.view().status).toBe('won');
    game.apply(flag(15, 2));
    game.apply(reveal(15, 3));
    expect(game.log()).toEqual([reveal(0, 1)]);
  });

  it('logs the command that ends the game, whether it wins or loses', () => {
    const lost = new Game(diagonal());
    lost.apply(reveal(0, 7));
    expect(lost.log()).toEqual([reveal(0, 7)]);
    const won = new Game(corner());
    won.apply(reveal(5, 9));
    expect(won.log()).toEqual([reveal(5, 9)]);
  });

  it('does not log a command whose index is outside the board (it throws)', () => {
    const game = new Game(diagonal());
    expect(() => game.apply(reveal(9, 1))).toThrow(RangeError);
    expect(game.log()).toEqual([]);
  });

  it('still logs a command when a subscriber throws, because the game has changed', () => {
    const game = new Game(diagonal());
    game.subscribe(() => {
      throw new Error('listener failed');
    });
    expect(() => game.apply(reveal(2, 10))).toThrow('listener failed');
    expect(game.view().revealedCount).toBeGreaterThan(0);
    expect(game.log()).toEqual([reveal(2, 10)]);
  });

  it('works the same for a game made by createGame, without the opening', () => {
    const game = createGame(PRESETS.beginner, 42);
    const hidden = game.view().cells.findIndex((cell) => cell.state === 'hidden');
    game.apply(flag(hidden, 3));
    expect(game.log()).toEqual([flag(hidden, 3)]);
  });
});

describe('Game.log: the returned list is a safe copy', () => {
  it('is frozen, and so is every entry', () => {
    const game = new Game(diagonal());
    game.apply(reveal(2, 10));
    const log = game.log();
    expect(Object.isFrozen(log)).toBe(true);
    expect(Object.isFrozen(log[0])).toBe(true);
  });

  it('does not change when more commands are applied after it was read', () => {
    const game = new Game(diagonal());
    game.apply(reveal(2, 10));
    const before = game.log();
    game.apply(flag(3, 11)); // the cascade from 2 opens 1, 4 and 5; 3 is still hidden
    expect(before).toEqual([reveal(2, 10)]);
    expect(game.log()).toHaveLength(2);
  });

  it('is not changed by the caller changing the command object it applied', () => {
    const game = new Game(diagonal());
    const command = { type: 'reveal', index: 2, t: 10 } as {
      type: 'reveal';
      index: number;
      t: number;
    };
    game.apply(command);
    command.t = 999;
    command.index = 6;
    expect(game.log()).toEqual([reveal(2, 10)]);
  });

  it('carries only type, index and t, even if the applied object had more fields', () => {
    const game = new Game(diagonal());
    game.apply({ type: 'reveal', index: 2, t: 10, secret: 'x' } as Command);
    expect(Object.keys(game.log()[0] as Command).sort()).toEqual(['index', 't', 'type']);
  });
});

describe('Command.t: which times are accepted (Review Focus #2)', () => {
  it('accepts t = 0 and the same t again (not decreasing)', () => {
    const game = new Game(diagonal());
    expect(game.apply(flag(1, 0))).toHaveLength(1);
    expect(game.apply(flag(3, 0))).toHaveLength(1);
    expect(game.log()).toEqual([flag(1, 0), flag(3, 0)]);
  });

  it('rejects a t lower than the last accepted one: nothing changes, nothing is logged', () => {
    const game = new Game(diagonal());
    game.apply(flag(1, 100));
    const view = game.view();
    expect(game.apply(flag(3, 99))).toEqual([]);
    expect(game.apply(reveal(2, 50))).toEqual([]);
    expect(game.view()).toEqual(view);
    expect(game.log()).toEqual([flag(1, 100)]);
  });

  it.each([
    ['negative', -1],
    ['fractional', 1.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['negative Infinity', Number.NEGATIVE_INFINITY],
    ['above the safe-integer range', 2 ** 53],
    ['slightly negative', -0.5],
  ])('rejects a %s t on the first command and the game stays ready', (_name, t) => {
    const game = new Game(diagonal());
    expect(game.apply(reveal(2, t))).toEqual([]);
    expect(game.view().status).toBe('ready');
    expect(game.view().revealedCount).toBe(0);
    expect(game.log()).toEqual([]);
  });

  it('accepts the largest safe integer', () => {
    const game = new Game(diagonal());
    expect(game.apply(flag(1, Number.MAX_SAFE_INTEGER))).toHaveLength(1);
  });

  it('treats -0 as 0', () => {
    const game = new Game(diagonal());
    expect(game.apply(flag(1, -0))).toHaveLength(1);
  });

  it('does not let a no-op move the last accepted t', () => {
    const game = new Game(diagonal());
    game.apply(reveal(2, 500));
    expect(game.apply(reveal(2, 900))).toEqual([]); // no-op, not logged
    expect(game.apply(flag(3, 600))).toHaveLength(1); // 600 >= 500, so accepted (3 is still hidden)
    expect(game.log()).toEqual([reveal(2, 500), flag(3, 600)]);
  });

  it('does not let a rejected command move the last accepted t', () => {
    const game = new Game(diagonal());
    game.apply(flag(1, 100));
    expect(game.apply(flag(3, 50))).toEqual([]); // too early: rejected
    expect(game.apply(flag(3, 100))).toHaveLength(1); // still compared with 100, not 50
  });

  it('checks the index first: a bad index throws even when t is bad too', () => {
    const game = new Game(diagonal());
    expect(() => game.apply(reveal(-1, -5))).toThrow(RangeError);
    expect(() => game.apply(reveal(9, Number.NaN))).toThrow(RangeError);
  });

  it('returns no events for a finished game whatever t is', () => {
    const game = new Game(diagonal());
    game.apply(reveal(0, 10));
    expect(game.apply(flag(1, -1))).toEqual([]);
    expect(game.apply(flag(1, 5))).toEqual([]);
    expect(game.log()).toEqual([reveal(0, 10)]);
  });

  it('takes the t of GameWon and GameLost from an accepted command, so it is always a valid time', () => {
    const lost = new Game(diagonal());
    expect(lost.apply(reveal(0, Number.NaN))).toEqual([]);
    expect(lost.view().status).toBe('ready');
    expect(lost.apply(reveal(0, 12))).toEqual([{ type: 'gameLost', t: 12, mineIndex: 0 }]);
  });
});

/** A board with at most 25 cells and a valid mine layout. */
const boardArbitrary: fc.Arbitrary<Board> = fc
  .record({ width: fc.integer({ min: 1, max: 5 }), height: fc.integer({ min: 1, max: 5 }) })
  .chain(({ width, height }) =>
    fc
      .uniqueArray(fc.integer({ min: 0, max: width * height - 1 }), {
        maxLength: width * height - 1,
      })
      .map((mines) => new Board({ width, height, mineCount: mines.length }, mines)),
  );

describe('Game.log: properties', () => {
  it('holds exactly the commands that took effect, with t never decreasing, and replays to the same game', () => {
    fc.assert(
      fc.property(
        boardArbitrary,
        fc.array(
          fc.record({
            type: fc.constantFrom<Command['type']>('reveal', 'reveal', 'flag', 'chord'),
            pick: fc.nat(),
            // Unordered and sometimes invalid on purpose, so the rule has something to reject.
            t: fc.oneof(
              fc.nat({ max: 1000 }),
              fc.nat({ max: 1000 }),
              fc.double({ noNaN: false }),
              fc.constant(-1),
            ),
          }),
          { maxLength: 80 },
        ),
        (board, steps) => {
          const game = new Game(board);
          const accepted: Command[] = [];
          for (const step of steps) {
            const command: Command = {
              type: step.type,
              index: step.pick % cellCount(board.config),
              t: step.t,
            };
            if (game.apply(command).length > 0) accepted.push(command);
          }
          const log = game.log();
          expect(log).toEqual(accepted);
          for (let i = 1; i < log.length; i += 1) {
            expect((log[i] as Command).t).toBeGreaterThanOrEqual((log[i - 1] as Command).t);
          }
          for (const command of log) {
            expect(Number.isSafeInteger(command.t) && command.t >= 0).toBe(true);
          }
          // Applying the log to a fresh game accepts every command and reaches the same view.
          const again = new Game(board);
          for (const command of log) expect(again.apply(command).length).toBeGreaterThan(0);
          expect(again.view()).toEqual(game.view());
        },
      ),
      { numRuns: 1000 },
    );
  });
});
