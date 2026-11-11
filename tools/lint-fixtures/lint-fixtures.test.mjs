// Proves that every guard rail of M0-T03 rejects what it must reject and accepts what it must accept.
// Runs on Node's built-in test runner because Vitest only arrives in M0-T04. Run: `pnpm test:lint-fixtures`.
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { checkBranchName } from '../../scripts/check-branch-name.mjs';
import { findBareTodos, isChecked } from '../../scripts/check-todos.mjs';
import { branchCases, commitCases, eslintCases, todoCases, todoScopeCases } from './manifest.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (fixture) => readFileSync(path.join(here, 'cases', `${fixture}.fixture`), 'utf8');
const eslint = new ESLint({ cwd: root });

describe('ESLint rules', () => {
  for (const c of eslintCases) {
    it(c.name, async () => {
      const [result] = await eslint.lintText(read(c.fixture), {
        filePath: path.join(root, c.virtualPath),
      });
      const summary = result.messages
        .map((m) => `${m.severity === 2 ? 'error' : 'warn'} ${m.ruleId}: ${m.message}`)
        .join('\n');
      const errors = result.messages.filter((m) => m.severity === 2);
      const warnings = result.messages.filter((m) => m.severity === 1);
      const e = c.expect;
      if (e.clean) assert.equal(result.messages.length, 0, `expected clean, got:\n${summary}`);
      if (e.noErrors) assert.equal(errors.length, 0, `expected no errors, got:\n${summary}`);
      for (const rule of e.errors ?? [])
        assert.ok(
          errors.some((m) => m.ruleId === rule),
          `expected error ${rule}, got:\n${summary}`,
        );
      for (const rule of e.warnings ?? [])
        assert.ok(
          warnings.some((m) => m.ruleId === rule),
          `expected warning ${rule}, got:\n${summary}`,
        );
      if (e.count !== undefined)
        assert.equal(errors.length, e.count, `expected ${e.count} errors, got:\n${summary}`);
      if (e.errors)
        assert.ok(
          errors.every((m) => e.errors.includes(m.ruleId)),
          `unexpected extra rule:\n${summary}`,
        );
    });
  }
});

describe('unnamed-task marker check', () => {
  for (const c of todoCases) {
    it(`${c.fixture}: ${c.bare} unnamed marker(s)`, () => {
      assert.equal(findBareTodos(read(c.fixture)).length, c.bare);
    });
  }
});

describe('unnamed-task marker scope', () => {
  for (const c of todoScopeCases) {
    it(`${c.file} is ${c.checked ? '' : 'not '}scanned`, () => {
      assert.equal(isChecked(c.file), c.checked);
    });
  }
});

describe('branch name check', () => {
  for (const c of branchCases) {
    it(`${c.ok ? 'accepts' : 'rejects'} ${JSON.stringify(c.name)}${c.why ? ` (${c.why})` : ''}`, () => {
      assert.equal(checkBranchName(c.name) === null, c.ok);
    });
  }
});

describe('commit message lint', () => {
  const cli = path.join(root, 'node_modules/@commitlint/cli/cli.js');
  for (const c of commitCases) {
    it(`${c.ok ? 'accepts' : 'rejects'} ${JSON.stringify(c.msg)}${c.why ? ` (${c.why})` : ''}`, () => {
      const run = spawnSync(
        process.execPath,
        [cli, '--config', path.join(root, 'commitlint.config.js')],
        { cwd: root, input: c.msg, encoding: 'utf8' },
      );
      assert.equal(run.status === 0, c.ok, `${run.stdout}${run.stderr}`);
    });
  }
});
