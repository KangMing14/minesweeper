import type { CellIndex } from '@minesweeper/engine';

// M3-T03. Pure geometry of the board, in device pixels. Working in whole device pixels (not CSS pixels times a
// fractional scale) keeps every cell edge on a pixel boundary at any zoom level or display density, so the
// board stays crisp, and it makes drawing and hit testing the same arithmetic.

/** Width of the gap between two cells, in CSS pixels. */
export const GAP_CSS_PX = 1;
/** Smallest cell, in CSS pixels. Below this the board is wider than its container and scrolls. */
export const MIN_CELL_CSS_PX = 16;
/** Largest cell, in CSS pixels, so a beginner board does not grow to fill a wide screen. */
export const MAX_CELL_CSS_PX = 40;

/**
 * Where everything sits on a board of a given size, in device pixels.
 *
 * @example
 * ```ts
 * const layout: BoardLayout = computeLayout(9, 9, 360, 2);
 * layout.widthPx / layout.dpr; // the canvas width in CSS pixels
 * ```
 */
export interface BoardLayout {
  /** Number of columns. */
  readonly columns: number;
  /** Number of rows. */
  readonly rows: number;
  /** Device pixels per CSS pixel that this layout was computed for (always finite and above 0). */
  readonly dpr: number;
  /** Side of one cell, in device pixels. */
  readonly cellPx: number;
  /** Gap between two cells, in device pixels. */
  readonly gapPx: number;
  /** Width of the whole board, in device pixels. There is no gap after the last column. */
  readonly widthPx: number;
  /** Height of the whole board, in device pixels. There is no gap after the last row. */
  readonly heightPx: number;
}

/**
 * A square on the canvas, in device pixels.
 *
 * @example
 * ```ts
 * const { x, y, size }: CellRect = cellRect(layout, 0); // { x: 0, y: 0, size: 39 }
 * ```
 */
export interface CellRect {
  /** Left edge. */
  readonly x: number;
  /** Top edge. */
  readonly y: number;
  /** Side length. */
  readonly size: number;
}

/** A usable scale factor: finite and positive, else 1. */
function sanitizeDpr(dpr: number): number {
  return Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
}

/**
 * Chooses the cell size for a board and the space it may use.
 *
 * @remarks
 * The cell is the largest whole number of device pixels that lets all columns fit in `availableCssWidth`,
 * kept between `MIN_CELL_CSS_PX` and `MAX_CELL_CSS_PX` (converted to device pixels). At the minimum the board
 * can be wider than the space: the container scrolls and nothing is squeezed below a size a person can hit.
 * Only the width decides: the height of the container is usually the height of the board itself.
 *
 * @param columns - Columns of the board, a whole number of at least 1.
 * @param rows - Rows of the board, a whole number of at least 1.
 * @param availableCssWidth - Space for the board, in CSS pixels. Not finite or negative counts as none.
 * @param dpr - Device pixels per CSS pixel. Not finite or not positive counts as 1.
 * @returns The layout.
 * @throws RangeError when `columns` or `rows` is not a whole number of at least 1.
 * @example
 * ```ts
 * const layout = computeLayout(30, 16, 1200, 1);
 * layout.cellPx; // 39
 * ```
 */
export function computeLayout(
  columns: number,
  rows: number,
  availableCssWidth: number,
  dpr: number,
): BoardLayout {
  if (!Number.isInteger(columns) || columns < 1) {
    throw new RangeError(`columns must be a whole number of at least 1, got ${columns}`);
  }
  if (!Number.isInteger(rows) || rows < 1) {
    throw new RangeError(`rows must be a whole number of at least 1, got ${rows}`);
  }
  const scale = sanitizeDpr(dpr);
  const gapPx = Math.max(1, Math.round(GAP_CSS_PX * scale));
  const minCell = Math.round(MIN_CELL_CSS_PX * scale);
  const maxCell = Math.round(MAX_CELL_CSS_PX * scale);
  const availablePx = Number.isFinite(availableCssWidth)
    ? Math.max(0, availableCssWidth * scale)
    : 0;
  const fitting = Math.floor((availablePx - gapPx * (columns - 1)) / columns);
  const cellPx = Math.min(maxCell, Math.max(minCell, fitting));
  return {
    columns,
    rows,
    dpr: scale,
    cellPx,
    gapPx,
    widthPx: columns * cellPx + (columns - 1) * gapPx,
    heightPx: rows * cellPx + (rows - 1) * gapPx,
  };
}

/**
 * The square of one cell.
 *
 * @param layout - The board layout.
 * @param index - Cell index, `y * columns + x`.
 * @returns Its position and size in device pixels.
 * @throws RangeError when `index` is not a whole number inside the board.
 * @example
 * ```ts
 * cellRect(computeLayout(9, 9, 360, 1), 1); // { x: 40, y: 0, size: 39 }
 * ```
 */
export function cellRect(layout: BoardLayout, index: CellIndex): CellRect {
  if (!Number.isInteger(index) || index < 0 || index >= layout.columns * layout.rows) {
    throw new RangeError(`index must be a whole number inside the board, got ${index}`);
  }
  const pitch = layout.cellPx + layout.gapPx;
  return {
    x: (index % layout.columns) * pitch,
    y: Math.floor(index / layout.columns) * pitch,
    size: layout.cellPx,
  };
}

/** Which slot of a row or column a coordinate falls into, or null in a gap or outside. */
function slotAt(layout: BoardLayout, coordinate: number, count: number): number | null {
  if (!Number.isFinite(coordinate) || coordinate < 0) return null;
  const pitch = layout.cellPx + layout.gapPx;
  const slot = Math.floor(coordinate / pitch);
  if (slot >= count) return null;
  return coordinate - slot * pitch < layout.cellPx ? slot : null;
}

/**
 * The cell under a point, or `null` when the point is in a gap or outside the board.
 *
 * @remarks
 * A gap returns `null` instead of the nearer cell on purpose: in a game where a wrong reveal ends the run, a
 * click that lands between two cells must do nothing rather than guess.
 *
 * @param layout - The board layout.
 * @param xPx - Horizontal position from the left edge of the canvas, in device pixels (may be fractional).
 * @param yPx - Vertical position from the top edge of the canvas, in device pixels (may be fractional).
 * @returns The cell index, or `null`.
 * @example
 * ```ts
 * const layout = computeLayout(9, 9, 360, 1);
 * cellAt(layout, 41, 2); // 1
 * cellAt(layout, 39, 2); // null (the gap)
 * ```
 */
export function cellAt(layout: BoardLayout, xPx: number, yPx: number): CellIndex | null {
  const column = slotAt(layout, xPx, layout.columns);
  if (column === null) return null;
  const row = slotAt(layout, yPx, layout.rows);
  if (row === null) return null;
  return row * layout.columns + column;
}
