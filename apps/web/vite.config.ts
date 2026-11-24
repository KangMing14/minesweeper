// Vite configuration for the browser client (M3-T01). Vitest does not read this file: the `web` project of the
// root `vitest.config.ts` has its own settings.
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/** Absolute path of a file relative to this one. */
const fromHere = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Same reason as in the root vitest.config.ts: `exports` of the workspace packages point at `dist/`, which
    // does not exist on a fresh clone. Resolving to the source lets `pnpm --filter web dev` and `build` run
    // without a prior `tsc -b`. Types still come from `dist/`.
    alias: [
      {
        find: /^@minesweeper\/engine$/,
        replacement: fromHere('../../packages/engine/src/index.ts'),
      },
      {
        find: /^@minesweeper\/protocol$/,
        replacement: fromHere('../../packages/protocol/src/index.ts'),
      },
    ],
  },
});
