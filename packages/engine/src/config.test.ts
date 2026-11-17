import { describe, expect, it } from 'vitest';
import {
  PRESETS,
  cellCount,
  safeCellCount,
  validateBoardConfig,
  type BoardConfig,
  type CellIndex,
} from './config.js';
import { InvalidBoardConfigError } from './errors.js';

type Field = 'width' | 'height' | 'mineCount';

/**
 * Asserts that `validateBoardConfig` rejects `config` with an `InvalidBoardConfigError` whose reason starts
 * with the name of the offending field. Starting with the field (not merely containing it) means an error
 * about the wrong field cannot satisfy the assertion by accident.
 */
function expectRejected(config: BoardConfig, field: Field): void {
  let caught: unknown;
  try {
    validateBoardConfig(config);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(InvalidBoardConfigError);
  const error = caught as InvalidBoardConfigError;
  expect(error.reason).toMatch(new RegExp(`^${field} `));
  expect(error.message).toBe(error.reason);
}

describe('CellIndex', () => {
  it('is a plain number, y * width + x', () => {
    const width = 9;
    const index: CellIndex = 2 * width + 4;
    expect(index).toBe(22);
  });
});

describe('PRESETS', () => {
  it('holds the three classic boards (D-01 working values)', () => {
    expect(PRESETS.beginner).toEqual({ width: 9, height: 9, mineCount: 10 });
    expect(PRESETS.intermediate).toEqual({ width: 16, height: 16, mineCount: 40 });
    expect(PRESETS.expert).toEqual({ width: 30, height: 16, mineCount: 99 });
  });

  it('lists exactly beginner, intermediate and expert', () => {
    expect(Object.keys(PRESETS)).toEqual(['beginner', 'intermediate', 'expert']);
  });

  it.each(['beginner', 'intermediate', 'expert'] as const)('%s passes validation', (name) => {
    expect(() => validateBoardConfig(PRESETS[name])).not.toThrow();
  });

  it('cannot be changed at runtime, so one game cannot alter the next', () => {
    expect(Object.isFrozen(PRESETS)).toBe(true);
    expect(Object.isFrozen(PRESETS.beginner)).toBe(true);
    expect(Object.isFrozen(PRESETS.intermediate)).toBe(true);
    expect(Object.isFrozen(PRESETS.expert)).toBe(true);
  });
});

describe('validateBoardConfig: accepted configs', () => {
  it('accepts a 1x1 board with 0 mines', () => {
    expect(() => validateBoardConfig({ width: 1, height: 1, mineCount: 0 })).not.toThrow();
  });

  it('accepts a 1xN board (one column)', () => {
    expect(() => validateBoardConfig({ width: 1, height: 10, mineCount: 3 })).not.toThrow();
  });

  it('accepts an Nx1 board (one row)', () => {
    expect(() => validateBoardConfig({ width: 10, height: 1, mineCount: 3 })).not.toThrow();
  });

  it('accepts zero mines on a large board', () => {
    expect(() => validateBoardConfig({ width: 30, height: 16, mineCount: 0 })).not.toThrow();
  });

  it('accepts the largest board: 100x100 with every cell but one mined', () => {
    expect(() => validateBoardConfig({ width: 100, height: 100, mineCount: 9999 })).not.toThrow();
  });

  it('accepts a mine count of cells minus one', () => {
    expect(() => validateBoardConfig({ width: 3, height: 3, mineCount: 8 })).not.toThrow();
  });
});

describe('validateBoardConfig: rejected dimensions', () => {
  const badSizes: readonly [string, number][] = [
    ['zero', 0],
    ['negative', -1],
    ['non-integer', 1.5],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['over the limit of 100', 101],
  ];

  it.each(badSizes)('rejects a %s width', (_label, value) => {
    expectRejected({ width: value, height: 9, mineCount: 0 }, 'width');
  });

  it.each(badSizes)('rejects a %s height', (_label, value) => {
    expectRejected({ width: 9, height: value, mineCount: 0 }, 'height');
  });

  it('puts the offending value and the allowed range in the message', () => {
    expect(() => validateBoardConfig({ width: 101, height: 9, mineCount: 0 })).toThrow(
      'width must be an integer from 1 to 100, got 101',
    );
  });
});

describe('validateBoardConfig: rejected mine counts', () => {
  it('rejects a mine count equal to the cell count (no safe cell would remain)', () => {
    expectRejected({ width: 9, height: 9, mineCount: 81 }, 'mineCount');
  });

  it('rejects a mine count above the cell count', () => {
    expectRejected({ width: 9, height: 9, mineCount: 500 }, 'mineCount');
  });

  it('rejects a 1x1 board with 1 mine', () => {
    expectRejected({ width: 1, height: 1, mineCount: 1 }, 'mineCount');
  });

  it('rejects a negative mine count', () => {
    expectRejected({ width: 9, height: 9, mineCount: -1 }, 'mineCount');
  });

  it('rejects a non-integer mine count', () => {
    expectRejected({ width: 9, height: 9, mineCount: 1.5 }, 'mineCount');
  });

  it('rejects a NaN mine count', () => {
    expectRejected({ width: 9, height: 9, mineCount: Number.NaN }, 'mineCount');
  });

  it('puts the offending value and the allowed range in the message', () => {
    expect(() => validateBoardConfig({ width: 9, height: 9, mineCount: 81 })).toThrow(
      'mineCount must be an integer from 0 to 80 (cells minus one), got 81',
    );
  });
});

describe('cellCount and safeCellCount', () => {
  it('count the cells and the non-mine cells of the presets', () => {
    expect(cellCount(PRESETS.beginner)).toBe(81);
    expect(safeCellCount(PRESETS.beginner)).toBe(71);
    expect(cellCount(PRESETS.intermediate)).toBe(256);
    expect(safeCellCount(PRESETS.intermediate)).toBe(216);
    expect(cellCount(PRESETS.expert)).toBe(480);
    expect(safeCellCount(PRESETS.expert)).toBe(381);
  });

  it('count a single-cell board', () => {
    const config = { width: 1, height: 1, mineCount: 0 };
    expect(cellCount(config)).toBe(1);
    expect(safeCellCount(config)).toBe(1);
  });

  it('count a non-square board by width times height, not width squared', () => {
    const config = { width: 5, height: 2, mineCount: 4 };
    expect(cellCount(config)).toBe(10);
    expect(safeCellCount(config)).toBe(6);
  });
});
