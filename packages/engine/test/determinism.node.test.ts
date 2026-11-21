import { describe, expect, it } from 'vitest';
import { defineDeterminismSuite } from './determinism.shared.js';

defineDeterminismSuite('node');

describe('the Node runner', () => {
  it('really runs in Node', () => {
    const versions = Reflect.get(Reflect.get(globalThis, 'process') as object, 'versions') as {
      node?: string;
    };
    expect(versions.node).toMatch(/^\d+\./);
  });
});
