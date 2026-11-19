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

/**
 * Thrown when a `ReplayLog` cannot be replayed: it is malformed, or the game does not accept a command in it.
 *
 * @remarks
 * `reason` is the human-readable explanation and is also the error `message`. It always starts with where the
 * problem is: `version`, `config`, `seed`, `commands` (the list as a whole), or `commands[i]` for the command
 * at position `i` (counted from 0), followed by the field (`commands[3].t`) when one field is at fault. A
 * caller can show or log the reason without parsing it, and a server can answer "your log is bad at
 * command 3" without any other data.
 *
 * It is a different class from `InvalidBoardConfigError` on purpose: a bad config given to a board is a
 * mistake of the caller of the engine, a bad log is a bad input from outside (a stored or submitted replay).
 * When a log is rejected because of its config, the `InvalidBoardConfigError` that was found is kept as
 * `cause`.
 *
 * @example
 * ```ts
 * try {
 *   replay({ version: 1, config: PRESETS.beginner, seed: -1, commands: [] });
 * } catch (error) {
 *   if (error instanceof InvalidReplayError) {
 *     console.log(error.reason); // "seed must be an integer from 0 to 4294967295, got -1"
 *   }
 * }
 * ```
 */
export class InvalidReplayError extends Error {
  /** Why the log was rejected. Identical to `message`; starts with where the problem is. */
  readonly reason: string;

  /**
   * Creates the error.
   *
   * @param reason - Why the log was rejected; start it with where the problem is (`seed`, `commands[3].t`).
   * @param options - Set `cause` to the error that made the log invalid, if there is one.
   */
  constructor(reason: string, options?: ErrorOptions) {
    super(reason, options);
    this.name = 'InvalidReplayError';
    this.reason = reason;
  }
}
