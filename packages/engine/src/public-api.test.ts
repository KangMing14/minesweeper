import { describe, expect, it } from 'vitest';
import {
  Board,
  Game,
  InvalidBoardConfigError,
  PRESETS,
  cellCount,
  safeCellCount,
  validateBoardConfig,
} from './index.js';
import type { Command, GameEvent, GameView } from './index.js';

// M1-T07: a consumer's view of the engine. Everything this file touches comes from `./index.js` and nothing
// else, exactly as `apps/web`, `apps/server` and `protocol` will import it, so a name that is needed to play
// a game but missing from the public entry point fails here.
//
// The board, 3 x 3, indices counted row by row from the top-left, mines `M` at 0 and 8:
//
//     M 1 0        index 0 1 2        number of adjacent mines per safe cell:
//     1 2 1              3 4 5        1 -> 1, 2 -> 0, 3 -> 1, 4 -> 2, 5 -> 1, 6 -> 0, 7 -> 1
//     0 1 M              6 7 8
const THREE_BY_THREE = { width: 3, height: 3, mineCount: 2 } as const;

/** Applies a command and checks that subscribers heard exactly the events that `apply` returned. */
function play(game: Game, heard: GameEvent[], command: Command): readonly GameEvent[] {
  const before = heard.length;
  const returned = game.apply(command);
  expect(heard.slice(before)).toEqual(returned);
  return returned;
}

describe('playing a game through the public entry point only', () => {
  it('wins a game with a reveal, a flag, a chord and a cascade', () => {
    const game = new Game(new Board(THREE_BY_THREE, [0, 8]));
    const heard: GameEvent[] = [];
    game.subscribe((event) => heard.push(event));

    const fresh: GameView = game.view();
    expect(fresh.status).toBe('ready');
    expect(fresh.revealedCount).toBe(0);
    expect(fresh.minesRemaining).toBe(2);
    expect(fresh.cells.every((cell) => cell.state === 'hidden')).toBe(true);
    expect('exposedMines' in fresh).toBe(false);

    // Revealing the empty cell 2 opens its neighbors 1, 4 and 5, which show numbers and stop the spread.
    const opening = play(game, heard, { type: 'reveal', index: 2, t: 1000 });
    expect(opening).toHaveLength(1);
    const [opened] = opening;
    expect(opened?.type).toBe('cellsRevealed');
    if (opened?.type !== 'cellsRevealed') throw new Error('expected a cellsRevealed event');
    expect([...opened.cells].sort((a, b) => a.index - b.index)).toEqual([
      { index: 1, value: 1 },
      { index: 2, value: 0 },
      { index: 4, value: 2 },
      { index: 5, value: 1 },
    ]);
    expect(game.view().status).toBe('playing');
    expect('exposedMines' in game.view()).toBe(false);

    // A flag on the mine at 0: flags are optional, but a chord needs them.
    expect(play(game, heard, { type: 'flag', index: 0, t: 2000 })).toEqual([
      { type: 'flagToggled', index: 0, flagged: true },
    ]);
    expect(game.view().flagCount).toBe(1);
    expect(game.view().minesRemaining).toBe(1);

    // Cell 1 shows 1 and has one flagged neighbor, so a chord opens its only other hidden neighbor, 3.
    expect(play(game, heard, { type: 'chord', index: 1, t: 3000 })).toEqual([
      { type: 'cellsRevealed', cells: [{ index: 3, value: 1 }] },
    ]);

    // The last empty cell, 6, opens 7. That is every safe cell, so the game is won.
    const finish = play(game, heard, { type: 'reveal', index: 6, t: 4000 });
    expect(finish.map((event) => event.type)).toEqual(['cellsRevealed', 'gameWon']);
    expect(finish[1]).toEqual({ type: 'gameWon', t: 4000 });

    const won = game.view();
    expect(won.status).toBe('won');
    expect(won.revealedCount).toBe(safeCellCount(THREE_BY_THREE));
    expect(won.exposedMines).toEqual([0, 8]);

    // A finished game ignores every command and leaves the view as it was.
    expect(play(game, heard, { type: 'reveal', index: 0, t: 5000 })).toEqual([]);
    expect(game.view()).toEqual(won);
    expect(heard.map((event) => event.type)).toEqual([
      'cellsRevealed',
      'flagToggled',
      'cellsRevealed',
      'cellsRevealed',
      'gameWon',
    ]);
  });

  it('loses on a mine, which stays hidden in the cells and is exposed in the view', () => {
    const game = new Game(new Board({ width: 3, height: 3, mineCount: 1 }, [4]));
    const heard: GameEvent[] = [];
    game.subscribe((event) => heard.push(event));

    play(game, heard, { type: 'reveal', index: 0, t: 100 });
    expect(play(game, heard, { type: 'reveal', index: 4, t: 500 })).toEqual([
      { type: 'gameLost', t: 500, mineIndex: 4 },
    ]);

    const lost = game.view();
    expect(lost.status).toBe('lost');
    expect(lost.exposedMines).toEqual([4]);
    expect(lost.cells[4]).toEqual({ state: 'hidden' });
    expect(lost.revealedCount).toBe(1);
    expect(play(game, heard, { type: 'flag', index: 1, t: 600 })).toEqual([]);
  });

  it('stops delivering events after unsubscribe', () => {
    const game = new Game(new Board(THREE_BY_THREE, [0, 8]));
    const heard: GameEvent[] = [];
    const unsubscribe = game.subscribe((event) => heard.push(event));

    game.apply({ type: 'flag', index: 0, t: 1 });
    unsubscribe();
    game.apply({ type: 'flag', index: 0, t: 2 });

    expect(heard).toEqual([{ type: 'flagToggled', index: 0, flagged: true }]);
  });

  it('throws RangeError for an index outside the board', () => {
    const game = new Game(new Board(THREE_BY_THREE, [0, 8]));
    expect(() => game.apply({ type: 'reveal', index: 9, t: 1 })).toThrow(RangeError);
  });
});

describe('configuration through the public entry point only', () => {
  it('accepts the three presets and counts their cells', () => {
    for (const config of Object.values(PRESETS)) validateBoardConfig(config);
    expect(cellCount(PRESETS.expert)).toBe(480);
    expect(safeCellCount(PRESETS.expert)).toBe(381);
  });

  it('rejects an invalid config with an error that names the field', () => {
    expect(() => validateBoardConfig({ width: 0, height: 9, mineCount: 1 })).toThrow(
      InvalidBoardConfigError,
    );
    try {
      validateBoardConfig({ width: 9, height: 9, mineCount: 81 });
      expect.unreachable('mineCount equal to the cell count must be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidBoardConfigError);
      expect((error as InvalidBoardConfigError).reason.startsWith('mineCount')).toBe(true);
    }
  });
});
