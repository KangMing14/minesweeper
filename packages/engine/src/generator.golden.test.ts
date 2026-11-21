import { describe, expect, it } from 'vitest';
import golden from '../fixtures/boards.json' with { type: 'json' };
import type { CellIndex } from './config.js';
import { cellCount } from './config.js';
import { sha256Hex } from '../test/determinism.support.js';
import { SeededBoardGenerator } from './generator.js';

// `sha256Hex` lives in the determinism test support (M2-T06), because the same hash runs in the browser suite.

/** The text that the fixture hashes: the mine indices in ascending order, joined by commas. */
const hashInput = (mines: readonly CellIndex[]): string => mines.join(',');

// The board that a seed gives is a stable contract (ADR-002): stored replays, ghosts and shared races rebuild
// the board from `(config, seed)`. These entries pin 22 boards. A failure here means that the layout or the
// opening for an existing seed changed. Do not update the fixture to make it pass: a change needs a new
// generator version and an ADR (see DECISIONS.md, "Generator stability").
describe('SeededBoardGenerator: golden boards', () => {
  const generator = new SeededBoardGenerator();

  it.each(golden.boards)(
    '$name, seed $seed: opening and mine hash are the committed ones',
    (entry) => {
      const { board, opening } = generator.generate(entry.config, entry.seed);
      const mines = Array.from({ length: cellCount(board.config) }, (_, index) => index).filter(
        (index) => board.isMine(index),
      );
      expect(mines).toHaveLength(entry.config.mineCount);
      expect(opening).toEqual(entry.opening);
      expect(sha256Hex(hashInput(mines))).toBe(entry.minesSha256);
    },
  );

  it('covers the three presets with several seeds each, and the extreme boards', () => {
    const names = new Set(golden.boards.map((entry) => entry.name));
    for (const name of ['beginner', 'intermediate', 'expert']) expect(names.has(name)).toBe(true);
    expect(golden.boards.length).toBeGreaterThanOrEqual(20);
    for (const preset of ['beginner', 'intermediate', 'expert']) {
      const seeds = golden.boards
        .filter((entry) => entry.name === preset)
        .map((entry) => entry.seed);
      expect(new Set(seeds).size).toBeGreaterThanOrEqual(6);
    }
    expect(golden.hashInput).toBe('ascending mine indices joined by a comma');
  });
});
