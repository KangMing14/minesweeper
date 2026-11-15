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

/** A flag command. */
const flag = (index: number, t = 0): Command => ({ type: 'flag', index, t });

/** A chord command. */
const chord = (index: number, t = 0): Command => ({ type: 'chord', index, t });

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

  it('returns [] for a cell that is flagged and leaves the view identical', () => {
    const game = new Game(corner());
    game.apply(flag(15)); // a flagged mine
    game.apply(flag(3)); // a flagged safe cell
    const before = game.view();
    expect(game.apply(reveal(15))).toEqual([]);
    expect(game.apply(reveal(3))).toEqual([]);
    expect(game.view()).toEqual(before);
    expect(game.view().status).toBe('playing');
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

describe('Game.apply: unknown command types', () => {
  it('returns [] and changes nothing, for input that did not come from typed code', () => {
    const game = new Game(corner());
    const before = game.view();
    const unknown = { type: 'question-mark', index: 3, t: 0 } as unknown as Command;
    expect(game.apply(unknown)).toEqual([]);
    expect(game.view()).toEqual(before);
    expect(game.view().status).toBe('ready');
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

describe('Game.apply: flag', () => {
  it('flags a hidden cell: one flagToggled event, the cell shows as flagged, the counts follow', () => {
    const game = new Game(corner());
    const events = game.apply(flag(3, 700));
    expect(events).toEqual([{ type: 'flagToggled', index: 3, flagged: true }]);
    const view = game.view();
    expect(view.cells[3]).toEqual({ state: 'flagged' });
    expect(view.flagCount).toBe(1);
    expect(view.minesRemaining).toBe(0);
    expect(view.revealedCount).toBe(0);
  });

  it('takes the flag off again: flagged becomes hidden', () => {
    const game = new Game(corner());
    game.apply(flag(3));
    const events = game.apply(flag(3));
    expect(events).toEqual([{ type: 'flagToggled', index: 3, flagged: false }]);
    expect(game.view().cells[3]).toEqual({ state: 'hidden' });
    expect(game.view().flagCount).toBe(0);
    expect(game.view().minesRemaining).toBe(1);
  });

  it('returns a frozen event array and frozen events', () => {
    const events = new Game(corner()).apply(flag(3));
    expect(Object.isFrozen(events)).toBe(true);
    expect(Object.isFrozen(events[0])).toBe(true);
  });

  it('does nothing on a revealed cell: [] and an identical view', () => {
    const game = new Game(corner());
    game.apply(reveal(10));
    const before = game.view();
    expect(game.apply(flag(10))).toEqual([]);
    expect(game.view()).toEqual(before);
  });

  it('does nothing on a cell that a cascade opened', () => {
    const game = new Game(corner());
    game.apply(reveal(0));
    const before = game.view();
    expect(game.apply(flag(5))).toEqual([]);
    expect(game.view()).toEqual(before);
  });

  it('moves the game from ready to playing, like any command that takes effect', () => {
    const game = new Game(corner());
    expect(game.view().status).toBe('ready');
    game.apply(flag(3));
    expect(game.view().status).toBe('playing');
  });

  it('keeps a game ready when the flag command changes nothing', () => {
    // Nothing is revealed yet, so the only no-op for `flag` is an out-of-range index, which throws.
    // A chord on a hidden cell is the no-op that must not start the game (see the chord tests).
    const game = new Game(corner());
    game.apply(chord(3));
    expect(game.view().status).toBe('ready');
  });

  it('lets a flag be placed on a mine or on a safe cell, and the two look the same', () => {
    const mineAt15 = new Game(new Board({ width: 4, height: 4, mineCount: 1 }, [15]));
    const mineAt14 = new Game(new Board({ width: 4, height: 4, mineCount: 1 }, [14]));
    mineAt15.apply(flag(14)); // safe here
    mineAt14.apply(flag(14)); // a mine here
    expect(JSON.stringify(mineAt15.view())).toBe(JSON.stringify(mineAt14.view()));
    expect(mineAt14.view().status).toBe('playing'); // flagging a mine does not hurt
  });

  it('allows more flags than mines: minesRemaining goes negative', () => {
    const game = new Game(corner());
    game.apply(flag(0));
    game.apply(flag(1));
    game.apply(flag(2));
    expect(game.view().flagCount).toBe(3);
    expect(game.view().minesRemaining).toBe(-2);
  });

  it('has no question-mark state: the third toggle is a flag again', () => {
    const game = new Game(corner());
    const states = [3, 3, 3].map(() => {
      game.apply(flag(3));
      return game.view().cells[3]?.state;
    });
    expect(states).toEqual(['flagged', 'hidden', 'flagged']);
  });

  it('lets a flagged cell be revealed after the flag is removed', () => {
    const game = new Game(corner());
    game.apply(flag(10));
    expect(game.apply(reveal(10))).toEqual([]);
    game.apply(flag(10));
    expect(game.apply(reveal(10))).toEqual([
      { type: 'cellsRevealed', cells: [{ index: 10, value: 1 }] },
    ]);
  });

  it('delivers the event to subscribers', () => {
    const game = new Game(corner());
    const heard = collect(game, () => {
      game.apply(flag(3));
      game.apply(flag(3));
    });
    expect(heard).toEqual([
      { type: 'flagToggled', index: 3, flagged: true },
      { type: 'flagToggled', index: 3, flagged: false },
    ]);
  });

  it('does nothing after the game is lost', () => {
    const game = new Game(corner());
    game.apply(reveal(15));
    const before = game.view();
    expect(game.apply(flag(3))).toEqual([]);
    expect(game.view()).toEqual(before);
  });
});

describe('Game.apply: chord', () => {
  /** The 4x4 corner board with 10 (a 1) open and the given cells flagged. */
  function opened(flags: readonly number[]): Game {
    const game = new Game(corner());
    game.apply(reveal(10));
    for (const index of flags) game.apply(flag(index));
    return game;
  }

  it('with the right flag opens every other neighbor in one cellsRevealed event', () => {
    const game = opened([15]);
    const events = game.apply(chord(10, 2_000));
    expect(events).toHaveLength(1);
    const [event] = events;
    if (event?.type !== 'cellsRevealed')
      throw new Error(`expected cellsRevealed, got ${event?.type}`);
    // Every safe cell except 10, which was already open. The cascades from 5, 6, 7 and 9 overlap, and each
    // cell is still listed once.
    const indices = event.cells.map((cell) => cell.index);
    expect(new Set(indices).size).toBe(14);
    expect(indices).not.toContain(10);
    expect(indices).not.toContain(15);
    const view = game.view();
    expect(view.revealedCount).toBe(15);
    expect(view.cells[15]).toEqual({ state: 'flagged' });
    expect(view.status).toBe('playing'); // winning is detected from M1-T06
  });

  it('loses when a flag is wrong and a mine is left unflagged: safe cells first, then gameLost', () => {
    const game = opened([14]); // 14 is safe; the mine at 15 is not flagged
    const events = game.apply(chord(10, 3_000));
    expect(events.map((event) => event.type)).toEqual(['cellsRevealed', 'gameLost']);
    expect(events[1]).toEqual({ type: 'gameLost', t: 3_000, mineIndex: 15 });
    const view = game.view();
    expect(view.status).toBe('lost');
    expect(view.exposedMines).toEqual([15]);
    expect(view.cells[14]).toEqual({ state: 'flagged' }); // the wrong flag stays where it was
    expect(view.cells[15]).toEqual({ state: 'hidden' }); // a hit mine is not counted as revealed
    expect(view.revealedCount).toBe(14); // the safe neighbors opened before the loss
  });

  it('names the lowest-index mine when it hits several', () => {
    // 3x3 with mines at 0 and 2: the centre shows 2. Two wrong flags satisfy it and leave both mines open.
    const game = new Game(new Board({ width: 3, height: 3, mineCount: 2 }, [0, 2]));
    game.apply(reveal(4));
    game.apply(flag(1));
    game.apply(flag(3));
    const events = game.apply(chord(4, 500));
    expect(events).toEqual([
      {
        type: 'cellsRevealed',
        cells: [
          { index: 5, value: 1 },
          { index: 6, value: 0 },
          { index: 7, value: 0 },
          { index: 8, value: 0 },
        ],
      },
      { type: 'gameLost', t: 500, mineIndex: 0 },
    ]);
  });

  it('emits only gameLost when the mine is the only cell left to open', () => {
    const game = new Game(new Board({ width: 4, height: 1, mineCount: 1 }, [2]));
    game.apply(reveal(1));
    game.apply(flag(0)); // wrong
    expect(game.apply(chord(1, 90))).toEqual([{ type: 'gameLost', t: 90, mineIndex: 2 }]);
    expect(game.view().status).toBe('lost');
  });

  it('does nothing with too few flags: [] and an identical view', () => {
    const game = opened([]);
    const before = game.view();
    expect(game.apply(chord(10))).toEqual([]);
    expect(game.view()).toEqual(before);
  });

  it('does nothing with too many flags: [] and an identical view', () => {
    const game = opened([14, 15]);
    const before = game.view();
    expect(game.apply(chord(10))).toEqual([]);
    expect(game.view()).toEqual(before);
  });

  it('does nothing on a hidden cell, a flagged cell and a revealed zero', () => {
    const game = new Game(corner());
    game.apply(reveal(0)); // cascades; 0 shows 0, 15 stays hidden
    game.apply(flag(15));
    const before = game.view();
    expect(game.apply(chord(15))).toEqual([]); // flagged mine
    expect(game.apply(chord(11))).toEqual([]); // revealed 1 with no matching flag
    expect(game.apply(chord(0))).toEqual([]); // revealed zero
    expect(game.view()).toEqual(before);
  });

  it('does nothing on a revealed zero even when a hidden neighbor is left next to it', () => {
    // A flag on a cell keeps a cascade out of it; taking the flag off leaves a hidden cell next to a zero.
    const game = new Game(corner());
    game.apply(flag(1));
    game.apply(reveal(0)); // cascades around the flag; 0 shows 0
    game.apply(flag(1)); // flag off: cell 1 is hidden again
    expect(game.view().cells[1]).toEqual({ state: 'hidden' });
    const before = game.view();
    expect(game.apply(chord(0))).toEqual([]);
    expect(game.view()).toEqual(before);
  });

  it('does nothing on a hidden cell, and does not start the game', () => {
    const game = new Game(corner());
    expect(game.apply(chord(10))).toEqual([]);
    expect(game.view().status).toBe('ready');
  });

  it('does nothing the second time: the neighbors are already open', () => {
    const game = opened([15]);
    game.apply(chord(10));
    const before = game.view();
    expect(game.apply(chord(10))).toEqual([]);
    expect(game.view()).toEqual(before);
  });

  it('counts flags, not mines: a right number of wrong flags is enough to chord', () => {
    const game = opened([14]);
    expect(game.apply(chord(10)).map((event) => event.type)).toEqual(['cellsRevealed', 'gameLost']);
  });

  it('does nothing after the game is lost', () => {
    const game = opened([14]);
    game.apply(chord(10));
    const before = game.view();
    expect(game.apply(chord(10))).toEqual([]);
    expect(game.view()).toEqual(before);
  });

  it('delivers both events of a losing chord to every subscriber, in order', () => {
    const game = opened([14]);
    const first: GameEvent['type'][] = [];
    const second: GameEvent['type'][] = [];
    game.subscribe((event) => first.push(event.type));
    game.subscribe((event) => second.push(event.type));
    game.apply(chord(10));
    expect(first).toEqual(['cellsRevealed', 'gameLost']);
    expect(second).toEqual(['cellsRevealed', 'gameLost']);
  });

  it('still delivers gameLost when a subscriber throws on cellsRevealed, then rethrows the first error', () => {
    const game = opened([14]);
    const heard: GameEvent['type'][] = [];
    game.subscribe((event) => {
      if (event.type === 'cellsRevealed') throw new Error('boom');
    });
    game.subscribe((event) => heard.push(event.type));
    expect(() => game.apply(chord(10))).toThrow('boom');
    expect(heard).toEqual(['cellsRevealed', 'gameLost']);
    expect(game.view().status).toBe('lost');
  });

  it('rethrows only the first error when a subscriber throws on both events of a chord', () => {
    const game = opened([14]);
    game.subscribe((event) => {
      throw new Error(event.type);
    });
    expect(() => game.apply(chord(10))).toThrow('cellsRevealed');
    expect(game.view().status).toBe('lost');
  });

  it('gives the same events and view for the same commands, twice', () => {
    const run = (): { events: GameEvent[][]; view: unknown } => {
      const game = new Game(corner());
      const commands = [reveal(10, 1), flag(14, 2), chord(10, 3)];
      return { events: commands.map((c) => [...game.apply(c)]), view: game.view() };
    };
    expect(run()).toEqual(run());
  });
});
