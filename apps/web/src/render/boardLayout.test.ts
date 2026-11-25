import { describe, expect, it } from 'vitest';
import {
  GAP_CSS_PX,
  MAX_CELL_CSS_PX,
  MIN_CELL_CSS_PX,
  cellAt,
  cellRect,
  computeLayout,
} from './boardLayout.js';

// M3-T03. The layout is pure arithmetic in device pixels, so every case here is a number that can be
// worked out by hand.

describe('computeLayout', () => {
  it('fills the available width with whole-pixel cells and a one-pixel gap (dpr 1)', () => {
    // (360 - 8 gaps) / 9 columns = 39.1, so 39 px cells; 9 * 39 + 8 = 359 px wide.
    const layout = computeLayout(9, 9, 360, 1);
    expect(layout).toMatchObject({ columns: 9, rows: 9, dpr: 1, cellPx: 39, gapPx: 1 });
    expect(layout.widthPx).toBe(359);
    expect(layout.heightPx).toBe(359);
  });

  it('is not square for a wide board', () => {
    // (1200 - 29) / 30 = 39.03, so 39 px; 30 * 39 + 29 = 1199 wide; 16 * 39 + 15 = 639 high.
    const layout = computeLayout(30, 16, 1200, 1);
    expect(layout.cellPx).toBe(39);
    expect(layout.widthPx).toBe(1199);
    expect(layout.heightPx).toBe(639);
  });

  it('never goes below the minimum cell size, and then overflows the container', () => {
    const layout = computeLayout(30, 16, 300, 1);
    expect(layout.cellPx).toBe(MIN_CELL_CSS_PX);
    expect(layout.widthPx).toBe(30 * MIN_CELL_CSS_PX + 29);
    expect(layout.widthPx).toBeGreaterThan(300);
  });

  it('never goes above the maximum cell size', () => {
    expect(computeLayout(9, 9, 5000, 1).cellPx).toBe(MAX_CELL_CSS_PX);
  });

  it('works in device pixels: a higher dpr gives more pixels for the same CSS width', () => {
    // 360 css px = 720 device px; gap 2; (720 - 16) / 9 = 78.2, so 78.
    const layout = computeLayout(9, 9, 360, 2);
    expect(layout).toMatchObject({ dpr: 2, cellPx: 78, gapPx: 2 });
    expect(layout.widthPx).toBe(9 * 78 + 8 * 2);
    // The CSS size of the canvas is the device size over dpr, so it fits the container.
    expect(layout.widthPx / 2).toBeLessThanOrEqual(360);
  });

  it('scales the limits with a fractional dpr and keeps whole device pixels', () => {
    const layout = computeLayout(9, 9, 100, 1.5);
    expect(layout.cellPx).toBe(Math.round(MIN_CELL_CSS_PX * 1.5));
    expect(Number.isInteger(layout.cellPx)).toBe(true);
    expect(Number.isInteger(layout.gapPx)).toBe(true);
    expect(layout.gapPx).toBeGreaterThanOrEqual(1);
    expect(GAP_CSS_PX).toBe(1);
  });

  it.each([0, -2, Number.NaN, Number.POSITIVE_INFINITY])('treats dpr %s as 1', (dpr) => {
    expect(computeLayout(9, 9, 360, dpr).dpr).toBe(1);
  });

  it.each([-5, Number.NaN, Number.NEGATIVE_INFINITY])(
    'treats an available width of %s as none: minimum cells',
    (width) => {
      expect(computeLayout(9, 9, width, 1).cellPx).toBe(MIN_CELL_CSS_PX);
    },
  );

  it.each([
    [0, 5],
    [5, 0],
    [2.5, 5],
    [5, Number.NaN],
    [-1, 5],
  ])('rejects %s columns by %s rows', (columns, rows) => {
    expect(() => computeLayout(columns, rows, 360, 1)).toThrow(RangeError);
  });

  it('handles a one-cell board (no gaps at all)', () => {
    const layout = computeLayout(1, 1, 100, 1);
    expect(layout.widthPx).toBe(layout.cellPx);
    expect(layout.heightPx).toBe(layout.cellPx);
  });
});

describe('cellRect', () => {
  const layout = computeLayout(9, 9, 360, 1); // 39 px cells, pitch 40

  it('puts cell 0 at the origin and each next cell one pitch further', () => {
    expect(cellRect(layout, 0)).toEqual({ x: 0, y: 0, size: 39 });
    expect(cellRect(layout, 1)).toEqual({ x: 40, y: 0, size: 39 });
    expect(cellRect(layout, 9)).toEqual({ x: 0, y: 40, size: 39 });
    expect(cellRect(layout, 80)).toEqual({ x: 320, y: 320, size: 39 });
  });

  it('ends the last cell exactly at the canvas edge', () => {
    const last = cellRect(layout, 80);
    expect(last.x + last.size).toBe(layout.widthPx);
    expect(last.y + last.size).toBe(layout.heightPx);
  });

  it.each([-1, 81, 1.5, Number.NaN])('rejects index %s', (index) => {
    expect(() => cellRect(layout, index)).toThrow(RangeError);
  });
});

describe('cellAt', () => {
  const layout = computeLayout(9, 9, 360, 1);

  it('finds the cell for the first and the last pixel of a cell', () => {
    expect(cellAt(layout, 0, 0)).toBe(0);
    expect(cellAt(layout, 38, 38)).toBe(0);
    expect(cellAt(layout, 40, 0)).toBe(1);
    expect(cellAt(layout, 40, 40)).toBe(10);
    expect(cellAt(layout, 358, 358)).toBe(80);
  });

  it('returns null in the gap between cells, so a slip never opens the wrong cell', () => {
    expect(cellAt(layout, 39, 0)).toBeNull();
    expect(cellAt(layout, 0, 39)).toBeNull();
    expect(cellAt(layout, 39, 39)).toBeNull();
  });

  it('returns null outside the board', () => {
    expect(cellAt(layout, -1, 0)).toBeNull();
    expect(cellAt(layout, 0, -0.5)).toBeNull();
    expect(cellAt(layout, layout.widthPx, 0)).toBeNull();
    expect(cellAt(layout, 0, layout.heightPx)).toBeNull();
    expect(cellAt(layout, 10_000, 10_000)).toBeNull();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'returns null for the non-finite coordinate %s',
    (bad) => {
      expect(cellAt(layout, bad, 5)).toBeNull();
      expect(cellAt(layout, 5, bad)).toBeNull();
    },
  );

  it('accepts fractional device pixels (a pointer between two pixels)', () => {
    expect(cellAt(layout, 38.9, 0)).toBe(0);
    expect(cellAt(layout, 39.0, 0)).toBeNull();
    expect(cellAt(layout, 39.9, 0)).toBeNull();
    expect(cellAt(layout, 40.0, 0)).toBe(1);
  });

  it.each([
    [1, 9, 9],
    [1, 30, 16],
    [1.5, 16, 16],
    [2, 5, 3],
    [3, 9, 9],
    [1, 1, 1],
    [1, 1, 12],
  ])('agrees with cellRect on every pixel (dpr %s, %sx%s)', (dpr, columns, rows) => {
    const l = computeLayout(columns, rows, 200, dpr);
    // The reference: the first row of squares gives the column spans, the first column gives the row spans.
    const spanOf = (start: number, size: number, at: number): boolean =>
      at >= start && at < start + size;
    const columnAt = (x: number): number | null => {
      for (let c = 0; c < columns; c += 1) {
        const r = cellRect(l, c);
        if (spanOf(r.x, r.size, x)) return c;
      }
      return null;
    };
    const rowAt = (y: number): number | null => {
      for (let row = 0; row < rows; row += 1) {
        const r = cellRect(l, row * columns);
        if (spanOf(r.y, r.size, y)) return row;
      }
      return null;
    };
    for (let y = -2; y < l.heightPx + 2; y += 1) {
      const row = rowAt(y);
      for (let x = -2; x < l.widthPx + 2; x += 1) {
        const column = columnAt(x);
        const expected = row === null || column === null ? null : row * columns + column;
        if (cellAt(l, x, y) !== expected) {
          throw new Error(`pixel (${x}, ${y}): got ${cellAt(l, x, y)}, expected ${expected}`);
        }
      }
    }
  });
});
