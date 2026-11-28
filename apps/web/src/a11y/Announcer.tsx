import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

// M3-T08. One polite live region for the whole app, outside the screens, so a message survives the screen
// that sent it (the play screen is gone the moment a game ends). A screen reader only reports changes to a
// region that is already in the page, so the region is rendered from the first paint, empty.

/** Sends a message to the live region. The default does nothing, so a component can be tested alone. */
export const AnnouncerContext = createContext<(text: string) => void>(() => {});

/**
 * The function that speaks a message through the app's live region.
 *
 * @returns `announce(text)`. A no-op outside an `AnnouncerProvider`.
 * @example
 * const announce = useAnnounce();
 * announce('Flag placed at row 1, column 1.');
 */
export function useAnnounce(): (text: string) => void {
  return useContext(AnnouncerContext);
}

interface Message {
  readonly id: number;
  readonly text: string;
}

/**
 * Renders its children and the live region, and lets any child speak through `useAnnounce`.
 *
 * A message is a keyed child of the region: the same text twice is a new element, and a new element is
 * what makes a screen reader say it again.
 *
 * @param props - The children.
 * @returns The provider and the hidden region.
 * @example
 * <AnnouncerProvider><App /></AnnouncerProvider>
 */
export function AnnouncerProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [message, setMessage] = useState<Message>({ id: 0, text: '' });
  const announce = useCallback((text: string): void => {
    setMessage((previous) => ({ id: previous.id + 1, text }));
  }, []);
  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message.text === '' ? null : <span key={message.id}>{message.text}</span>}
      </div>
    </AnnouncerContext.Provider>
  );
}
