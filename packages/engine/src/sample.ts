/**
 * Adds two numbers. This is M0 scaffolding, not game logic: it exists so the test, coverage and API
 * documentation pipelines have one real exported symbol to process before the engine has any.
 *
 * @remarks
 * Not part of the engine's real API and not a canonical name. M1-T07 deletes this file, its test and the
 * re-export in `index.ts` when it locks the public surface.
 *
 * @param a - The first addend.
 * @param b - The second addend.
 * @returns The sum of `a` and `b`.
 *
 * @example
 * ```ts
 * m0SampleAdd(2, 3); // 5
 * ```
 */
export function m0SampleAdd(a: number, b: number): number {
  return a + b;
}
