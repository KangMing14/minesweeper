import type { JSX } from 'react';

/** One key, drawn as a key cap from the tokens. */
function Key({ children }: { readonly children: string }): JSX.Element {
  return (
    <kbd className="rounded-sm border border-cell-hidden bg-raised px-1.5 py-0.5 font-sans text-sm text-ink">
      {children}
    </kbd>
  );
}

/**
 * A line that says which keys restart the game (M3-T06). The keys are handled by the app, not by this
 * component; it only names them. Read as one sentence by a screen reader.
 *
 * @returns The hint.
 * @example
 * ```tsx
 * <RestartHint />
 * ```
 */
export function RestartHint(): JSX.Element {
  return (
    <p className="text-sm text-ink-muted">
      Press <Key>R</Key> for a new board, or <Key>Shift</Key>+<Key>R</Key> to retry this one.
    </p>
  );
}
