// Vitest configuration: one project per workspace package (spec section 5, M0-T04).
// Why `test.projects` and not a `vitest.workspace.ts` file: workspace files were removed in Vitest 4, and
// this repository pins Vitest 5. Run `pnpm test` (all projects), `pnpm test:coverage` or `pnpm test:affected`.
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

/** Absolute path of a repository-relative file, independent of the directory Vitest is started in. */
const fromRoot = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

// Name and directory of every workspace package. The project name is what `vitest --project <name>` accepts.
const PROJECTS = [
  { name: 'engine', dir: 'packages/engine' },
  { name: 'protocol', dir: 'packages/protocol' },
  { name: 'server', dir: 'apps/server' },
  { name: 'web', dir: 'apps/web' },
] as const;

/**
 * Settings that only some projects need. `web` runs component tests, so it gets a DOM (jsdom) and a setup
 * file that cleans up after each test (M3-T01). The other projects stay on plain Node.
 */
const PROJECT_OVERRIDES: Record<string, { environment: 'jsdom'; setupFiles: string[] }> = {
  web: { environment: 'jsdom', setupFiles: [fromRoot('./apps/web/test/setup.ts')] },
};

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
    // M2-T10: writes the fuzz digest of the Node run to `reports/fuzz-digest/node.json`; the Chromium run does the
    // same from `vitest.browser.config.ts`, and `scripts/compare-fuzz-digests.mjs` compares the two files in CI.
    reporters: [
      'default',
      [
        fromRoot('./tools/fuzz-digest-reporter.mjs'),
        { environment: 'node', outputDir: fromRoot('./reports/fuzz-digest') },
      ],
    ],
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
        ...PROJECT_OVERRIDES[name],
        // The browser runner of the determinism suite (M2-T06) needs Chromium, so it has its own config and
        // script (`pnpm test:browser`, `vitest.browser.config.ts`) and stays out of `pnpm test` and `pre-push`.
        exclude: [...configDefaults.exclude, '**/*.browser.test.ts'],
      },
    })),
    coverage: {
      provider: 'v8',
      // `text` for the terminal, `json-summary` and `lcov` for tools and the CI artifact.
      reporter: ['text', 'json-summary', 'lcov'],
      reportsDirectory: fromRoot('./coverage'),
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.{ts,tsx}'],
      // `index.ts` barrels only re-export: they hold no logic to cover. What they export is guarded by the
      // API-surface test of each package (engine: M1-T07), which is a better check than a coverage number.
      exclude: ['**/*.{test,spec}.{ts,tsx}', '**/*.d.ts', '**/dist/**', '**/src/index.ts'],
      // Thresholds, set by M1-T07 as the M1 acceptance asks (high branch coverage of the engine). They apply
      // to `packages/engine` only: the other packages have no real code yet, so add an entry for each when it
      // does. Why these numbers: every engine file was at 100% when they were set, so 90% branches and 95% for
      // the rest leave room for a defensive branch or two but fail a task that ships logic without a test.
      // Changing a number is a deliberate edit of this file, explained in the pull request.
      thresholds: {
        'packages/engine/src/**/*.ts': {
          statements: 95,
          branches: 90,
          functions: 95,
          lines: 95,
        },
      },
    },
  },
});
