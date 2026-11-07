// Vitest configuration: one project per workspace package (spec section 5, M0-T04).
// Why `test.projects` and not a `vitest.workspace.ts` file: workspace files were removed in Vitest 4, and
// this repository pins Vitest 5. Run `pnpm test` (all projects), `pnpm test:coverage` or `pnpm test:affected`.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Absolute path of a repository-relative file, independent of the directory Vitest is started in. */
const fromRoot = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

// Name and directory of every workspace package. The project name is what `vitest --project <name>` accepts.
const PROJECTS = [
  { name: 'engine', dir: 'packages/engine' },
  { name: 'protocol', dir: 'packages/protocol' },
  { name: 'server', dir: 'apps/server' },
  { name: 'web', dir: 'apps/web' },
] as const;

export default defineConfig({
  resolve: {
    // Why aliases: package.json `exports` point at `dist/`, which only exists after `tsc -b`. Resolving the
    // workspace packages to their source lets tests run on a fresh clone, and lets `--changed` see that a
    // change in `engine` affects tests in `protocol` and the apps. Types still come from the built `dist/`.
    alias: [
      {
        find: /^@minesweeper\/engine$/,
        replacement: fromRoot('./packages/engine/src/index.ts'),
      },
      {
        find: /^@minesweeper\/protocol$/,
        replacement: fromRoot('./packages/protocol/src/index.ts'),
      },
    ],
  },
  test: {
    // A package without tests yet (both apps until M3 and M5) must not fail the run.
    passWithNoTests: true,
    projects: PROJECTS.map(({ name, dir }) => ({
      extends: true,
      test: {
        name,
        root: fromRoot(`./${dir}`),
        // `src/` holds unit tests next to the code; `test/` holds shared and integration tests (M2, M6).
        // Playwright specs live in `e2e/` (M3-T08) and are deliberately not matched here.
        include: ['src/**/*.{test,spec}.{ts,tsx}', 'test/**/*.{test,spec}.{ts,tsx}'],
        environment: 'node',
      },
    })),
    coverage: {
      provider: 'v8',
      // `text` for the terminal, `json-summary` and `lcov` for tools and the CI artifact.
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: fromRoot('./coverage'),
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.{ts,tsx}'],
      exclude: ['**/*.{test,spec}.{ts,tsx}', '**/*.d.ts', '**/dist/**'],
      // No thresholds yet: there is no real code to measure. M1 sets them (its acceptance asks for high
      // branch coverage of the engine).
    },
  },
});
