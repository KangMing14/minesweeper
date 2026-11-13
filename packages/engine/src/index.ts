// Public API of @minesweeper/engine. M1-T01 starts the real surface; M1-T07 locks it with a test.
// The engine must stay free of DOM, Node APIs, clocks and Math.random (spec section 4.1), which is why its
// tsconfig has no DOM lib and no ambient @types.

export type { BoardConfig, CellIndex } from './config.js';
export { PRESETS, cellCount, safeCellCount, validateBoardConfig } from './config.js';
export { InvalidBoardConfigError } from './errors.js';

// TODO(M1-T07): remove the M0 sample together with `sample.ts` and `sample.test.ts`.
export { m0SampleAdd } from './sample.js';
