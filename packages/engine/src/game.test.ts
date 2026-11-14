import { describe, expect, it } from 'vitest';
import { Board } from './board.js';
import { PRESETS } from './config.js';
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

  // TODO(M1-T04): once `apply` exists, add the Game-level checks that a reveal delivers its events to
  // subscribers and that unsubscribing stops delivery. The emitter itself is tested in events.test.ts.
});
