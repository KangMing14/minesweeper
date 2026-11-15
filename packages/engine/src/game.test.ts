import { describe, expect, it } from 'vitest';
import { Board } from './board.js';
import type { Command } from './command.js';
import { PRESETS } from './config.js';
import type { GameEvent } from './events.js';
import { Game } from './game.js';

// M . .
// . . .
// . . M
const diagonal = (): Board => new Board({ width: 3, height: 3, mineCount: 2 }, [0, 8]);

describe('new Game', () => {
  it('starts as ready, with every cell hidden and nothing revealed or flagged', () => {
    const view = new Game(diagonal()).view();
    expect(view.status).toBe('ready');
    expect(view.width).toBe(3);
    expect(view.height).toBe(3);
    expect(view.cells).toHaveLength(9);
    expect(view.cells.every((cell) => cell.state === 'hidden')).toBe(true);
    expect(view.revealedCount).toBe(0);
    expect(view.flagCount).toBe(0);
    expect(view.minesRemaining).toBe(2);
  });

  it('has no exposedMines key before the game ends', () => {
    const view = new Game(diagonal()).view();
    expect('exposedMines' in view).toBe(false);
  });

  it('works for every preset', () => {
    for (const config of Object.values(PRESETS)) {
      const mines = Array.from({ length: config.mineCount }, (_, i) => i);
      const view = new Game(new Board(config, mines)).view();
      expect(view.cells).toHaveLength(config.width * config.height);
      expect(view.minesRemaining).toBe(config.mineCount);
    }
  });

  it('gives a view with no trace of where the mines are', () => {
    const a = new Board({ width: 9, height: 9, mineCount: 10 }, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const b = new Board(
      { width: 9, height: 9, mineCount: 10 },
      [71, 72, 73, 74, 75, 76, 77, 78, 79, 80],
    );
    expect(JSON.stringify(new Game(a).view())).toBe(JSON.stringify(new Game(b).view()));
  });

  it('is independent of other games on the same board', () => {
    const board = diagonal();
    const first = new Game(board);
    const second = new Game(board);
    expect(first.view()).toEqual(second.view());
    expect(first.view()).not.toBe(second.view());
  });
});

describe('Game.view', () => {
  it('returns a fresh, frozen snapshot on every call', () => {
    const game = new Game(diagonal());
    const first = game.view();
    const second = game.view();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.cells)).toBe(true);
  });
});

describe('Game.subscribe', () => {
  it('returns a function that can be called more than once without error', () => {
    const game = new Game(diagonal());
    const unsubscribe = game.subscribe(() => {});
    expect(typeof unsubscribe).toBe('function');
    expect(() => {
      unsubscribe();
      unsubscribe();
    }).not.toThrow();
  });
});

/** A reveal command. */
const reveal = (index: number, t = 0): Command => ({ type: 'reveal', index, t });

/** Everything a game announces, in order, while `action` runs. */
function collect(game: Game, action: () => void): GameEvent[] {
  const heard: GameEvent[] = [];
  const stop = game.subscribe((event) => heard.push(event));
  try {
    action();
  } finally {
    stop();
  }
  return heard;
}

// 4x4, one mine in the bottom-right corner. Everything else cascades from the top-left:
//   0 0 0 0
//   0 0 0 0
//   0 0 1 1
//   0 0 1 M
const corner = (): Board => new Board({ width: 4, height: 4, mineCount: 1 }, [15]);

describe('Game.apply: reveal a single cell', () => {
  it('reveals a numbered cell, reports it in one event and moves the game to playing', () => {
    const game = new Game(corner());
    const events = game.apply(reveal(10, 1_500)); // (2,2) touches the mine
    expect(events).toEqual([{ type: 'cellsRevealed', cells: [{ index: 10, value: 1 }] }]);
    const view = game.view();
    expect(view.status).toBe('playing');
    expect(view.revealedCount).toBe(1);
    expect(view.cells[10]).toEqual({ state: 'revealed', value: 1 });
    expect(view.cells[0]).toEqual({ state: 'hidden' });
  });

  it('returns events that can be kept: a frozen array', () => {
    const events = new Game(corner()).apply(reveal(10));
    expect(Object.isFrozen(events)).toBe(true);
  });

  it('is status ready until the first command and playing after it', () => {
    const game = new Game(corner());
    expect(game.view().status).toBe('ready');
    game.apply(reveal(10));
    expect(game.view().status).toBe('playing');
    game.apply(reveal(11));
    expect(game.view().status).toBe('playing');
  });

  it('delivers the returned events to subscribers, in order, and stops after unsubscribe', () => {
    const game = new Game(corner());
    let returned: readonly GameEvent[] = [];
    const heard = collect(game, () => {
      returned = game.apply(reveal(10));
    });
    expect(heard).toEqual(returned);
    expect(heard).toHaveLength(1);

    const stop = game.subscribe(() => {
      throw new Error('should not be called after unsubscribe');
    });
    stop();
    expect(() => game.apply(reveal(11))).not.toThrow();
  });
});

describe('Game.apply: cascades', () => {
  it('opens the whole zero region in one cellsRevealed event', () => {
    const game = new Game(corner());
    const events = game.apply(reveal(0));
    expect(events).toHaveLength(1);
    const event = events[0];
    if (event?.type !== 'cellsRevealed') throw new Error('expected cellsRevealed');
    expect(event.cells).toHaveLength(15); // every cell but the mine
    expect(event.cells[0]).toEqual({ index: 0, value: 0 });
    expect(game.view().revealedCount).toBe(15);
    expect(game.view().cells[15]).toEqual({ state: 'hidden' });
  });

  it('cascades the whole zero-mine expert board in one command, under 16 ms, without overflow', () => {
    const board = new Board({ ...PRESETS.expert, mineCount: 0 }, []);
    // Fresh games so every run does the full cascade. The clock is `Date.now` (whole milliseconds): the
    // engine's own tsconfig has no `performance` type, and tests may read the clock (eslint.config.js).
    // The best of three runs keeps a noisy CI machine from failing a cascade that takes about a millisecond.
    let best = Number.POSITIVE_INFINITY;
    for (let run = 0; run < 3; run++) {
      const game = new Game(board);
      const started = Date.now();
      const events = game.apply(reveal(0));
      best = Math.min(best, Date.now() - started);
      const event = events[0];
      if (event?.type !== 'cellsRevealed') throw new Error('expected cellsRevealed');
      expect(events).toHaveLength(1);
      expect(event.cells).toHaveLength(480);
      expect(game.view().revealedCount).toBe(480);
    }
    expect(best).toBeLessThan(16);
  });

  it('cascades the largest legal board (100x100) in one command', () => {
    const game = new Game(new Board({ width: 100, height: 100, mineCount: 0 }, []));
    const events = game.apply(reveal(0));
    const event = events[0];
    if (event?.type !== 'cellsRevealed') throw new Error('expected cellsRevealed');
    expect(event.cells).toHaveLength(10_000);
    expect(game.view().revealedCount).toBe(10_000);
  });
});

describe('Game.apply: revealing a mine', () => {
  it('loses the game with one gameLost event and exposes the mines', () => {
    const game = new Game(corner());
    game.apply(reveal(10, 100));
    const events = game.apply(reveal(15, 2_345));
    expect(events).toEqual([{ type: 'gameLost', t: 2_345, mineIndex: 15 }]);
    const view = game.view();
    expect(view.status).toBe('lost');
    expect(view.exposedMines).toEqual([15]);
  });

  it('does not count the mine as a revealed cell', () => {
    const game = new Game(corner());
    game.apply(reveal(10));
    game.apply(reveal(15));
    const view = game.view();
    expect(view.revealedCount).toBe(1);
    expect(view.cells[15]).toEqual({ state: 'hidden' });
  });

  it('can lose on the very first command', () => {
    const game = new Game(corner());
    expect(game.apply(reveal(15, 7))).toEqual([{ type: 'gameLost', t: 7, mineIndex: 15 }]);
    expect(game.view().status).toBe('lost');
  });

  it('delivers gameLost to subscribers', () => {
    const game = new Game(corner());
    const heard = collect(game, () => game.apply(reveal(15, 9)));
    expect(heard).toEqual([{ type: 'gameLost', t: 9, mineIndex: 15 }]);
  });

  it('has no exposedMines key while the game is in progress', () => {
    const game = new Game(corner());
    game.apply(reveal(10));
    expect('exposedMines' in game.view()).toBe(false);
  });
});

describe('Game.apply: commands that do nothing', () => {
  it('returns [] for a cell that is already revealed and leaves the view identical', () => {
    const game = new Game(corner());
    game.apply(reveal(10));
    const before = game.view();
    const heard = collect(game, () => {
      expect(game.apply(reveal(10, 50))).toEqual([]);
    });
    expect(heard).toEqual([]);
    expect(game.view()).toEqual(before);
  });

  it('returns [] for a cell opened earlier by a cascade', () => {
    const game = new Game(corner());
    game.apply(reveal(0));
    const before = game.view();
    expect(game.apply(reveal(5))).toEqual([]);
    expect(game.view()).toEqual(before);
  });

  // TODO(M1-T05): once `flag` exists, add the Game-level check that a reveal on a flagged cell returns []
  // and leaves the view identical. The cell-level rule is already tested through `revealCell`.

  it('ignores flag and chord for now: [] and no change', () => {
    // TODO(M1-T05): replace with the real flag and chord tests.
    const game = new Game(corner());
    const before = game.view();
    expect(game.apply({ type: 'flag', index: 3, t: 0 })).toEqual([]);
    expect(game.apply({ type: 'chord', index: 3, t: 0 })).toEqual([]);
    expect(game.view()).toEqual(before);
  });

  it('returns [] for a reveal after the game is lost and leaves the view identical', () => {
    // M1-T06 adds the full post-game suite; this is the minimal guard that a lost game stays lost.
    const game = new Game(corner());
    game.apply(reveal(15));
    const before = game.view();
    expect(game.apply(reveal(0))).toEqual([]);
    expect(game.apply(reveal(15))).toEqual([]);
    expect(game.view()).toEqual(before);
  });
});

describe('Game.apply: out-of-range indices', () => {
  it('throws RangeError and changes nothing, for every command type', () => {
    for (const type of ['reveal', 'flag', 'chord'] as const) {
      for (const index of [-1, 16, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        const game = new Game(corner());
        const before = game.view();
        expect(() => game.apply({ type, index, t: 0 })).toThrow(RangeError);
        expect(game.view()).toEqual(before);
      }
    }
  });

  it('still throws after the game is over', () => {
    const game = new Game(corner());
    game.apply(reveal(15));
    expect(() => game.apply(reveal(99))).toThrow(RangeError);
  });
});

describe('Game.apply: determinism', () => {
  it('gives the same events and the same view for the same board and commands', () => {
    const commands = [reveal(10, 1), reveal(0, 2), reveal(15, 3)];
    const run = (): { events: readonly GameEvent[][]; view: unknown } => {
      const game = new Game(corner());
      return { events: commands.map((c) => [...game.apply(c)]), view: game.view() };
    };
    expect(run()).toEqual(run());
  });

  it('does not let two games on one board affect each other', () => {
    const board = corner();
    const first = new Game(board);
    const second = new Game(board);
    first.apply(reveal(0));
    expect(second.view().revealedCount).toBe(0);
    expect(second.view().status).toBe('ready');
  });
});
