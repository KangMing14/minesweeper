import { describe, expect, it } from 'vitest';
import { Board } from './board.js';
import type { Command } from './command.js';
import type { GameEvent } from './events.js';
import { Game } from './game.js';

// Win, loss and the rules after them (M1-T06). The earlier suites (`game.test.ts`, `reveal.test.ts`,
// `chord.test.ts`) cover how single commands behave; this one covers how a game ends and what an ended game
// does.

const reveal = (index: number, t = 0): Command => ({ type: 'reveal', index, t });
const flag = (index: number, t = 0): Command => ({ type: 'flag', index, t });
const chord = (index: number, t = 0): Command => ({ type: 'chord', index, t });

/** Every command type on every cell of a board, in a fixed order. */
function everyCommand(cells: number): Command[] {
  const commands: Command[] = [];
  for (let index = 0; index < cells; index++) {
    for (const type of ['reveal', 'flag', 'chord'] as const) {
      commands.push({ type, index, t: 99_000 });
    }
  }
  return commands;
}

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

// M . .      The two zeros are the corners at 2 and 6; the other safe cells are numbers.
// . . .
// . . M
const diagonal = (): Board => new Board({ width: 3, height: 3, mineCount: 2 }, [0, 8]);

describe('winning by reveal', () => {
  it('is won by one reveal on a 1x1 board with no mine', () => {
    const game = new Game(new Board({ width: 1, height: 1, mineCount: 0 }, []));
    expect(game.view().status).toBe('ready');
    const events = game.apply(reveal(0, 640));
    expect(events).toEqual([
      { type: 'cellsRevealed', cells: [{ index: 0, value: 0 }] },
      { type: 'gameWon', t: 640 },
    ]);
    const view = game.view();
    expect(view.status).toBe('won');
    expect(view.revealedCount).toBe(1);
    expect(view.exposedMines).toEqual([]);
  });

  it('is won when the last safe cell of a one-row board is revealed', () => {
    const game = new Game(new Board({ width: 3, height: 1, mineCount: 1 }, [1]));
    expect(game.apply(reveal(0, 10)).map((event) => event.type)).toEqual(['cellsRevealed']);
    expect(game.view().status).toBe('playing');
    const events = game.apply(reveal(2, 20));
    expect(events.map((event) => event.type)).toEqual(['cellsRevealed', 'gameWon']);
    expect(events[1]).toEqual({ type: 'gameWon', t: 20 });
    expect(game.view().status).toBe('won');
  });

  it('is won by a cascade that opens every safe cell: cellsRevealed, then gameWon, from one command', () => {
    const game = new Game(corner());
    const events = game.apply(reveal(0, 1_750));
    expect(events.map((event) => event.type)).toEqual(['cellsRevealed', 'gameWon']);
    expect(events[1]).toEqual({ type: 'gameWon', t: 1_750 });
    const view = game.view();
    expect(view.status).toBe('won');
    expect(view.revealedCount).toBe(15);
  });

  it('takes the time of the winning command, not of an earlier one', () => {
    const game = new Game(diagonal());
    game.apply(reveal(2, 100));
    const events = game.apply(reveal(6, 4_321));
    expect(events.at(-1)).toEqual({ type: 'gameWon', t: 4_321 });
  });

  it('stays playing until the last safe cell, then wins on it', () => {
    const game = new Game(diagonal()); // 7 safe cells
    const first = game.apply(reveal(2, 100)); // 2 is a zero: opens 1, 2, 4, 5
    expect(first.map((event) => event.type)).toEqual(['cellsRevealed']);
    expect(game.view().status).toBe('playing');
    expect(game.view().revealedCount).toBe(4);
    const second = game.apply(reveal(6, 200)); // 6 is a zero: opens 3, 6, 7
    expect(second.map((event) => event.type)).toEqual(['cellsRevealed', 'gameWon']);
    expect(game.view().revealedCount).toBe(7);
    expect(game.view().status).toBe('won');
  });

  it('exposes every mine, ascending, when the game is won', () => {
    const game = new Game(diagonal());
    game.apply(reveal(2));
    game.apply(reveal(6));
    expect(game.view().exposedMines).toEqual([0, 8]);
  });

  it('does not need any flag: mines stay hidden and the game is still won', () => {
    const game = new Game(diagonal());
    game.apply(reveal(2));
    game.apply(reveal(6));
    const view = game.view();
    expect(view.status).toBe('won');
    expect(view.flagCount).toBe(0);
    expect(view.cells[0]).toEqual({ state: 'hidden' });
    expect(view.cells[8]).toEqual({ state: 'hidden' });
  });

  it('is won with flags on the mines too, and they stay on the board', () => {
    const game = new Game(diagonal());
    game.apply(flag(0));
    game.apply(flag(8));
    game.apply(reveal(2));
    game.apply(reveal(6));
    const view = game.view();
    expect(view.status).toBe('won');
    expect(view.flagCount).toBe(2);
    expect(view.minesRemaining).toBe(0);
    expect(view.cells[0]).toEqual({ state: 'flagged' });
  });

  it('is not won while a flag sits on a safe cell, and is won once that flag is removed and the cell revealed', () => {
    const game = new Game(diagonal());
    game.apply(flag(7)); // 7 is safe
    game.apply(reveal(2));
    const blocked = game.apply(reveal(6)); // opens 3 and 6 but not the flagged 7
    expect(blocked.map((event) => event.type)).toEqual(['cellsRevealed']);
    expect(game.view().status).toBe('playing');
    expect(game.view().revealedCount).toBe(6);
    expect(game.apply(reveal(7))).toEqual([]); // still flagged
    game.apply(flag(7)); // take the flag off
    const events = game.apply(reveal(7, 900));
    expect(events.map((event) => event.type)).toEqual(['cellsRevealed', 'gameWon']);
    expect(game.view().status).toBe('won');
  });

  it('delivers both events to subscribers, in order', () => {
    const game = new Game(corner());
    const heard = collect(game, () => game.apply(reveal(0, 5)));
    expect(heard.map((event) => event.type)).toEqual(['cellsRevealed', 'gameWon']);
  });

  it('still delivers gameWon when a subscriber throws on cellsRevealed, and rethrows the first error', () => {
    const game = new Game(corner());
    const heard: string[] = [];
    game.subscribe((event) => {
      heard.push(event.type);
      if (event.type === 'cellsRevealed') throw new Error('first');
    });
    const late: string[] = [];
    game.subscribe((event) => late.push(event.type));
    expect(() => game.apply(reveal(0))).toThrow('first');
    expect(heard).toEqual(['cellsRevealed', 'gameWon']);
    expect(late).toEqual(['cellsRevealed', 'gameWon']);
    expect(game.view().status).toBe('won'); // the game changed before anything was delivered
  });

  it('returns a frozen array of frozen events', () => {
    const events = new Game(corner()).apply(reveal(0));
    expect(Object.isFrozen(events)).toBe(true);
    expect(events.every((event) => Object.isFrozen(event))).toBe(true);
  });
});

describe('winning by chord', () => {
  it('is won by a chord that opens the last safe cells (the M1-T05 follow-up)', () => {
    const game = new Game(corner());
    game.apply(reveal(10));
    game.apply(flag(15));
    const events = game.apply(chord(10, 2_000));
    expect(events.map((event) => event.type)).toEqual(['cellsRevealed', 'gameWon']);
    expect(events[1]).toEqual({ type: 'gameWon', t: 2_000 });
    const view = game.view();
    expect(view.status).toBe('won');
    expect(view.revealedCount).toBe(15);
    expect(view.exposedMines).toEqual([15]);
  });

  it('does not win when the chord leaves a safe cell closed', () => {
    // 3x3 with the mine in the middle: every other cell shows 1.
    const game = new Game(new Board({ width: 3, height: 3, mineCount: 1 }, [4]));
    game.apply(reveal(0));
    game.apply(flag(4));
    const events = game.apply(chord(0)); // opens 1 and 3 only
    expect(events.map((event) => event.type)).toEqual(['cellsRevealed']);
    expect(game.view().status).toBe('playing');
  });

  it('never wins on a chord that hits a mine: a wrong flag keeps one safe cell closed', () => {
    const game = new Game(corner());
    game.apply(reveal(10));
    game.apply(flag(14)); // 14 is safe, the mine at 15 is not flagged
    const events = game.apply(chord(10, 3_000));
    expect(events.map((event) => event.type)).toEqual(['cellsRevealed', 'gameLost']);
    const view = game.view();
    expect(view.status).toBe('lost');
    expect(view.revealedCount).toBe(14); // one short of the 15 safe cells: 14 is still under the flag
  });
});

describe('losing', () => {
  it('is lost by revealing a mine, with exposedMines listing every mine', () => {
    const game = new Game(diagonal());
    game.apply(reveal(2));
    const events = game.apply(reveal(8, 777));
    expect(events).toEqual([{ type: 'gameLost', t: 777, mineIndex: 8 }]);
    const view = game.view();
    expect(view.status).toBe('lost');
    expect(view.exposedMines).toEqual([0, 8]);
  });

  it('is lost, not won, when a mine is hit while safe cells are still closed, and stays lost', () => {
    const game = new Game(diagonal());
    game.apply(reveal(2)); // opens 1, 2, 4, 5
    game.apply(reveal(3));
    game.apply(reveal(0)); // a mine, with 6 and 7 still closed
    expect(game.view().status).toBe('lost');
    expect(game.view().revealedCount).toBe(5);
    expect(collect(game, () => game.apply(reveal(6)))).toEqual([]);
    expect(game.view().status).toBe('lost');
  });
});

describe('status transitions', () => {
  it('goes ready, then playing, then won', () => {
    const game = new Game(diagonal());
    const seen = [game.view().status];
    game.apply(reveal(2));
    seen.push(game.view().status);
    game.apply(reveal(6));
    seen.push(game.view().status);
    expect(seen).toEqual(['ready', 'playing', 'won']);
  });

  it('goes ready, then playing on a flag, then lost', () => {
    const game = new Game(diagonal());
    const seen = [game.view().status];
    game.apply(flag(4));
    seen.push(game.view().status);
    game.apply(reveal(0));
    seen.push(game.view().status);
    expect(seen).toEqual(['ready', 'playing', 'lost']);
  });

  it('goes straight from ready to won or to lost on a single command', () => {
    const winner = new Game(corner());
    winner.apply(reveal(0));
    expect(winner.view().status).toBe('won');

    const loser = new Game(corner());
    loser.apply(reveal(15));
    expect(loser.view().status).toBe('lost');
  });

  it('stays ready after a command that takes no effect', () => {
    const game = new Game(diagonal());
    game.apply(chord(2)); // a chord on a hidden cell
    expect(game.view().status).toBe('ready');
  });
});

describe('after the game is over (Review Focus #2)', () => {
  /** A won game and a lost game on the same 4x4 board, in a state where some cells are flagged. */
  function finished(how: 'won' | 'lost'): Game {
    const game = new Game(corner());
    game.apply(flag(3)); // a flag on a safe cell
    game.apply(flag(15)); // a flag on the mine
    if (how === 'lost') {
      game.apply(flag(15)); // take it off again
      game.apply(reveal(15));
    } else {
      game.apply(flag(3)); // take the flag off the safe cell so that the game can be won
      game.apply(reveal(0));
    }
    expect(game.view().status).toBe(how);
    return game;
  }

  it.each(['won', 'lost'] as const)(
    'returns [] for every command type on every cell of a %s game and leaves the view identical',
    (how) => {
      const game = finished(how);
      const before = game.view();
      for (const command of everyCommand(16)) {
        expect(game.apply(command)).toEqual([]);
      }
      expect(game.view()).toEqual(before);
    },
  );

  it.each(['won', 'lost'] as const)('delivers nothing to subscribers after a %s game', (how) => {
    const game = finished(how);
    const heard = collect(game, () => {
      for (const command of everyCommand(16)) game.apply(command);
    });
    expect(heard).toEqual([]);
  });

  it.each(['won', 'lost'] as const)(
    'still throws RangeError for a bad index after a %s game',
    (how) => {
      const game = finished(how);
      expect(() => game.apply(reveal(16))).toThrow(RangeError);
      expect(() => game.apply(flag(-1))).toThrow(RangeError);
      expect(() => game.apply(chord(1.5))).toThrow(RangeError);
    },
  );

  it.each(['won', 'lost'] as const)(
    'keeps exposedMines and the counts of a %s game unchanged',
    (how) => {
      const game = finished(how);
      const view = game.view();
      game.apply(flag(15));
      game.apply(reveal(15));
      const after = game.view();
      expect(after.exposedMines).toEqual([15]);
      expect(after.revealedCount).toBe(view.revealedCount);
      expect(after.flagCount).toBe(view.flagCount);
      expect(after.minesRemaining).toBe(view.minesRemaining);
    },
  );
});
