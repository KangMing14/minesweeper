import type { CellIndex, GameView } from '@minesweeper/engine';

/**
 * Draws a `GameView` and says which cell a point on the screen belongs to.
 *
 * @remarks
 * The renderer knows nothing about sessions, input or the engine's rules: it is given views and returns cell
 * indices. The input controller (M3-T04) pairs `hitTest` with `GameSession.dispatch`. The call order is free:
 * `render` before `mount` is remembered and drawn on `mount`, and `render` after `unmount` is remembered and
 * not drawn.
 *
 * @example
 * ```ts
 * const renderer: BoardRenderer = new CanvasBoardRenderer();
 * renderer.mount(canvas);
 * renderer.render(session.view());
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
  /** Measures the container, the pixel ratio and the theme again, and redraws every cell. */
  resize(): void;
  /** Lets go of the canvas. The renderer can be mounted again. */
  unmount(): void;
}
