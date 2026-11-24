import { useEffect, useState, type JSX } from 'react';
import { applyTheme, nextTheme, type ThemePreference } from './theme.js';

// Written out in full so Tailwind finds each class when it scans the source.
const NUMBER_CELLS = [
  { value: 1, color: 'text-num-1' },
  { value: 2, color: 'text-num-2' },
  { value: 3, color: 'text-num-3' },
  { value: 4, color: 'text-num-4' },
  { value: 5, color: 'text-num-5' },
  { value: 6, color: 'text-num-6' },
  { value: 7, color: 'text-num-7' },
  { value: 8, color: 'text-num-8' },
] as const;

/**
 * The app shell: a header with the game name and the theme button, and the main region. Until the play
 * screens arrive (M3-T05) the main region shows the eight cell numbers in the colors of the active theme.
 *
 * @returns The page.
 * @example
 * ```tsx
 * createRoot(element).render(<App />);
 * ```
 */
export function App(): JSX.Element {
  const [theme, setTheme] = useState<ThemePreference>('system');

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="flex items-center justify-between gap-4 border-b border-cell-hidden bg-raised px-5 py-3">
        <h1 className="text-xl font-bold tracking-tight">Minesweeper</h1>
        <button
          type="button"
          className="rounded-md border border-cell-hidden px-3 py-1 text-sm text-ink-muted hover:text-ink"
          onClick={() => {
            setTheme(nextTheme(theme));
          }}
        >
          Theme: {theme}
        </button>
      </header>
      <main className="mx-auto max-w-xl px-5 py-6">
        <h2 className="text-lg font-semibold">Numbers on the board</h2>
        <p className="mt-2 max-w-prose text-ink-muted">
          Each number has its own color, in the light and the dark theme. The play screen is coming
          soon.
        </p>
        <ul aria-label="Cell number colors" className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {NUMBER_CELLS.map(({ value, color }) => (
            <li
              key={value}
              className={`flex aspect-square items-center justify-center rounded-sm border border-cell-hidden bg-cell-revealed text-xl font-bold tabular-nums ${color}`}
            >
              {value}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
