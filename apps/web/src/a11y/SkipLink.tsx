import type { JSX, MouseEvent } from 'react';
import { useAppStore } from '../state/appStore.js';
import { PLAY_BOARD_ID } from './ids.js';

// M3-T08. A link that is hidden until it has the focus and that moves the focus to the board. It is the
// first focusable thing in the page, and it exists only while there is a board to skip to (the play screen).

/**
 * The "Skip to board" link.
 *
 * @returns The link while a game is being played, and nothing on the menu and the result screen.
 * @example
 * <SkipLink />
 */
export function SkipLink(): JSX.Element | null {
  const screen = useAppStore((state) => state.screen);
  if (screen !== 'playing') return null;
  // Moving the focus by script, not by the fragment: the board is the canvas that the input controller is
  // attached to, and the address of the page must not change.
  const skip = (event: MouseEvent<HTMLAnchorElement>): void => {
    event.preventDefault();
    document.getElementById(PLAY_BOARD_ID)?.focus();
  };
  return (
    <a
      href={`#${PLAY_BOARD_ID}`}
      onClick={skip}
      className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-10 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-surface"
    >
      Skip to board
    </a>
  );
}
