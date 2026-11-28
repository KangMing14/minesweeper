import type {
  CellIndex,
  CellView,
  GameResult,
  GameStatus,
  GameView,
  ReplayLog,
} from '@minesweeper/engine';
import { fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardRenderer } from '../render/BoardRenderer.js';
import type { GameSession, PlayerAction } from '../session/GameSession.js';
import { InputController } from './InputController.js';

// M3-T04. The controller is tested against a fake session (it records what it is sent) and a fake renderer
// (a hit test the test controls, and a record of the cursor). Both are written against the real interfaces.

const H: CellView = { state: 'hidden' };
const F: CellView = { state: 'flagged' };
const R = (value: number): CellView => ({ state: 'revealed', value });

function makeView(
  width: number,
  height: number,
  status: GameStatus = 'playing',
  cells?: readonly CellView[],
): GameView {
  const list = cells ?? Array.from({ length: width * height }, () => H);
  return {
    width,
    height,
    status,
    cells: list,
    revealedCount: list.filter((c) => c.state === 'revealed').length,
    flagCount: list.filter((c) => c.state === 'flagged').length,
    minesRemaining: 0,
  };
}

class FakeSession implements GameSession {
  readonly actions: PlayerAction[] = [];
  current: GameView;
  stuck = false;
  constructor(view: GameView) {
    this.current = view;
  }
  start(): void {}
  dispatch(action: PlayerAction): void {
    this.actions.push(action);
  }
  subscribe(): () => void {
    return () => {};
  }
  view(): GameView {
    return this.current;
  }
  elapsedMs(): number {
    return 0;
  }
  result(): GameResult | undefined {
    return undefined;
  }
  isStuck(): boolean {
    return this.stuck;
  }
  replayLog(): ReplayLog | undefined {
    return undefined;
  }
  dispose(): void {}
}

/** `hitTest(x, y)` answers `x` when it is a cell of the board, so a test points at cell `n` with `clientX: n`. */
class FakeRenderer implements BoardRenderer {
  cells = 9;
  readonly cursorCalls: (CellIndex | null)[] = [];
  mount(): void {}
  render(): void {}
  hitTest(clientX: number): CellIndex | null {
    return Number.isInteger(clientX) && clientX >= 0 && clientX < this.cells ? clientX : null;
  }
  setCursor(index: CellIndex | null): void {
    this.cursorCalls.push(index);
  }
  resize(): void {}
  unmount(): void {}
  get shown(): CellIndex | null | undefined {
    return this.cursorCalls[this.cursorCalls.length - 1];
  }
}

let element: HTMLElement;
let session = new FakeSession(makeView(1, 1));
let renderer = new FakeRenderer();
let controller = new InputController({ session, renderer });

function setup(
  view: GameView = makeView(3, 3),
  options: { chordOnNumberClick?: boolean; onCursorChange?: (index: CellIndex) => void } = {},
): void {
  controller.detach(); // a test may call setup() again; two controllers on one element would double every event
  session = new FakeSession(view);
  renderer = new FakeRenderer();
  renderer.cells = view.width * view.height;
  controller = new InputController({ session, renderer, ...options });
  controller.attach(element);
}

beforeEach(() => {
  element = document.createElement('div');
  document.body.append(element);
  setup();
});

afterEach(() => {
  controller.detach();
  element.remove();
});

const down = (button: number, x = 0, extra: MouseEventInit = {}): boolean =>
  fireEvent.mouseDown(element, { button, clientX: x, ...extra });
const up = (button: number, x = 0, extra: MouseEventInit = {}): boolean =>
  fireEvent.mouseUp(element, { button, clientX: x, ...extra });
function click(button: number, x: number): void {
  down(button, x);
  up(button, x);
}
const key = (k: string, init: KeyboardEventInit = {}): boolean =>
  fireEvent.keyDown(element, { key: k, ...init });

describe('mouse', () => {
  it('left click reveals the cell under the pointer', () => {
    click(0, 4);
    expect(session.actions).toEqual([{ type: 'reveal', index: 4 }]);
  });

  it('right click flags', () => {
    click(2, 5);
    expect(session.actions).toEqual([{ type: 'flag', index: 5 }]);
  });

  it('middle click chords', () => {
    click(1, 6);
    expect(session.actions).toEqual([{ type: 'chord', index: 6 }]);
  });

  it('left and right together chord once, not reveal and flag', () => {
    down(0, 4);
    down(2, 4);
    up(0, 4);
    up(2, 4);
    expect(session.actions).toEqual([{ type: 'chord', index: 4 }]);
  });

  it('chords whichever button is released first', () => {
    down(2, 4);
    down(0, 4);
    up(2, 4);
    up(0, 4);
    expect(session.actions).toEqual([{ type: 'chord', index: 4 }]);
  });

  it('treats two separate clicks as two actions', () => {
    click(0, 1);
    click(2, 2);
    expect(session.actions).toEqual([
      { type: 'reveal', index: 1 },
      { type: 'flag', index: 2 },
    ]);
  });

  it('acts where the button is released, as in the classic game', () => {
    down(0, 1);
    up(0, 7);
    expect(session.actions).toEqual([{ type: 'reveal', index: 7 }]);
  });

  it('does nothing when the pointer is over no cell (a gap or outside), never "cell 0"', () => {
    click(0, -1);
    click(2, 99);
    click(1, 2.5);
    expect(session.actions).toEqual([]);
  });

  it('forgets a half-finished gesture when the pointer leaves the board', () => {
    down(0, 3);
    fireEvent.mouseLeave(element);
    up(0, 3);
    expect(session.actions).toEqual([]);
    click(0, 3);
    expect(session.actions).toEqual([{ type: 'reveal', index: 3 }]);
  });

  it('ignores a release that has no press, and buttons it has no use for', () => {
    up(0, 3);
    click(3, 3);
    click(4, 3);
    expect(session.actions).toEqual([]);
  });

  it('ignores a press with Ctrl held (a right click on macOS), so it cannot reveal by mistake', () => {
    down(0, 3, { ctrlKey: true });
    up(0, 3, { ctrlKey: true });
    expect(session.actions).toEqual([]);
  });

  it('suppresses the context menu on the board', () => {
    expect(fireEvent.contextMenu(element)).toBe(false);
  });

  describe('clicking a revealed number', () => {
    const cells = [R(0), R(2), H, F, H, H, H, H, H];

    it('chords by default, as a shortcut', () => {
      setup(makeView(3, 3, 'playing', cells));
      click(0, 1);
      expect(session.actions).toEqual([{ type: 'chord', index: 1 }]);
    });

    it('still reveals on a hidden cell, a flagged cell and a revealed zero', () => {
      setup(makeView(3, 3, 'playing', cells));
      click(0, 0);
      click(0, 2);
      click(0, 3);
      expect(session.actions.map((a) => a.type)).toEqual(['reveal', 'reveal', 'reveal']);
    });

    it('reveals instead when the option is off', () => {
      setup(makeView(3, 3, 'playing', cells), { chordOnNumberClick: false });
      click(0, 1);
      expect(session.actions).toEqual([{ type: 'reveal', index: 1 }]);
    });

    it('does not turn a right click or a middle click into something else', () => {
      setup(makeView(3, 3, 'playing', cells));
      click(2, 1);
      click(1, 1);
      expect(session.actions.map((a) => a.type)).toEqual(['flag', 'chord']);
    });
  });
});

describe('a game that cannot change', () => {
  it.each(['won', 'lost'] as const)(
    'sends nothing with the mouse or the keyboard after a %s',
    (status) => {
      setup(makeView(3, 3, status));
      click(0, 1);
      click(2, 1);
      click(1, 1);
      key('ArrowRight');
      key(' ');
      key('f');
      key('Enter');
      expect(session.actions).toEqual([]);
    },
  );

  it('sends nothing when the game is stuck', () => {
    session.stuck = true;
    click(0, 1);
    key('ArrowRight');
    key(' ');
    expect(session.actions).toEqual([]);
  });

  it('sends actions again when a later view is playable (the same session, a changed view)', () => {
    session.current = makeView(3, 3, 'lost');
    click(0, 1);
    session.current = makeView(3, 3, 'playing');
    click(0, 1);
    expect(session.actions).toEqual([{ type: 'reveal', index: 1 }]);
  });
});

describe('keyboard cursor', () => {
  it('shows the cursor on the first key, in the middle, and does not act yet, even for Space', () => {
    key(' ');
    expect(session.actions).toEqual([]);
    expect(controller.cursor).toBe(4);
    expect(renderer.shown).toBe(4);
  });

  it('moves with the arrow keys, one cell at a time', () => {
    key('ArrowUp');
    expect(controller.cursor).toBe(4);
    key('ArrowRight');
    key('ArrowDown');
    expect(controller.cursor).toBe(8);
    key('ArrowLeft');
    key('ArrowUp');
    expect(controller.cursor).toBe(4);
    expect(renderer.shown).toBe(4);
  });

  it('clamps at every edge and never wraps to the next row', () => {
    key('ArrowUp');
    for (let i = 0; i < 5; i += 1) key('ArrowLeft');
    expect(controller.cursor).toBe(3);
    for (let i = 0; i < 5; i += 1) key('ArrowUp');
    expect(controller.cursor).toBe(0);
    for (let i = 0; i < 5; i += 1) key('ArrowRight');
    expect(controller.cursor).toBe(2);
    for (let i = 0; i < 5; i += 1) key('ArrowDown');
    expect(controller.cursor).toBe(8);
    for (let i = 0; i < 5; i += 1) key('ArrowRight');
    expect(controller.cursor).toBe(8);
  });

  it('works on a one-row board and a one-cell board', () => {
    setup(makeView(5, 1));
    key('ArrowUp');
    expect(controller.cursor).toBe(2);
    key('ArrowUp');
    key('ArrowDown');
    expect(controller.cursor).toBe(2);
    setup(makeView(1, 1));
    key('ArrowLeft');
    key('ArrowRight');
    expect(controller.cursor).toBe(0);
  });

  const placed = (): void => {
    key('ArrowUp'); // shows the cursor in the middle (cell 4)
    session.actions.length = 0;
  };

  it('Space reveals, F and f flag, Enter and C and c chord, all at the cursor', () => {
    placed();
    key(' ');
    key('f');
    key('F');
    key('Enter');
    key('c');
    key('C');
    expect(session.actions).toEqual([
      { type: 'reveal', index: 4 },
      { type: 'flag', index: 4 },
      { type: 'flag', index: 4 },
      { type: 'chord', index: 4 },
      { type: 'chord', index: 4 },
      { type: 'chord', index: 4 },
    ]);
  });

  it('acts on the cell it moved to', () => {
    placed();
    key('ArrowRight');
    key('ArrowDown');
    key(' ');
    expect(session.actions).toEqual([{ type: 'reveal', index: 8 }]);
  });

  it('does not repeat an action while a key is held, but keeps moving', () => {
    placed();
    key(' ', { repeat: true });
    key('f', { repeat: true });
    expect(session.actions).toEqual([]);
    key('ArrowLeft', { repeat: true });
    key('ArrowLeft', { repeat: true });
    expect(controller.cursor).toBe(3);
  });

  it('leaves shortcuts with Ctrl, Meta or Alt to the browser', () => {
    placed();
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      expect(key('f', init)).toBe(true);
      expect(key('ArrowLeft', init)).toBe(true);
    }
    expect(session.actions).toEqual([]);
    expect(controller.cursor).toBe(4);
  });

  it('stops the page from scrolling on the keys it uses, and lets every other key through', () => {
    for (const k of ['ArrowUp', 'ArrowDown', ' ', 'f', 'Enter', 'c']) {
      expect(key(k)).toBe(false);
    }
    for (const k of ['Tab', 'Escape', 'r', 'R', 'x', 'Shift']) {
      expect(key(k)).toBe(true);
    }
  });

  it('keeps Shift+R and R free for the restart keys of a later task', () => {
    placed();
    key('r');
    key('R', { shiftKey: true });
    expect(session.actions).toEqual([]);
    expect(controller.cursor).toBe(4);
  });

  it('hides the ring when the board loses focus and shows it again, in place, on the next key', () => {
    placed();
    key('ArrowRight');
    fireEvent.blur(element);
    expect(renderer.shown).toBeNull();
    expect(controller.cursor).toBe(5);
    key(' ');
    expect(session.actions).toEqual([]);
    expect(renderer.shown).toBe(5);
    key(' ');
    expect(session.actions).toEqual([{ type: 'reveal', index: 5 }]);
  });

  it('after a mouse click hides the ring but remembers the cell, so the next key shows it there', () => {
    placed();
    click(0, 7);
    expect(renderer.shown).toBeNull();
    expect(controller.cursor).toBe(7);
    session.actions.length = 0;
    key(' ');
    expect(session.actions).toEqual([]);
    expect(renderer.shown).toBe(7);
    key('ArrowUp');
    expect(controller.cursor).toBe(4);
  });

  it('puts a cursor that no longer fits the board back inside it', () => {
    setup(makeView(9, 9));
    key('ArrowUp');
    key('ArrowDown');
    key('ArrowDown');
    key('ArrowDown');
    expect(controller.cursor).toBe(67);
    session.current = makeView(3, 3);
    renderer.cells = 9;
    key('ArrowLeft');
    expect(controller.cursor).toBeGreaterThanOrEqual(0);
    expect(controller.cursor).toBeLessThan(9);
    expect(renderer.shown).toBe(controller.cursor);
  });
});

describe('attach and detach', () => {
  it('makes an element focusable that is not, and leaves its own tabindex alone', () => {
    expect(element.getAttribute('tabindex')).toBe('0');
    controller.detach();
    expect(element.hasAttribute('tabindex')).toBe(false);
    element.setAttribute('tabindex', '-1');
    controller.attach(element);
    expect(element.getAttribute('tabindex')).toBe('-1');
    controller.detach();
    expect(element.getAttribute('tabindex')).toBe('-1');
  });

  it('stops listening on detach, lets the context menu through, and removes the ring', () => {
    key('ArrowUp');
    controller.detach();
    expect(renderer.shown).toBeNull();
    session.actions.length = 0;
    click(0, 1);
    key(' ');
    expect(session.actions).toEqual([]);
    expect(fireEvent.contextMenu(element)).toBe(true);
  });

  it('moves to another element on a second attach, and the old one stops working', () => {
    const other = document.createElement('div');
    document.body.append(other);
    controller.attach(other);
    expect(element.hasAttribute('tabindex')).toBe(false);
    click(0, 1);
    expect(session.actions).toEqual([]);
    fireEvent.mouseDown(other, { button: 0, clientX: 1 });
    fireEvent.mouseUp(other, { button: 0, clientX: 1 });
    expect(session.actions).toEqual([{ type: 'reveal', index: 1 }]);
    controller.detach();
    other.remove();
  });

  it('is safe to detach twice and to detach before attach', () => {
    controller.detach();
    controller.detach();
    const fresh = new InputController({ session, renderer });
    expect(() => fresh.detach()).not.toThrow();
  });
});

describe('keyboard focus and cursor reports (M3-T08)', () => {
  /** Makes the element answer `:focus-visible` the way a browser does after a keyboard focus (or not). */
  const focusVisible = (visible: boolean): void => {
    vi.spyOn(element, 'matches').mockImplementation(
      (selector: string) => selector === ':focus-visible' && visible,
    );
  };

  it('shows the ring in the middle when the element gets the focus from the keyboard', () => {
    focusVisible(true);
    fireEvent.focus(element);
    expect(renderer.shown).toBe(4);
    expect(controller.cursor).toBe(4);
  });

  it('shows no ring when the focus comes from the mouse', () => {
    focusVisible(false);
    fireEvent.focus(element);
    expect(renderer.cursorCalls).toEqual([]);
    expect(controller.cursor).toBeNull();
  });

  it('lets a key act on the cell that a keyboard focus has marked', () => {
    focusVisible(true);
    fireEvent.focus(element);
    key(' ');
    expect(session.actions).toEqual([{ type: 'reveal', index: 4 }]);
  });

  it('still only shows the ring on the first key when the focus came from the mouse', () => {
    focusVisible(false);
    fireEvent.focus(element);
    key(' ');
    expect(session.actions).toEqual([]);
    expect(renderer.shown).toBe(4);
  });

  it('puts the ring back on the remembered cell after a blur and a keyboard focus', () => {
    focusVisible(true);
    fireEvent.focus(element);
    key('ArrowRight');
    key('ArrowDown');
    expect(controller.cursor).toBe(8);
    fireEvent.blur(element);
    expect(renderer.shown).toBeNull();
    fireEvent.focus(element);
    expect(renderer.shown).toBe(8);
  });

  it('shows no ring, and does not throw, when the browser cannot answer :focus-visible', () => {
    vi.spyOn(element, 'matches').mockImplementation(() => {
      throw new SyntaxError('unsupported selector');
    });
    expect(() => fireEvent.focus(element)).not.toThrow();
    expect(renderer.cursorCalls).toEqual([]);
  });

  it('shows no ring on focus once the controller is detached', () => {
    focusVisible(true);
    controller.detach();
    fireEvent.focus(element);
    expect(renderer.cursorCalls).toEqual([]);
  });

  describe('onCursorChange', () => {
    const reports: CellIndex[] = [];
    beforeEach(() => {
      reports.length = 0;
      setup(makeView(3, 3), { onCursorChange: (index) => reports.push(index) });
    });

    it('reports the cell the ring is first shown on, then every move', () => {
      key('ArrowRight'); // first key: shows the ring at the middle, no move
      key('ArrowRight');
      key('ArrowDown');
      expect(reports).toEqual([4, 5, 8]);
    });

    it('reports the cell when a keyboard focus shows the ring', () => {
      vi.spyOn(element, 'matches').mockImplementation((s: string) => s === ':focus-visible');
      fireEvent.focus(element);
      expect(reports).toEqual([4]);
    });

    it('reports the same cell again when the edge of the board stops a move, so the key is not silent', () => {
      key('ArrowRight');
      key('ArrowRight');
      key('ArrowRight');
      expect(reports).toEqual([4, 5, 5]);
    });

    it('does not report mouse actions, or the actions of the keyboard', () => {
      click(0, 2);
      click(2, 3);
      expect(reports).toEqual([]);
      key('ArrowRight'); // shows the ring on the remembered cell 3
      key('f');
      key(' ');
      expect(reports).toEqual([3]);
    });
  });
});
