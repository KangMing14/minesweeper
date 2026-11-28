// M3-T06. The restart hotkeys: R and Shift+R. They are handled on the window and not by the `InputController`,
// which leaves R alone on purpose (M3-T04), so one handler serves the play screen and the result screen
// whatever has the focus.

/** What the restart keys ask for. */
export interface RestartKeysHandlers {
  /** R: another board of the same difficulty, with a new seed. */
  readonly onNewBoard: () => void;
  /** Shift+R: the same board again, with the same seed. */
  readonly onRetry: () => void;
}

/** Elements that take typed text, where R is a letter and not a command. */
const TEXT_TARGETS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

function typesText(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TEXT_TARGETS) !== null;
}

/**
 * Listens for R and Shift+R on `target` (the game region in the app, M3-T08) and calls the matching handler.
 *
 * @remarks
 * A key is left alone, with no call and no `preventDefault`, when Ctrl, Meta or Alt is held (Ctrl+R and
 * Cmd+R reload the page), when it is a held key repeating (one press is one restart, so holding the key does
 * not burn through boards), when it belongs to an input method composition, when it was typed into a text
 * field, or when something else already handled it. Shift is read from `shiftKey`, so a capital R from Caps
 * Lock counts as a plain R. The keys are matched by the character they produce, so they work on any
 * keyboard layout that has an R.
 *
 * The caller decides where and when to attach. The app attaches to the element that wraps the play and
 * result screens, and only while they are shown: a key that is only a printable character must be active
 * only while a component of the page has the focus (WCAG 2.1.4, level A), so there is no window listener.
 *
 * @param target - Where to listen: an element, so that only keys typed while the focus is inside it count.
 * @param handlers - What each key asks for.
 * @returns A function that stops listening. It is safe to call more than once.
 * @example
 * ```ts
 * const detach = attachRestartKeys(region, { onNewBoard: newGame, onRetry: retryGame });
 * // later
 * detach();
 * ```
 */
export function attachRestartKeys(target: EventTarget, handlers: RestartKeysHandlers): () => void {
  const listener = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key.toLowerCase() !== 'r') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.repeat || event.isComposing || event.defaultPrevented) return;
    if (typesText(event.target)) return;
    event.preventDefault();
    if (event.shiftKey) handlers.onRetry();
    else handlers.onNewBoard();
  };
  target.addEventListener('keydown', listener);
  let attached = true;
  return () => {
    if (!attached) return;
    attached = false;
    target.removeEventListener('keydown', listener);
  };
}
