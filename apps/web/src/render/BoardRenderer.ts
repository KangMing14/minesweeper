import type { CellIndex, GameView } from '@minesweeper/engine';

/**
 * Draws a `GameView` and says which cell a point on the screen belongs to.
 *
 * @remarks
 * The renderer knows nothing about sessions, input or the engine's rules: it is given views and returns cell
 * indices. The input controller (M3-T04) pairs `hitTest` with `GameSession.dispatch`, and shows its keyboard
 * cursor with `setCursor`. The call order is free:
 * `render` before `mount` is remembered and drawn on `mount`, and `render` after `unmount` is remembered and
 * not drawn.
 *
 * @example
 * ```ts
 * const renderer: BoardRenderer = new CanvasBoardRenderer();
 * renderer.mount(canvas);
 * renderer.render(session.view());
 * renderer.setCursor(0); // a ring on the top-left cell
 * const cell = renderer.hitTest(event.clientX, event.clientY); // CellIndex | null
 * renderer.unmount();
 * ```
 */
export interface BoardRenderer {
  /** Attaches the renderer to a canvas and draws the last view, if any. Moves from an earlier canvas. */
  mount(canvas: HTMLCanvasElement): void;
  /** Shows a view, redrawing only the cells that differ from the one shown before. */
  render(view: GameView): void;
  /** The cell under a point given in client (viewport) coordinates, or `null` in a gap or outside the board. */
  hitTest(clientX: number, clientY: number): CellIndex | null;
  /**
   * Marks one cell as the keyboard cursor with a visible ring, or removes the ring with `null`. Only the cell
   * that loses the ring and the cell that gets it are redrawn. The cursor is remembered across `render`,
   * `resize`, `unmount` and `mount`, like the view. A cursor that falls outside a new, smaller board is dropped.
   * Throws `RangeError`, and keeps the old cursor, for an index that is not a whole number inside the board
   * that is shown (before the first view only the whole-number test applies).
   */
  setCursor(index: CellIndex | null): void;
  /** Measures the container, the pixel ratio and the theme again, and redraws every cell. */
  resize(): void;
  /** Lets go of the canvas. The renderer can be mounted again. */
  unmount(): void;
}
