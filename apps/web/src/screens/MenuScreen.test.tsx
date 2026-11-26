import { PRESETS } from '@minesweeper/engine';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MenuScreen } from './MenuScreen.js';

describe('MenuScreen', () => {
  it('asks for a difficulty, and explains how the clock and the controls work', () => {
    render(<MenuScreen onStart={() => undefined} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Choose a difficulty' })).toBeTruthy();
    expect(screen.getByText(/clock starts as soon as the board appears/i)).toBeTruthy();
    expect(screen.getByText(/right-click to flag/i)).toBeTruthy();
  });

  it('lists the three presets of the engine with their size and mines', () => {
    render(<MenuScreen onStart={() => undefined} />);
    const list = screen.getByRole('list', { name: 'Difficulties' });
    const buttons = within(list).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Beginner'),
      expect.stringContaining('Intermediate'),
      expect.stringContaining('Expert'),
    ]);
    for (const [id, config] of Object.entries(PRESETS)) {
      const name = id.charAt(0).toUpperCase() + id.slice(1);
      const button = within(list).getByRole('button', { name: new RegExp(`^${name}\\b`) });
      expect(button.textContent).toContain(`${config.width} × ${config.height}`);
      expect(button.textContent).toContain(`${config.mineCount} mines`);
    }
  });

  it('starts the chosen preset', () => {
    const onStart = vi.fn();
    render(<MenuScreen onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: /^Expert/ }));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith('expert');
  });

  it('puts the keyboard focus on its heading, so a screen reader starts at the top', () => {
    render(<MenuScreen onStart={() => undefined} />);
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2 }));
  });

  it('draws the boards to scale, hidden from assistive technology', () => {
    const { container } = render(<MenuScreen onStart={() => undefined} />);
    const sketches = container.querySelectorAll<HTMLElement>('[data-board-sketch]');
    expect(sketches).toHaveLength(3);
    const widths = [...sketches].map((s) => parseFloat(s.style.width));
    expect(widths[0]).toBeLessThan(widths[1] as number);
    expect(widths[1]).toBeLessThan(widths[2] as number);
    for (const sketch of sketches) expect(sketch.getAttribute('aria-hidden')).toBe('true');
  });
});
