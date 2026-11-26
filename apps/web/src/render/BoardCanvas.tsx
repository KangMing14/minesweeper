import type { GameView } from '@minesweeper/engine';
import { useEffect, useRef, useState } from 'react';
import type { BoardRenderer } from './BoardRenderer.js';
import { CanvasBoardRenderer } from './CanvasBoardRenderer.js';

// M3-T03. The React side of the board: it owns the canvas and the lifetime of a renderer. It takes a `view`,
// never a session, so the screen that uses it decides where views come from (M3-T05).

/** Props of `BoardCanvas`. */
export interface BoardCanvasProps {
  /** What to show. Pass a new object when the game changes; an equal-looking view costs nothing to redraw. */
  readonly view: GameView;
  /**
   * Called with the mounted renderer (so the input controller can use `hitTest`) and with `null` when it is
   * let go. Read once per mount; changing the function later does not remount the board.
   */
  readonly onRenderer?: (renderer: BoardRenderer | null) => void;
  /**
   * Called with the canvas element once the renderer is mounted on it (just before `onRenderer`), and with
   * `null` when the board leaves the page (just after `onRenderer(null)`). The input controller listens on
   * this element, so it needs it as well as the renderer. Read once per mount, like `onRenderer`.
   */
  readonly onCanvas?: (canvas: HTMLCanvasElement | null) => void;
  /** Makes the renderer. Defaults to `new CanvasBoardRenderer()`. Read once per mount; used by tests. */
  readonly createRenderer?: () => BoardRenderer;
}

/** Calls `onChange` whenever the device pixel ratio changes (browser zoom, moving to another screen). */
function watchPixelRatio(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  let query: MediaQueryList | null = null;
  let stopped = false;
  // A `resolution` query only fires once for the ratio it was made with, so ask again for the new ratio.
  const handle = (): void => {
    query?.removeEventListener('change', handle);
    if (stopped) return;
    onChange();
    listen();
  };
  const listen = (): void => {
    query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    query.addEventListener('change', handle);
  };
  listen();
  return () => {
    stopped = true;
    query?.removeEventListener('change', handle);
  };
}

/**
 * The board as a canvas, kept sharp and in the right colors as the page changes.
 *
 * @remarks
 * It mounts a `BoardRenderer` on its canvas, shows each new `view`, and calls `resize()` when the container
 * changes size, the window resizes, the pixel ratio changes, the system switches between light and dark, or
 * the page's `data-theme` attribute changes. It sizes itself to the width of its own wrapper, so put it in a
 * container that has a width. If the browser gives no 2D drawing context it shows a message instead.
 * Keyboard play and screen-reader support arrive with M3-T04 and M3-T08; for now the canvas has a name only.
 *
 * @example
 * ```tsx
 * <BoardCanvas
 * view={session.view()}
 * onRenderer={(r) => (rendererRef.current = r)}
 * onCanvas={(c) => (canvasRef.current = c)}
 * />
 * ```
 */
export function BoardCanvas({
  view,
  onRenderer,
  onCanvas,
  createRenderer,
}: BoardCanvasProps): React.JSX.Element {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BoardRenderer | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  // The effect below must see the latest of these without running again, so it reads them through refs.
  const latest = useRef({ view, onRenderer, onCanvas, createRenderer });
  latest.current = { view, onRenderer, onCanvas, createRenderer };

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (canvas === null || wrapper === null) return undefined;
    const { createRenderer: make, onRenderer: notify, onCanvas: notifyCanvas } = latest.current;
    const renderer = make?.() ?? new CanvasBoardRenderer();
    try {
      renderer.mount(canvas);
    } catch {
      setUnavailable(true);
      return undefined;
    }
    // The effect below shows the view; effects of one component run in order, so it runs right after this one.
    rendererRef.current = renderer;
    notifyCanvas?.(canvas);
    notify?.(renderer);

    const resize = (): void => renderer.resize();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
    observer?.observe(wrapper);
    window.addEventListener('resize', resize);
    const themeWatcher = new MutationObserver(resize);
    themeWatcher.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const scheme =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
    scheme?.addEventListener('change', resize);
    const stopPixelRatio = watchPixelRatio(resize);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      themeWatcher.disconnect();
      scheme?.removeEventListener('change', resize);
      stopPixelRatio();
      notify?.(null);
      notifyCanvas?.(null);
      renderer.unmount();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.render(view);
  }, [view]);

  if (unavailable) {
    return (
      <p role="alert" className="text-danger">
        This browser can&rsquo;t draw the board. Try a current version of Chrome, Firefox, Safari or
        Edge.
      </p>
    );
  }

  return (
    <div ref={wrapperRef} className="w-full overflow-x-auto">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Minesweeper board, ${view.width} by ${view.height}`}
        className="mx-auto block"
      />
    </div>
  );
}
