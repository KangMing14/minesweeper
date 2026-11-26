import type { CellView, GameView } from '@minesweeper/engine';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeContext2D } from '../../test/fakeCanvas.js';
import type { BoardRenderer } from './BoardRenderer.js';
import { BoardCanvas } from './BoardCanvas.js';

// M3-T03. The component's job is the lifecycle: create and mount a renderer, feed it views, tell it when
// the size, the pixel ratio or the theme changes, and let go of it. Drawing itself is tested elsewhere.

function makeView(width: number, height: number, cell: CellView = { state: 'hidden' }): GameView {
  return {
    width,
    height,
    status: 'ready',
    cells: Array.from({ length: width * height }, () => cell),
    revealedCount: 0,
    flagCount: 0,
    minesRemaining: 0,
  };
}

/** A renderer that only writes down what it was asked to do. */
function makeSpyRenderer(): BoardRenderer & {
  calls: string[];
  views: GameView[];
  canvas: unknown[];
} {
  const spy = {
    calls: [] as string[],
    views: [] as GameView[],
    canvas: [] as unknown[],
    mount(canvas: HTMLCanvasElement) {
      spy.calls.push('mount');
      spy.canvas.push(canvas);
    },
    render(view: GameView) {
      spy.calls.push('render');
      spy.views.push(view);
    },
    hitTest: () => null,
    setCursor() {},
    resize() {
      spy.calls.push('resize');
    },
    unmount() {
      spy.calls.push('unmount');
    },
  };
  return spy;
}

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(readonly callback: () => void) {
    FakeResizeObserver.instances.push(this);
  }
  observe(element: Element): void {
    this.observed.push(element);
  }
  disconnect(): void {
    this.disconnected = true;
  }
  unobserve(): void {}
}

/** `matchMedia` stand-in whose queries can be made to fire. */
function stubMatchMedia(): { fire(query: string): void; listeners: Map<string, Set<() => void>> } {
  const listeners = new Map<string, Set<() => void>>();
  vi.stubGlobal(
    'matchMedia',
    (
      query: string,
    ): Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'> => ({
      matches: false,
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        const set = listeners.get(query) ?? new Set();
        set.add(listener as () => void);
        listeners.set(query, set);
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.get(query)?.delete(listener as () => void);
      },
    }),
  );
  return {
    listeners,
    fire(query) {
      for (const listener of [...(listeners.get(query) ?? [])]) listener();
    },
  };
}

beforeEach(() => {
  FakeResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-theme');
});

describe('BoardCanvas lifecycle', () => {
  it('renders a canvas with an accessible name and hands it to a new renderer with the view', () => {
    const renderer = makeSpyRenderer();
    const view = makeView(9, 9);
    render(<BoardCanvas view={view} createRenderer={() => renderer} />);
    const canvas = screen.getByRole('img', { name: /minesweeper board.*9 by 9/i });
    expect(canvas.tagName).toBe('CANVAS');
    expect(renderer.calls).toEqual(['mount', 'render']);
    expect(renderer.canvas[0]).toBe(canvas);
    expect(renderer.views[0]).toBe(view);
  });

  it('gives the renderer to onRenderer, so an input controller can use hitTest', () => {
    const renderer = makeSpyRenderer();
    const seen: (BoardRenderer | null)[] = [];
    const { unmount } = render(
      <BoardCanvas
        view={makeView(3, 3)}
        createRenderer={() => renderer}
        onRenderer={(r) => seen.push(r)}
      />,
    );
    expect(seen).toEqual([renderer]);
    unmount();
    expect(seen).toEqual([renderer, null]);
  });

  it('gives the canvas element to onCanvas, so an input controller can listen on it (M3-T05)', () => {
    const renderer = makeSpyRenderer();
    const seen: (HTMLCanvasElement | null)[] = [];
    const { unmount } = render(
      <BoardCanvas
        view={makeView(3, 3)}
        createRenderer={() => renderer}
        onCanvas={(c) => seen.push(c)}
      />,
    );
    const canvas = screen.getByRole('img');
    expect(seen).toEqual([canvas]);
    expect(canvas.tagName).toBe('CANVAS');
    unmount();
    expect(seen).toEqual([canvas, null]);
  });

  it('calls onCanvas and onRenderer for the same mount, the canvas first, and pairs every call with a null', () => {
    const order: string[] = [];
    render(
      <StrictMode>
        <BoardCanvas
          view={makeView(3, 3)}
          createRenderer={makeSpyRenderer}
          onCanvas={(c) => order.push(c === null ? 'canvas:null' : 'canvas')}
          onRenderer={(r) => order.push(r === null ? 'renderer:null' : 'renderer')}
        />
      </StrictMode>,
    );
    cleanup();
    // StrictMode mounts, unmounts and mounts again; each mount announces the canvas before the renderer,
    // and each unmount takes the renderer away before the canvas.
    expect(order).toEqual([
      'canvas',
      'renderer',
      'renderer:null',
      'canvas:null',
      'canvas',
      'renderer',
      'renderer:null',
      'canvas:null',
    ]);
  });

  it('renders each new view without mounting again', () => {
    const renderer = makeSpyRenderer();
    const first = makeView(3, 3);
    const second = makeView(3, 3, { state: 'flagged' });
    const { rerender } = render(<BoardCanvas view={first} createRenderer={() => renderer} />);
    rerender(<BoardCanvas view={second} createRenderer={() => renderer} />);
    expect(renderer.calls.filter((c) => c === 'mount')).toHaveLength(1);
    expect(renderer.views.at(-1)).toBe(second);
  });

  it('unmounts the renderer when it leaves the page', () => {
    const renderer = makeSpyRenderer();
    const { unmount } = render(
      <BoardCanvas view={makeView(3, 3)} createRenderer={() => renderer} />,
    );
    unmount();
    expect(renderer.calls.at(-1)).toBe('unmount');
  });

  it('ends mounted after the double mount of StrictMode, with every observer from the first pass released', () => {
    const made: ReturnType<typeof makeSpyRenderer>[] = [];
    render(
      <StrictMode>
        <BoardCanvas
          view={makeView(3, 3)}
          createRenderer={() => {
            const r = makeSpyRenderer();
            made.push(r);
            return r;
          }}
        />
      </StrictMode>,
    );
    expect(made.length).toBeGreaterThanOrEqual(2);
    const last = made.at(-1);
    expect(last?.calls.at(-1)).toBe('render');
    for (const earlier of made.slice(0, -1)) expect(earlier.calls.at(-1)).toBe('unmount');
    expect(FakeResizeObserver.instances.slice(0, -1).every((o) => o.disconnected)).toBe(true);
  });

  it('shows a message instead of a canvas that cannot be drawn on, and tells nobody it has a renderer', () => {
    const seen: (BoardRenderer | null)[] = [];
    const broken: BoardRenderer = {
      ...makeSpyRenderer(),
      mount() {
        throw new Error('no 2d');
      },
    };
    render(
      <BoardCanvas
        view={makeView(3, 3)}
        createRenderer={() => broken}
        onRenderer={(r) => seen.push(r)}
      />,
    );
    expect(screen.getByRole('alert').textContent).toMatch(/can.t draw the board/i);
    expect(seen).not.toContain(broken);
  });
});

describe('BoardCanvas keeps the picture right', () => {
  it('redraws when the container is resized', () => {
    const renderer = makeSpyRenderer();
    const { container } = render(
      <BoardCanvas view={makeView(3, 3)} createRenderer={() => renderer} />,
    );
    const observer = FakeResizeObserver.instances.at(-1);
    expect(observer?.observed).toContain(container.firstElementChild);
    renderer.calls.length = 0;
    act(() => observer?.callback());
    expect(renderer.calls).toEqual(['resize']);
  });

  it('redraws when the window is resized', () => {
    const renderer = makeSpyRenderer();
    render(<BoardCanvas view={makeView(3, 3)} createRenderer={() => renderer} />);
    renderer.calls.length = 0;
    fireEvent(window, new Event('resize'));
    expect(renderer.calls).toEqual(['resize']);
  });

  it('redraws when the system switches between light and dark', () => {
    const media = stubMatchMedia();
    const renderer = makeSpyRenderer();
    render(<BoardCanvas view={makeView(3, 3)} createRenderer={() => renderer} />);
    renderer.calls.length = 0;
    act(() => media.fire('(prefers-color-scheme: dark)'));
    expect(renderer.calls).toEqual(['resize']);
  });

  it('redraws when the page theme attribute changes', async () => {
    const renderer = makeSpyRenderer();
    render(<BoardCanvas view={makeView(3, 3)} createRenderer={() => renderer} />);
    renderer.calls.length = 0;
    document.documentElement.setAttribute('data-theme', 'dark');
    await waitFor(() => expect(renderer.calls).toEqual(['resize']));
  });

  it('redraws when the pixel ratio changes, for the new ratio each time', () => {
    const media = stubMatchMedia();
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
    const renderer = makeSpyRenderer();
    render(<BoardCanvas view={makeView(3, 3)} createRenderer={() => renderer} />);
    renderer.calls.length = 0;
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
    act(() => media.fire('(resolution: 1dppx)'));
    expect(renderer.calls).toEqual(['resize']);
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });
    act(() => media.fire('(resolution: 2dppx)'));
    expect(renderer.calls).toEqual(['resize', 'resize']);
  });

  it('stops listening to everything when it leaves the page', () => {
    const media = stubMatchMedia();
    const renderer = makeSpyRenderer();
    const { unmount } = render(
      <BoardCanvas view={makeView(3, 3)} createRenderer={() => renderer} />,
    );
    unmount();
    renderer.calls.length = 0;
    fireEvent(window, new Event('resize'));
    document.documentElement.setAttribute('data-theme', 'dark');
    for (const query of media.listeners.keys()) media.fire(query);
    expect(renderer.calls).toEqual([]);
    expect(FakeResizeObserver.instances.at(-1)?.disconnected).toBe(true);
    for (const set of media.listeners.values()) expect(set.size).toBe(0);
  });

  it('works where ResizeObserver and matchMedia do not exist', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    vi.stubGlobal('matchMedia', undefined);
    const renderer = makeSpyRenderer();
    expect(() =>
      render(<BoardCanvas view={makeView(3, 3)} createRenderer={() => renderer} />),
    ).not.toThrow();
  });
});

describe('BoardCanvas with the real renderer', () => {
  it('draws one rectangle per cell on the canvas', () => {
    const ctx = new FakeContext2D();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    render(<BoardCanvas view={makeView(4, 3)} />);
    expect(ctx.all('fillRect')).toHaveLength(12);
  });

  it('shows the fallback message when the browser gives no 2D context', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    render(<BoardCanvas view={makeView(4, 3)} />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});
