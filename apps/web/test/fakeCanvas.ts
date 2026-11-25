// Test kit for M3-T03: a recording stand-in for a 2D canvas context, and a canvas wired up the way a browser
// would have it. jsdom has no canvas, and `node-canvas` would be a new dependency, so the renderer is tested
// against a fake that writes every drawing call down. This checks what is drawn and where, not how a real
// GPU rasterizes it (the manual check on an expert board covers that).

/** One drawing call, with the colors that were set when it was made. */
export interface Op {
  readonly name: string;
  readonly args: readonly unknown[];
  readonly fillStyle: string;
  readonly strokeStyle: string;
  readonly lineWidth: number;
  readonly font: string;
}

const CALLS = [
  'clearRect',
  'fillRect',
  'beginPath',
  'closePath',
  'moveTo',
  'lineTo',
  'arc',
  'fill',
  'stroke',
  'fillText',
] as const;

/** Records the drawing calls of a renderer. Settable properties are plain fields. */
export class FakeContext2D {
  fillStyle = '#000000';
  strokeStyle = '#000000';
  lineWidth = 1;
  font = '10px sans-serif';
  textAlign = 'start';
  textBaseline = 'alphabetic';
  /** Every drawing call since the last `reset()`. */
  ops: Op[] = [];

  constructor() {
    for (const name of CALLS) {
      (this as unknown as Record<string, unknown>)[name] = (...args: unknown[]): void => {
        this.ops.push({
          name,
          args,
          fillStyle: this.fillStyle,
          strokeStyle: this.strokeStyle,
          lineWidth: this.lineWidth,
          font: this.font,
        });
      };
    }
  }

  /** Forgets the calls so far. */
  reset(): void {
    this.ops = [];
  }

  /** The calls with this name. */
  all(name: (typeof CALLS)[number]): Op[] {
    return this.ops.filter((op) => op.name === name);
  }
}

/** A canvas in a container, as the browser would lay it out. */
export interface CanvasRig {
  readonly canvas: HTMLCanvasElement;
  readonly parent: HTMLElement;
  readonly ctx: FakeContext2D;
  /** Changes what `parent.clientWidth` reports. */
  setParentWidth(width: number): void;
  /** Changes `window.devicePixelRatio`. */
  setDpr(dpr: number): void;
  /** Makes the canvas look `factor` times as large on screen as its CSS size says (browser zoom, a transform). */
  setScreenScale(factor: number): void;
  /** Removes the elements and puts `devicePixelRatio` back. */
  dispose(): void;
}

/**
 * Builds a canvas inside a div that reports `parentWidth`, at the screen position (`left`, `top`).
 *
 * @param options - Where the canvas is and how wide its container is.
 * @returns The rig.
 */
export function makeCanvasRig(
  options: { parentWidth?: number; dpr?: number; left?: number; top?: number } = {},
): CanvasRig {
  const state = {
    parentWidth: options.parentWidth ?? 360,
    left: options.left ?? 0,
    top: options.top ?? 0,
    screenScale: 1,
  };
  const dprBefore = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
  const setDpr = (dpr: number): void => {
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: dpr });
  };
  setDpr(options.dpr ?? 1);

  const parent = document.createElement('div');
  Object.defineProperty(parent, 'clientWidth', {
    configurable: true,
    get: () => state.parentWidth,
  });
  const canvas = document.createElement('canvas');
  parent.append(canvas);
  document.body.append(parent);

  const ctx = new FakeContext2D();
  (canvas as unknown as { getContext: () => FakeContext2D }).getContext = () => ctx;
  canvas.getBoundingClientRect = (): DOMRect => {
    const dpr = window.devicePixelRatio;
    const width = (canvas.width / dpr) * state.screenScale;
    const height = (canvas.height / dpr) * state.screenScale;
    return {
      left: state.left,
      top: state.top,
      width,
      height,
      right: state.left + width,
      bottom: state.top + height,
      x: state.left,
      y: state.top,
      toJSON: () => ({}),
    };
  };

  return {
    canvas,
    parent,
    ctx,
    setParentWidth: (width) => {
      state.parentWidth = width;
    },
    setDpr,
    setScreenScale: (factor) => {
      state.screenScale = factor;
    },
    dispose: () => {
      parent.remove();
      if (dprBefore) Object.defineProperty(window, 'devicePixelRatio', dprBefore);
      else Reflect.deleteProperty(window, 'devicePixelRatio');
    },
  };
}
