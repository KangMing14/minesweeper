import type { Command } from './command.js';
import { cellCount, validateBoardConfig } from './config.js';
import type { BoardConfig } from './config.js';
import { createGame } from './create-game.js';
import { InvalidBoardConfigError, InvalidReplayError } from './errors.js';
import type { Game } from './game.js';
import type { BoardGenerator } from './generator.js';

/** The largest seed: an unsigned 32-bit integer (ADR-002). */
const MAX_SEED = 4294967295;

/** The command types the engine understands. */
const COMMAND_TYPES: ReadonlySet<unknown> = new Set(['reveal', 'flag', 'chord']);

/**
 * The most commands a `ReplayLog` may hold: 100,000.
 *
 * @remarks
 * A log is replayed command by command, so its size is the cost of validating it. The longest real game
 * (100x100, every cell touched twice) stays far below this. Not exported from `index.ts`; the limit is
 * documented in the TSDoc of `validateReplayLog`.
 *
 * @internal
 */
export const MAX_REPLAY_COMMANDS = 100_000;

/**
 * Everything needed to play a game again: the board (`config` and `seed`) and every command that took effect.
 *
 * @remarks
 * `replay(log)` rebuilds the game with `createGame(config, seed)` and applies `commands` in order, so the
 * same log gives the same game in the browser, on the server and in a test (ADR-002). `Game.log()` returns
 * the `commands`; the `config` and the `seed` are the ones the game was created with.
 *
 * **The version is a promise about the rules.** `version: 1` means: the `Prng` of M2-T01, the board and the
 * opening of `SeededBoardGenerator` (M2-T02), the way `createGame` starts a game (M2-T03) and the rules of
 * `Game.apply` (ADR-009). Stored logs depend on every one of them, so a change that gives a different game
 * for the same log must not be made quietly: it gets a new version number and an ADR, and `replay` must keep
 * playing the old versions. Today `validateReplayLog` accepts only `1`.
 *
 * This type is plain data on purpose. Turning it into JSON, and checking JSON that comes from outside, is
 * the job of `protocol` (M5-T01); the engine accepts typed input only, but `validateReplayLog` still checks
 * every field at run time, because a typed value can still be wrong (a log read from a database).
 *
 * @example
 * ```ts
 * const game = createGame(PRESETS.beginner, 42);
 * game.apply({ type: 'reveal', index: 0, t: 800 });
 * const log: ReplayLog = { version: 1, config: PRESETS.beginner, seed: 42, commands: game.log() };
 * replay(log).view(); // the same view as game.view()
 * ```
 */
export interface ReplayLog {
  /** The rules the log was made under. Only `1` exists. */
  readonly version: 1;
  /** The size and mine count of the board. */
  readonly config: BoardConfig;
  /** The seed of the board: an unsigned 32-bit integer. */
  readonly seed: number;
  /** The commands that took effect, oldest first, with `t` that never goes down. */
  readonly commands: readonly Command[];
}

/**
 * Describes a value for an error message without ever failing or printing something huge.
 *
 * @param value - Anything, including values that no type allows.
 * @returns A short text.
 */
function show(value: unknown): string {
  if (typeof value === 'string') {
    return value.length > 24 ? `"${value.slice(0, 24)}..."` : `"${value}"`;
  }
  if (typeof value === 'object' && value !== null)
    return Array.isArray(value) ? 'an array' : 'an object';
  return String(value);
}

/**
 * Checks a `ReplayLog` on its own: its fields, its ranges and the order of its `t`. It does not play it.
 *
 * @remarks
 * The checks run in this order and stop at the first problem, so the reason names one place: `version`
 * (must be `1`), `config` (an object that passes `validateBoardConfig`), `seed` (an integer from 0 to
 * 4294967295), `commands` (an array of at most 100,000 entries; the count is checked before any entry, so a
 * huge list costs nothing), then each command in order: `type` (`'reveal'`, `'flag'` or `'chord'`), `index`
 * (a whole number inside the board of this log) and `t` (a non-negative safe integer that is not lower than
 * the `t` before it; equal is fine, as in `Game.apply`).
 *
 * What it cannot know is whether the game accepts each command, because that depends on the board: a reveal
 * on a cell that is already open is well-formed but cannot be in a log. `replay` finds that out by playing.
 * It also does not run the generator, so a config whose mines do not fit around a safe opening (M2-T02)
 * passes here and is rejected by `replay`.
 *
 * @param log - The log to check.
 * @throws {@link InvalidReplayError} describing the first problem. When the config is the problem, the
 * `InvalidBoardConfigError` is its `cause`.
 *
 * @example
 * ```ts
 * validateReplayLog({ version: 1, config: PRESETS.beginner, seed: 42, commands: [] }); // fine
 * validateReplayLog({ version: 1, config: PRESETS.beginner, seed: 42, commands: [
 *   { type: 'reveal', index: 0, t: 500 },
 *   { type: 'reveal', index: 1, t: 400 }, // throws: commands[1].t is lower than the t before it
 * ] });
 * ```
 */
export function validateReplayLog(log: ReplayLog): void {
  if (typeof log !== 'object' || log === null) {
    throw new InvalidReplayError(`log must be an object, got ${show(log)}`);
  }
  // The log may come from outside the type system, so every field is read as `unknown`.
  const { version, config, seed, commands } = log as unknown as Record<string, unknown>;

  if (version !== 1) {
    throw new InvalidReplayError(`version must be 1, got ${show(version)}`);
  }

  if (typeof config !== 'object' || config === null) {
    throw new InvalidReplayError(`config must be an object, got ${show(config)}`);
  }
  try {
    validateBoardConfig(config as BoardConfig);
  } catch (error) {
    if (error instanceof InvalidBoardConfigError) {
      throw new InvalidReplayError(`config is not valid: ${error.reason}`, { cause: error });
    }
    throw error;
  }
  const total = cellCount(config as BoardConfig);

  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) {
    throw new InvalidReplayError(
      `seed must be an integer from 0 to ${MAX_SEED}, got ${show(seed)}`,
    );
  }

  if (!Array.isArray(commands)) {
    throw new InvalidReplayError(`commands must be an array, got ${show(commands)}`);
  }
  if (commands.length > MAX_REPLAY_COMMANDS) {
    throw new InvalidReplayError(
      `commands has ${commands.length} entries, more than the maximum of ${MAX_REPLAY_COMMANDS}`,
    );
  }

  let previousT = 0;
  for (let i = 0; i < commands.length; i += 1) {
    const command: unknown = commands[i];
    if (typeof command !== 'object' || command === null) {
      throw new InvalidReplayError(`commands[${i}] must be an object, got ${show(command)}`);
    }
    const { type, index, t } = command as Record<string, unknown>;
    if (!COMMAND_TYPES.has(type)) {
      throw new InvalidReplayError(
        `commands[${i}].type must be 'reveal', 'flag' or 'chord', got ${show(type)}`,
      );
    }
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= total) {
      throw new InvalidReplayError(
        `commands[${i}].index must be a whole number from 0 to ${total - 1}, got ${show(index)}`,
      );
    }
    if (typeof t !== 'number' || !Number.isSafeInteger(t) || t < 0) {
      throw new InvalidReplayError(
        `commands[${i}].t must be a non-negative safe integer, got ${show(t)}`,
      );
    }
    if (t < previousT) {
      throw new InvalidReplayError(
        `commands[${i}].t is ${t}, lower than ${previousT}, the t of the command before it`,
      );
    }
    previousT = t;
  }
}

/**
 * Plays a `ReplayLog` again and returns the finished game.
 *
 * @remarks
 * The log is validated first (`validateReplayLog`), then the game is made with
 * `createGame(config, seed, generator)` and every command is applied in order. The result is the same game
 * that was played live: the same `view()`, the same `log()`, in every environment (ADR-002).
 *
 * **A log holds only accepted commands.** `Game.log()` never contains a command that changed nothing, came
 * after the end of the game, or had a bad `t`, so a command that the game answers with `[]` means the log
 * was not made by this engine, or was edited. `replay` throws instead of skipping it: a validator that
 * quietly ignored commands would accept a log whose result nobody played.
 *
 * **Empty and cleared boards.** An empty log replays to the game `createGame` returns: `'ready'` with the
 * opening open. The exception is a board that the opening already clears (a 1x1 board, a board with no
 * mines, a small board where the cascade reaches everything, and rarely a preset board for some seed): it is
 * `'won'` at `t = 0` (M2-T03), so an empty log replays to `'won'` and any command in a log for it is rejected.
 *
 * **The generator.** The log carries no generator, so the caller decides; the default is
 * `SeededBoardGenerator`, which is what `version: 1` means. Pass another one only for a log that was made
 * with it (tests do this to replay on a hand-made board).
 *
 * @param log - The log to play.
 * @param generator - Makes the board and the opening for the log's `config` and `seed`. Defaults to
 * `SeededBoardGenerator` (through `createGame`).
 * @returns The game after the last command; the same object type as a live game, so `view()` and `log()`
 * work as usual.
 * @throws {@link InvalidReplayError} if the log is malformed (see `validateReplayLog`), if its config leaves
 * no room for a safe opening (the `InvalidBoardConfigError` from the generator is its `cause`), or if the
 * game does not accept a command; the reason starts with `commands[i]`. Any other error of the generator
 * passes through unchanged.
 *
 * @example
 * ```ts
 * const live = createGame(PRESETS.beginner, 42);
 * live.apply({ type: 'reveal', index: 0, t: 800 });
 * const log: ReplayLog = { version: 1, config: PRESETS.beginner, seed: 42, commands: live.log() };
 * const again = replay(log);
 * again.view().status === live.view().status; // true, and so is every cell
 * ```
 */
export function replay(log: ReplayLog, generator?: BoardGenerator): Game {
  validateReplayLog(log);

  let game: Game;
  try {
    game = createGame(log.config, log.seed, generator);
  } catch (error) {
    // The config is valid, but the generator found no room for a safe opening (M2-T02). That is a
    // property of the log, so it is reported as one, with the original error attached.
    if (error instanceof InvalidBoardConfigError) {
      throw new InvalidReplayError(`config cannot be played: ${error.reason}`, { cause: error });
    }
    throw error;
  }

  for (let i = 0; i < log.commands.length; i += 1) {
    const command = log.commands[i] as Command;
    if (game.apply(command).length === 0) {
      // Only now is the view built (it costs a pass over the board), to say why: an accepted command never
      // gets here, and a rejected one is the end of the replay.
      const { status } = game.view();
      const why =
        status === 'won' || status === 'lost'
          ? `the game was already ${status}`
          : 'it changes nothing (the cell is already open or flagged, or the chord does not apply)';
      throw new InvalidReplayError(
        `commands[${i}] was not accepted by the game: ${why}; a log holds only accepted commands`,
      );
    }
  }
  return game;
}
