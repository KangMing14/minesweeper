import type { BoardConfig } from './config.js';
import { Game } from './game.js';
import { SeededBoardGenerator } from './generator.js';
import type { BoardGenerator } from './generator.js';

/**
 * Creates a game that is ready to play: the board for a config and a seed, with its safe opening already
 * revealed.
 *
 * @remarks
 * This is the one way to start a game in the browser, on the server and in a replay, so that all of them
 * begin from the same state. It asks the generator for the board and the opening, and hands both to `Game`.
 *
 * **The opening is part of creating the game, not a move.** It is revealed at `t = 0` (the start signal),
 * it is not in `Game.log()`, and no event is announced for it (nobody can have subscribed yet; read it
 * from `view()`). Everyone who plays the same `(config, seed)` therefore starts from the same view, which
 * is the shared safe opening of a race (spec section 2.3).
 *
 * **The status.** The game is `'ready'` until the first command that takes effect, even though cells are
 * already open: `'ready'` means that no player command has been accepted yet. One case differs: if the
 * opening already reveals every safe cell (a 1x1 board, a board with no mines, or a small board where the
 * cascade reaches everything), the game is `'won'` at `t = 0`, because a finished game cannot be `'ready'`.
 * The 9x9, 16x16 and 30x16 presets almost never do this, but a seed can.
 *
 * `new Game(board)` is still available and starts with every cell hidden; use `createGame` for anything
 * that is played or replayed.
 *
 * @param config - The size and mine count of the board.
 * @param seed - An unsigned 32-bit integer.
 * @param generator - Makes the board and the opening. Defaults to `SeededBoardGenerator`.
 * @returns A new game with the opening revealed and an empty command log.
 * @throws {@link InvalidBoardConfigError} if the config is invalid or leaves no room for a safe opening.
 * @throws `RangeError` if the seed is not an integer from 0 to 4294967295.
 *
 * @example
 * ```ts
 * const game = createGame(PRESETS.beginner, 42);
 * game.view().status; // 'ready': the opening is open, but nobody has moved yet
 * game.log(); // []: the opening is not a command
 * game.apply({ type: 'flag', index: 80, t: 1_500 });
 * game.view().status; // 'playing'
 * game.log(); // [{ type: 'flag', index: 80, t: 1500 }]
 * ```
 */
export function createGame(
  config: BoardConfig,
  seed: number,
  generator: BoardGenerator = new SeededBoardGenerator(),
): Game {
  const { board, opening } = generator.generate(config, seed);
  return new Game(board, opening);
}
