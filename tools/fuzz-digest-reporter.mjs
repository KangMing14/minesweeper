// A Vitest reporter that writes the fuzz digest of a determinism run to a file (M2-T10, review M5).
//
// The determinism suite (`packages/engine/test/determinism.shared.ts`) puts `{ mode, games, digest }` in the
// meta of two tests per run. Meta is the one channel that works the same for the Node runner and for the
// Chromium runner, because Vitest carries it to the process that runs the reporter. The engine's tests may not
// touch the file system, so this reporter does it: `reports/fuzz-digest/<environment>.json`, which
// `scripts/compare-fuzz-digests.mjs` compares in CI.
//
// Options: `environment` (`node` or `browser`) and `outputDir` (absolute). A run that has no digest test (a
// partial run of other files) leaves the files alone. A run whose digest tests did not all pass removes a stale
// file, so an old digest can never be compared with a new one.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReport } from '../scripts/compare-fuzz-digests.mjs';

/** Reporter class loaded by Vitest from its path. */
export default class FuzzDigestReporter {
  /** @param {{ environment: string; outputDir: string }} options Where this run is and where to write. */
  constructor(options) {
    this.environment = options.environment;
    this.outputDir = options.outputDir;
    this.entries = [];
    this.seen = 0;
  }

  /** @param {import('vitest/node').TestCase} testCase A finished test. */
  onTestCaseResult(testCase) {
    const entry = testCase.meta().fuzzDigest;
    if (entry === undefined) return;
    this.seen += 1;
    if (testCase.result().state === 'passed') this.entries.push(entry);
  }

  /** Writes the report once the run is over. */
  onTestRunEnd() {
    if (this.seen === 0) return;
    const file = join(this.outputDir, `${this.environment}.json`);
    try {
      const report = buildReport(this.environment, this.entries);
      mkdirSync(this.outputDir, { recursive: true });
      writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    } catch (error) {
      rmSync(file, { force: true });
      console.error(
        `fuzz digest not written: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
