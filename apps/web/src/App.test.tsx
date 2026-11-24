import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App.js';
import { THEME_ATTRIBUTE } from './theme.js';

afterEach(() => {
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
});

describe('App', () => {
  it('has a header with the game name as the page heading, and a main region', () => {
    render(<App />);
    expect(within(screen.getByRole('banner')).getByRole('heading', { level: 1 }).textContent).toBe(
      'Minesweeper',
    );
    expect(screen.getByRole('main')).toBeTruthy();
  });

  it('shows the eight cell numbers, 1 to 8, as a labeled list', () => {
    render(<App />);
    const list = screen.getByRole('list', { name: 'Cell number colors' });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });

  it('cycles the theme from the header button: system, light, dark, system', () => {
    render(<App />);
    const root = document.documentElement;
    const button = screen.getByRole('button', { name: /^Theme: / });
    expect(button.textContent).toBe('Theme: system');
    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);

    fireEvent.click(button);
    expect(button.textContent).toBe('Theme: light');
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('light');

    fireEvent.click(button);
    expect(button.textContent).toBe('Theme: dark');
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('dark');

    fireEvent.click(button);
    expect(button.textContent).toBe('Theme: system');
    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });
});
