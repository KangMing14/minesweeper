// Runs only the tests affected by the commits about to be pushed (used by the pre-push hook).
// Usage: `node scripts/test-affected.mjs` (or `pnpm test:affected`). CI runs the full suite instead.
//
// How it works: `vitest --changed origin/main` selects the test files whose module graph contains a file
// that differs from `origin/main`. Changes to Vitest or package config files re-run everything (Vitest's
// own rule). Without an `origin/main` (a fresh clone with no fetch, or a different remote name) the whole
// suite runs, which is slower but never skips tests.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vitest = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');
const BASE = 'origin/main';

const hasBase =
  spawnSync('git', ['rev-parse', '--verify', '--quiet', `${BASE}^{commit}`], { cwd: root })
    .status === 0;

// Launched with `node <script>` instead of through pnpm, because the pnpm shim can be broken on some
// Windows setups (seen in M0-T02).
const args = hasBase ? ['run', '--changed', BASE] : ['run'];
console.log(
  hasBase
    ? `[test:affected] running tests affected by changes since ${BASE}`
    : `[test:affected] ${BASE} not found: running the whole suite`,
);
const result = spawnSync(process.execPath, [vitest, ...args], { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
