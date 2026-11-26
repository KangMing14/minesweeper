// M3-T05. The screen flow of the client as data: which screen follows which event. An enum plus a table is
// enough on the client (ARCHITECTURE.md, "Design patterns": State is for the match lifecycle on the server).

/** The three screens of the solo client. */
export const SCREENS = ['menu', 'playing', 'result'] as const;

/** A screen of the client. */
export type Screen = (typeof SCREENS)[number];

/** Everything that can move the client from one screen to another. */
export const SCREEN_EVENTS = ['start', 'finish', 'newGame', 'toMenu'] as const;

/** Something that moves the client from one screen to another. */
export type ScreenEvent = (typeof SCREEN_EVENTS)[number];

/**
 * The transition table. A pair that is not listed is not allowed. `Object.hasOwn` guards the lookups below, so
 * a name such as `constructor` from untyped input is never read from the prototype.
 */
const TABLE: Readonly<Record<Screen, Readonly<Partial<Record<ScreenEvent, Screen>>>>> = {
  menu: { start: 'playing' },
  playing: { finish: 'result', newGame: 'playing', toMenu: 'menu' },
  result: { newGame: 'playing', toMenu: 'menu' },
};

/**
 * Gives the screen that follows `event` on `from`, or `undefined` when the table does not allow it.
 *
 * @param from - The screen that is showing.
 * @param event - What happened.
 * @returns The next screen, or `undefined` for a transition that is refused.
 * @example
 * ```ts
 * nextScreen('menu', 'start'); // 'playing'
 * nextScreen('menu', 'finish'); // undefined
 * ```
 */
export function nextScreen(from: Screen, event: ScreenEvent): Screen | undefined {
  if (!Object.hasOwn(TABLE, from)) return undefined;
  const row = TABLE[from];
  return Object.hasOwn(row, event) ? row[event] : undefined;
}
