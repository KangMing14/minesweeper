// Compares the fuzz digests that the Node run and the Chromium run of the determinism suite wrote (M2-T10,
// review M5). Usage: `node scripts/compare-fuzz-digests.mjs [dir]` (default `reports/fuzz-digest`); it reads
// `node.json` and `browser.json` from `dir`, exits 0 when they agree and 1 otherwise.
//
// Why a file per environment and a separate step: the two runs are separate Vitest processes, and the
// engine's tests may not touch the file system (the engine is pure), so a reporter (`tools/`) writes the
// files and this script, which is not engine code, decides. A missing or malformed file is a failure, never a
// pass: a run that wrote nothing must not look like agreement.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIGEST = /^[0-9a-f]{64}$/;
const MODES = ['plain', 'stubbed'];

/**
 * Builds the report of one run from the entries its tests produced.
 *
 * @param {string} environment `node` or `browser`.
 * @param {ReadonlyArray<{ mode: string; games: unknown; digest: unknown }>} entries One entry per mode.
 * @returns {{ environment: string; games: number; digests: { plain: string; stubbed: string } }} The report.
 * @throws {Error} If a mode is missing, a digest or a game count is malformed, or the counts disagree.
 */
export function buildReport(environment, entries) {
  const digests = {};
  let games;
  for (const mode of MODES) {
    const entry = entries.find((candidate) => candidate.mode === mode);
    if (entry === undefined) throw new Error(`${environment}: no ${mode} entry`);
    if (typeof entry.digest !== 'string' || !DIGEST.test(entry.digest)) {
      throw new Error(`${environment}: the ${mode} digest is not 64 lower-case hex digits`);
    }
    if (!Number.isSafeInteger(entry.games) || entry.games < 1) {
      throw new Error(`${environment}: the ${mode} games is not a positive whole number`);
    }
    if (games !== undefined && games !== entry.games) {
      throw new Error(`${environment}: the modes played different numbers of games`);
    }
    games = entry.games;
    digests[mode] = entry.digest;
  }
  return { environment, games, digests };
}

/** Why a value is not a usable report of `environment`, or `undefined` when it is. */
function malformed(report, environment) {
  if (typeof report !== 'object' || report === null) return 'is not an object';
  if (report.environment !== environment) return `is not a report of the ${environment} run`;
  if (!Number.isSafeInteger(report.games) || report.games < 1) return 'has no valid games count';
  for (const mode of MODES) {
    const digest = report.digests?.[mode];
    if (typeof digest !== 'string' || !DIGEST.test(digest)) return `has no valid ${mode} digest`;
  }
  return undefined;
}

/**
 * Compares the reports of the Node run and the Chromium run.
 *
 * @param {unknown} node The report of the Node run.
 * @param {unknown} browser The report of the Chromium run.
 * @returns {string[]} The problems found; empty when all four digests are equal over the same games.
 */
export function compareReports(node, browser) {
  const problems = [];
  for (const [name, report] of [
    ['node', node],
    ['browser', browser],
  ]) {
    const reason = malformed(report, name);
    if (reason !== undefined) problems.push(`the ${name} report ${reason}`);
  }
  if (problems.length > 0) return problems;
  if (node.games !== browser.games) {
    problems.push(`node played ${node.games} games and browser ${browser.games}`);
  }
  for (const [name, report] of [
    ['node', node],
    ['browser', browser],
  ]) {
    if (report.digests.plain !== report.digests.stubbed) {
      problems.push(`${name}: the plain and stubbed digests differ`);
    }
  }
  for (const mode of MODES) {
    if (node.digests[mode] !== browser.digests[mode]) {
      problems.push(
        `the ${mode} digests of node and browser differ (${node.digests[mode]} against ${browser.digests[mode]})`,
      );
    }
  }
  return problems;
}

function main() {
  const dir = process.argv[2] ?? fileURLToPath(new URL('../reports/fuzz-digest', import.meta.url));
  const reports = [];
  for (const name of ['node', 'browser']) {
    const file = join(dir, `${name}.json`);
    try {
      reports.push(JSON.parse(readFileSync(file, 'utf8')));
    } catch (error) {
      console.error(
        `cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
      return;
    }
  }
  const problems = compareReports(reports[0], reports[1]);
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exitCode = 1;
    return;
  }
  console.log(
    `fuzz digests: node and browser ended ${reports[0].games} games the same way (${reports[0].digests.plain})`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
