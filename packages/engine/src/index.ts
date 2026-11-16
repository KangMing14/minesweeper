// Public API of @minesweeper/engine: the one entry point other packages import (`exports` in package.json).
// Everything here is a canonical name (ARCHITECTURE.md, "Canonical names"); anything not listed is internal
// to the engine. M1-T07 locked this surface: `api-surface.test.ts` compares it with the committed snapshot
// `__snapshots__/api-surface.txt`, so adding, removing or reshaping an export is a visible change in review.
// A new name is added here by the task that creates it, together with a snapshot update (`vitest -u`).
// The engine must stay free of DOM, Node APIs, clocks and Math.random (spec section 4.1), which is why its
// tsconfig has no DOM lib and no ambient @types.

export { Board } from './board.js';
export type { Command } from './command.js';
export type { BoardConfig, CellIndex } from './config.js';
export { PRESETS, cellCount, safeCellCount, validateBoardConfig } from './config.js';
export { InvalidBoardConfigError } from './errors.js';
export type { CellsRevealed, FlagToggled, GameEvent, GameLost, GameWon } from './events.js';
export { Game } from './game.js';
export type { CellView, GameStatus, GameView } from './view.js';
