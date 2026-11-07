import { describe, expect, it } from 'vitest';
import { m0SampleAdd } from './index.js';

// M0 sample test: proves the Vitest pipeline runs a real test against real engine source.
// M1-T07 removes this file together with `sample.ts`.
describe('m0SampleAdd', () => {
  it('adds two integers', () => {
    expect(m0SampleAdd(2, 3)).toBe(5);
  });

  it('is exported from the package entry point', () => {
    expect(typeof m0SampleAdd).toBe('function');
  });
});
