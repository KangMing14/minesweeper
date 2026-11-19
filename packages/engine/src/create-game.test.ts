import { describe, expect, it } from 'vitest';
import { Board } from './board.js';
import type { BoardConfig } from './config.js';
import { PRESETS } from './config.js';
import { createGame } from './create-game.js';
import { InvalidBoardConfigError } from './errors.js';
import { Game } from './game.js';
import type { BoardGenerator, GeneratedBoard } from './generator.js';
import { SeededBoardGenerator } from './generator.js';

// `createGame` and the opening reveal (M2-T03). The opening is part of creating a game, not a move: it is
// revealed at t = 0, never logged, and leaves the status `'ready'` until the first accepted command, unless
// it already clears the board (then the game is `'won'` at t = 0).

/** A generator that returns a fixed board and opening whatever it is asked, to reach cases seeds do not. */
function fixed(config: BoardConfig, mines: number[], opening: number[]): BoardGenerator {
  const result: GeneratedBoard = { board: new Board(config, mines), opening };
  return { generate: () => result };
}

describe('createGame: the same inputs give the same game', () => {
  it('gives equal views for the same config and seed', () => {
    for (const seed of [0, 1, 42, 2026, 4294967295]) {
      expect(createGame(PRESETS.beginner, seed).view()).toEqual(
        createGame(PRESETS.beginner, seed).view(),
      );
    }
  });

  it('gives different games for different seeds (most of the time)', () => {
    const views = new Set<string>();
    for (let seed = 0; seed < 20; seed += 1) {
      views.add(JSON.stringify(createGame(PRESETS.expert, seed).view()));
    }
    expect(views.size).toBeGreaterThan(15);
  });

  it('uses the default seeded generator: its opening is what is revealed at the start', () => {
    const { board, opening } = new SeededBoardGenerator().generate(PRESETS.intermediate, 77);
    const view = createGame(PRESETS.intermediate, 77).view();
    for (const cell of opening) {
      expect(view.cells[cell]).toEqual({ state: 'revealed', value: board.adjacentMines(cell) });
    }
  });
});

describe('createGame: the opening is revealed immediately', () => {
  it('starts in the status ready with the opening open and nothing flagged', () => {
    const view = createGame(PRESETS.beginner, 42).view();
    expect(view.status).toBe('ready');
    expect(view.flagCount).toBe(0);
    expect(view.revealedCount).toBeGreaterThanOrEqual(4);
    expect(view.exposedMines).toBeUndefined();
    expect(view.cells.filter((cell) => cell.state === 'revealed')).toHaveLength(view.revealedCount);
  });

  it('opens a cell that shows 0 and cascades, on every preset and 100 seeds each', () => {
    for (const config of Object.values(PRESETS)) {
      for (let seed = 0; seed < 100; seed += 1) {
        const view = createGame(config, seed * 40_000_001 + 5).view();
        expect(view.status).toBe('ready');
        expect(view.revealedCount).toBeGreaterThanOrEqual(4);
        expect(view.cells.some((cell) => cell.state === 'revealed' && cell.value === 0)).toBe(true);
      }
    }
  });

  it('does not log the opening', () => {
    expect(createGame(PRESETS.beginner, 42).log()).toEqual([]);
  });

  it('moves to playing on the first accepted command, and not before', () => {
    const game = createGame(PRESETS.beginner, 42);
    const hidden = game.view().cells.findIndex((cell) => cell.state === 'hidden');
    expect(game.view().status).toBe('ready');
    game.apply({ type: 'flag', index: hidden, t: 10 });
    expect(game.view().status).toBe('playing');
    expect(game.log()).toEqual([{ type: 'flag', index: hidden, t: 10 }]);
  });

  it('treats a reveal of an opening cell as a no-op', () => {
    const game = createGame(PRESETS.beginner, 42);
    const opened = game.view().cells.findIndex((cell) => cell.state === 'revealed');
    expect(game.apply({ type: 'reveal', index: opened, t: 5 })).toEqual([]);
    expect(game.view().status).toBe('ready');
    expect(game.log()).toEqual([]);
  });

  it('can be played to a win, with the log holding only the player commands', () => {
    const { board } = new SeededBoardGenerator().generate(PRESETS.beginner, 42);
    const game = createGame(PRESETS.beginner, 42);
    let t = 0;
    while (game.view().status !== 'won') {
      const next = game
        .view()
        .cells.findIndex((cell, index) => cell.state === 'hidden' && !board.isMine(index));
      t += 7;
      game.apply({ type: 'reveal', index: next, t });
    }
    const log = game.log();
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((command) => command.type === 'reveal')).toBe(true);
    expect(game.view().revealedCount).toBe(81 - 10);
  });
});

describe('createGame: a generator of your own', () => {
  it('uses the board and opening that the generator gives', () => {
    const config = { width: 3, height: 3, mineCount: 2 };
    // Mines at 2 and 6. The opening at 0 shows a 0 and opens its neighbors 1, 3 and 4, which show 1, 1 and
    // 2, so the cascade stops there and 5, 7 and 8 stay hidden.
    const game = createGame(config, 1, fixed(config, [2, 6], [0]));
    const view = game.view();
    expect(view.status).toBe('ready');
    expect(view.revealedCount).toBe(4);
    expect(view.cells[0]).toEqual({ state: 'revealed', value: 0 });
    expect(view.cells[4]).toEqual({ state: 'revealed', value: 2 });
    expect(view.cells[5]).toEqual({ state: 'hidden' });
  });

  it('passes the config and the seed on to the generator', () => {
    const seen: unknown[] = [];
    const generator: BoardGenerator = {
      generate(config, seed) {
        seen.push([config, seed]);
        return new SeededBoardGenerator().generate(config, seed);
      },
    };
    createGame(PRESETS.beginner, 9, generator);
    expect(seen).toEqual([[PRESETS.beginner, 9]]);
  });
});

describe('createGame: an opening that clears the board', () => {
  it('is won at t = 0 on a 1x1 board with no mine', () => {
    const view = createGame({ width: 1, height: 1, mineCount: 0 }, 3).view();
    expect(view.status).toBe('won');
    expect(view.revealedCount).toBe(1);
    expect(view.exposedMines).toEqual([]);
  });

  it('is won at creation on a board with no mines, whatever the seed', () => {
    const game = createGame({ width: 4, height: 4, mineCount: 0 }, 11);
    expect(game.view().status).toBe('won');
    expect(game.view().revealedCount).toBe(16);
  });

  it('is won at creation when a cascade reaches every safe cell around a mine', () => {
    const config = { width: 5, height: 1, mineCount: 1 };
    const game = createGame(config, 1, fixed(config, [4], [0]));
    const view = game.view();
    expect(view.status).toBe('won');
    expect(view.revealedCount).toBe(4);
    expect(view.exposedMines).toEqual([4]);
  });

  it('ignores every command after that and logs nothing', () => {
    const game = createGame({ width: 1, height: 1, mineCount: 0 }, 3);
    expect(game.apply({ type: 'flag', index: 0, t: 1 })).toEqual([]);
    expect(game.apply({ type: 'reveal', index: 0, t: 2 })).toEqual([]);
    expect(game.log()).toEqual([]);
  });
});

describe('createGame: bad input', () => {
  it('rejects an invalid config with InvalidBoardConfigError', () => {
    expect(() => createGame({ width: 0, height: 5, mineCount: 1 }, 1)).toThrow(
      InvalidBoardConfigError,
    );
  });

  it('rejects a config with too many mines for the opening', () => {
    expect(() => createGame({ width: 9, height: 9, mineCount: 78 }, 1)).toThrow(
      InvalidBoardConfigError,
    );
  });

  it('rejects a seed that is not a uint32 with RangeError', () => {
    expect(() => createGame(PRESETS.beginner, -1)).toThrow(RangeError);
    expect(() => createGame(PRESETS.beginner, 1.5)).toThrow(RangeError);
    expect(() => createGame(PRESETS.beginner, 4294967296)).toThrow(RangeError);
  });
});

describe('new Game(board, opening)', () => {
  it('stays a plain hidden game without an opening', () => {
    const game = new Game(new Board({ width: 3, height: 3, mineCount: 1 }, [4]));
    expect(game.view().status).toBe('ready');
    expect(game.view().revealedCount).toBe(0);
  });

  it('rejects an opening cell that is a mine', () => {
    const board = new Board({ width: 3, height: 3, mineCount: 1 }, [4]);
    expect(() => new Game(board, [4])).toThrow(RangeError);
  });

  it('rejects an opening cell outside the board', () => {
    const board = new Board({ width: 3, height: 3, mineCount: 1 }, [4]);
    expect(() => new Game(board, [9])).toThrow(RangeError);
    expect(() => new Game(board, [-1])).toThrow(RangeError);
    expect(() => new Game(board, [1.5])).toThrow(RangeError);
  });

  it('accepts several opening cells and counts each cell once', () => {
    const board = new Board({ width: 5, height: 1, mineCount: 1 }, [4]);
    const game = new Game(board, [0, 1, 0]);
    expect(game.view().revealedCount).toBe(4);
    expect(game.view().status).toBe('won');
  });
});
