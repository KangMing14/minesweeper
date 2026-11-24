import { describe, expect, it } from 'vitest';
import { contrastRatio, parseHexColor, relativeLuminance } from './contrast.js';

describe('parseHexColor', () => {
  it('reads six-digit and three-digit hex colors, in any case', () => {
    expect(parseHexColor('#ff8000')).toEqual([255, 128, 0]);
    expect(parseHexColor('#FF8000')).toEqual([255, 128, 0]);
    expect(parseHexColor('#f80')).toEqual([255, 136, 0]);
  });

  it.each(['', 'ff8000', '#ff80', '#ff80000', '#gg0000', 'rgb(0,0,0)'])('rejects %j', (bad) => {
    expect(() => parseHexColor(bad)).toThrow(RangeError);
  });
});

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBe(1);
  });

  it('matches the WCAG formula for a mid grey', () => {
    // sRGB 128 -> ((128/255 + 0.055) / 1.055) ^ 2.4 = 0.21586...
    expect(relativeLuminance('#808080')).toBeCloseTo(0.2158605, 6);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a color on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10);
    expect(contrastRatio('#336699', '#336699')).toBe(1);
  });

  it('does not depend on the order of the two colors', () => {
    expect(contrastRatio('#123456', '#fedcba')).toBe(contrastRatio('#fedcba', '#123456'));
  });

  it('gives the published ratio for #767676 on white (4.54:1, the lightest grey that passes AA)', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });
});
