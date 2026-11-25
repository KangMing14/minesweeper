// @vitest-environment node
// M3-T03. The board draws glyphs (flag, mine, cross) in the token colors; this keeps each pair readable in
// every theme. Reads `tokens.css` as text, like `tokens.test.ts`.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../styles/contrast.js';

const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

/** Color tokens of one rule, found by its exact selector. */
function block(selector: string): Record<string, string> {
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const found = (match[1] ?? '').replace(/^[\s\S]*?(?=:root)/, '').trim();
    if (found !== selector) continue;
    const out: Record<string, string> = {};
    for (const decl of (match[2] ?? '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      out[decl[1] ?? ''] = (decl[2] ?? '').trim();
    }
    return out;
  }
  throw new Error(`no rule for ${selector}`);
}

const themes: [string, string][] = [
  ['light', ':root'],
  ['dark (system)', ":root:not([data-theme='light'])"],
  ['dark (forced)', ":root[data-theme='dark']"],
];

describe.each(themes)('glyph colors in the %s theme', (_name, selector) => {
  const t = block(selector);
  const color = (token: string): string => t[`--ms-color-${token}`] ?? '';

  it('keeps the flag pole and the mine readable on their cells (4.5:1)', () => {
    expect(contrastRatio(color('text'), color('cell-hidden'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(color('text'), color('cell-revealed'))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the flag cloth and the wrong-flag cross visible as graphics (3:1)', () => {
    expect(contrastRatio(color('danger'), color('cell-hidden'))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(color('danger'), color('cell-revealed'))).toBeGreaterThanOrEqual(3);
  });

  it('keeps the keyboard cursor ring visible as a graphic on both cells (3:1, M3-T04)', () => {
    expect(contrastRatio(color('accent'), color('cell-hidden'))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(color('accent'), color('cell-revealed'))).toBeGreaterThanOrEqual(3);
  });
});
