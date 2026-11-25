import { SeededBoardGenerator, createGame } from '@minesweeper/engine';
import type { CellView, GameStatus, GameView } from '@minesweeper/engine';
import { describe, expect, it } from 'vitest';
import { VISUAL, computeVisuals } from './cellVisuals.js';

/** A hand-made view; `exposedMines` is only present when given, as in the engine. */
function makeView(
  width: number,
  height: number,
  status: GameStatus,
  cells: readonly CellView[],
  exposedMines?: readonly number[],
): GameView {
  const base = {
    width,
    height,
    status,
    cells,
    revealedCount: cells.filter((c) => c.state === 'revealed').length,
    flagCount: cells.filter((c) => c.state === 'flagged').length,
    minesRemaining: 0,
  };
  return exposedMines === undefined ? base : { ...base, exposedMines };
}

const H: CellView = { state: 'hidden' };
const F: CellView = { state: 'flagged' };
const R = (value: number): CellView => ({ state: 'revealed', value });

describe('computeVisuals', () => {
  it('shows every cell of a new game as hidden', () => {
    const visuals = computeVisuals(makeView(3, 1, 'ready', [H, H, H]));
    expect([...visuals]).toEqual([VISUAL.HIDDEN, VISUAL.HIDDEN, VISUAL.HIDDEN]);
  });

  it('keeps a code for each revealed value 0 to 8, all different from each other and from the others', () => {
    const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(R);
    const visuals = [...computeVisuals(makeView(9, 1, 'playing', cells))];
    expect(new Set(visuals).size).toBe(9);
    expect(visuals).toEqual(cells.map((_, value) => VISUAL.revealed(value)));
    for (const code of visuals) {
      expect([VISUAL.HIDDEN, VISUAL.FLAG, VISUAL.MINE, VISUAL.WRONG_FLAG]).not.toContain(code);
    }
  });

  it('shows a flag as a flag during play, whether or not a mine is under it', () => {
    const visuals = computeVisuals(makeView(3, 1, 'playing', [F, H, R(1)]));
    expect([...visuals]).toEqual([VISUAL.FLAG, VISUAL.HIDDEN, VISUAL.revealed(1)]);
  });

  it('does not show a mine that the view does not list, even in a finished game', () => {
    const visuals = computeVisuals(makeView(2, 1, 'lost', [H, H]));
    expect([...visuals]).toEqual([VISUAL.HIDDEN, VISUAL.HIDDEN]);
  });

  it('after a loss shows hidden mines, keeps correct flags and marks wrong flags', () => {
    // Cell 0: hidden mine. 1: flag on a mine. 2: flag on a safe cell. 3: hidden safe cell. 4: revealed 2.
    const view = makeView(5, 1, 'lost', [H, F, F, H, R(2)], [0, 1]);
    expect([...computeVisuals(view)]).toEqual([
      VISUAL.MINE,
      VISUAL.FLAG,
      VISUAL.WRONG_FLAG,
      VISUAL.HIDDEN,
      VISUAL.revealed(2),
    ]);
  });

  it('after a win shows the remaining mines as flags, as in the classic game', () => {
    const view = makeView(3, 1, 'won', [H, F, R(1)], [0, 1]);
    expect([...computeVisuals(view)]).toEqual([VISUAL.FLAG, VISUAL.FLAG, VISUAL.revealed(1)]);
  });

  it('writes into the array it is given and returns it, so a redraw allocates nothing', () => {
    const out = new Uint8Array(3);
    const result = computeVisuals(makeView(3, 1, 'playing', [F, H, R(0)]), out);
    expect(result).toBe(out);
    expect([...out]).toEqual([VISUAL.FLAG, VISUAL.HIDDEN, VISUAL.revealed(0)]);
  });

  it('throws when the view is not as large as it says, or the array is too small', () => {
    expect(() => computeVisuals(makeView(3, 1, 'ready', [H, H]))).toThrow(RangeError);
    expect(() => computeVisuals(makeView(3, 1, 'ready', [H, H, H]), new Uint8Array(2))).toThrow(
      RangeError,
    );
  });

  it('agrees with a real lost game: every mine is a mine, a flag on a safe cell is wrong', () => {
    const config = { width: 9, height: 9, mineCount: 10 } as const;
    const game = createGame(config, 7);
    const mines = new SeededBoardGenerator().generate(config, 7).board;
    const hidden = game
      .view()
      .cells.map((c, i) => (c.state === 'hidden' ? i : -1))
      .filter((i) => i >= 0);
    const mine = hidden.find((i) => mines.isMine(i));
    const safe = hidden.find((i) => !mines.isMine(i));
    if (mine === undefined || safe === undefined)
      throw new Error('test board has no hidden mine or safe cell');
    game.apply({ type: 'flag', index: safe, t: 1 });
    game.apply({ type: 'reveal', index: mine, t: 2 });
    const view = game.view();
    expect(view.status).toBe('lost');
    const visuals = computeVisuals(view);
    expect(visuals[safe]).toBe(VISUAL.WRONG_FLAG);
    for (const m of view.exposedMines ?? []) expect(visuals[m]).toBe(VISUAL.MINE);
    expect(view.exposedMines).toHaveLength(10);
  });
});
