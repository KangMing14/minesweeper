import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachRestartKeys } from './restartKeys.js';

// M3-T06. R starts another board of the same difficulty and Shift+R retries the same board. The handler sits
// on the window because the input controller leaves R alone (M3-T04), and it must never take a key that the
// browser or a text field needs.

const detachers: (() => void)[] = [];
function setup(): { newBoard: ReturnType<typeof vi.fn>; retry: ReturnType<typeof vi.fn> } {
  const newBoard = vi.fn();
  const retry = vi.fn();
  detachers.push(attachRestartKeys(window, { onNewBoard: newBoard, onRetry: retry }));
  return { newBoard, retry };
}

/** Sends a key to `target` the way the browser does, and says whether a handler called preventDefault. */
function press(init: KeyboardEventInit, target: EventTarget = window): boolean {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

afterEach(() => {
  while (detachers.length > 0) detachers.pop()?.();
  document.body.innerHTML = '';
});

describe('attachRestartKeys', () => {
  it('R asks for a new board', () => {
    const { newBoard, retry } = setup();
    press({ key: 'r' });
    expect(newBoard).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  it('Shift+R asks for a retry of the same board', () => {
    const { newBoard, retry } = setup();
    press({ key: 'R', shiftKey: true });
    expect(retry).toHaveBeenCalledTimes(1);
    expect(newBoard).not.toHaveBeenCalled();
  });

  it('a capital R without Shift (Caps Lock) is a plain R', () => {
    const { newBoard, retry } = setup();
    press({ key: 'R' });
    expect(newBoard).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
  });

  it('prevents the default of the keys it handles', () => {
    setup();
    expect(press({ key: 'r' })).toBe(true);
    expect(press({ key: 'R', shiftKey: true })).toBe(true);
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Meta', { metaKey: true }],
    ['Alt', { altKey: true }],
    ['Ctrl+Shift', { ctrlKey: true, shiftKey: true }],
  ])(
    'leaves %s+R to the browser (reload and friends): no call, no preventDefault',
    (_name, mods) => {
      const { newBoard, retry } = setup();
      expect(press({ key: 'r', ...mods })).toBe(false);
      expect(newBoard).not.toHaveBeenCalled();
      expect(retry).not.toHaveBeenCalled();
    },
  );

  it('ignores a held key: only the first keydown counts', () => {
    const { newBoard, retry } = setup();
    press({ key: 'r' });
    for (let i = 0; i < 5; i += 1) press({ key: 'r', repeat: true });
    press({ key: 'R', shiftKey: true });
    for (let i = 0; i < 5; i += 1) press({ key: 'R', shiftKey: true, repeat: true });
    expect(newBoard).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('ignores a key that is part of an IME composition', () => {
    const { newBoard } = setup();
    press({ key: 'r', isComposing: true });
    expect(newBoard).not.toHaveBeenCalled();
  });

  it('ignores other keys, and does not prevent them', () => {
    const { newBoard, retry } = setup();
    for (const key of ['f', ' ', 'Enter', 'ArrowLeft', 'Escape', 'c', 'Shift', 'Control']) {
      expect(press({ key })).toBe(false);
    }
    expect(newBoard).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  });

  it.each(['input', 'textarea', 'select'])('ignores a key typed into a %s', (tag) => {
    const { newBoard, retry } = setup();
    const field = document.body.appendChild(document.createElement(tag));
    expect(press({ key: 'r' }, field)).toBe(false);
    expect(press({ key: 'R', shiftKey: true }, field)).toBe(false);
    expect(newBoard).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  });

  it('ignores a key typed into editable content, also from a child of it', () => {
    const { newBoard } = setup();
    const editor = document.body.appendChild(document.createElement('div'));
    editor.setAttribute('contenteditable', 'true');
    const child = editor.appendChild(document.createElement('span'));
    press({ key: 'r' }, child);
    expect(newBoard).not.toHaveBeenCalled();
  });

  it('still works from a div that says contenteditable="false", and from a button', () => {
    const { newBoard } = setup();
    const box = document.body.appendChild(document.createElement('div'));
    box.setAttribute('contenteditable', 'false');
    press({ key: 'r' }, box);
    const button = document.body.appendChild(document.createElement('button'));
    press({ key: 'r' }, button);
    expect(newBoard).toHaveBeenCalledTimes(2);
  });

  it('leaves a key that someone else already handled', () => {
    const { newBoard } = setup();
    const other = (event: Event): void => {
      event.preventDefault();
    };
    document.body.addEventListener('keydown', other);
    const child = document.body.appendChild(document.createElement('div'));
    press({ key: 'r' }, child);
    document.body.removeEventListener('keydown', other);
    expect(newBoard).not.toHaveBeenCalled();
  });

  it('stops listening when detached, and detaching twice is safe', () => {
    const newBoard = vi.fn();
    const detach = attachRestartKeys(window, { onNewBoard: newBoard, onRetry: vi.fn() });
    detach();
    expect(() => {
      detach();
    }).not.toThrow();
    press({ key: 'r' });
    expect(newBoard).not.toHaveBeenCalled();
  });

  it('adds exactly one listener and removes exactly that one', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const detach = attachRestartKeys(window, { onNewBoard: vi.fn(), onRetry: vi.fn() });
    expect(add).toHaveBeenCalledTimes(1);
    detach();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls[0]?.[1]).toBe(add.mock.calls[0]?.[1]);
    vi.restoreAllMocks();
  });
});
