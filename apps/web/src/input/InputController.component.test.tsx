import { SeededBoardGenerator } from '@minesweeper/engine';
import type { BoardConfig, Clock, GameView } from '@minesweeper/engine';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeContext2D } from '../../test/fakeCanvas.js';
import { BoardCanvas } from '../render/BoardCanvas.js';
import type { BoardRenderer } from '../render/BoardRenderer.js';
import { LocalSession } from '../session/LocalSession.js';
import { InputController } from './InputController.js';

// M3-T04 acceptance: keyboard-only completion of a seeded game, through the real pieces: LocalSession (with a
// fake clock), BoardCanvas with the real CanvasBoardRenderer on a fake 2D context, and InputController attached
// to the canvas. Nothing here calls `dispatch` directly: every action comes from a key press.

const CONFIG: BoardConfig = { width: 6, height: 6, mineCount: 6 };
const SEED = 11;

class FakeClock implements Clock {
  now = 1000;
  nowMs(): number {
    return this.now;
  }
}

/** Which cells are safe and which are mines, from the same generator the session uses. */
function facts(): { safe: number[]; mines: number[] } {
  const { board } = new SeededBoardGenerator().generate(CONFIG, SEED);
  const safe: number[] = [];
  const mines: number[] = [];
  for (let i = 0; i < CONFIG.width * CONFIG.height; i += 1)
    (board.isMine(i) ? mines : safe).push(i);
  return { safe, mines };
}

let ctx: FakeContext2D;
let session: LocalSession;
let controller: InputController;
let canvas: HTMLElement;

/** Shows the session's view and keeps it current, the way the play screen (M3-T05) will. */
function Board(props: { onRenderer: (renderer: BoardRenderer | null) => void }): React.JSX.Element {
  const [view, setView] = useState<GameView>(() => session.view());
  useEffect(() => session.subscribe(() => setView(session.view())), []);
  return <BoardCanvas view={view} onRenderer={props.onRenderer} />;
}

beforeEach(() => {
  ctx = new FakeContext2D();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  session = new LocalSession(CONFIG, SEED, new FakeClock());
  session.start();
  let renderer: BoardRenderer | null = null;
  render(<Board onRenderer={(r) => (renderer = r)} />);
  if (renderer === null) throw new Error('the board did not give out its renderer');
  controller = new InputController({ session, renderer });
  canvas = screen.getByRole('img');
  controller.attach(canvas);
});

afterEach(() => {
  controller.detach();
  cleanup();
  vi.restoreAllMocks();
});

const press = (key: string): void => {
  fireEvent.keyDown(canvas, { key });
};

/** Walks the cursor to a cell with the arrow keys alone. */
function moveTo(target: number): void {
  const at = controller.cursor ?? -1;
  if (at < 0) press('ArrowUp'); // the first key only shows the cursor
  for (let guard = 0; guard < 200 && controller.cursor !== target; guard += 1) {
    const here = controller.cursor ?? 0;
    const [hx, hy] = [here % CONFIG.width, Math.floor(here / CONFIG.width)];
    const [tx, ty] = [target % CONFIG.width, Math.floor(target / CONFIG.width)];
    press(hx < tx ? 'ArrowRight' : hx > tx ? 'ArrowLeft' : hy < ty ? 'ArrowDown' : 'ArrowUp');
  }
  expect(controller.cursor).toBe(target);
}

describe('playing with the keyboard alone', () => {
  it('wins a seeded game by moving with the arrows and revealing with Space', () => {
    const { safe } = facts();
    for (const target of safe) {
      if (session.view().cells[target]?.state === 'revealed') continue;
      moveTo(target);
      press(' ');
    }
    expect(session.view().status).toBe('won');
    expect(session.result()?.outcome).toBe('won');
  });

  it('draws the cursor ring on the board while the keys are used, and removes it on blur', () => {
    press('ArrowUp');
    const ring = (): number =>
      ctx.ops.filter((op) => op.name === 'fillRect' && op.fillStyle === 'blue').length;
    expect(ring()).toBeGreaterThanOrEqual(4);
    ctx.reset();
    fireEvent.blur(canvas);
    expect(ring()).toBe(0);
    expect(ctx.all('fillRect')).toHaveLength(1);
  });

  it('flags with F, and the flag shows in the view', () => {
    const { mines } = facts();
    const target = mines[0] as number;
    moveTo(target);
    press('f');
    expect(session.view().cells[target]?.state).toBe('flagged');
    press('f');
    expect(session.view().cells[target]?.state).toBe('hidden');
  });

  it('loses on a mine, and then no key does anything', () => {
    const { mines } = facts();
    moveTo(mines[0] as number);
    press(' ');
    expect(session.view().status).toBe('lost');
    const before = session.view();
    press('ArrowLeft');
    press(' ');
    press('f');
    press('Enter');
    expect(session.view().cells).toEqual(before.cells);
    expect(session.view().status).toBe('lost');
  });

  it('does not act on the first key, so a stray Space cannot end a run', () => {
    const before = session.view().revealedCount;
    press(' ');
    expect(session.view().revealedCount).toBe(before);
    expect(session.view().status).toBe('ready');
  });
});
