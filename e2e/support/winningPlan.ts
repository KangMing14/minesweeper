import { SeededBoardGenerator, createGame } from '@minesweeper/engine';
import type { BoardConfig, CellIndex } from '@minesweeper/engine';

// M3-T08. The cells to click to win a seeded board, worked out by the engine itself. The browser test does
// not know where the mines are by looking at the page (it must not be able to); it asks the same engine and
// the same generator that the client runs, for the same seed.

/** What a test needs to play one board to a win. */
export interface WinningPlan {
  /** The board. */
  readonly config: BoardConfig;
  /** The seed the client is made to draw. */
  readonly seed: number;
  /** Cells to reveal, in order. Each one opens something that the earlier ones did not. */
  readonly clicks: readonly CellIndex[];
  /** Safe cells on the board: the "Cells cleared" figure of a win. */
  readonly safeCells: number;
}

/**
 * Plays a board to a win with the fewest clicks of a simple sweep: every safe cell, in index order, that is
 * still hidden when its turn comes. A click that the opening or an earlier cascade made unnecessary is left
 * out, so every click in the plan changes the board.
 *
 * @param config - The board.
 * @param seed - The seed.
 * @returns The plan.
 * @throws If the sweep does not end in a win, which would mean the engine and the plan disagree.
 * @example
 * const plan = planWin(PRESETS.beginner, 4242);
 * plan.clicks; // [ ... cell indices, row by row ... ]
 */
export function planWin(config: BoardConfig, seed: number): WinningPlan {
  const { board } = new SeededBoardGenerator().generate(config, seed);
  const game = createGame(config, seed);
  const total = config.width * config.height;
  const clicks: CellIndex[] = [];
  let safeCells = 0;
  for (let index = 0; index < total; index += 1) {
    if (board.isMine(index)) continue;
    safeCells += 1;
    if (game.view().cells[index]?.state !== 'hidden') continue;
    const events = game.apply({ type: 'reveal', index, t: clicks.length });
    if (events.length > 0) clicks.push(index);
  }
  if (game.view().status !== 'won') {
    throw new Error(`the sweep of seed ${seed} ended as '${game.view().status}', not 'won'`);
  }
  return { config, seed, clicks, safeCells };
}
