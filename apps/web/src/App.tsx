import type { BoardConfig } from '@minesweeper/engine';
import { useEffect, useState, type JSX } from 'react';
import { MenuScreen } from './screens/MenuScreen.js';
import { PlayScreen } from './screens/PlayScreen.js';
import { presetInfo } from './screens/presets.js';
import { ResultScreen } from './screens/ResultScreen.js';
import type { GameSession } from './session/GameSession.js';
import { AppStoreContext, createAppStore, useAppStore, type AppStore } from './state/appStore.js';
import { applyTheme, nextTheme, type ThemePreference } from './theme.js';

/** Props of `App`. Both are for tests; the app itself passes nothing. */
export interface AppProps {
  /** The store of the client. Defaults to a new one, on the menu. */
  readonly store?: AppStore;
  /** Makes the session of a game. Defaults to a `LocalSession` on the system clock. */
  readonly createSession?: (config: BoardConfig, seed: number) => GameSession;
}

/** Shows the screen that the store says is current. */
function Screens({ createSession }: Pick<AppProps, 'createSession'>): JSX.Element {
  const screen = useAppStore((s) => s.screen);
  const presetId = useAppStore((s) => s.presetId);
  const seed = useAppStore((s) => s.seed);
  const gameId = useAppStore((s) => s.gameId);
  const finished = useAppStore((s) => s.finished);
  const startGame = useAppStore((s) => s.startGame);
  const newGame = useAppStore((s) => s.newGame);
  const finishGame = useAppStore((s) => s.finishGame);
  const toMenu = useAppStore((s) => s.toMenu);

  if (screen === 'playing' && presetId !== null && seed !== null) {
    const preset = presetInfo(presetId);
    return (
      <PlayScreen
        // A new game is a new screen, even when the seed repeats.
        key={gameId}
        presetName={preset.name}
        config={preset.config}
        seed={seed}
        onFinish={(view, result) => {
          finishGame({ presetId, seed, view, result });
        }}
        onNewGame={newGame}
        onMenu={toMenu}
        {...(createSession === undefined ? {} : { createSession })}
      />
    );
  }
  if (screen === 'result' && finished !== null) {
    return <ResultScreen finished={finished} onNewGame={newGame} onMenu={toMenu} />;
  }
  return <MenuScreen onStart={startGame} />;
}

/**
 * The app: a header with the game name and the theme button, and the screen of the current state of the
 * client (menu, play, result).
 *
 * @param props - Optional store and session factory, for tests.
 * @returns The page.
 * @example
 * ```tsx
 * createRoot(element).render(<App />);
 * ```
 */
export function App({ store, createSession }: AppProps = {}): JSX.Element {
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [appStore] = useState(() => store ?? createAppStore());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <AppStoreContext.Provider value={appStore}>
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
        <main className="mx-auto w-full max-w-6xl px-5 py-6">
          <Screens {...(createSession === undefined ? {} : { createSession })} />
        </main>
      </div>
    </AppStoreContext.Provider>
  );
}
