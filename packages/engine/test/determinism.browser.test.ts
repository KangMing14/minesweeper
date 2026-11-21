import { describe, expect, it } from 'vitest';
import { defineDeterminismSuite } from './determinism.shared.js';

defineDeterminismSuite('browser');

// Without this, a misconfigured runner could pass by running the suite in Node a second time.
describe('the browser runner', () => {
  it('really runs in Chromium, not in Node', () => {
    const navigator = Reflect.get(globalThis, 'navigator') as { userAgent?: string } | undefined;
    expect(navigator?.userAgent).toMatch(/Chrome|Chromium/);
    expect(Reflect.get(globalThis, 'process')).toBeUndefined();
    expect(Reflect.get(globalThis, 'document')).toBeDefined();
  });
});
