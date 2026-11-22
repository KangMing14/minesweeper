/**
 * The most commands one game accepts, and the most commands a `ReplayLog` may hold: 100,000.
 *
 * @remarks
 * One number for two rules, so that they cannot drift apart. `Game.apply` stops accepting commands once
 * `Game.log()` holds this many, and `validateReplayLog` rejects a log with more. Every game that is played
 * can therefore be replayed (ADR-002). Without the first rule a legal game could outgrow the second: flag
 * toggles are accepted for ever, so the size of a log has no natural bound.
 *
 * The bound is generous for real play: a 100x100 board has 10,000 cells, so a game that opens every cell
 * and flags and unflags each of them a few times stays below it. It is a fixed limit, not a parameter, and
 * it is part of what `ReplayLog` `version: 1` promises. `protocol` must enforce the same number in its
 * schema for a replay log (M5-T01), which is why the constant is public.
 *
 * @example
 * ```ts
 * const game = createGame(PRESETS.beginner, 42);
 * game.log().length < MAX_REPLAY_COMMANDS; // true: a game accepts commands until its log is this long
 * ```
 */
export const MAX_REPLAY_COMMANDS = 100_000;
