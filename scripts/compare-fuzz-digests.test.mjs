// Tests of the cross-environment comparison of the fuzz digests (M2-T10). Run with `pnpm test:scripts`.
// The comparison is the only place where "Node and Chromium end the fuzz games the same way" is decided,
// so every way it can pass by mistake (a missing file, an empty digest, one mode only) is pinned here.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { buildReport, compareReports } from './compare-fuzz-digests.mjs';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const entries = (plain, stubbed, games = 500) => [
  { mode: 'plain', games, digest: plain },
  { mode: 'stubbed', games, digest: stubbed },
];
const report = (environment, plain = A, stubbed = A, games = 500) =>
  buildReport(environment, entries(plain, stubbed, games));

describe('buildReport', () => {
  it('turns the two entries of a run into one report', () => {
    assert.deepEqual(report('node'), {
      environment: 'node',
      games: 500,
      digests: { plain: A, stubbed: A },
    });
  });

  it('refuses a run that lacks one of the two modes', () => {
    assert.throws(() => buildReport('node', [entries(A, A)[0]]), /stubbed/);
    assert.throws(() => buildReport('node', [entries(A, A)[1]]), /plain/);
    assert.throws(() => buildReport('node', []), /plain/);
  });

  it('refuses entries that disagree on the number of games', () => {
    const [plain, stubbed] = entries(A, A);
    assert.throws(() => buildReport('node', [plain, { ...stubbed, games: 499 }]), /games/);
  });

  it('refuses a digest that is not 64 lower-case hex digits', () => {
    for (const bad of ['', 'abc', 'A'.repeat(64), 'g'.repeat(64), `${A}0`, 42, undefined]) {
      assert.throws(() => buildReport('node', entries(bad, A)), /digest/);
    }
  });

  it('refuses a game count that is not a positive whole number', () => {
    for (const bad of [0, -1, 1.5, '500', null]) {
      assert.throws(() => buildReport('node', entries(A, A, bad)), /games/);
    }
  });
});

describe('compareReports', () => {
  it('accepts four equal digests over the same number of games', () => {
    assert.deepEqual(compareReports(report('node'), report('browser')), []);
  });

  it('reports a difference between the environments, naming the mode', () => {
    const problems = compareReports(report('node', A, A), report('browser', B, B));
    assert.ok(problems.some((p) => /plain digests of node and browser differ/.test(p)));
    assert.ok(problems.some((p) => /stubbed digests of node and browser differ/.test(p)));
  });

  it('reports a difference that shows only in the stubbed run', () => {
    const problems = compareReports(report('node', A, A), report('browser', A, B));
    assert.ok(problems.some((p) => /stubbed digests of node and browser differ/.test(p)));
    assert.ok(!problems.some((p) => /plain digests of node and browser differ/.test(p)));
  });

  it('reports a difference inside one environment, also when both environments share it', () => {
    const problems = compareReports(report('node', A, B), report('browser', A, B));
    assert.deepEqual(problems.length, 2);
    assert.ok(problems.some((p) => /node/.test(p) && /plain and stubbed/.test(p)));
    assert.ok(problems.some((p) => /browser/.test(p) && /plain and stubbed/.test(p)));
  });

  it('reports a different number of games', () => {
    const problems = compareReports(report('node'), report('browser', A, A, 400));
    assert.ok(problems.some((p) => /games/.test(p)));
  });

  it('never accepts something that is not a report of the right environment', () => {
    const malformed = [undefined, null, 'x', {}, { ...report('node'), games: 0 }];
    for (const bad of malformed) {
      assert.notDeepEqual(compareReports(bad, report('browser')), []);
      assert.notDeepEqual(compareReports(report('node'), bad), []);
    }
    // The two reports in the wrong places: each is fine alone, but not as the other environment's.
    assert.notDeepEqual(compareReports(report('browser'), report('node')), []);
    assert.notDeepEqual(compareReports(report('node'), report('node')), []);
  });
});

describe('the command line', () => {
  const script = fileURLToPath(new URL('./compare-fuzz-digests.mjs', import.meta.url));
  const run = (files) => {
    const dir = mkdtempSync(join(tmpdir(), 'fuzz-digest-'));
    try {
      for (const [name, content] of Object.entries(files)) {
        writeFileSync(
          join(dir, name),
          typeof content === 'string' ? content : JSON.stringify(content),
        );
      }
      return spawnSync(process.execPath, [script, dir], { encoding: 'utf8' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('exits 0 and says so when both reports agree', () => {
    const result = run({ 'node.json': report('node'), 'browser.json': report('browser') });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /same/);
  });

  it('exits 1 when the digests differ', () => {
    const result = run({ 'node.json': report('node'), 'browser.json': report('browser', B, B) });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /differ/);
  });

  it('exits 1 when a report is missing, so a run that wrote nothing cannot pass', () => {
    const result = run({ 'node.json': report('node') });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /browser\.json/);
  });

  it('exits 1 when a report is not JSON', () => {
    const result = run({ 'node.json': report('node'), 'browser.json': 'not json' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /browser\.json/);
  });
});
