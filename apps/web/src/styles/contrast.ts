/**
 * WCAG 2.x contrast math for the design tokens. Used by the token tests; the app itself does not import it.
 * Colors are `#rgb` or `#rrggbb` strings, the only forms `tokens.css` uses.
 */

/**
 * Reads a hex color into its red, green and blue channels (0 to 255).
 *
 * @param hex - `#rgb` or `#rrggbb`, in either case.
 * @returns The three channels.
 * @throws RangeError when the text is not a hex color.
 * @example
 * ```ts
 * parseHexColor('#f80'); // [255, 136, 0]
 * ```
 */
export function parseHexColor(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  const digits = match?.[1];
  if (digits === undefined)
    throw new RangeError(`hex: not a #rgb or #rrggbb color: ${JSON.stringify(hex)}`);
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * Relative luminance of an sRGB color, from 0 (black) to 1 (white), as WCAG 2.x defines it.
 *
 * @param hex - `#rgb` or `#rrggbb`.
 * @returns The luminance.
 * @example
 * ```ts
 * relativeLuminance('#ffffff'); // 1
 * ```
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHexColor(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Contrast ratio of two colors, from 1 (identical) to 21 (black on white). The order does not matter.
 *
 * @param a - One color, `#rgb` or `#rrggbb`.
 * @param b - The other color.
 * @returns The ratio.
 * @example
 * ```ts
 * contrastRatio('#000000', '#ffffff'); // 21
 * ```
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
