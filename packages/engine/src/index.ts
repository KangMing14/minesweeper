// Public API of @minesweeper/engine. M1-T01 started the real surface (config), M1-T02 adds Board; M1-T07 locks it with a test.
// The engine must stay free of DOM, Node APIs, clocks and Math.random (spec section 4.1), which is why its
// tsconfig has no DOM lib and no ambient @types.

export { Board } from './board.js';
export type { BoardConfig, CellIndex } from './config.js';
export { PRESETS, cellCount, safeCellCount, validateBoardConfig } from './config.js';
export { InvalidBoardConfigError } from './errors.js';

// TODO(M1-T07): remove the M0 sample together with `sample.ts` and `sample.test.ts`.
export { m0SampleAdd } from './sample.js';
