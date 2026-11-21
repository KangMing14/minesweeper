import type { Board } from './board.js';
import { cellCount } from './config.js';

/**
 * Computes the 3BV of a board: the fewest plain reveals that clear it when every mine is known.
 *
 * @remarks
 * 3BV is Bechtel's Board Benchmark Value, the standard measure of how much work a Minesweeper board is.
 * It is the number of reveals a perfect player needs if they use no flags and no chords:
 *
 * 1. **One reveal for each opening**: a group of connected zero cells (cells that touch no mine). One click
 *    on any zero of the group opens all of it, and also every numbered cell around it.
 * 2. **One reveal for each isolated number**: a safe, numbered cell that touches no zero, so no opening
 *    ever reaches it.
 *
 * The 3BV is the sum of the two. It is 1 for a board without mines and the number of safe cells for a board
 * with no zero at all. Two zeros are in the same group when one is a neighbor of the other (the eight
 * surrounding cells, diagonals included, as in `Board.neighbors`). Mines never count.
 *
 * The value depends on the mine layout alone. In particular it counts the opening that `createGame`
 * reveals for free like any other opening, because the definition knows nothing about which cell the
 * player clicks first.
 *
 * The search uses an explicit stack, never recursion: the largest legal board is 100 by 100, and a board
 * without mines is one opening of 10,000 cells. Each cell is visited once, so the cost grows with the
 * number of cells.
 *
 * This is derived from the mine layout, so it is information about where the mines are (an aggregate,
 * not a position). `Game.result()` carries it only once a game is over; see the D-14 note there.
 *
 * Reference: Bechtel's Board Benchmark Value, the standard difficulty measure of Minesweeper speed-solving,
 * reported by Minesweeper Arbiter and used on the Authoritative Minesweeper site (minesweepergame.com). The
 * definition above, openings plus isolated numbers, is the one public explanations of 3BV agree on. It was
 * checked against such explanations, not against the original text.
 *
 * Not part of the public API; `Game.result()` is the way to read it.
 *
 * @param board - The mine layout.
 * @returns The 3BV, a whole number from 1 up to the number of safe cells.
 *
 * @example
 * ```ts
 * // 1x9 row with mines at 3 and 5: openings {0, 1} and {7, 8}, and the isolated 2 at cell 4.
 * computeThreeBV(new Board({ width: 9, height: 1, mineCount: 2 }, [3, 5])); // 3
 * ```
 *
 * @internal
 */
export function computeThreeBV(board: Board): number {
  const total = cellCount(board.config);
  // `covered`: a cell that some opening reaches (a zero, or a number next to a zero).
  const covered = new Uint8Array(total);
  // `visited`: a zero that is already part of an opening that has been counted.
  const visited = new Uint8Array(total);
  const stack: number[] = [];
  let value = 0;

  for (let start = 0; start < total; start++) {
    if (visited[start] === 1 || board.isMine(start) || board.adjacentMines(start) !== 0) continue;
    // A zero that no earlier opening reached: a new opening, one click.
    value++;
    visited[start] = 1;
    covered[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
      const cell = stack.pop() as number;
      for (const neighbor of board.neighbors(cell)) {
        covered[neighbor] = 1;
        // A neighbor of a zero is never a mine, so only its own count decides whether the opening spreads.
        if (visited[neighbor] === 0 && board.adjacentMines(neighbor) === 0) {
          visited[neighbor] = 1;
          stack.push(neighbor);
        }
      }
    }
  }

  // A safe cell that no opening reaches is a number next to no zero: it takes a click of its own.
  for (let index = 0; index < total; index++) {
    if (covered[index] === 0 && !board.isMine(index)) value++;
  }
  return value;
}
