/**
 * Theme switching for the design tokens. `tokens.css` follows the system theme (prefers-color-scheme) unless
 * the root element carries a `data-theme` attribute of `light` or `dark`; this module sets and clears it.
 */

/** Name of the attribute on the root element that forces a theme. */
export const THEME_ATTRIBUTE = 'data-theme';

/** What the player chose: follow the system, or force light or dark. */
export type ThemePreference = 'system' | 'light' | 'dark';

const ORDER: readonly ThemePreference[] = ['system', 'light', 'dark'];

/**
 * The preference that follows `current` when the theme button is pressed: system, light, dark, system.
 *
 * @param current - The preference now in effect.
 * @returns The next one in the cycle.
 * @example
 * ```ts
 * nextTheme('dark'); // 'system'
 * ```
 */
export function nextTheme(current: ThemePreference): ThemePreference {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? 'system';
}

/**
 * Puts a preference into effect. `light` and `dark` set the data attribute; `system` removes it, so the
 * system setting decides.
 *
 * @param preference - The theme to apply.
 * @param root - The element that carries the attribute; the document element by default.
 * @example
 * ```ts
 * applyTheme('dark'); // <html data-theme="dark">
 * ```
 */
export function applyTheme(
  preference: ThemePreference,
  root: HTMLElement = document.documentElement,
): void {
  if (preference === 'system') root.removeAttribute(THEME_ATTRIBUTE);
  else root.setAttribute(THEME_ATTRIBUTE, preference);
}
