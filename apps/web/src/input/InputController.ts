import type { CellIndex, GameView } from '@minesweeper/engine';
import type { BoardRenderer } from '../render/BoardRenderer.js';
import type { GameSession, PlayerAction } from '../session/GameSession.js';

// M3-T04. Translates mouse and keyboard events on the board into `PlayerAction`s. It knows two interfaces:
// `BoardRenderer` (which cell is under a point, and where to draw the keyboard cursor) and `GameSession` (where
// actions go, and the view for the board size and the game status). It never creates or drives a `Game`
// (ADR-004) and handles no mine data (D-14): everything it reads is a `GameView`.

/** Options of `InputController`. */
export interface InputControllerOptions {
  /** The session that receives the actions. It must be started: the controller reads `view()`. */
  readonly session: GameSession;
  /** Answers which cell is under a point and shows the keyboard cursor. */
  readonly renderer: BoardRenderer;
  /**
   * When true (the default), a left click on a revealed number chords instead of doing nothing. A reveal on a
   * revealed cell has no effect in the engine, so the shortcut takes nothing away.
   */
  readonly chordOnNumberClick?: boolean;
  /**
   * Called with the cell the ring marks each time the keyboard shows it or moves it, also when a move is
   * stopped by the edge (the same cell again, so a key press is never silent). Not called for the mouse and
   * not for actions. The play screen turns it into a live-region message (M3-T08).
   */
  readonly onCursorChange?: (index: CellIndex) => void;
}

/** The three mouse buttons the controller uses: `MouseEvent.button` values. */
const LEFT = 0;
const MIDDLE = 1;
const RIGHT = 2;

/** Arrow keys as a step on the board: columns, rows. */
const STEPS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/** Keys that act on the cursor cell. Letters are matched in lower case. */
const KEY_ACTIONS: Readonly<Record<string, PlayerAction['type']>> = {
  ' ': 'reveal',
  f: 'flag',
  Enter: 'chord',
  c: 'chord',
};

/**
 * Turns pointer and keyboard input on the board into `PlayerAction`s for a `GameSession`.
 *
 * @remarks
 * **Mouse.** A gesture is every button pressed until all are released, and it acts once, at the cell where the
 * last button is released (as in the classic game): left reveals, right flags, middle chords, left and right
 * together chord, and a left click on a revealed number chords too (see `chordOnNumberClick`). A release over
 * no cell (a gap between cells, or outside the board) does nothing and is never read as cell 0. Leaving the
 * element cancels a gesture. A press with Ctrl held is ignored: on macOS it is a right click, and revealing on
 * it would end a run by mistake. The context menu is suppressed on the element.
 *
 * **Keyboard.** The element is made focusable if it is not. Arrow keys move the cursor one cell and stop at the
 * edges (no wrap); Space reveals, F flags, Enter or C chords, all at the cursor cell. The ring is hidden until a
 * key is pressed, and the first key only shows it (in the middle of the board, or where the last mouse click or
 * key left it), so a key never acts on a cell the player has not seen marked. Holding a key does not repeat an
 * action, only a move. Keys with Ctrl, Meta or Alt are left to the browser, and so are keys the controller does
 * not use (Tab, R, Shift+R). After a mouse click the ring is hidden again and the clicked cell is remembered;
 * when the element loses focus the ring is hidden too.
 *
 * **The end of the game.** Once the game is won or lost, or stuck (`isStuck()`), no action is sent, though the
 * cursor can still move. The session ignores such input as well; the controller checks so that nothing is sent
 * and a click that can have no effect does not move the cursor.
 *
 * @example
 * ```ts
 * const controller = new InputController({ session, renderer });
 * controller.attach(canvas); // wire the listeners, make the canvas focusable
 * // ... when the board leaves the page, or the session changes:
 * controller.detach();
 * ```
 */
export class InputController {
  readonly #session: GameSession;
  readonly #renderer: BoardRenderer;
  readonly #chordOnNumberClick: boolean;
  readonly #onCursorChange: ((index: CellIndex) => void) | undefined;
  #element: HTMLElement | null = null;
  #addedTabIndex = false;
  /** The keyboard cursor, or null before the first key or click. Remembered while the ring is hidden. */
  #cursor: CellIndex | null = null;
  #ringShown = false;
  /** Mouse buttons that are down now, and every button that was down since the gesture began. */
  readonly #held = new Set<number>();
  readonly #seen = new Set<number>();

  /** Creates a controller that is not attached to anything. */
  constructor(options: InputControllerOptions) {
    this.#session = options.session;
    this.#renderer = options.renderer;
    this.#chordOnNumberClick = options.chordOnNumberClick ?? true;
    this.#onCursorChange = options.onCursorChange;
  }

  /** The cell the keyboard cursor is on, or `null` before the first key or click. */
  get cursor(): CellIndex | null {
    return this.#cursor;
  }

  /**
   * Starts listening on an element (normally the board's canvas). An element that is already attached is
   * detached first, so a controller listens on one element at a time.
   *
   * @param element - The element that receives the mouse and key events.
   */
  attach(element: HTMLElement): void {
    this.detach();
    this.#element = element;
    if (!element.hasAttribute('tabindex')) {
      element.setAttribute('tabindex', '0');
      this.#addedTabIndex = true;
    }
    element.addEventListener('mousedown', this.#onMouseDown);
    element.addEventListener('mouseup', this.#onMouseUp);
    element.addEventListener('mouseleave', this.#onMouseLeave);
    element.addEventListener('contextmenu', this.#onContextMenu);
    element.addEventListener('keydown', this.#onKeyDown);
    element.addEventListener('blur', this.#onBlur);
    element.addEventListener('focus', this.#onFocus);
  }

  /** Stops listening, removes the ring and forgets a half-finished gesture. Safe to call at any time. */
  detach(): void {
    const element = this.#element;
    if (element === null) return;
    element.removeEventListener('mousedown', this.#onMouseDown);
    element.removeEventListener('mouseup', this.#onMouseUp);
    element.removeEventListener('mouseleave', this.#onMouseLeave);
    element.removeEventListener('contextmenu', this.#onContextMenu);
    element.removeEventListener('keydown', this.#onKeyDown);
    element.removeEventListener('blur', this.#onBlur);
    element.removeEventListener('focus', this.#onFocus);
    if (this.#addedTabIndex) element.removeAttribute('tabindex');
    this.#addedTabIndex = false;
    this.#element = null;
    this.#clearGesture();
    this.#hideRing();
  }

  readonly #onMouseDown = (event: MouseEvent): void => {
    if (event.ctrlKey) return;
    this.#held.add(event.button);
    this.#seen.add(event.button);
  };

  readonly #onMouseUp = (event: MouseEvent): void => {
    if (!this.#held.delete(event.button) || this.#held.size > 0) return;
    const buttons = new Set(this.#seen);
    this.#clearGesture();
    this.#finishGesture(buttons, event.clientX, event.clientY);
  };

  readonly #onMouseLeave = (): void => {
    this.#clearGesture();
  };

  readonly #onContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  readonly #onBlur = (): void => {
    this.#hideRing();
  };

  /**
   * A focus that the browser treats as keyboard focus (`:focus-visible`: Tab, or a script after a key press)
   * shows the ring at once, on the remembered cell or in the middle, so a keyboard player sees where they
   * are without pressing a key first. A focus from the mouse shows nothing: the ring stays hidden until the
   * first key, which only shows it (M3-T04), so no key ever acts on a cell that was not marked.
   */
  readonly #onFocus = (): void => {
    const element = this.#element;
    if (element === null || !matchesFocusVisible(element)) return;
    const view = this.#session.view();
    if (this.#cursor === null || this.#cursor >= view.cells.length) this.#cursor = centerOf(view);
    this.#showRing();
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const step = STEPS[event.key];
    const actionType = KEY_ACTIONS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
    if (step === undefined && actionType === undefined) return;
    event.preventDefault(); // Space and the arrows would scroll the page

    const view = this.#session.view();
    const count = view.cells.length;
    if (this.#cursor === null || this.#cursor >= count) {
      this.#cursor = centerOf(view);
      this.#showRing();
      return;
    }
    if (!this.#ringShown) {
      this.#showRing();
      return;
    }
    if (step !== undefined) {
      this.#cursor = moveWithin(view, this.#cursor, step[0], step[1]);
      this.#showRing();
      return;
    }
    if (actionType !== undefined && !event.repeat && this.#canAct(view)) {
      this.#session.dispatch({ type: actionType, index: this.#cursor });
    }
  };

  /** Acts on the buttons of a finished gesture at the point where the last one was released. */
  #finishGesture(buttons: ReadonlySet<number>, clientX: number, clientY: number): void {
    const left = buttons.has(LEFT);
    const right = buttons.has(RIGHT);
    const middle = buttons.has(MIDDLE);
    if (!left && !right && !middle) return;
    const index = this.#renderer.hitTest(clientX, clientY);
    if (index === null) return;
    const view = this.#session.view();
    if (!this.#canAct(view)) return;

    // The mouse takes over from the keyboard: the ring goes, the cell is remembered for the next key.
    this.#cursor = index;
    this.#hideRing();

    if (middle || (left && right)) {
      this.#send('chord', index);
    } else if (right) {
      this.#send('flag', index);
    } else if (this.#chordOnNumberClick && isNumber(view, index)) {
      this.#send('chord', index);
    } else {
      this.#send('reveal', index);
    }
  }

  #send(type: PlayerAction['type'], index: CellIndex): void {
    this.#session.dispatch({ type, index });
  }

  #canAct(view: GameView): boolean {
    return (view.status === 'ready' || view.status === 'playing') && !this.#session.isStuck();
  }

  #clearGesture(): void {
    this.#held.clear();
    this.#seen.clear();
  }

  #showRing(): void {
    this.#ringShown = true;
    this.#renderer.setCursor(this.#cursor);
    if (this.#cursor !== null) this.#onCursorChange?.(this.#cursor);
  }

  #hideRing(): void {
    if (!this.#ringShown) return;
    this.#ringShown = false;
    this.#renderer.setCursor(null);
  }
}

/** Whether the browser shows a focus ring on the element; false where it cannot say (an old browser, jsdom). */
function matchesFocusVisible(element: HTMLElement): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
}

/** True for a revealed cell that shows 1 to 8: the only cells a chord can do something on. */
function isNumber(view: GameView, index: CellIndex): boolean {
  const cell = view.cells[index];
  return cell !== undefined && cell.state === 'revealed' && cell.value > 0;
}

/** The middle cell; on an even side, the later of the two middle cells. */
function centerOf(view: GameView): CellIndex {
  return Math.floor(view.height / 2) * view.width + Math.floor(view.width / 2);
}

/** One step from a cell, staying on the board: no wrap from one row to the next. */
function moveWithin(view: GameView, index: CellIndex, dx: number, dy: number): CellIndex {
  const x = index % view.width;
  const y = Math.floor(index / view.width);
  const nx = Math.min(view.width - 1, Math.max(0, x + dx));
  const ny = Math.min(view.height - 1, Math.max(0, y + dy));
  return ny * view.width + nx;
}
