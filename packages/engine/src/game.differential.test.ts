import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Board } from './board.js';
import type { Command } from './command.js';
import { cellCount, safeCellCount } from './config.js';
import type { GameEvent } from './events.js';
import { Game } from './game.js';
import type { GameView } from './view.js';

// M1-T10 (review I2). The M1-T06 properties draw commands blindly, so a chord almost never takes effect (3 of
// 1,034 chords in a 1,000-game sample). This file adds three things:
//   1. a guided player that looks at the view and picks commands that reach chords and long games,
//   2. a guard that fails if that stops being true, and
//   3. a differential test against a short recursive reference written from ADR-009 (cell rules).
// The order of the cells inside one `cellsRevealed` event is pinned by the example tests (reveal.test.ts); the
// reference is recursive, so it compares sets, not order.

/** How many generated cases every property runs (the task asks for at least 1,000 in CI). */
const RUNS = 1_000;

/**
 * Timeout of the tests that play 1,000 games. The default of 5 s is too tight for a shared CI runner with
 * coverage on (they take 2 to 4 s on a fast machine); the limit is there to catch a hang, not to time them.
 */
const SLOW_TEST_MS = 60_000;

/** Reads `array[index]` and fails loudly if it is missing (the project has `noUncheckedIndexedAccess`). */
function at<T>(array: readonly T[], index: number): T {
  const item = array[index];
  if (item === undefined) throw new Error(`no item at ${index} of ${array.length}`);
  return item;
}

// --- Boards ---------------------------------------------------------------------------------------------

/**
 * A board up to 16x16 with at most a quarter of its cells mined, so a game can last long enough for flags and
 * chords to matter. (The M1-T06 generator draws any mine count and mostly makes boards that end in one click.)
 */
const guidedBoard: fc.Arbitrary<Board> = fc
  .record({ width: fc.integer({ min: 1, max: 16 }), height: fc.integer({ min: 1, max: 16 }) })
  .chain(({ width, height }) => {
    const cells = width * height;
    const mostMines = Math.min(cells - 1, Math.floor(cells / 4));
    return fc.integer({ min: 0, max: mostMines }).chain((mineCount) =>
      fc
        .uniqueArray(fc.integer({ min: 0, max: cells - 1 }), {
          minLength: mineCount,
          maxLength: mineCount,
        })
        .map((mines) => new Board({ width, height, mineCount }, mines)),
    );
  });

/** A guided game: a board and the numbers that steer the player. Shrinking shortens and simplifies them. */
const guidedGame: fc.Arbitrary<{ board: Board; steer: number[] }> = fc.record({
  board: guidedBoard,
  // Long enough for a real game; the default size of fast-check favors very short arrays.
  steer: fc.array(fc.nat(1_000_000), { minLength: 80, maxLength: 480 }),
});

// --- The guided player ----------------------------------------------------------------------------------

/** Cells of a view that are revealed and show a number of 1 or more: the cells a chord can start from. */
function numberCells(view: GameView): number[] {
  const cells: number[] = [];
  view.cells.forEach((cell, index) => {
    if (cell.state === 'revealed' && cell.value > 0) cells.push(index);
  });
  return cells;
}

/** Hidden, unflagged neighbors of the number cells, split into real mines and safe cells (the test knows the board). */
function frontier(board: Board, view: GameView): { mines: number[]; safe: number[] } {
  const seen = new Set<number>();
  const mines: number[] = [];
  const safe: number[] = [];
  for (const cell of numberCells(view)) {
    for (const neighbor of board.neighbors(cell)) {
      if (seen.has(neighbor) || at(view.cells, neighbor).state !== 'hidden') continue;
      seen.add(neighbor);
      (board.isMine(neighbor) ? mines : safe).push(neighbor);
    }
  }
  return { mines, safe };
}

/**
 * Number cells whose flagged neighbors equal their value. With `needOpen` the cell must also still have a
 * hidden, unflagged neighbor (a chord that does something); without it, cells with nothing left to open count
 * too (a chord that must do nothing).
 */
function matching(board: Board, view: GameView, needOpen: boolean): number[] {
  return numberCells(view).filter((cell) => {
    const value = board.adjacentMines(cell);
    let flags = 0;
    let open = 0;
    for (const neighbor of board.neighbors(cell)) {
      const state = at(view.cells, neighbor).state;
      if (state === 'flagged') flags += 1;
      else if (state === 'hidden') open += 1;
    }
    return flags === value && (open > 0 || !needOpen);
  });
}

/** Picks one entry by a steering number, or `undefined` when the list is empty. */
function choose<T>(list: readonly T[], pick: number): T | undefined {
  return list.length === 0 ? undefined : at(list, pick % list.length);
}

/**
 * Chooses the next command from what the player can see, steered by two numbers. The mix is meant to build
 * the situations a chord needs: reveal safe cells to get numbers, flag the real mines next to them (and, now
 * and then, a safe cell, so some chords lose), chord when the flags match, chord when they do not, and now
 * and then touch any cell at all.
 */
function nextCommand(board: Board, view: GameView, kind: number, pick: number, t: number): Command {
  const hiddenSafe: number[] = [];
  const hiddenAny: number[] = [];
  const flagged: number[] = [];
  view.cells.forEach((cell, index) => {
    if (cell.state === 'hidden') {
      hiddenAny.push(index);
      if (!board.isMine(index)) hiddenSafe.push(index);
    } else if (cell.state === 'flagged') flagged.push(index);
  });
  const { mines, safe } = frontier(board, view);
  const reveal = (index: number | undefined): Command => ({ type: 'reveal', index: index ?? 0, t });
  switch (kind % 10) {
    case 0:
    case 1:
    case 2:
      return reveal(choose(hiddenSafe.length > 0 ? hiddenSafe : hiddenAny, pick));
    case 3:
      return reveal(choose(hiddenAny, pick)); // may be a mine: the game ends
    case 4:
    case 5: {
      const index = choose(mines, pick) ?? choose(hiddenAny, pick);
      return index === undefined ? reveal(undefined) : { type: 'flag', index, t };
    }
    case 6: {
      const index = choose(safe, pick) ?? choose(hiddenAny, pick); // a wrong flag
      return index === undefined ? reveal(undefined) : { type: 'flag', index, t };
    }
    case 7: {
      const index = choose(matching(board, view, true), pick) ?? choose(numberCells(view), pick);
      return index === undefined ? reveal(choose(hiddenSafe, pick)) : { type: 'chord', index, t };
    }
    case 8: {
      // Chords that must do nothing: nothing left to open, too few or too many flags.
      const index = choose(matching(board, view, false), pick) ?? choose(numberCells(view), pick);
      return index === undefined ? reveal(choose(hiddenSafe, pick)) : { type: 'chord', index, t };
    }
    default: {
      // Odd corners: take a flag back, chord or flag any cell at all (hidden, flagged, zero, revealed).
      const any = pick % view.cells.length;
      switch (Math.floor(pick / 7) % 3) {
        case 0: {
          const index = choose(flagged, pick);
          return index === undefined
            ? reveal(choose(hiddenSafe, pick))
            : { type: 'flag', index, t };
        }
        case 1:
          return { type: 'chord', index: any, t };
        default:
          return { type: 'flag', index: any, t };
      }
    }
  }
}

/** One step of a guided game: the command, what `Game` announced, and the view before and after. */
interface Step {
  readonly command: Command;
  readonly events: readonly GameEvent[];
  readonly before: GameView;
  readonly after: GameView;
}

/** Plays a guided game (two steering numbers per command) and hands every step to `onStep`. */
function playGuided(
  board: Board,
  steer: readonly number[],
  game: Game,
  onStep: (step: Step) => void,
): void {
  // A view is a frozen snapshot, so the one taken after a command is also the one before the next: build one
  // per command, not two (the tests below play thousands of games, and CI runs them with coverage on).
  let before = game.view();
  for (let i = 0; i + 1 < steer.length; i += 2) {
    const command = nextCommand(board, before, at(steer, i), at(steer, i + 1), i * 10);
    const events = game.apply(command);
    const after = game.view();
    onStep({ command, events, before, after });
    before = after;
  }
}

// --- The guard: the generators must reach what they are for -------------------------------------------------

describe('guided play reaches chords (review I2)', () => {
  it(
    'makes hundreds of chords take effect in 1,000 games: some lose, some win the game',
    () => {
      const stats = { games: 0, chords: 0, chordLost: 0, chordWon: 0, won: 0, lost: 0 };
      for (const { board, steer } of fc.sample(guidedGame, { numRuns: RUNS, seed: 20_261_117 })) {
        const game = new Game(board);
        stats.games += 1;
        playGuided(board, steer, game, ({ command, events }) => {
          if (command.type !== 'chord' || events.length === 0) return;
          stats.chords += 1;
          if (events.some((event) => event.type === 'gameLost')) stats.chordLost += 1;
          if (events.some((event) => event.type === 'gameWon')) stats.chordWon += 1;
        });
        const status = game.view().status;
        if (status === 'won') stats.won += 1;
        if (status === 'lost') stats.lost += 1;
      }
      // The blind generator of game.property.test.ts gave 3 effective chords in 1,034 tries, and no chord win.
      // This sample (a fixed seed) gives about 650 effective chords, 260 losing ones and 8 winning ones.
      expect(stats.chords).toBeGreaterThanOrEqual(300);
      expect(stats.chordLost).toBeGreaterThanOrEqual(50);
      expect(stats.chordWon).toBeGreaterThanOrEqual(3);
      // Games must also reach both ends, not only die on the first click.
      expect(stats.won).toBeGreaterThanOrEqual(200);
      expect(stats.lost).toBeGreaterThanOrEqual(200);
    },
    SLOW_TEST_MS,
  );
});

// --- The reference ------------------------------------------------------------------------------------------

/** An event with its cell list sorted, so two implementations that open cells in another order compare equal. */
type Plain =
  | { type: 'cellsRevealed'; cells: [number, number][] }
  | { type: 'flagToggled'; index: number; flagged: boolean }
  | { type: 'gameWon'; t: number }
  | { type: 'gameLost'; t: number; mineIndex: number };

/** Turns the engine's events into `Plain` ones. */
function plain(events: readonly GameEvent[]): Plain[] {
  return events.map((event): Plain => {
    if (event.type !== 'cellsRevealed') return { ...event };
    const cells = event.cells.map((cell): [number, number] => [cell.index, cell.value]);
    return { type: 'cellsRevealed', cells: cells.sort((a, b) => a[0] - b[0]) };
  });
}

/** The cells of a view as one string: `H` hidden, `F` flagged, a digit for a revealed cell. */
function boardText(view: GameView): string {
  return view.cells
    .map((cell) =>
      cell.state === 'hidden' ? 'H' : cell.state === 'flagged' ? 'F' : String(cell.value),
    )
    .join('');
}

/**
 * The rules of ADR-009 and M1-T04 to M1-T06, written the obvious way: a recursive flood fill, no running
 * counters, no shared code with `Game`. If it and `Game` disagree, decide from the ADR which one is wrong.
 */
class Reference {
  status: 'ready' | 'playing' | 'won' | 'lost' = 'ready';
  readonly revealed: boolean[];
  readonly flagged: boolean[];

  constructor(private readonly board: Board) {
    const cells = cellCount(board.config);
    this.revealed = new Array<boolean>(cells).fill(false);
    this.flagged = new Array<boolean>(cells).fill(false);
  }

  /** The same text as `boardText` gives for a view. */
  text(): string {
    return this.revealed
      .map((open, index) =>
        open ? String(this.board.adjacentMines(index)) : this.flagged[index] === true ? 'F' : 'H',
      )
      .join('');
  }

  get revealedCount(): number {
    return this.revealed.filter(Boolean).length;
  }

  /** Opens a hidden, unflagged cell and, if it shows 0, everything it touches. Appends the cells it opened. */
  #open(index: number, opened: [number, number][]): void {
    if (this.revealed[index] === true || this.flagged[index] === true) return;
    this.revealed[index] = true;
    const value = this.board.adjacentMines(index);
    opened.push([index, value]);
    if (value === 0)
      for (const neighbor of this.board.neighbors(index)) this.#open(neighbor, opened);
  }

  /** Finishes a command that opened cells: a win if every safe cell is open. */
  #finish(t: number, opened: [number, number][], mineIndex: number | null): Plain[] {
    const events: Plain[] = [];
    if (opened.length > 0)
      events.push({ type: 'cellsRevealed', cells: opened.sort((a, b) => a[0] - b[0]) });
    if (mineIndex !== null) {
      this.status = 'lost';
      events.push({ type: 'gameLost', t, mineIndex });
    } else if (this.revealedCount === safeCellCount(this.board.config)) {
      this.status = 'won';
      events.push({ type: 'gameWon', t });
    }
    return events;
  }

  apply(command: Command): Plain[] {
    if (this.status === 'won' || this.status === 'lost') return [];
    const { index, t } = command;
    const opened: [number, number][] = [];
    if (command.type === 'flag') {
      if (this.revealed[index] === true) return [];
      this.flagged[index] = this.flagged[index] !== true;
      this.status = 'playing';
      return [{ type: 'flagToggled', index, flagged: this.flagged[index] === true }];
    }
    if (command.type === 'reveal') {
      if (this.revealed[index] === true || this.flagged[index] === true) return [];
      this.status = 'playing';
      if (this.board.isMine(index)) return this.#finish(t, opened, index);
      this.#open(index, opened);
      return this.#finish(t, opened, null);
    }
    // chord
    if (this.revealed[index] !== true) return [];
    const value = this.board.adjacentMines(index);
    if (value === 0) return [];
    const neighbors = this.board.neighbors(index);
    if (neighbors.filter((n) => this.flagged[n] === true).length !== value) return [];
    const targets = neighbors.filter((n) => this.revealed[n] !== true && this.flagged[n] !== true);
    if (targets.length === 0) return [];
    this.status = 'playing';
    let mineIndex: number | null = null;
    for (const target of targets) {
      if (this.board.isMine(target))
        mineIndex ??= target; // targets ascend, so the first is the lowest
      else this.#open(target, opened);
    }
    return this.#finish(t, opened, mineIndex);
  }
}

describe('Game against a simple recursive reference (review I2)', () => {
  it(
    'agrees on events, status and every cell after every command of a guided game',
    () => {
      fc.assert(
        fc.property(guidedGame, ({ board, steer }) => {
          const game = new Game(board);
          const reference = new Reference(board);
          const mines: number[] = [];
          for (let i = 0; i < cellCount(board.config); i++) if (board.isMine(i)) mines.push(i);
          playGuided(board, steer, game, ({ command, events, after }) => {
            const expected = reference.apply(command);
            // One comparison of two strings per command: thousands of `expect` calls per game would be too slow.
            const finished = reference.status === 'won' || reference.status === 'lost';
            const engine = [
              JSON.stringify(plain(events)),
              after.status,
              after.revealedCount,
              boardText(after),
              JSON.stringify(after.exposedMines ?? null),
            ].join('|');
            const wanted = [
              JSON.stringify(expected),
              reference.status,
              reference.revealedCount,
              reference.text(),
              JSON.stringify(finished ? mines : null),
            ].join('|');
            if (engine !== wanted) expect(engine).toBe(wanted); // fast-check shows the command and the shrunk case
          });
        }),
        { numRuns: RUNS },
      );
    },
    SLOW_TEST_MS,
  );

  it(
    'never loses a chord whose flags sit exactly on the real mines around the number',
    () => {
      fc.assert(
        fc.property(guidedGame, ({ board, steer }) => {
          playGuided(board, steer, new Game(board), ({ command, events, before }) => {
            if (command.type !== 'chord') return;
            const around = board.neighbors(command.index);
            const exact = around.every(
              (n) => (at(before.cells, n).state === 'flagged') === board.isMine(n),
            );
            const number = at(before.cells, command.index);
            if (exact && number.state === 'revealed') {
              expect(events.some((event) => event.type === 'gameLost')).toBe(false);
            }
          });
        }),
        { numRuns: RUNS },
      );
    },
    SLOW_TEST_MS,
  );
});
