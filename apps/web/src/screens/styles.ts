// M3-T05. Class lists the three screens share. Written out in full so Tailwind finds each class, and built
// from the design tokens only: no literal color.

/** The main action of a screen. Surface-colored text on the accent has the contrast `tokens.test.ts` checks. */
export const PRIMARY_BUTTON =
  'rounded-md bg-accent px-4 py-2 text-base font-semibold text-surface hover:opacity-90';

/** A secondary action. */
export const SECONDARY_BUTTON =
  'rounded-md border border-cell-hidden px-4 py-2 text-base text-ink hover:bg-raised';

/** A heading that receives the focus when its screen appears; the focus needs no outline of its own. */
export const SCREEN_HEADING = 'text-xl font-bold tracking-tight focus:outline-none';
