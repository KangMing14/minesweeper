// Vitest configuration for the tests that need a real browser (M2-T06). Run `pnpm test:browser`.
// Why a second config and not a project in `vitest.config.ts`: `pnpm test` and the `pre-push` hook must work on
// a machine without Chromium. CI runs this one as its own step, after `pnpm exec playwright install chromium`.
// Locally, install the browser once with `pnpm exec playwright install chromium`.
// Chromium only (the task): the claim under test is that the engine gives the same games in Node and in a real
// browser engine, not that it is portable to every browser.
import { playwright } from '@vitest/browser-playwright';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'engine-browser',
    root: fileURLToPath(new URL('./packages/engine', import.meta.url)),
    // Only the browser runners. The suite itself is `test/determinism.shared.ts`, shared with the Node runner.
    include: ['test/**/*.browser.test.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
});
