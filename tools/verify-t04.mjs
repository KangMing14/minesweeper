// Verifies the M0-T04 deliverables (test tooling, TypeDoc, CI). Static checks always run; `--full` also
// runs every tool for real and then breaks things on purpose to prove each CI step fails when it should.
// Usage: node tools/verify-t04.mjs [--full]
// Tools are launched with `node <script>` rather than through pnpm, because the pnpm shim can be broken
// on some Windows setups (seen in M0-T02). Temporary files created by `--full` are removed afterwards.
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The marker word is assembled at run time: the repository's own to-do check scans this file as well.
const MARKER = 'TO' + 'DO';
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
const tail = (result, lines = 6) =>
  `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split('\n').slice(-lines).join(' | ');
function node(script, args = [], options = {}) {
  return spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    encoding: 'utf8',
    ...options,
  });
}

const TOOLS = {
  tsc: 'node_modules/typescript/bin/tsc',
  eslint: 'node_modules/eslint/bin/eslint.js',
  vitest: 'node_modules/vitest/vitest.mjs',
  typedoc: 'node_modules/typedoc/bin/typedoc',
  commitlint: 'node_modules/@commitlint/cli/cli.js',
  todos: 'scripts/check-todos.mjs',
};

// Files created by the deliberate-failure checks. They are restored or deleted in `finally`, and on Ctrl+C.
const restorers = new Set();
function restoreAll() {
  for (const restore of restorers) restore();
  restorers.clear();
}
process.on('SIGINT', () => {
  restoreAll();
  process.exit(130);
});
function withTempFiles(files, fn) {
  const backups = new Map();
  const restore = () => {
    for (const [absolute, previous] of backups) {
      if (previous === null) rmSync(absolute, { force: true });
      else writeFileSync(absolute, previous);
    }
  };
  restorers.add(restore);
  try {
    for (const [file, content] of Object.entries(files)) {
      const absolute = path.join(root, file);
      backups.set(absolute, existsSync(absolute) ? readFileSync(absolute, 'utf8') : null);
      mkdirSync(path.dirname(absolute), { recursive: true });
      writeFileSync(absolute, content);
    }
    return fn();
  } finally {
    restore();
    restorers.delete(restore);
  }
}

/** Asserts that `run()` fails (non-zero exit) and that its output names the intended reason. */
function mustFail(name, files, run, reason) {
  const result = withTempFiles(files, run);
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  check(
    name,
    result.status !== 0 && reason.test(output),
    result.status === 0
      ? 'the command passed but must fail'
      : `failed for another reason: ${tail(result, 3)}`,
  );
}

// ---------------------------------------------------------------------------------------------------
console.log('Files');
for (const file of [
  'vitest.config.ts',
  'typedoc.json',
  'tsconfig.tooling.json',
  '.github/workflows/ci.yml',
  'scripts/test-affected.mjs',
  'packages/engine/tsconfig.test.json',
  'packages/protocol/tsconfig.test.json',
  'packages/engine/src/sample.ts',
  'packages/engine/src/sample.test.ts',
]) {
  check(`${file} exists`, existsSync(path.join(root, file)));
}

console.log('package.json');
const pkg = JSON.parse(read('package.json') || '{}');
for (const script of ['test', 'test:coverage', 'test:affected', 'typecheck:tests', 'docs:api']) {
  check(`script "${script}" defined`, typeof pkg.scripts?.[script] === 'string');
}
check('test is not a placeholder', !/not configured/.test(pkg.scripts?.test ?? 'not configured'));
check(
  'docs:api is not a placeholder',
  !/not configured/.test(pkg.scripts?.['docs:api'] ?? 'not configured'),
);
check('typecheck also covers test files', /typecheck:tests/.test(pkg.scripts?.typecheck ?? ''));
const expectedPins = {
  vitest: '5.0.5',
  '@vitest/coverage-v8': '5.0.5',
  typedoc: '0.28.20',
  vite: '8.3.5',
  '@types/node': '24.19.2',
  typescript: '6.0.3',
};
for (const [name, version] of Object.entries(expectedPins)) {
  check(
    `${name} pinned to exactly ${version}`,
    pkg.devDependencies?.[name] === version,
    String(pkg.devDependencies?.[name]),
  );
}
check(
  'no range specifiers in root devDependencies',
  Object.values(pkg.devDependencies ?? {}).every((version) => /^\d/.test(version)),
);

console.log('Vitest, TypeDoc and tsconfig (static)');
const vitestConfig = read('vitest.config.ts');
check(
  'vitest uses test.projects (workspace files were removed in Vitest 4)',
  /projects/.test(vitestConfig),
);
check('no vitest.workspace file', !existsSync(path.join(root, 'vitest.workspace.ts')));
for (const name of ['engine', 'protocol', 'server', 'web']) {
  check(`vitest project "${name}"`, vitestConfig.includes(`'${name}'`));
}
check('coverage uses the v8 provider', /provider:\s*'v8'/.test(vitestConfig));
check(
  'vitest aliases the workspace packages to their source',
  /@minesweeper\\\/engine/.test(vitestConfig) && /@minesweeper\\\/protocol/.test(vitestConfig),
);
let typedocConfig = {};
try {
  typedocConfig = JSON.parse(read('typedoc.json') || '{}');
} catch {
  /* reported by the check below */
}
check('typedoc treats warnings as errors', typedocConfig.treatWarningsAsErrors === true);
check(
  'typedoc output goes to the ignored docs/api',
  typedocConfig.out === 'docs/api' && /^docs\/api\/?$/m.test(read('.gitignore')),
);
check(
  'typedoc documents engine and protocol',
  JSON.stringify(typedocConfig.entryPoints ?? []).includes('engine') &&
    JSON.stringify(typedocConfig.entryPoints ?? []).includes('protocol'),
);
for (const dir of ['engine', 'protocol']) {
  const base = JSON.parse(read(`packages/${dir}/tsconfig.json`) || '{}');
  check(
    `${dir}: tsc -b build excludes test files`,
    JSON.stringify(base.exclude ?? []).includes('.test.ts'),
  );
}

console.log('CI workflow (static)');
const ci = read('.github/workflows/ci.yml');
check(
  'single job named ci (the required status check)',
  /^ {2}ci:\s*$/m.test(ci) && /name:\s*ci\b/.test(ci),
);
check(
  'runs on pull_request and on push to main',
  /pull_request:/.test(ci) && /push:[\s\S]*main/.test(ci),
);
check('read-only token permissions', /permissions:\s*\n\s+contents:\s*read/.test(ci));
check('husky is disabled in CI', /HUSKY:\s*['"]?0['"]?/.test(ci));
const usesLines = ci.split('\n').filter((line) => /^\s*-?\s*uses:/.test(line));
check('workflow uses third-party actions', usesLines.length >= 3);
check(
  'every action is pinned to a full commit SHA',
  usesLines.every((line) => /uses:\s+[\w./-]+@[0-9a-f]{40}\b/.test(line)),
  usesLines.join(' | '),
);
let lastIndex = -1;
for (const command of [
  'pnpm install --frozen-lockfile',
  'pnpm typecheck',
  'pnpm lint',
  'pnpm format:check',
  'pnpm check:todos',
  'pnpm test:lint-fixtures',
  'pnpm test:coverage',
  'pnpm docs:api',
]) {
  const index = ci.indexOf(`run: ${command}`);
  check(
    `CI runs \`${command}\` (in order)`,
    index > lastIndex,
    index === -1 ? 'missing' : 'out of order',
  );
  lastIndex = Math.max(lastIndex, index);
}
check(
  'CI checks the PR title with commitlint (pull_request only)',
  /commitlint/.test(ci) && /github\.event_name == 'pull_request'/.test(ci),
);
check(
  'CI uploads coverage and API docs as artifacts',
  /upload-artifact/.test(ci) && /docs\/api/.test(ci),
);

console.log('Hooks and docs (static)');
const prePush = read('.husky/pre-push');
check('pre-push runs affected tests', /test:affected/.test(prePush));
const M0_T04_MARKER = new RegExp(`${MARKER}\\(M0-T04\\)`);
check('pre-push no longer carries the M0-T04 placeholder', !M0_T04_MARKER.test(prePush));
const stray = [];
for (const dir of ['scripts', 'tools', 'packages', 'apps', '.husky', '.github']) {
  const walk = (current) => {
    if (!existsSync(current)) return;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', 'coverage', 'cases', '_'].includes(entry.name)) walk(full);
      } else if (
        entry.name !== 'verify-t04.mjs' &&
        M0_T04_MARKER.test(readFileSync(full, 'utf8'))
      ) {
        stray.push(path.relative(root, full));
      }
    }
  };
  walk(path.join(root, dir));
}
check('no M0-T04 placeholder markers left anywhere', stray.length === 0, stray.join(', '));
const guide = read('DEVELOPMENT_GUIDE.md');
check(
  'DEVELOPMENT_GUIDE documents tests, coverage, API docs and CI',
  ['test:coverage', 'docs:api', 'test:affected', 'typecheck:tests'].every((word) =>
    guide.includes(word),
  ),
);
check(
  'DEVELOPMENT_GUIDE tells how to require the ci check',
  guide.includes('protect-main.sh OWNER/REPO ci'),
);
check(
  'README explains setup and the scripts',
  /pnpm test/.test(read('README.md')) && /corepack enable/.test(read('README.md')),
);
const decisions = read('DECISIONS.md');
for (const tool of ['vitest', '@vitest/coverage-v8', 'typedoc', 'vite', '@types/node']) {
  check(
    `DECISIONS marks ${tool} installed`,
    new RegExp(`\`${tool}\`[^\\n]*\\*\\*installed\\*\\*`).test(decisions),
  );
}
check(
  'DECISIONS lists the pinned GitHub Actions',
  /actions\/checkout/.test(decisions) && /actions\/cache/.test(decisions),
);

// ---------------------------------------------------------------------------------------------------
if (full) {
  console.log('Running the tools (--full)');
  const clean = (name, script, args) => {
    const result = node(script, args);
    check(name, result.status === 0, tail(result));
    return result;
  };
  clean('tsc -b passes', TOOLS.tsc, ['-b']);
  clean('test files typecheck (engine)', TOOLS.tsc, ['-p', 'packages/engine/tsconfig.test.json']);
  clean('test files typecheck (protocol)', TOOLS.tsc, [
    '-p',
    'packages/protocol/tsconfig.test.json',
  ]);
  clean('config files typecheck', TOOLS.tsc, ['-p', 'tsconfig.tooling.json']);
  clean('eslint . is clean', TOOLS.eslint, ['.']);
  clean('check-todos is clean', TOOLS.todos, []);
  const tests = clean('vitest run passes', TOOLS.vitest, ['run']);
  check(
    'vitest ran the engine sample test and nothing from tools/',
    /sample\.test\.ts/.test(tests.stdout) && !/lint-fixtures/.test(tests.stdout),
  );
  rmSync(path.join(root, 'coverage'), { recursive: true, force: true });
  clean('vitest run --coverage passes', TOOLS.vitest, ['run', '--coverage']);
  check(
    'coverage reports were written (json-summary and lcov)',
    existsSync(path.join(root, 'coverage/coverage-summary.json')) &&
      existsSync(path.join(root, 'coverage/lcov.info')),
  );
  rmSync(path.join(root, 'docs/api'), { recursive: true, force: true });
  clean('typedoc builds the API reference without warnings', TOOLS.typedoc, []);
  check('docs/api/index.html was generated', existsSync(path.join(root, 'docs/api/index.html')));
  clean('test:affected runs', 'scripts/test-affected.mjs', []);

  // Behavioural proof of the alias: a package that imports another by name must resolve it to source,
  // so tests work on a fresh clone where `dist/` does not exist yet. `dist/` is parked and put back.
  const engineDist = path.join(root, 'packages/engine/dist');
  const parked = `${engineDist}.parked-by-verify`;
  const putBack = () => {
    if (existsSync(parked)) renameSync(parked, engineDist);
  };
  restorers.add(putBack);
  try {
    if (existsSync(engineDist)) renameSync(engineDist, parked);
    const aliasRun = withTempFiles(
      {
        'packages/protocol/src/zz-verify-alias.test.ts': [
          "import { expect, it } from 'vitest';",
          "import { m0SampleAdd } from '@minesweeper/engine';",
          "it('resolves the engine from source', () => expect(m0SampleAdd(1, 2)).toBe(3));",
          '',
        ].join('\n'),
      },
      () => node(TOOLS.vitest, ['run', '--project', 'protocol']),
    );
    check(
      'a cross-package import resolves to source without dist/',
      aliasRun.status === 0 && /zz-verify-alias\.test\.ts/.test(aliasRun.stdout),
      tail(aliasRun),
    );
  } finally {
    putBack();
    restorers.delete(putBack);
  }

  console.log('Deliberate failures: each CI step must reject a broken change');
  mustFail(
    'a failing test fails vitest',
    {
      'packages/engine/src/zz-verify-failing.test.ts':
        "import { expect, it } from 'vitest';\nit('fails', () => expect(1).toBe(2));\n",
    },
    () => node(TOOLS.vitest, ['run']),
    /expected 1 to be 2|AssertionError/,
  );
  mustFail(
    'a type error fails tsc -b',
    { 'packages/engine/src/zz-verify-type.ts': "export const broken: number = 'text';\n" },
    () => node(TOOLS.tsc, ['-b']),
    /TS2322/,
  );
  mustFail(
    'a type error inside a test file fails the test typecheck',
    {
      'packages/engine/src/zz-verify-type.test.ts':
        "const broken: number = 'text';\nconsole.log(broken);\n",
    },
    () => node(TOOLS.tsc, ['-p', 'packages/engine/tsconfig.test.json']),
    /TS2322/,
  );
  mustFail(
    'an undocumented engine export fails eslint',
    { 'packages/engine/src/zz-verify-lint.ts': 'export const undocumented = 1;\n' },
    () => node(TOOLS.eslint, ['packages/engine/src/zz-verify-lint.ts']),
    /jsdoc\/require-jsdoc/,
  );
  mustFail(
    'a malformed TSDoc tag fails eslint',
    {
      'packages/engine/src/zz-verify-tsdoc.ts':
        '/**\n * Summary.\n *\n * @bogus nothing\n *\n * @example\n * ```ts\n * zzVerifyTsdoc();\n * ```\n */\nexport function zzVerifyTsdoc(): void {}\n',
    },
    () => node(TOOLS.eslint, ['packages/engine/src/zz-verify-tsdoc.ts']),
    /tsdoc\/syntax/,
  );
  mustFail(
    'an unresolved {@link} fails typedoc (warnings are errors)',
    {
      'packages/engine/src/zz-verify-link.ts':
        '/**\n * See {@link DoesNotExist}.\n *\n * @example\n * ```ts\n * zzVerifyLink();\n * ```\n */\nexport function zzVerifyLink(): void {}\n',
      'packages/engine/src/index.ts': `${read('packages/engine/src/index.ts')}\nexport * from './zz-verify-link.js';\n`,
    },
    () => node(TOOLS.typedoc, ['--emit', 'none']),
    /DoesNotExist/,
  );
  mustFail(
    'a bare marker fails check-todos',
    { 'packages/engine/src/zz-verify-todo.ts': `// ${MARKER} fix later\nexport {};\n` },
    () => node(TOOLS.todos, []),
    new RegExp(`${MARKER} must name a task`),
  );
  const badTitle = node(TOOLS.commitlint, [], { input: 'fix stuff\n' });
  check('commitlint rejects a bad PR title', badTitle.status !== 0, tail(badTitle, 2));
  const goodTitle = node(TOOLS.commitlint, [], {
    input: 'ci: add test tooling and CI workflow [M0-T04]\n',
  });
  check('commitlint accepts a good PR title', goodTitle.status === 0, tail(goodTitle, 3));
} else {
  console.log('Skipped: running the tools and the deliberate failures (use --full)');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
