import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Board } from './board.js';
import type { Command } from './command.js';
import { cellCount, safeCellCount, type BoardConfig } from './config.js';
import type { GameEvent } from './events.js';
import { Game } from './game.js';

// Property tests for the game lifecycle (M1-T06). Each property runs on 1,000 generated cases (the task asks
// for at least 1,000 in CI). On a failure fast-check prints the seed and the shrunk counterexample, which is
// all that is needed to replay it.

/** How many generated cases every property runs. */
const RUNS = 1_000;

/** A small board with its mines, from 1x1 up to 8x8: small enough that random play often finishes a game. */
const boardArbitrary: fc.Arbitrary<Board> = fc
  .record({ width: fc.integer({ min: 1, max: 8 }), height: fc.integer({ min: 1, max: 8 }) })
  .chain(({ width, height }) => {
    const cells = width * height;
    return fc.integer({ min: 0, max: cells - 1 }).chain((mineCount) =>
      fc
        .uniqueArray(fc.integer({ min: 0, max: cells - 1 }), {
          minLength: mineCount,
          maxLength: mineCount,
        })
        .map((mines) => new Board({ width, height, mineCount }, mines)),
    );
  });

/** A board together with a list of commands that are all inside it. */
const playArbitrary: fc.Arbitrary<{ board: Board; commands: Command[] }> = boardArbitrary.chain(
  (board) => {
    const cells = cellCount(board.config);
    // Reveals are the most common command, as in real play; flags and chords are mixed in.
    const type = fc.constantFrom<Command['type']>('reveal', 'reveal', 'reveal', 'flag', 'chord');
    const command = fc.record({
      type,
      index: fc.integer({ min: 0, max: cells - 1 }),
      t: fc.nat({ max: 600_000 }),
    });
    return fc.array(command, { maxLength: 150 }).map((commands) => ({ board, commands }));
  },
);

/** Every mine of a board, ascending. */
function minesOf(board: Board): number[] {
  const { width, height } = board.config;
  const mines: number[] = [];
  for (let i = 0; i < width * height; i++) if (board.isMine(i)) mines.push(i);
  return mines;
}

/** Plays the commands and returns what the game announced, command by command. */
function play(board: Board, commands: readonly Command[]): { game: Game; log: GameEvent[][] } {
  const game = new Game(board);
  const log: GameEvent[][] = [];
  for (const command of commands) log.push([...game.apply(command)]);
  return { game, log };
}

describe('Game: properties of random play', () => {
  it('never throws for an index inside the board, whatever the command and the state', () => {
    fc.assert(
      fc.property(playArbitrary, ({ board, commands }) => {
        expect(() => play(board, commands)).not.toThrow();
      }),
      { numRuns: RUNS },
    );
  });

  it('never decreases revealedCount, and never counts a cell twice', () => {
    fc.assert(
      fc.property(playArbitrary, ({ board, commands }) => {
        const game = new Game(board);
        let previous = 0;
        let announced = 0;
        for (const command of commands) {
          for (const event of game.apply(command)) {
            if (event.type === 'cellsRevealed') announced += event.cells.length;
          }
          const { revealedCount } = game.view();
          expect(revealedCount).toBeGreaterThanOrEqual(previous);
          // The events add up to exactly the cells the view shows as revealed: nothing is announced twice.
          expect(announced).toBe(revealedCount);
          previous = revealedCount;
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('never reveals a mine: a mine is only ever hit, and hitting one loses the game', () => {
    fc.assert(
      fc.property(playArbitrary, ({ board, commands }) => {
        const { game, log } = play(board, commands);
        const view = game.view();
        view.cells.forEach((cell, index) => {
          if (cell.state === 'revealed') {
            expect(board.isMine(index)).toBe(false);
            expect(cell.value).toBe(board.adjacentMines(index));
          }
        });
        for (const event of log.flat()) {
          if (event.type === 'cellsRevealed') {
            for (const cell of event.cells) expect(board.isMine(cell.index)).toBe(false);
          }
          if (event.type === 'gameLost') expect(board.isMine(event.mineIndex)).toBe(true);
        }
        const lostEvents = log.flat().filter((event) => event.type === 'gameLost').length;
        expect(lostEvents).toBe(view.status === 'lost' ? 1 : 0);
      }),
      { numRuns: RUNS },
    );
  });

  it('never changes the mine layout: a finished game exposes exactly the board mines', () => {
    fc.assert(
      fc.property(playArbitrary, ({ board, commands }) => {
        const before = minesOf(board);
        const { game } = play(board, commands);
        expect(minesOf(board)).toEqual(before);
        const view = game.view();
        if (view.status === 'won' || view.status === 'lost') {
          expect(view.exposedMines).toEqual(before);
        } else {
          expect('exposedMines' in view).toBe(false);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('is won exactly when every safe cell is revealed, and then announces one gameWon, last', () => {
    fc.assert(
      fc.property(playArbitrary, ({ board, commands }) => {
        const { game, log } = play(board, commands);
        const view = game.view();
        const safe = safeCellCount(board.config);
        // Lost wins over everything, but a lost game never has every safe cell revealed (see Game.apply).
        if (view.status === 'lost') expect(view.revealedCount).toBeLessThan(safe);
        else expect(view.status === 'won').toBe(view.revealedCount === safe);

        const events = log.flat();
        const won = events.filter((event) => event.type === 'gameWon');
        expect(won).toHaveLength(view.status === 'won' ? 1 : 0);
        if (view.status === 'won') expect(events.at(-1)?.type).toBe('gameWon');
      }),
      { numRuns: RUNS },
    );
  });

  it('moves the status only forwards: ready, playing, then won or lost, and never back', () => {
    const rank = { ready: 0, playing: 1, won: 2, lost: 2 } as const;
    fc.assert(
      fc.property(playArbitrary, ({ board, commands }) => {
        const game = new Game(board);
        let previous = game.view().status;
        expect(previous).toBe('ready');
        for (const command of commands) {
          game.apply(command);
          const { status } = game.view();
          expect(rank[status]).toBeGreaterThanOrEqual(rank[previous]);
          if (previous === 'won' || previous === 'lost') expect(status).toBe(previous);
          previous = status;
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('ignores every command once the game is over, and keeps the view identical', () => {
    fc.assert(
      fc.property(playArbitrary, playArbitrary, ({ board, commands }, extra) => {
        const { game } = play(board, commands);
        const status = game.view().status;
        fc.pre(status === 'won' || status === 'lost');
        const before = game.view();
        const cells = cellCount(board.config);
        for (const command of extra.commands) {
          expect(game.apply({ ...command, index: command.index % cells })).toEqual([]);
        }
        expect(game.view()).toEqual(before);
      }),
      { numRuns: RUNS },
    );
  });

  it('is won by revealing every safe cell, in any order', () => {
    const winArbitrary = boardArbitrary.chain((board) => {
      const safe: number[] = [];
      for (let i = 0; i < cellCount(board.config); i++) if (!board.isMine(i)) safe.push(i);
      return fc
        .shuffledSubarray(safe, { minLength: safe.length })
        .map((order) => ({ board, order }));
    });
    fc.assert(
      fc.property(winArbitrary, ({ board, order }) => {
        const game = new Game(board);
        const events: GameEvent[] = [];
        order.forEach((index, step) =>
          events.push(...game.apply({ type: 'reveal', index, t: step })),
        );
        const view = game.view();
        expect(view.status).toBe('won');
        expect(view.revealedCount).toBe(safeCellCount(board.config));
        expect(events.filter((event) => event.type === 'gameWon')).toHaveLength(1);
        expect(events.at(-1)?.type).toBe('gameWon');
      }),
      { numRuns: RUNS },
    );
  });

  it('gives the same events and the same view for the same board and commands', () => {
    fc.assert(
      fc.property(playArbitrary, ({ board, commands }) => {
        const first = play(board, commands);
        const second = play(board, commands);
        expect(second.log).toEqual(first.log);
        expect(second.game.view()).toEqual(first.game.view());
      }),
      { numRuns: RUNS },
    );
  });
});

describe('Game: the generators', () => {
  // A property test that never reaches a win or a loss would pass without testing the lifecycle. This pins
  // that the generators do reach both, so a change to them cannot quietly empty the properties above.
  it('reach both a win and a loss in a sample of random games', () => {
    const outcomes = new Set<string>();
    const sample = fc.sample(playArbitrary, { numRuns: 400, seed: 1 });
    for (const { board, commands } of sample)
      outcomes.add(play(board, commands).game.view().status);
    expect(outcomes.has('won')).toBe(true);
    expect(outcomes.has('lost')).toBe(true);
  });

  it('only build valid boards', () => {
    fc.assert(
      fc.property(boardArbitrary, (board) => {
        const config: BoardConfig = board.config;
        expect(config.mineCount).toBeLessThanOrEqual(cellCount(config) - 1);
        expect(minesOf(board)).toHaveLength(config.mineCount);
      }),
      { numRuns: 200 },
    );
  });
});
