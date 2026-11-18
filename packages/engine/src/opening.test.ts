import { describe, expect, it } from 'vitest';
import type { BoardConfig, CellIndex } from './config.js';
import { cellCount } from './config.js';
import { InvalidBoardConfigError } from './errors.js';
import { SafeOpeningPolicy, openingZone } from './opening.js';
import { createPrng } from './prng.js';

const policy = new SafeOpeningPolicy();

const BEGINNER: BoardConfig = { width: 9, height: 9, mineCount: 10 };

/** True when the cell is not on the border of a `width` x `height` board. */
const isInterior = (index: CellIndex, { width, height }: BoardConfig): boolean => {
  const x = index % width;
  const y = Math.floor(index / width);
  return x > 0 && x < width - 1 && y > 0 && y < height - 1;
};

/** The cell the policy picks for each of the seeds 0..count-1. */
const picksFor = (config: BoardConfig, count: number): CellIndex[] =>
  Array.from({ length: count }, (_, seed) => {
    const picked = policy.select(config, createPrng(seed));
    expect(picked).toHaveLength(1);
    return picked[0] as CellIndex;
  });

describe('SafeOpeningPolicy.select', () => {
  it('returns one cell inside the board, in a frozen list', () => {
    const picked = policy.select(BEGINNER, createPrng(7));
    expect(picked).toHaveLength(1);
    expect(Object.isFrozen(picked)).toBe(true);
    const [cell] = picked;
    expect(Number.isInteger(cell)).toBe(true);
    expect(cell).toBeGreaterThanOrEqual(0);
    expect(cell).toBeLessThan(cellCount(BEGINNER));
  });

  it('is decided by the generator state alone: the same seed picks the same cell', () => {
    expect(policy.select(BEGINNER, createPrng(99))).toEqual(
      policy.select(BEGINNER, createPrng(99)),
    );
    expect(picksFor(BEGINNER, 40)).toEqual(picksFor(BEGINNER, 40));
  });

  it('draws exactly one nextInt over every cell when the board is loose (the draw order is a contract)', () => {
    const used = createPrng(5);
    policy.select(BEGINNER, used);
    const reference = createPrng(5);
    reference.nextInt(cellCount(BEGINNER));
    expect(used.nextUint32()).toBe(reference.nextUint32());
  });

  it('can pick any cell of a loose board, corners and edges included', () => {
    const picks = new Set(picksFor(BEGINNER, 3000));
    expect(picks.size).toBe(cellCount(BEGINNER));
  });

  describe('on a board where the mines leave room only for a small opening', () => {
    it('9x9 with 73 mines: never an interior cell, whose zone of 9 would leave 72', () => {
      const config = { width: 9, height: 9, mineCount: 73 };
      const picks = picksFor(config, 400);
      expect(picks.some((cell) => isInterior(cell, config))).toBe(false);
      expect(picks.some((cell) => !isInterior(cell, config))).toBe(true);
    });

    it('9x9 with 77 mines: only the four corners, whose zone of 4 leaves exactly 77', () => {
      const picks = new Set(picksFor({ width: 9, height: 9, mineCount: 77 }, 400));
      expect([...picks].sort((a, b) => a - b)).toEqual([0, 8, 72, 80]);
    });

    it('3x3 with 5 mines: only corners', () => {
      const picks = new Set(picksFor({ width: 3, height: 3, mineCount: 5 }, 200));
      expect([...picks].sort((a, b) => a - b)).toEqual([0, 2, 6, 8]);
    });

    it.each([
      ['5 wide, 1 high', { width: 5, height: 1, mineCount: 3 }, [0, 4]],
      ['1 wide, 5 high', { width: 1, height: 5, mineCount: 3 }, [0, 4]],
      ['2 wide, 1 high with no mines', { width: 2, height: 1, mineCount: 0 }, [0, 1]],
    ] as const)(
      '%s: only the end cells fit when the mines need the room',
      (_name, config, expected) => {
        const picks = new Set(picksFor(config, 200));
        expect([...picks].sort((a, b) => a - b)).toEqual([...expected]);
      },
    );

    it('1x1 with no mines: the single cell', () => {
      expect(policy.select({ width: 1, height: 1, mineCount: 0 }, createPrng(3))).toEqual([0]);
    });
  });

  describe('rejects a config that leaves too few cells for a safe opening', () => {
    it.each([
      [
        '9x9 with 78 mines (the smallest zone is a corner of 4)',
        { width: 9, height: 9, mineCount: 78 },
        77,
      ],
      ['9x9 with 80 mines (legal for the basic check)', { width: 9, height: 9, mineCount: 80 }, 77],
      ['3x3 with 6 mines', { width: 3, height: 3, mineCount: 6 }, 5],
      ['2x2 with 1 mine', { width: 2, height: 2, mineCount: 1 }, 0],
      ['5x1 with 4 mines (an end cell has a zone of 2)', { width: 5, height: 1, mineCount: 4 }, 3],
      ['1x5 with 4 mines', { width: 1, height: 5, mineCount: 4 }, 3],
      ['2x1 with 1 mine', { width: 2, height: 1, mineCount: 1 }, 0],
    ] as const)('%s', (_name, config, mostAllowed) => {
      const prng = createPrng(11);
      let caught: unknown;
      try {
        policy.select(config, prng);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(InvalidBoardConfigError);
      const reason = (caught as InvalidBoardConfigError).reason;
      expect(reason.startsWith('mineCount')).toBe(true);
      expect(reason).toContain(`at most ${String(mostAllowed)}`);
      // A rejected config must not move the generator: a caught mistake cannot desynchronize a replay.
      expect(prng.nextUint32()).toBe(createPrng(11).nextUint32());
    });

    it('1x1 with 1 mine is already rejected by the basic check, with the same kind of error', () => {
      const prng = createPrng(11);
      expect(() => policy.select({ width: 1, height: 1, mineCount: 1 }, prng)).toThrow(
        InvalidBoardConfigError,
      );
      expect(prng.nextUint32()).toBe(createPrng(11).nextUint32());
    });

    it('checks the basic config rules first and names the first bad field', () => {
      const prng = createPrng(11);
      expect(() => policy.select({ width: 0, height: 9, mineCount: 1 }, prng)).toThrow(/^width/);
      expect(prng.nextUint32()).toBe(createPrng(11).nextUint32());
    });
  });
});

describe('openingZone (internal)', () => {
  const THREE: BoardConfig = { width: 3, height: 3, mineCount: 0 };

  it('is the opening cell plus every neighbor that exists', () => {
    expect([...openingZone(THREE, [0])].sort((a, b) => a - b)).toEqual([0, 1, 3, 4]);
    expect([...openingZone(THREE, [1])].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
    expect([...openingZone(THREE, [4])].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('is the union of the zones when there are several opening cells', () => {
    const zone = openingZone({ width: 9, height: 9, mineCount: 0 }, [0, 80]);
    expect([...zone].sort((a, b) => a - b)).toEqual([0, 1, 9, 10, 70, 71, 79, 80]);
  });

  it('is just the cell on a one-cell board, and empty for no opening cells', () => {
    expect([...openingZone({ width: 1, height: 1, mineCount: 0 }, [0])]).toEqual([0]);
    expect(openingZone(THREE, []).size).toBe(0);
  });

  it('throws RangeError for a cell outside the board', () => {
    expect(() => openingZone(THREE, [9])).toThrow(RangeError);
    expect(() => openingZone(THREE, [-1])).toThrow(RangeError);
    expect(() => openingZone(THREE, [1.5])).toThrow(RangeError);
  });
});
