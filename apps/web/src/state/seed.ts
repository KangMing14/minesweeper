// M3-T05. Where the seed of a new board comes from. The engine has no random source (ADR-002); the client
// draws the seed and gives it to `LocalSession`.

/**
 * Draws a seed for a new board: a whole number from 0 to 4294967295, from `crypto.getRandomValues`.
 *
 * @returns A uint32.
 * @example
 * ```ts
 * const session = new LocalSession(PRESETS.beginner, randomSeed(), new SystemClock());
 * ```
 */
export function randomSeed(): number {
  const word = new Uint32Array(1);
  crypto.getRandomValues(word);
  return word[0] ?? 0;
}
