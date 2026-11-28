import { defineConfig, devices } from '@playwright/test';

// M3-T08. End-to-end tests in Chromium against the production build of the client (`vite preview`), not the
// dev server: the build is what ships. `pnpm test:e2e` builds first, so a stale `dist/` cannot be tested.
// The Chromium comes from `pnpm exec playwright install chromium`; `@playwright/test` must equal `playwright`.

const PORT = 4173;
const ORIGIN = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: process.env['CI'] !== undefined,
  // No retries: a test that passes only on the second try is a flaky test, and CI should say so.
  retries: 0,
  reporter: process.env['CI'] === undefined ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: ORIGIN,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm --filter @minesweeper/web build && pnpm --filter @minesweeper/web preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: ORIGIN,
    reuseExistingServer: process.env['CI'] === undefined,
    timeout: 180_000,
  },
});
