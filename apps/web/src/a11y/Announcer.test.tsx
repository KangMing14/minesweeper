import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnnouncerProvider, useAnnounce } from './Announcer.js';

// M3-T08. One polite live region for the whole app. It must exist before the first message (a screen
// reader only reports changes to a region that is already there) and must speak the same text twice.

let announce: (text: string) => void = () => {};
function Probe(): null {
  announce = useAnnounce();
  return null;
}
const region = (): HTMLElement => screen.getByRole('status');

describe('AnnouncerProvider', () => {
  it('renders a polite, atomic, visually hidden status region that starts empty', () => {
    render(
      <AnnouncerProvider>
        <Probe />
      </AnnouncerProvider>,
    );
    expect(region().getAttribute('aria-live')).toBe('polite');
    expect(region().getAttribute('aria-atomic')).toBe('true');
    expect(region().className).toContain('sr-only');
    expect(region().textContent).toBe('');
  });

  it('shows the latest message', () => {
    render(
      <AnnouncerProvider>
        <Probe />
      </AnnouncerProvider>,
    );
    act(() => announce('Flag placed at row 1, column 1.'));
    expect(region().textContent).toBe('Flag placed at row 1, column 1.');
    act(() => announce('Opened 4 cells.'));
    expect(region().textContent).toBe('Opened 4 cells.');
  });

  it('replaces the text node for a repeated message, so it is spoken again', () => {
    render(
      <AnnouncerProvider>
        <Probe />
      </AnnouncerProvider>,
    );
    act(() => announce('Opened 4 cells.'));
    const first = region().firstElementChild;
    act(() => announce('Opened 4 cells.'));
    const second = region().firstElementChild;
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
    expect(region().textContent).toBe('Opened 4 cells.');
  });

  it('keeps the same region element across messages', () => {
    render(
      <AnnouncerProvider>
        <Probe />
      </AnnouncerProvider>,
    );
    const before = region();
    act(() => announce('one'));
    act(() => announce('two'));
    expect(region()).toBe(before);
  });
});

describe('useAnnounce outside a provider', () => {
  it('does nothing and does not throw', () => {
    render(<Probe />);
    expect(() => announce('nobody listens')).not.toThrow();
  });
});
