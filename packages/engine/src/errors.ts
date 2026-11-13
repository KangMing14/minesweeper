/**
 * Thrown when a `BoardConfig` cannot describe a playable board.
 *
 * @remarks
 * `reason` is the human-readable explanation and is also the error `message`. It always starts with the name
 * of the offending field (`width`, `height` or `mineCount`), so a caller can tell which part of the config
 * to fix without parsing anything else. The class carries no other data on purpose: callers branch on the
 * type, and show or log the reason.
 *
 * @example
 * ```ts
 * try {
 *   validateBoardConfig({ width: 0, height: 9, mineCount: 10 });
 * } catch (error) {
 *   if (error instanceof InvalidBoardConfigError) {
 *     console.log(error.reason); // "width must be an integer from 1 to 100, got 0"
 *   }
 * }
 * ```
 */
export class InvalidBoardConfigError extends Error {
  /** Why the config was rejected. Identical to `message`; starts with the offending field's name. */
  readonly reason: string;

  /**
   * Creates the error.
   *
   * @param reason - Why the config was rejected; start it with the offending field's name.
   */
  constructor(reason: string) {
    super(reason);
    this.name = 'InvalidBoardConfigError';
    this.reason = reason;
  }
}
