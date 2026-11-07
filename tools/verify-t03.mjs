// Verifies the M0-T03 deliverables. Static checks always run; `--full` also runs every tool for real.
// Usage: node tools/verify-t03.mjs [--full]
// Tools are launched with `node <script>` rather than through pnpm, because the pnpm shim can be broken
// on some Windows setups (seen in M0-T02).
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const full = process.argv.includes('--full');
let passed = 0;
let failed = 0;

const read = (file) =>
  existsSync(path.join(root, file)) ? readFileSync(path.join(root, file), 'utf8') : '';
function check(name, ok, detail = '') {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : detail ? `: ${detail}` : ''}`);
}
function run(name, script, args) {
  const argv = script ? [path.join(root, script), ...args] : args;
  const result = spawnSync(process.execPath, argv, {
    cwd: root,
    encoding: 'utf8',
  });
  check(
    name,
    result.status === 0,
    `${result.stdout}${result.stderr}`.trim().split('\n').slice(-6).join(' | '),
  );
}

console.log('Files');
for (const file of [
  'eslint.config.js',
  '.prettierrc',
  '.prettierignore',
  'commitlint.config.js',
  'lint-staged.config.js',
  'scripts/check-todos.mjs',
  '.husky/pre-commit',
  '.husky/commit-msg',
  '.husky/pre-push',
  'tools/lint-fixtures/manifest.mjs',
  'tools/lint-fixtures/lint-fixtures.test.mjs',
]) {
  check(`${file} exists`, existsSync(path.join(root, file)));
}
const fixtureDir = path.join(root, 'tools/lint-fixtures/cases');
const fixtureCount = existsSync(fixtureDir) ? readdirSync(fixtureDir).length : 0;
check('at least 20 lint fixtures', fixtureCount >= 20, `found ${fixtureCount}`);

console.log('package.json');
const pkg = JSON.parse(read('package.json') || '{}');
for (const script of [
  'lint',
  'format',
  'format:check',
  'check:todos',
  'test:lint-fixtures',
  'prepare',
]) {
  check(`script "${script}" defined`, typeof pkg.scripts?.[script] === 'string');
}
check('lint is not a placeholder', !/not configured/.test(pkg.scripts?.lint ?? 'not configured'));
const expectedPins = {
  eslint: '10.13.0',
  '@eslint/js': '10.0.1',
  'typescript-eslint': '8.72.0',
  'eslint-plugin-tsdoc': '0.5.4',
  'eslint-plugin-jsdoc': '65.4.0',
  prettier: '3.9.10',
  husky: '9.1.7',
  'lint-staged': '17.6.0',
  '@commitlint/cli': '21.2.4',
  '@commitlint/config-conventional': '21.2.4',
};
for (const [name, version] of Object.entries(expectedPins)) {
  check(
    `${name} pinned to exactly ${version}`,
    pkg.devDependencies?.[name] === version,
    String(pkg.devDependencies?.[name]),
  );
}

console.log('Hooks and rules (static)');
check('pre-commit runs lint-staged', /lint-staged/.test(read('.husky/pre-commit')));
check('commit-msg runs commitlint', /commitlint --edit/.test(read('.husky/commit-msg')));
check('pre-push runs tests', /pnpm test/.test(read('.husky/pre-push')));
const eslintConfig = read('eslint.config.js');
for (const needle of [
  'tsdoc/syntax',
  'jsdoc/require-jsdoc',
  'jsdoc/require-example',
  'no-restricted-imports',
  'no-restricted-globals',
  'no-restricted-properties',
]) {
  check(`eslint config uses ${needle}`, eslintConfig.includes(needle));
}
check('commitlint requires a task ID', read('commitlint.config.js').includes('task-id-in-subject'));
check(
  'docs: DEVELOPMENT_GUIDE documents the tooling',
  /M0-T03/.test(read('DEVELOPMENT_GUIDE.md')) && /check:todos/.test(read('DEVELOPMENT_GUIDE.md')),
);
check(
  'docs: DECISIONS marks the quality tools installed',
  /`eslint`[^\n]*\*\*installed\*\*/.test(read('DECISIONS.md')),
);

if (full) {
  console.log('Running the tools (--full)');
  run('eslint . is clean', 'node_modules/eslint/bin/eslint.js', ['.']);
  run('prettier --check is clean', 'node_modules/prettier/bin/prettier.cjs', [
    '--check',
    '**/*.{ts,tsx,mts,cts,js,mjs,cjs,json,yml,yaml}',
  ]);
  run('check-todos is clean', 'scripts/check-todos.mjs', []);
  run('tsc -b passes', 'node_modules/typescript/bin/tsc', ['-b']);
  run('lint fixtures: every rule fires as intended', '', [
    '--test',
    'tools/lint-fixtures/lint-fixtures.test.mjs',
  ]);
} else {
  console.log('Skipped: running the tools (use --full)');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
