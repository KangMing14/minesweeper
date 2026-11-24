// @vitest-environment node
// Reads `tokens.css` as text, so it needs Node's file system and not the jsdom of the component tests.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast.js';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

/** Declarations of one rule, by exact selector text: `{ '--ms-color-text': '#16222d', ... }`. */
function rules(): Map<string, Record<string, string>> {
  const found = new Map<string, Record<string, string>>();
  // A rule whose body has no nested braces; a rule inside @media is found the same way.
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (match[1] ?? '').replace(/^[\s\S]*?(?=:root)/, '').trim();
    if (!selector.startsWith(':root')) continue;
    const declarations: Record<string, string> = {};
    for (const decl of (match[2] ?? '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      declarations[decl[1] ?? ''] = (decl[2] ?? '').trim();
    }
    found.set(selector, declarations);
  }
  return found;
}

const LIGHT = ':root';
const DARK_AUTO = ":root:not([data-theme='light'])";
const DARK_FORCED = ":root[data-theme='dark']";

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const COLOR_TOKENS = [
  'surface',
  'surface-raised',
  'cell-hidden',
  'cell-revealed',
  'text',
  'text-muted',
  'accent',
  'danger',
  ...NUMBERS.map((n) => `num-${n}`),
].map((name) => `--ms-color-${name}`);

const SCALE_TOKENS = [
  ...[1, 2, 3, 4, 5, 6].map((n) => `--ms-space-${n}`),
  ...['sm', 'md', 'lg'].map((n) => `--ms-radius-${n}`),
  ...['xs', 'sm', 'md', 'lg', 'xl', '2xl'].map((n) => `--ms-font-size-${n}`),
  '--ms-font-sans',
];

describe('tokens.css structure', () => {
  const all = rules();

  it('has a light block, a dark block under prefers-color-scheme and a forced-dark block', () => {
    expect([...all.keys()].sort()).toEqual([DARK_FORCED, DARK_AUTO, LIGHT].sort());
    expect(css).toMatch(
      /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme='light'\]\)/,
    );
  });

  it('declares every color token in the light theme and in both dark blocks', () => {
    for (const selector of [LIGHT, DARK_AUTO, DARK_FORCED]) {
      const block = all.get(selector) ?? {};
      for (const token of COLOR_TOKENS) {
        expect(block[token], `${token} in ${selector}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('declares the spacing, radius and type scales once, in the light block', () => {
    const block = all.get(LIGHT) ?? {};
    for (const token of SCALE_TOKENS) expect(block[token], token).toBeTruthy();
  });

  it('keeps the two dark blocks identical, so the system theme and the forced theme cannot drift apart', () => {
    expect(all.get(DARK_AUTO)).toEqual(all.get(DARK_FORCED));
  });

  it('gives each number 1 to 8 its own color in each theme', () => {
    for (const selector of [LIGHT, DARK_AUTO]) {
      const block = all.get(selector) ?? {};
      const colors = NUMBERS.map((n) => (block[`--ms-color-num-${n}`] ?? '').toLowerCase());
      expect(new Set(colors).size, selector).toBe(8);
    }
  });
});

describe('tokens.css contrast (WCAG AA, 4.5:1 for text)', () => {
  const all = rules();
  const themes = [
    ['light', LIGHT],
    ['dark', DARK_AUTO],
  ] as const;

  for (const [theme, selector] of themes) {
    const color = (name: string): string => all.get(selector)?.[`--ms-color-${name}`] ?? '';

    describe(theme, () => {
      it.each(NUMBERS)('number %i on a revealed cell', (n) => {
        expect(contrastRatio(color(`num-${n}`), color('cell-revealed'))).toBeGreaterThanOrEqual(
          4.5,
        );
      });

      it.each([
        ['text', 'surface'],
        ['text', 'surface-raised'],
        ['text', 'cell-revealed'],
        ['text-muted', 'surface'],
        ['text-muted', 'surface-raised'],
        ['accent', 'surface'],
        ['accent', 'surface-raised'],
        ['danger', 'surface-raised'],
      ])('%s on %s', (foreground, background) => {
        expect(contrastRatio(color(foreground), color(background))).toBeGreaterThanOrEqual(4.5);
      });

      it('tells a hidden cell from a revealed one (at least 1.5:1)', () => {
        expect(contrastRatio(color('cell-hidden'), color('cell-revealed'))).toBeGreaterThanOrEqual(
          1.5,
        );
      });
    });
  }
});
