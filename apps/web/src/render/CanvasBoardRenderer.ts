import type { CellIndex, GameView } from '@minesweeper/engine';
import type { BoardRenderer } from './BoardRenderer.js';
import { type BoardLayout, cellAt, cellRect, computeLayout } from './boardLayout.js';
import { type BoardTheme, readBoardTheme } from './boardTheme.js';
import { VISUAL, computeVisuals } from './cellVisuals.js';

// M3-T03. Canvas 2D implementation of `BoardRenderer`. Everything is drawn in whole device pixels (see
// `boardLayout.ts`), and a redraw touches only the cells whose visual code changed.

/** Options of `CanvasBoardRenderer`. */
export interface CanvasBoardRendererOptions {
  /** Where the colors come from. Defaults to the `--ms-*` tokens in effect on the canvas. Tests replace it. */
  readonly readTheme?: (canvas: HTMLCanvasElement) => BoardTheme;
}

/**
 * Draws the board on a canvas, crisply at any pixel ratio, and redraws only what changed.
 *
 * @remarks
 * Cell size follows the width of the canvas's parent (between 16 and 40 CSS pixels; below that the parent
 * scrolls). `resize()` must be called when the parent's width, the device pixel ratio or the theme changes:
 * `BoardCanvas` does that. The view alone decides what is drawn, so during a race (where the server withholds
 * `exposedMines`) the same code draws no mines. One thing the view cannot say is which mine ended the game,
 * so that mine is not highlighted.
 *
 * @example
 * ```ts
 * const renderer = new CanvasBoardRenderer();
 * renderer.mount(canvas); // the canvas must have a parent element that has a width
 * renderer.render(session.view());
 * window.addEventListener('resize', () => renderer.resize());
 * ```
 */
export class CanvasBoardRenderer implements BoardRenderer {
  readonly #readTheme: (canvas: HTMLCanvasElement) => BoardTheme;
  #canvas: HTMLCanvasElement | null = null;
  #ctx: CanvasRenderingContext2D | null = null;
  #theme: BoardTheme | null = null;
  #layout: BoardLayout | null = null;
  #lastView: GameView | null = null;
  /** What is on the canvas now, one visual code per cell; null until the first full draw. */
  #shown: Uint8Array | null = null;

  /** Creates a renderer that is not mounted. */
  constructor(options: CanvasBoardRendererOptions = {}) {
    this.#readTheme = options.readTheme ?? readBoardTheme;
  }

  /** Attaches to a canvas and draws the last view, if there is one. */
  mount(canvas: HTMLCanvasElement): void {
    this.unmount();
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('This canvas has no 2D drawing context.');
    this.#canvas = canvas;
    this.#ctx = ctx;
    if (this.#lastView !== null) this.#drawFully(this.#lastView, computeVisuals(this.#lastView));
  }

  /** Shows a view; throws `RangeError` (and keeps the old picture) when the view is not `width * height` cells. */
  render(view: GameView): void {
    // Validate first: a bad view must not replace the remembered one.
    const visuals = computeVisuals(view);
    this.#lastView = view;
    if (this.#canvas === null) return;
    const layout = this.#layout;
    if (
      layout === null ||
      layout.columns !== view.width ||
      layout.rows !== view.height ||
      this.#shown === null
    ) {
      this.#drawFully(view, visuals);
      return;
    }
    this.#drawChanges(visuals, this.#shown);
  }

  /** The cell under a point in client coordinates, or `null`. */
  hitTest(clientX: number, clientY: number): CellIndex | null {
    const canvas = this.#canvas;
    const layout = this.#layout;
    if (canvas === null || layout === null) return null;
    const rect = canvas.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) return null;
    // The canvas can look larger or smaller on screen than its pixel grid (zoom, a transform), so scale by what
    // the browser reports and not by `devicePixelRatio` alone.
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    return cellAt(layout, x, y);
  }

  /** Measures again and redraws every cell of the last view. Does nothing without a canvas or a view. */
  resize(): void {
    if (this.#canvas === null || this.#lastView === null) return;
    this.#drawFully(this.#lastView, computeVisuals(this.#lastView));
  }

  /** Lets go of the canvas. The last view is remembered. */
  unmount(): void {
    this.#canvas = null;
    this.#ctx = null;
    this.#theme = null;
    this.#layout = null;
    this.#shown = null;
  }

  /** Sizes the canvas, clears it and draws every cell. */
  #drawFully(view: GameView, visuals: Uint8Array): void {
    const canvas = this.#canvas;
    const ctx = this.#ctx;
    if (canvas === null || ctx === null) return;
    this.#theme = this.#readTheme(canvas);
    const dpr = window.devicePixelRatio;
    const available = canvas.parentElement?.clientWidth ?? 0;
    const layout = computeLayout(view.width, view.height, available, dpr);
    this.#layout = layout;
    // Assigning a size clears the canvas and resets the context, so only do it when the size changes.
    if (canvas.width !== layout.widthPx) canvas.width = layout.widthPx;
    if (canvas.height !== layout.heightPx) canvas.height = layout.heightPx;
    canvas.style.width = `${layout.widthPx / layout.dpr}px`;
    canvas.style.height = `${layout.heightPx / layout.dpr}px`;
    ctx.clearRect(0, 0, layout.widthPx, layout.heightPx);
    this.#shown = new Uint8Array(visuals);
    for (let i = 0; i < visuals.length; i += 1) this.#drawCell(i, visuals[i] ?? VISUAL.HIDDEN);
  }

  /** Draws the cells whose code differs from what is on the canvas. */
  #drawChanges(visuals: Uint8Array, shown: Uint8Array): void {
    for (let i = 0; i < visuals.length; i += 1) {
      const code = visuals[i] ?? VISUAL.HIDDEN;
      if (shown[i] === code) continue;
      shown[i] = code;
      this.#drawCell(i, code);
    }
  }

  #drawCell(index: CellIndex, code: number): void {
    const ctx = this.#ctx;
    const theme = this.#theme;
    const layout = this.#layout;
    if (ctx === null || theme === null || layout === null) return;
    const square = cellRect(layout, index);
    const { x, y, size } = square;
    const open = code !== VISUAL.HIDDEN && code !== VISUAL.FLAG;
    ctx.fillStyle = open ? theme.revealed : theme.hidden;
    ctx.fillRect(x, y, size, size);
    if (code === VISUAL.FLAG) {
      drawFlag(ctx, theme, x, y, size);
    } else if (code === VISUAL.MINE) {
      drawMine(ctx, theme, x, y, size);
    } else if (code === VISUAL.WRONG_FLAG) {
      drawFlag(ctx, theme, x, y, size);
      drawCross(ctx, theme, x, y, size);
    } else if (code > VISUAL.revealed(0) && code <= VISUAL.revealed(8)) {
      drawNumber(ctx, theme, code - VISUAL.revealed(0), x, y, size);
    }
  }
}

/** A digit, centered, bold, in the color of its value. */
function drawNumber(
  ctx: CanvasRenderingContext2D,
  theme: BoardTheme,
  value: number,
  x: number,
  y: number,
  size: number,
): void {
  ctx.font = `bold ${Math.round(size * 0.62)}px ${theme.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.numbers[value - 1] ?? theme.text;
  // A touch below the middle: digits have no descenders, so the box middle looks high.
  ctx.fillText(String(value), x + size / 2, y + size * 0.54);
}

/** A pole with a base and a triangular cloth. The cloth is the only colored part, the pole and base are dark. */
function drawFlag(
  ctx: CanvasRenderingContext2D,
  theme: BoardTheme,
  x: number,
  y: number,
  size: number,
): void {
  const thick = Math.max(1, Math.round(size * 0.08));
  const poleX = Math.round(x + size * 0.44);
  const top = Math.round(y + size * 0.18);
  const bottom = Math.round(y + size * 0.78);
  ctx.fillStyle = theme.text;
  ctx.fillRect(poleX, top, thick, bottom - top);
  ctx.fillRect(
    Math.round(x + size * 0.28),
    Math.round(y + size * 0.74),
    Math.round(size * 0.44),
    thick,
  );
  ctx.fillStyle = theme.danger;
  ctx.beginPath();
  ctx.moveTo(poleX + thick, top);
  ctx.lineTo(x + size * 0.78, top + size * 0.17);
  ctx.lineTo(poleX + thick, top + size * 0.34);
  ctx.closePath();
  ctx.fill();
}

/** A disc with four spikes and a small highlight. */
function drawMine(
  ctx: CanvasRenderingContext2D,
  theme: BoardTheme,
  x: number,
  y: number,
  size: number,
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const reach = size * 0.34;
  const diagonal = reach * Math.SQRT1_2;
  ctx.fillStyle = theme.text;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = theme.text;
  ctx.lineWidth = Math.max(1, Math.round(size * 0.07));
  ctx.beginPath();
  ctx.moveTo(cx - reach, cy);
  ctx.lineTo(cx + reach, cy);
  ctx.moveTo(cx, cy - reach);
  ctx.lineTo(cx, cy + reach);
  ctx.moveTo(cx - diagonal, cy - diagonal);
  ctx.lineTo(cx + diagonal, cy + diagonal);
  ctx.moveTo(cx + diagonal, cy - diagonal);
  ctx.lineTo(cx - diagonal, cy + diagonal);
  ctx.stroke();
  const glint = Math.max(1, Math.round(size * 0.07));
  ctx.fillStyle = theme.revealed;
  ctx.fillRect(Math.round(cx - size * 0.1), Math.round(cy - size * 0.1), glint, glint);
}

/** A cross over the whole cell, for a flag on a safe cell. A shape, so it does not rely on color alone. */
function drawCross(
  ctx: CanvasRenderingContext2D,
  theme: BoardTheme,
  x: number,
  y: number,
  size: number,
): void {
  ctx.strokeStyle = theme.danger;
  ctx.lineWidth = Math.max(2, Math.round(size * 0.09));
  ctx.beginPath();
  ctx.moveTo(x + size * 0.16, y + size * 0.16);
  ctx.lineTo(x + size * 0.84, y + size * 0.84);
  ctx.moveTo(x + size * 0.84, y + size * 0.16);
  ctx.lineTo(x + size * 0.16, y + size * 0.84);
  ctx.stroke();
}
