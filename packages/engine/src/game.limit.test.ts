import { describe, expect, it } from 'vitest';
import {
  Board,
  Game,
  MAX_REPLAY_COMMANDS,
  PRESETS,
  createGame,
  replay,
  validateReplayLog,
} from './index.js';
import type { Command, GameEvent } from './index.js';

// The limit on the command log (M2-T07, review B1 of M2). A game accepts at most `MAX_REPLAY_COMMANDS`
// commands, the same number `validateReplayLog` allows, so that every live game can be replayed. Flag toggles
// are the reason: they are accepted for ever, and without a limit a legal game could log more commands than
// `replay` is willing to read.

const flag = (index: number, t: number): Command => ({ type: 'flag', index, t });
const reveal = (index: number, t: number): Command => ({ type: 'reveal', index, t });

/** A 2x1 board with one mine on cell 1: revealing cell 0 wins, and cell 1 can be flagged for ever. */
const tiny = (): Game => new Game(new Board({ width: 2, height: 1, mineCount: 1 }, [1]));

describe('the limit on the command log (M2-T07, review B1)', () => {
  it('is 100,000 and is public, so that protocol can carry the same number', () => {
    expect(MAX_REPLAY_COMMANDS).toBe(100_000);
  });

  it('accepts exactly the limit and refuses the next command, which is not logged', () => {
    const game = tiny();
    for (let i = 0; i < MAX_REPLAY_COMMANDS; i += 1) {
      expect(game.apply(flag(1, 10)).length).toBe(1);
    }
    expect(game.log()).toHaveLength(MAX_REPLAY_COMMANDS);
    const before = game.view();
    const heard: GameEvent[] = [];
    game.subscribe((event) => heard.push(event));
    expect(game.apply(flag(1, 10))).toEqual([]);
    expect(game.apply(reveal(0, 20))).toEqual([]);
    expect(heard).toEqual([]);
    expect(game.log()).toHaveLength(MAX_REPLAY_COMMANDS);
    expect(game.view()).toEqual(before);
    expect(game.view().status).toBe('playing');
    expect(game.result()).toBeUndefined();
  });

  it('lets the last command the limit allows win the game', () => {
    const game = tiny();
    for (let i = 0; i < MAX_REPLAY_COMMANDS - 1; i += 1) game.apply(flag(1, 10));
    expect(game.apply(reveal(0, 20)).map((event) => event.type)).toEqual([
      'cellsRevealed',
      'gameWon',
    ]);
    expect(game.view().status).toBe('won');
    expect(game.result()?.effectiveCommands).toBe(MAX_REPLAY_COMMANDS);
  });

  it('still checks the index first, so a bad index throws at the limit too', () => {
    const game = tiny();
    for (let i = 0; i < MAX_REPLAY_COMMANDS; i += 1) game.apply(flag(1, 10));
    expect(() => game.apply(flag(2, 10))).toThrow(RangeError);
  });

  it('keeps every live game replayable, also one that stopped at the limit (review B1)', () => {
    const game = createGame(PRESETS.beginner, 42);
    const hidden = game.view().cells.findIndex((cell) => cell.state === 'hidden');
    for (let i = 0; i < MAX_REPLAY_COMMANDS + 5; i += 1) game.apply(flag(hidden, 1_000));
    const commands = game.log();
    expect(commands).toHaveLength(MAX_REPLAY_COMMANDS);
    const log = { version: 1 as const, config: PRESETS.beginner, seed: 42, commands };
    expect(() => validateReplayLog(log)).not.toThrow();
    const again = replay(log);
    expect(again.view()).toEqual(game.view());
    expect(again.log()).toEqual(commands);
  });
});
