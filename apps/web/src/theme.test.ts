import { afterEach, describe, expect, it } from 'vitest';
import { THEME_ATTRIBUTE, applyTheme, nextTheme } from './theme.js';

afterEach(() => {
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
});

describe('nextTheme', () => {
  it('cycles system, light, dark and back to system', () => {
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });
});

describe('applyTheme', () => {
  it('sets the data attribute for light and dark', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
    applyTheme('dark');
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
  });

  it('removes the attribute for system, so prefers-color-scheme decides', () => {
    applyTheme('dark');
    applyTheme('system');
    expect(document.documentElement.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });

  it('can target another element', () => {
    const element = document.createElement('div');
    applyTheme('dark', element);
    expect(element.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(document.documentElement.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });
});
