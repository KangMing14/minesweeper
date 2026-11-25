import type { CellView, GameStatus, GameView } from '@minesweeper/engine';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CanvasRig, type Op, makeCanvasRig } from '../../test/fakeCanvas.js';
import type { BoardTheme } from './boardTheme.js';
import { CanvasBoardRenderer } from './CanvasBoardRenderer.js';
import { cellRect, computeLayout } from './boardLayout.js';

// M3-T03. The renderer is checked against a recording fake of the 2D context (jsdom has no canvas).

const THEME: BoardTheme = {
  hidden: '#101010',
  revealed: '#202020',
  text: '#303030',
  danger: '#404040',
  fontFamily: 'TestSans, sans-serif',
  numbers: ['#a1a1a1', '#a2a2a2', '#a3a3a3', '#a4a4a4', '#a5a5a5', '#a6a6a6', '#a7a7a7', '#a8a8a8'],
};
const OTHER_THEME: BoardTheme = { ...THEME, hidden: '#999999', revealed: '#888888' };

const H: CellView = { state: 'hidden' };
const F: CellView = { state: 'flagged' };
const R = (value: number): CellView => ({ state: 'revealed', value });

function makeView(
  width: number,
  height: number,
  cells: readonly CellView[],
  status: GameStatus = 'playing',
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

function allHidden(width: number, height: number): GameView {
  return makeView(
    width,
    height,
    Array.from({ length: width * height }, () => H),
    'ready',
  );
}

/** True when every coordinate of the op lies inside the square (with half a pixel of slack for strokes). */
function inside(op: Op, rect: { x: number; y: number; size: number }): boolean {
  const slack = 0.5 + op.lineWidth / 2;
  const within = (x: number, y: number, rx = 0, ry = 0): boolean =>
    x - rx >= rect.x - slack &&
    y - ry >= rect.y - slack &&
    x + rx <= rect.x + rect.size + slack &&
    y + ry <= rect.y + rect.size + slack;
  const a = op.args as number[];
  switch (op.name) {
    case 'fillRect':
      return (
        within(a[0] ?? 0, a[1] ?? 0) && within((a[0] ?? 0) + (a[2] ?? 0), (a[1] ?? 0) + (a[3] ?? 0))
      );
    case 'moveTo':
    case 'lineTo':
      return within(a[0] ?? 0, a[1] ?? 0);
    case 'arc':
      return within(a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, a[2] ?? 0);
    case 'fillText':
      return within(a[1] ?? 0, a[2] ?? 0);
    default:
      return true;
  }
}

let rig: CanvasRig;
let theme = THEME;
let renderer: CanvasBoardRenderer;

beforeEach(() => {
  theme = THEME;
  rig = makeCanvasRig({ parentWidth: 360, dpr: 1 });
  renderer = new CanvasBoardRenderer({ readTheme: () => theme });
});

afterEach(() => {
  renderer.unmount();
  rig.dispose();
});

describe('mount and sizing', () => {
  it('throws a clear error when the canvas has no 2D context', () => {
    (rig.canvas as unknown as { getContext: () => null }).getContext = () => null;
    expect(() => renderer.mount(rig.canvas)).toThrow(/2d/i);
  });

  it('draws nothing before mount, and draws the last view as soon as it is mounted', () => {
    renderer.render(allHidden(3, 3));
    expect(rig.ctx.ops).toHaveLength(0);
    renderer.mount(rig.canvas);
    expect(rig.ctx.all('fillRect')).toHaveLength(9);
  });

  it('sizes the canvas to the board: a 9x9 board in 360 px is 359 px with 39 px cells', () => {
    renderer.mount(rig.canvas);
    renderer.render(allHidden(9, 9));
    expect(rig.canvas.width).toBe(359);
    expect(rig.canvas.height).toBe(359);
    expect(rig.canvas.style.width).toBe('359px');
    expect(rig.canvas.style.height).toBe('359px');
  });

  it('gives the canvas dpr times the pixels but the same CSS size on a dense screen', () => {
    rig.setDpr(2);
    renderer.mount(rig.canvas);
    renderer.render(allHidden(9, 9));
    const layout = computeLayout(9, 9, 360, 2);
    expect(rig.canvas.width).toBe(layout.widthPx);
    expect(rig.canvas.style.width).toBe(`${layout.widthPx / 2}px`);
    expect(layout.widthPx / 2).toBeLessThanOrEqual(360);
  });

  it('uses the minimum cell size when the container is narrower than the board', () => {
    rig.setParentWidth(200);
    renderer.mount(rig.canvas);
    renderer.render(allHidden(30, 16));
    expect(rig.canvas.width).toBe(30 * 16 + 29);
  });
});

describe('drawing one cell', () => {
  const layout = (): ReturnType<typeof computeLayout> => computeLayout(3, 1, 360, 1);

  function drawOne(
    cell: CellView,
    status: GameStatus = 'playing',
    exposed?: readonly number[],
  ): Op[] {
    renderer.mount(rig.canvas);
    renderer.render(makeView(3, 1, [H, H, H], 'ready'));
    rig.ctx.reset();
    renderer.render(makeView(3, 1, [H, cell, H], status, exposed));
    return rig.ctx.ops;
  }

  it('fills a closed cell with the hidden color at its square', () => {
    renderer.mount(rig.canvas);
    renderer.render(allHidden(3, 1));
    const fills = rig.ctx.all('fillRect').filter((op) => op.fillStyle === THEME.hidden);
    expect(fills.map((op) => op.args)).toEqual(
      [0, 1, 2].map((i) => {
        const r = cellRect(layout(), i);
        return [r.x, r.y, r.size, r.size];
      }),
    );
  });

  it('fills a revealed zero with the revealed color and writes no text', () => {
    const ops = drawOne(R(0));
    expect(
      ops.filter((op) => op.name === 'fillRect' && op.fillStyle === THEME.revealed),
    ).toHaveLength(1);
    expect(ops.filter((op) => op.name === 'fillText')).toHaveLength(0);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    'writes %s in its own color, centered, in the theme font',
    (value) => {
      const ops = drawOne(R(value));
      const text = ops.filter((op) => op.name === 'fillText');
      expect(text).toHaveLength(1);
      expect(text[0]?.args[0]).toBe(String(value));
      expect(text[0]?.fillStyle).toBe(THEME.numbers[value - 1]);
      expect(text[0]?.font).toContain('bold');
      expect(text[0]?.font).toContain(THEME.fontFamily);
      expect(rig.ctx.textAlign).toBe('center');
      expect(inside(text[0] as Op, cellRect(layout(), 1))).toBe(true);
    },
  );

  it('draws a flag on the hidden color: a dark pole and a danger cloth', () => {
    const ops = drawOne(F);
    const square = cellRect(layout(), 1);
    expect(ops.some((op) => op.name === 'fillRect' && op.fillStyle === THEME.hidden)).toBe(true);
    expect(ops.some((op) => op.name === 'fillRect' && op.fillStyle === THEME.text)).toBe(true);
    expect(ops.some((op) => op.name === 'fill' && op.fillStyle === THEME.danger)).toBe(true);
    expect(ops.every((op) => inside(op, square))).toBe(true);
  });

  it('draws a mine after a loss on the revealed color, as a disc with spikes', () => {
    const ops = drawOne(H, 'lost', [1]);
    const square = cellRect(layout(), 1);
    expect(ops.some((op) => op.name === 'fillRect' && op.fillStyle === THEME.revealed)).toBe(true);
    expect(ops.some((op) => op.name === 'arc')).toBe(true);
    expect(ops.some((op) => op.name === 'stroke' && op.strokeStyle === THEME.text)).toBe(true);
    expect(ops.every((op) => inside(op, square))).toBe(true);
  });

  it('draws a wrong flag as a flag with a danger cross, so it is not told apart by color alone', () => {
    // The mine on cell 2 makes the flag on cell 1 wrong. Cells are drawn in index order, so the ops before the
    // first rectangle of cell 2 are the ones of cell 1.
    const all = drawOne(F, 'lost', [2]);
    const cell2X = cellRect(layout(), 2).x;
    const end = all.findIndex((op) => op.name === 'fillRect' && op.args[0] === cell2X);
    const ops = all.slice(0, end);
    expect(end).toBeGreaterThan(0);
    expect(ops.every((op) => inside(op, cellRect(layout(), 1)))).toBe(true);
    expect(ops.some((op) => op.name === 'fillRect' && op.fillStyle === THEME.revealed)).toBe(true);
    expect(ops.some((op) => op.name === 'fill' && op.fillStyle === THEME.danger)).toBe(true);
    expect(ops.some((op) => op.name === 'stroke' && op.strokeStyle === THEME.danger)).toBe(true);
  });

  it('draws a remaining mine as a flag after a win', () => {
    const ops = drawOne(H, 'won', [1]);
    expect(ops.some((op) => op.name === 'fill' && op.fillStyle === THEME.danger)).toBe(true);
    expect(ops.some((op) => op.name === 'arc')).toBe(false);
  });

  it('draws a flag and a hidden mine differently from each other', () => {
    const flag = drawOne(F);
    rig.ctx.reset();
    renderer.render(makeView(3, 1, [H, H, H], 'ready'));
    const mine = drawOne(H, 'lost', [1]);
    expect(flag.map((op) => op.name)).not.toEqual(mine.map((op) => op.name));
  });
});

describe('redrawing only what changed', () => {
  it('does nothing for a view that shows the same as the last one', () => {
    renderer.mount(rig.canvas);
    const cells = [H, F, R(2), R(0)];
    renderer.render(makeView(2, 2, cells));
    rig.ctx.reset();
    renderer.render(makeView(2, 2, [...cells]));
    expect(rig.ctx.ops).toHaveLength(0);
  });

  it('draws only the changed cell, with no clear of the whole canvas', () => {
    renderer.mount(rig.canvas);
    renderer.render(allHidden(9, 9));
    rig.ctx.reset();
    const cells = allHidden(9, 9).cells.map((c, i) => (i === 40 ? R(3) : c));
    renderer.render(makeView(9, 9, cells, 'playing'));
    const square = cellRect(computeLayout(9, 9, 360, 1), 40);
    expect(rig.ctx.all('clearRect')).toHaveLength(0);
    expect(rig.ctx.all('fillRect')).toHaveLength(1);
    expect(rig.ctx.ops.every((op) => inside(op, square))).toBe(true);
  });

  it('after a loss redraws only the mines and the wrong flags', () => {
    renderer.mount(rig.canvas);
    const before = makeView(5, 1, [H, F, F, H, R(2)], 'playing');
    renderer.render(before);
    rig.ctx.reset();
    // Cells 0 and 1 are mines: 0 shows up, 1 stays a flag; flag 2 is wrong; cell 3 is unchanged.
    renderer.render(makeView(5, 1, [H, F, F, H, R(2)], 'lost', [0, 1]));
    const layout = computeLayout(5, 1, 360, 1);
    const [mine, wrong, others] = [
      cellRect(layout, 0),
      cellRect(layout, 2),
      [1, 3, 4].map((i) => cellRect(layout, i)),
    ];
    expect(rig.ctx.ops.length).toBeGreaterThan(0);
    expect(rig.ctx.ops.every((op) => inside(op, mine) || inside(op, wrong))).toBe(true);
    expect(rig.ctx.ops.some((op) => inside(op, mine) && !inside(op, wrong))).toBe(true);
    expect(rig.ctx.ops.some((op) => inside(op, wrong) && !inside(op, mine))).toBe(true);
    // No op belongs to an unchanged cell: the flag on a mine, the closed safe cell and the revealed 2.
    for (const other of others) {
      expect(
        rig.ctx.ops.some((op) => inside(op, other) && !inside(op, mine) && !inside(op, wrong)),
      ).toBe(false);
    }
  });

  it('redraws everything when the board has a different size', () => {
    renderer.mount(rig.canvas);
    renderer.render(allHidden(3, 3));
    rig.ctx.reset();
    renderer.render(allHidden(4, 4));
    expect(rig.ctx.all('clearRect')).toHaveLength(1);
    expect(rig.ctx.all('fillRect')).toHaveLength(16);
  });

  it('rejects a view that does not hold width * height cells, and keeps what it showed', () => {
    renderer.mount(rig.canvas);
    renderer.render(allHidden(2, 2));
    const bad = makeView(2, 2, [H, H, H]);
    expect(() => renderer.render(bad)).toThrow(RangeError);
    rig.ctx.reset();
    renderer.render(allHidden(2, 2));
    expect(rig.ctx.ops).toHaveLength(0);
  });
});

describe('resize', () => {
  it('measures the container again, resizes the canvas and redraws every cell', () => {
    renderer.mount(rig.canvas);
    renderer.render(allHidden(9, 9));
    rig.ctx.reset();
    rig.setParentWidth(180);
    renderer.resize();
    const layout = computeLayout(9, 9, 180, 1);
    expect(rig.canvas.width).toBe(layout.widthPx);
    expect(rig.ctx.all('clearRect')).toHaveLength(1);
    expect(rig.ctx.all('fillRect')).toHaveLength(81);
  });

  it('follows a change of device pixel ratio', () => {
    renderer.mount(rig.canvas);
    renderer.render(allHidden(9, 9));
    const before = rig.canvas.width;
    rig.setDpr(2);
    renderer.resize();
    expect(rig.canvas.width).toBe(computeLayout(9, 9, 360, 2).widthPx);
    expect(rig.canvas.width).toBeGreaterThan(before);
  });

  it('reads the theme again, so a switch between light and dark repaints in the new colors', () => {
    renderer.mount(rig.canvas);
    renderer.render(allHidden(3, 3));
    theme = OTHER_THEME;
    rig.ctx.reset();
    renderer.resize();
    expect(rig.ctx.all('fillRect').every((op) => op.fillStyle === OTHER_THEME.hidden)).toBe(true);
  });

  it('does nothing before mount or before a view, and does not throw', () => {
    expect(() => renderer.resize()).not.toThrow();
    renderer.mount(rig.canvas);
    expect(() => renderer.resize()).not.toThrow();
    expect(rig.ctx.ops).toHaveLength(0);
  });
});

describe('hitTest', () => {
  const dprs = [1, 1.5, 2, 3];
  const boards: [number, number, number][] = [
    [9, 9, 360],
    [16, 16, 800],
    [30, 16, 1200],
    [30, 16, 300], // narrower than the minimum cells: the board overflows
  ];

  /** CSS client coordinates of a device-pixel point on the canvas. */
  const client = (r: CanvasRig, dpr: number, x: number, y: number): [number, number] => {
    const rect = r.canvas.getBoundingClientRect();
    return [rect.left + x / dpr, rect.top + y / dpr];
  };

  for (const dpr of dprs) {
    for (const [columns, rows, width] of boards) {
      it(`maps pixels to cells for ${columns}x${rows} in ${width} px at dpr ${dpr}`, () => {
        rig.dispose();
        rig = makeCanvasRig({ parentWidth: width, dpr, left: 13, top: 27 });
        renderer.mount(rig.canvas);
        renderer.render(allHidden(columns, rows));
        const layout = computeLayout(columns, rows, width, dpr);
        for (let i = 0; i < columns * rows; i += 1) {
          const r = cellRect(layout, i);
          const inset = 0.25;
          const points: [number, number][] = [
            [r.x + r.size / 2, r.y + r.size / 2],
            [r.x + inset, r.y + inset],
            [r.x + r.size - inset, r.y + r.size - inset],
          ];
          for (const [x, y] of points) {
            expect(renderer.hitTest(...client(rig, dpr, x, y))).toBe(i);
          }
        }
        // Gap between cell 0 and cell 1, and past each edge of the board.
        const gapX = layout.cellPx + layout.gapPx / 2;
        if (columns > 1) expect(renderer.hitTest(...client(rig, dpr, gapX, 2))).toBeNull();
        expect(renderer.hitTest(...client(rig, dpr, -1, 2))).toBeNull();
        expect(renderer.hitTest(...client(rig, dpr, 2, -1))).toBeNull();
        expect(renderer.hitTest(...client(rig, dpr, layout.widthPx + 1, 2))).toBeNull();
        expect(renderer.hitTest(...client(rig, dpr, 2, layout.heightPx + 1))).toBeNull();
      });
    }
  }

  it('follows the size the canvas has on screen (zoom or transform), not only its CSS size', () => {
    renderer.mount(rig.canvas);
    renderer.render(allHidden(9, 9));
    rig.setScreenScale(0.5);
    const rect = rig.canvas.getBoundingClientRect();
    const layout = computeLayout(9, 9, 360, 1);
    const target = cellRect(layout, 10);
    const x = rect.left + ((target.x + target.size / 2) / layout.widthPx) * rect.width;
    const y = rect.top + ((target.y + target.size / 2) / layout.heightPx) * rect.height;
    expect(renderer.hitTest(x, y)).toBe(10);
  });

  it('returns null for non-finite coordinates', () => {
    renderer.mount(rig.canvas);
    renderer.render(allHidden(3, 3));
    expect(renderer.hitTest(Number.NaN, 5)).toBeNull();
    expect(renderer.hitTest(5, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('returns null before mount, before the first view, and after unmount', () => {
    expect(renderer.hitTest(5, 5)).toBeNull();
    renderer.mount(rig.canvas);
    expect(renderer.hitTest(5, 5)).toBeNull();
    renderer.render(allHidden(3, 3));
    expect(renderer.hitTest(5, 5)).toBe(0);
    renderer.unmount();
    expect(renderer.hitTest(5, 5)).toBeNull();
  });
});

describe('unmount', () => {
  it('stops drawing, and a later render only remembers the view', () => {
    renderer.mount(rig.canvas);
    renderer.render(allHidden(3, 3));
    renderer.unmount();
    rig.ctx.reset();
    renderer.render(allHidden(4, 4));
    renderer.resize();
    expect(rig.ctx.ops).toHaveLength(0);
  });

  it('can be mounted again on another canvas, which then shows the last view in full', () => {
    renderer.mount(rig.canvas);
    renderer.render(allHidden(3, 3));
    renderer.unmount();
    const second = makeCanvasRig({ parentWidth: 360, dpr: 1 });
    try {
      renderer.mount(second.canvas);
      expect(second.ctx.all('fillRect')).toHaveLength(9);
    } finally {
      renderer.unmount();
      second.dispose();
    }
  });

  it('moves to the new canvas when mounted twice without an unmount', () => {
    const second = makeCanvasRig({ parentWidth: 360, dpr: 1 });
    try {
      renderer.mount(rig.canvas);
      renderer.mount(second.canvas);
      rig.ctx.reset();
      renderer.render(allHidden(3, 3));
      expect(rig.ctx.ops).toHaveLength(0);
      expect(second.ctx.all('fillRect')).toHaveLength(9);
    } finally {
      renderer.unmount();
      second.dispose();
    }
  });

  it('is safe to call when nothing is mounted', () => {
    expect(() => {
      renderer.unmount();
      renderer.unmount();
    }).not.toThrow();
  });
});

// The documented budget for a full redraw of the largest classic board (expert, 30x16 = 480 cells). The fake
// context makes the numbers the cost of the renderer's own code and of the number of canvas calls it makes;
// it does not time a GPU. Real smoothness is checked by hand on an expert board (the task's acceptance text).
// Measured when this was written (Node 24, busiest mix below, dpr 2): 2,029 calls = 4.2 per cell, 1.6 ms.
const BUDGET = {
  /** Canvas calls per cell for the busiest mix of cells: about twice what was measured. */
  callsPerCell: 8,
  /** Calls for a one-cell change, whatever the board size (a mine is the dearest cell, about 20 calls). */
  singleCellCalls: 25,
  /** Milliseconds for the renderer's own work in a resize plus a render, with the fake context. Wide margin for slow CI. */
  fullRedrawMs: 50,
} as const;

describe('budget on an expert board', () => {
  const busy = (): GameView => {
    const cells = Array.from({ length: 480 }, (_, i): CellView => {
      if (i % 7 === 0) return F;
      if (i % 3 === 0) return H;
      return R(i % 9);
    });
    const mines = Array.from({ length: 99 }, (_, k) => k * 4 + 1).filter((i) => i < 480);
    return makeView(30, 16, cells, 'lost', mines);
  };

  it('stays inside the call budget for a full redraw of the busiest view', () => {
    rig.dispose();
    rig = makeCanvasRig({ parentWidth: 1200, dpr: 2 });
    renderer.mount(rig.canvas);
    renderer.render(busy());
    expect(rig.ctx.ops.length).toBeLessThanOrEqual(BUDGET.callsPerCell * 480);
    expect(rig.ctx.ops.length).toBeGreaterThan(480);
  });

  it('stays inside the time budget for a full redraw', () => {
    renderer.mount(rig.canvas);
    renderer.render(busy());
    const view = busy();
    const started = performance.now();
    renderer.resize(); // a resize is a full redraw of the last view
    renderer.render(view);
    expect(performance.now() - started).toBeLessThan(BUDGET.fullRedrawMs);
  });

  it('draws a one-cell change with a handful of calls, not a number that grows with the board', () => {
    renderer.mount(rig.canvas);
    renderer.render(busy());
    rig.ctx.reset();
    const next = busy();
    const cells = next.cells.map((c, i) => (i === 200 ? R(5) : c));
    renderer.render(makeView(30, 16, cells, 'lost', next.exposedMines));
    expect(rig.ctx.ops.length).toBeGreaterThan(0);
    expect(rig.ctx.ops.length).toBeLessThanOrEqual(BUDGET.singleCellCalls);
  });
});
