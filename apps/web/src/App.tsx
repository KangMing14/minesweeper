import type { BoardConfig } from '@minesweeper/engine';
import { useEffect, useState, type JSX, type ReactNode } from 'react';
import { AnnouncerProvider } from './a11y/Announcer.js';
import { SkipLink } from './a11y/SkipLink.js';
import { attachRestartKeys } from './input/restartKeys.js';
import { MenuScreen } from './screens/MenuScreen.js';
import { PlayScreen } from './screens/PlayScreen.js';
import { presetInfo } from './screens/presets.js';
import { ResultScreen } from './screens/ResultScreen.js';
import type { GameSession } from './session/GameSession.js';
import { AppStoreContext, createAppStore, useAppStore, type AppStore } from './state/appStore.js';
import { createStatsStore } from './stats/createStatsStore.js';
import type { StatsStore } from './stats/StatsStore.js';
import { applyTheme, nextTheme, type ThemePreference } from './theme.js';

/** Props of `App`. All are for tests; the app itself passes nothing. */
export interface AppProps {
  /** The store of the client. Defaults to a new one, on the menu. */
  readonly store?: AppStore;
  /** Makes the session of a game. Defaults to a `LocalSession` on the system clock. */
  readonly createSession?: (config: BoardConfig, seed: number) => GameSession;
  /** Where finished games are recorded (M3-T07). Defaults to the browser's `localStorage`, or memory. */
  readonly statsStore?: StatsStore;
}

/**
 * The element that wraps the play and result screens, and the only place where R and Shift+R are heard.
 *
 * WCAG 2.1.4 (Character Key Shortcuts, level A) asks that a shortcut made of one printable character can be
 * turned off, remapped, or is active only while a component of the page has the focus. This is the third:
 * the listener is on this region, not on the window, so a key typed with the focus anywhere else (the theme
 * button, the address bar, a screen reader's browse mode) never restarts a game. The board takes the focus
 * when a game starts and the result heading takes it on the result screen, so in normal play the keys work as
 * before. The store still refuses a restart that the screen table does not allow (developer decision of
 * 2026-11-27, M3-T08; it replaces the window listener approved in M3-T06).
 */
function GameRegion({
  onNewBoard,
  onRetry,
  children,
}: {
  readonly onNewBoard: () => void;
  readonly onRetry: () => void;
  readonly children: ReactNode;
}): JSX.Element {
  // A state and not a ref: the effect must run when the element exists, and again if it is replaced.
  const [region, setRegion] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (region === null) return undefined;
    return attachRestartKeys(region, { onNewBoard, onRetry });
  }, [region, onNewBoard, onRetry]);
  return (
    <section ref={setRegion} aria-label="Game">
      {children}
    </section>
  );
}

/** Shows the screen that the store says is current. */
function Screens({
  createSession,
  statsStore,
}: Pick<AppProps, 'createSession'> & { readonly statsStore: StatsStore }): JSX.Element {
  const screen = useAppStore((s) => s.screen);
  const presetId = useAppStore((s) => s.presetId);
  const seed = useAppStore((s) => s.seed);
  const gameId = useAppStore((s) => s.gameId);
  const finished = useAppStore((s) => s.finished);
  const isRetry = useAppStore((s) => s.isRetry);
  const startGame = useAppStore((s) => s.startGame);
  const newGame = useAppStore((s) => s.newGame);
  const finishGame = useAppStore((s) => s.finishGame);
  const retryGame = useAppStore((s) => s.retryGame);
  const toMenu = useAppStore((s) => s.toMenu);

  if (screen === 'playing' && presetId !== null && seed !== null) {
    const preset = presetInfo(presetId);
    return (
      <GameRegion onNewBoard={newGame} onRetry={retryGame}>
        <PlayScreen
          // A new game is a new screen, even when the seed repeats.
          key={gameId}
          presetName={preset.name}
          config={preset.config}
          seed={seed}
          onFinish={(view, result, replayLog) => {
            // Record only when the store took the game: a second report of the same game (StrictMode runs
            // the play screen's effect twice) is refused by the screen table and must not count twice.
            // A retry of the same board is not a new attempt for the statistics (M3-T07, developer decision).
            if (finishGame({ presetId, seed, view, result }, replayLog) && !isRetry) {
              statsStore.record(presetId, result);
            }
          }}
          onNewGame={newGame}
          onMenu={toMenu}
          {...(createSession === undefined ? {} : { createSession })}
        />
      </GameRegion>
    );
  }
  if (screen === 'result' && finished !== null) {
    return (
      <GameRegion onNewBoard={newGame} onRetry={retryGame}>
        <ResultScreen finished={finished} onNewGame={newGame} onRetry={retryGame} onMenu={toMenu} />
      </GameRegion>
    );
  }
  return <MenuScreen onStart={startGame} stats={(id) => statsStore.summary(id)} />;
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
export function App({ store, createSession, statsStore }: AppProps = {}): JSX.Element {
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [appStore] = useState(() => store ?? createAppStore());
  const [stats] = useState(() => statsStore ?? createStatsStore());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <AppStoreContext.Provider value={appStore}>
      <AnnouncerProvider>
        <div className="relative min-h-screen bg-surface text-ink">
          <SkipLink />
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
            <Screens
              statsStore={stats}
              {...(createSession === undefined ? {} : { createSession })}
            />
          </main>
        </div>
      </AnnouncerProvider>
    </AppStoreContext.Provider>
  );
}
