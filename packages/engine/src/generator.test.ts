import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Board } from './board.js';
import type { BoardConfig, CellIndex } from './config.js';
import { PRESETS, cellCount } from './config.js';
import { InvalidBoardConfigError } from './errors.js';
import { Game } from './game.js';
import { SeededBoardGenerator } from './generator.js';
import type { BoardGenerator, GeneratedBoard } from './generator.js';
import { SafeOpeningPolicy } from './opening.js';
import { createPrng } from './prng.js';

const UINT32_MAX = 4294967295;
const SEEDS = [0, 1, 2, 3, 42, 1000, 65535, 2147483647, 2147483648, UINT32_MAX];
const generator = new SeededBoardGenerator();

/** Every mine of the board, ascending. */
const minesOf = (board: Board): CellIndex[] =>
  Array.from({ length: cellCount(board.config) }, (_, index) => index).filter((index) =>
    board.isMine(index),
  );

/** The cells of the opening zone: the opening cell and its neighbors. */
const zoneOf = (board: Board, cell: CellIndex): CellIndex[] => [cell, ...board.neighbors(cell)];

/** The single opening cell of a generated board; fails the test if there is not exactly one. */
const openingCell = ({ opening }: GeneratedBoard): CellIndex => {
  expect(opening).toHaveLength(1);
  return opening[0] as CellIndex;
};

describe('SeededBoardGenerator: determinism', () => {
  it('gives the same board and the same opening for the same seed, from any instance', () => {
    for (const config of Object.values(PRESETS)) {
      for (const seed of SEEDS) {
        const first = generator.generate(config, seed);
        const again = generator.generate(config, seed);
        const other = new SeededBoardGenerator().generate(config, seed);
        expect(minesOf(again.board)).toEqual(minesOf(first.board));
        expect(minesOf(other.board)).toEqual(minesOf(first.board));
        expect(again.opening).toEqual(first.opening);
        expect(other.opening).toEqual(first.opening);
      }
    }
  });

  it('does not depend on earlier calls: generating other boards in between changes nothing', () => {
    const before = generator.generate(PRESETS.intermediate, 77);
    generator.generate(PRESETS.expert, 1);
    generator.generate(PRESETS.beginner, 2);
    const after = generator.generate(PRESETS.intermediate, 77);
    expect(minesOf(after.board)).toEqual(minesOf(before.board));
    expect(after.opening).toEqual(before.opening);
  });

  it('gives different boards for different seeds (almost always)', () => {
    const layouts = Array.from({ length: 50 }, (_, seed) =>
      minesOf(generator.generate(PRESETS.beginner, seed).board).join(','),
    );
    expect(new Set(layouts).size).toBeGreaterThanOrEqual(49);
  });
});

describe('SeededBoardGenerator: the board and its opening', () => {
  it('has exactly mineCount mines, and the board carries the config it was made for', () => {
    for (const config of Object.values(PRESETS)) {
      for (const seed of SEEDS) {
        const { board } = generator.generate(config, seed);
        expect(minesOf(board)).toHaveLength(config.mineCount);
        expect(board.config).toEqual(config);
      }
    }
  });

  it('opens on a safe cell that shows 0, with no mine anywhere in its zone', () => {
    for (const config of Object.values(PRESETS)) {
      for (const seed of SEEDS) {
        const generated = generator.generate(config, seed);
        const cell = openingCell(generated);
        const { board } = generated;
        expect(board.isMine(cell)).toBe(false);
        expect(board.adjacentMines(cell)).toBe(0);
        for (const inZone of zoneOf(board, cell)) expect(board.isMine(inZone)).toBe(false);
      }
    }
  });

  it('cascades: revealing the opening cell opens more than one cell, the opening cell first', () => {
    for (const config of Object.values(PRESETS)) {
      for (const seed of SEEDS) {
        const generated = generator.generate(config, seed);
        const cell = openingCell(generated);
        const events = new Game(generated.board).apply({ type: 'reveal', index: cell, t: 0 });
        const first = events[0];
        if (first?.type !== 'cellsRevealed')
          throw new Error('expected a cellsRevealed event first');
        expect(first.cells.length).toBeGreaterThan(1);
        expect(first.cells[0]).toEqual({ index: cell, value: 0 });
      }
    }
  });

  it('hands back frozen results, so a caller cannot change what the next caller sees', () => {
    const generated = generator.generate(PRESETS.beginner, 5);
    expect(Object.isFrozen(generated)).toBe(true);
    expect(Object.isFrozen(generated.opening)).toBe(true);
  });

  it('does not keep or change the config it was given', () => {
    const config = { width: 9, height: 9, mineCount: 10 };
    const { board } = generator.generate(config, 5);
    config.mineCount = 3;
    expect(board.config.mineCount).toBe(10);
  });

  it('never fails on the expert preset, whatever the seed (100 random seeds)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: UINT32_MAX }), (seed) => {
        const generated = generator.generate(PRESETS.expert, seed);
        const cell = openingCell(generated);
        expect(minesOf(generated.board)).toHaveLength(99);
        expect(generated.board.adjacentMines(cell)).toBe(0);
        expect(generated.board.isMine(cell)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

// Why this property: it pins the rule that the error depends on the config alone, never on the seed. The
// smallest opening zone of a board is `min(width, 2) * min(height, 2)` cells (a corner), so a config is
// possible exactly when the mines fit in the other cells.
describe('SeededBoardGenerator: which configs are possible', () => {
  const configArbitrary = fc
    .record({ width: fc.integer({ min: 1, max: 12 }), height: fc.integer({ min: 1, max: 12 }) })
    .chain(({ width, height }) =>
      fc.record({
        width: fc.constant(width),
        height: fc.constant(height),
        mineCount: fc.integer({ min: 0, max: width * height - 1 }),
      }),
    );

  it('works for every seed when the mines fit around the smallest zone, and for no seed when they do not', () => {
    fc.assert(
      fc.property(configArbitrary, fc.integer({ min: 0, max: UINT32_MAX }), (config, seed) => {
        const smallestZone = Math.min(config.width, 2) * Math.min(config.height, 2);
        const fits = config.mineCount <= cellCount(config) - smallestZone;
        if (!fits) {
          expect(() => generator.generate(config, seed)).toThrow(/^mineCount/);
          return;
        }
        const generated = generator.generate(config, seed);
        const cell = openingCell(generated);
        expect(minesOf(generated.board)).toHaveLength(config.mineCount);
        expect(generated.board.isMine(cell)).toBe(false);
        expect(generated.board.adjacentMines(cell)).toBe(0);
      }),
      { numRuns: 1000 },
    );
  });
});

describe('SeededBoardGenerator: extreme configs (Review Focus #4)', () => {
  it('9x9 with 77 mines works for every seed, and the opening is always a corner', () => {
    const config = { width: 9, height: 9, mineCount: 77 };
    for (let seed = 0; seed < 100; seed += 1) {
      const generated = generator.generate(config, seed);
      expect([0, 8, 72, 80]).toContain(openingCell(generated));
      expect(minesOf(generated.board)).toHaveLength(77);
    }
  });

  it('9x9 with 78 mines is rejected with a clear error, at once', () => {
    expect(() => generator.generate({ width: 9, height: 9, mineCount: 78 }, 1)).toThrow(
      InvalidBoardConfigError,
    );
    expect(() => generator.generate({ width: 9, height: 9, mineCount: 78 }, 1)).toThrow(
      /^mineCount .*at most 77/,
    );
  });

  it('a 1x1 board with no mines is valid: the opening is its only cell', () => {
    const generated = generator.generate({ width: 1, height: 1, mineCount: 0 }, 9);
    expect(generated.opening).toEqual([0]);
    expect(minesOf(generated.board)).toEqual([]);
  });

  it('a 2x2 board is valid with no mines and rejected with one', () => {
    expect(minesOf(generator.generate({ width: 2, height: 2, mineCount: 0 }, 1).board)).toEqual([]);
    expect(() => generator.generate({ width: 2, height: 2, mineCount: 1 }, 1)).toThrow(
      /^mineCount/,
    );
  });

  it.each([
    ['one row', { width: 5, height: 1, mineCount: 3 }],
    ['one column', { width: 1, height: 5, mineCount: 3 }],
  ])(
    'a board with %s is valid while the mines fit, and the opening is an end cell',
    (_name, config) => {
      for (let seed = 0; seed < 50; seed += 1) {
        const generated = generator.generate(config, seed);
        expect([0, 4]).toContain(openingCell(generated));
        expect(minesOf(generated.board)).toHaveLength(3);
        expect(generated.board.adjacentMines(openingCell(generated))).toBe(0);
      }
    },
  );

  it.each([
    ['one row', { width: 5, height: 1, mineCount: 4 }],
    ['one column', { width: 1, height: 5, mineCount: 4 }],
  ])('a board with %s is rejected when there is no room for the opening', (_name, config) => {
    expect(() => generator.generate(config, 1)).toThrow(/^mineCount/);
  });

  it('largest legal board with a typical density generates without trouble', () => {
    const generated = generator.generate({ width: 100, height: 100, mineCount: 2000 }, 8);
    expect(minesOf(generated.board)).toHaveLength(2000);
    expect(generated.board.adjacentMines(openingCell(generated))).toBe(0);
  });
});

describe('SeededBoardGenerator: bad input', () => {
  it.each([-1, 1.5, 4294967296, Number.NaN, Number.POSITIVE_INFINITY])(
    'seed %s throws RangeError naming the seed',
    (seed) => {
      expect(() => generator.generate(PRESETS.beginner, seed)).toThrow(RangeError);
      expect(() => generator.generate(PRESETS.beginner, seed)).toThrow(/^seed/);
    },
  );

  it('an invalid config throws InvalidBoardConfigError naming the field', () => {
    expect(() => generator.generate({ width: 0, height: 9, mineCount: 1 }, 1)).toThrow(/^width/);
    expect(() => generator.generate({ width: 9, height: 9, mineCount: -1 }, 1)).toThrow(
      /^mineCount/,
    );
  });

  it('checks the config before the seed', () => {
    expect(() => generator.generate({ width: 0, height: 9, mineCount: 1 }, -1)).toThrow(
      InvalidBoardConfigError,
    );
  });
});

describe('SeededBoardGenerator: a different opening policy', () => {
  it('uses the opening that its policy picks, and keeps that whole zone free of mines', () => {
    const fixed = new SeededBoardGenerator({ select: () => [40] });
    for (let seed = 0; seed < 30; seed += 1) {
      const generated = fixed.generate(PRESETS.beginner, seed);
      expect(generated.opening).toEqual([40]);
      for (const cell of [30, 31, 32, 39, 40, 41, 48, 49, 50]) {
        expect(generated.board.isMine(cell)).toBe(false);
      }
      expect(minesOf(generated.board)).toHaveLength(10);
    }
  });

  it('keeps the zones of several opening cells free of mines', () => {
    const two = new SeededBoardGenerator({ select: () => [0, 80] });
    const { board } = two.generate(PRESETS.beginner, 4);
    for (const cell of [0, 1, 9, 10, 70, 71, 79, 80]) expect(board.isMine(cell)).toBe(false);
  });

  it('rejects an opening whose zone leaves too few cells, and does not hang', () => {
    const tooBig = new SeededBoardGenerator({ select: () => [4] });
    expect(() => tooBig.generate({ width: 3, height: 3, mineCount: 5 }, 1)).toThrow(
      InvalidBoardConfigError,
    );
    expect(() => tooBig.generate({ width: 3, height: 3, mineCount: 5 }, 1)).toThrow(/^mineCount/);
  });

  it('the default policy is a SafeOpeningPolicy', () => {
    const explicit = new SeededBoardGenerator(new SafeOpeningPolicy());
    const a = explicit.generate(PRESETS.beginner, 21);
    const b = generator.generate(PRESETS.beginner, 21);
    expect(minesOf(a.board)).toEqual(minesOf(b.board));
    expect(a.opening).toEqual(b.opening);
  });

  it('can be used wherever a BoardGenerator is expected', () => {
    const asInterface: BoardGenerator = generator;
    expect(asInterface.generate(PRESETS.beginner, 1).board.config).toEqual(PRESETS.beginner);
  });
});

// A second, deliberately plain implementation of the contract written from the task text: coordinates and
// arrays, no Board and no policy class. It catches a slip in the real one, such as a changed draw order or a
// zone that is one cell too small. (The PRNG itself is pinned by its own golden vectors.)
describe('SeededBoardGenerator against a plain reference of the contract', () => {
  type Outcome = { readonly opening: number[]; readonly mines: number[] } | 'rejected';

  function reference(config: BoardConfig, seed: number): Outcome {
    const { width, height, mineCount } = config;
    const total = width * height;
    const zoneOfCell = (cell: number): number[] => {
      const x = cell % width;
      const y = Math.floor(cell / width);
      const zone: number[] = [];
      for (let ny = y - 1; ny <= y + 1; ny += 1) {
        for (let nx = x - 1; nx <= x + 1; nx += 1) {
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) zone.push(ny * width + nx);
        }
      }
      return zone;
    };
    const candidates = Array.from({ length: total }, (_, cell) => cell).filter(
      (cell) => total - zoneOfCell(cell).length >= mineCount,
    );
    if (candidates.length === 0) return 'rejected';
    const prng = createPrng(seed);
    const center = candidates[prng.nextInt(candidates.length)] as number;
    const zone = new Set(zoneOfCell(center));
    const pool = Array.from({ length: total }, (_, cell) => cell).filter((cell) => !zone.has(cell));
    for (let taken = 0; taken < mineCount; taken += 1) {
      const swapWith = taken + prng.nextInt(pool.length - taken);
      const kept = pool[swapWith] as number;
      pool[swapWith] = pool[taken] as number;
      pool[taken] = kept;
    }
    return { opening: [center], mines: pool.slice(0, mineCount).sort((a, b) => a - b) };
  }

  const CONFIGS: BoardConfig[] = [
    ...Object.values(PRESETS),
    { width: 9, height: 9, mineCount: 73 },
    { width: 9, height: 9, mineCount: 77 },
    { width: 9, height: 9, mineCount: 78 },
    { width: 3, height: 3, mineCount: 5 },
    { width: 3, height: 3, mineCount: 6 },
    { width: 5, height: 1, mineCount: 3 },
    { width: 1, height: 5, mineCount: 4 },
    { width: 2, height: 2, mineCount: 0 },
    { width: 2, height: 2, mineCount: 1 },
    { width: 1, height: 1, mineCount: 0 },
    { width: 30, height: 16, mineCount: 0 },
    { width: 30, height: 16, mineCount: 471 },
  ];

  it.each(CONFIGS)('matches the reference: $width x $height with $mineCount mines', (config) => {
    for (let seed = 0; seed < 150; seed += 1) {
      const expected = reference(config, seed);
      if (expected === 'rejected') {
        expect(() => generator.generate(config, seed)).toThrow(InvalidBoardConfigError);
        continue;
      }
      const generated = generator.generate(config, seed);
      expect(generated.opening).toEqual(expected.opening);
      expect(minesOf(generated.board)).toEqual(expected.mines);
    }
  });
});

// A loose sanity check, not a statistical proof: it would catch a generator that favors a corner, forgets a
// row, or always opens in the same place. The opening zone keeps mines away from the opening, so the
// frequencies are not exactly equal; the bounds leave room for that.
describe('SeededBoardGenerator: distribution', () => {
  const RUNS = 20000;
  const config = PRESETS.beginner;

  it('puts mines on every cell at about the same rate, and opens in every cell about equally often', () => {
    const mineHits = new Array<number>(cellCount(config)).fill(0);
    const openingHits = new Array<number>(cellCount(config)).fill(0);
    for (let seed = 0; seed < RUNS; seed += 1) {
      const generated = generator.generate(config, seed);
      const cell = openingCell(generated);
      openingHits[cell] = (openingHits[cell] ?? 0) + 1;
      for (const mine of minesOf(generated.board)) mineHits[mine] = (mineHits[mine] ?? 0) + 1;
    }
    const expectedMine = (RUNS * config.mineCount) / cellCount(config);
    const expectedOpening = RUNS / cellCount(config);
    mineHits.forEach((hits) => {
      expect(hits).toBeGreaterThan(expectedMine * 0.75);
      expect(hits).toBeLessThan(expectedMine * 1.25);
    });
    openingHits.forEach((hits) => {
      expect(hits).toBeGreaterThan(expectedOpening * 0.7);
      expect(hits).toBeLessThan(expectedOpening * 1.3);
    });
  });
});
