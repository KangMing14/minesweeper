#!/usr/bin/env node
// Verifies the M0-T02 monorepo scaffold (spec section 4.2, plan "Global Constraints").
//
// Usage: node tools/verify-t02.mjs           static checks (files, package.json graph, tsconfig flags, pins)
//        node tools/verify-t02.mjs --full    also: pnpm install --frozen-lockfile, tsc -b,
//                                            and deliberate-violation fixtures that must fail to typecheck
//                                            (the typecheck steps run tsc directly, not through pnpm)
//
// Plain Node, no dependencies, so it runs before any tooling exists (lint and Vitest arrive in M0-T03/T04).
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const full = process.argv.includes('--full');
let pass = 0;
let fail = 0;
let skipped = 0;
const ok = (d) => {
  console.log(`  ok   ${d}`);
  pass++;
};
const bad = (d, why) => {
  console.log(`  FAIL ${d}${why ? `\n         ${why}` : ''}`);
  fail++;
};
const check = (d, cond, why) => (cond ? ok(d) : bad(d, why));
const p = (...s) => join(ROOT, ...s);
const read = (f) => (existsSync(p(f)) ? readFileSync(p(f), 'utf8') : '');
const json = (f) => {
  try {
    return JSON.parse(read(f));
  } catch {
    return null;
  }
};

const PKGS = [
  { dir: 'packages/engine', name: '@minesweeper/engine', deps: [] },
  { dir: 'packages/protocol', name: '@minesweeper/protocol', deps: ['@minesweeper/engine'] },
  {
    dir: 'apps/server',
    name: '@minesweeper/server',
    deps: ['@minesweeper/engine', '@minesweeper/protocol'],
  },
  {
    dir: 'apps/web',
    name: '@minesweeper/web',
    deps: ['@minesweeper/engine', '@minesweeper/protocol'],
  },
];
const EXACT = /^\d+\.\d+\.\d+$/;
const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

console.log('Files');
for (const f of [
  'pnpm-workspace.yaml',
  'package.json',
  '.nvmrc',
  'tsconfig.base.json',
  'tsconfig.json',
  'pnpm-lock.yaml',
  'ARCHITECTURE.md',
  'DECISIONS.md',
  ...PKGS.flatMap((k) => [
    `${k.dir}/package.json`,
    `${k.dir}/tsconfig.json`,
    `${k.dir}/src/index.ts`,
  ]),
])
  check(`exists: ${f}`, existsSync(p(f)));

console.log('Workspace and root package');
const ws = read('pnpm-workspace.yaml');
check('workspace lists packages/* and apps/*', /packages\/\*/.test(ws) && /apps\/\*/.test(ws));
const root = json('package.json') ?? {};
check('root is private', root.private === true);
check(
  'packageManager is pinned pnpm@x.y.z',
  /^pnpm@\d+\.\d+\.\d+$/.test(root.packageManager ?? ''),
);
check('engines.node is set', typeof root.engines?.node === 'string');
for (const s of ['typecheck', 'lint', 'test', 'build', 'docs:api'])
  check(`root script: ${s}`, typeof root.scripts?.[s] === 'string');
for (const s of ['typecheck', 'build'])
  check(`root script ${s} runs tsc -b`, /tsc -b/.test(root.scripts?.[s] ?? ''));
const nvm = read('.nvmrc').trim();
const nodeMajor = /(\d+)/.exec(root.engines?.node ?? '')?.[1];
check(
  '.nvmrc major matches engines.node',
  /^\d+(\.\d+){0,2}$/.test(nvm) && nvm.split('.')[0] === nodeMajor,
  `.nvmrc="${nvm}" engines="${root.engines?.node}"`,
);

console.log('Pinned versions (no ^ ~ ranges for tools)');
const manifests = [
  { file: 'package.json', pkg: root },
  ...PKGS.map((k) => ({ file: `${k.dir}/package.json`, pkg: json(`${k.dir}/package.json`) ?? {} })),
];
for (const { file, pkg } of manifests) {
  const loose = DEP_FIELDS.flatMap((f) => Object.entries(pkg[f] ?? {})).filter(
    ([, v]) => !(EXACT.test(v) || v === 'workspace:*'),
  );
  check(
    `${file}: every dependency is an exact version or workspace:*`,
    loose.length === 0,
    loose.map(([k, v]) => `${k}@${v}`).join(', '),
  );
}
const ts = root.devDependencies?.typescript;
check('root pins typescript', EXACT.test(ts ?? ''));

console.log('Dependency graph (package.json only)');
for (const k of PKGS) {
  const pkg = json(`${k.dir}/package.json`) ?? {};
  check(`${k.dir}: name is ${k.name}`, pkg.name === k.name, `got ${pkg.name}`);
  check(`${k.dir}: private, ESM`, pkg.private === true && pkg.type === 'module');
  const internal = DEP_FIELDS.flatMap((f) => Object.keys(pkg[f] ?? {})).filter((n) =>
    n.startsWith('@minesweeper/'),
  );
  check(
    `${k.dir}: internal deps are exactly [${k.deps.join(', ')}]`,
    JSON.stringify([...new Set(internal)].sort()) === JSON.stringify([...k.deps].sort()),
    `got [${internal.join(', ')}]`,
  );
  for (const d of k.deps)
    check(`${k.dir}: ${d} uses workspace:*`, pkg.dependencies?.[d] === 'workspace:*');
}
const engine = json('packages/engine/package.json') ?? {};
check(
  'engine declares zero dependencies of any kind',
  DEP_FIELDS.every((f) => Object.keys(engine[f] ?? {}).length === 0),
);
check(
  'no package depends on an app',
  !PKGS.some(
    (k) =>
      (json(`${k.dir}/package.json`)?.dependencies ?? {})['@minesweeper/server'] ||
      (json(`${k.dir}/package.json`)?.dependencies ?? {})['@minesweeper/web'],
  ),
);

console.log('TypeScript configuration');
const base = json('tsconfig.base.json')?.compilerOptions ?? {};
for (const f of [
  'strict',
  'noUncheckedIndexedAccess',
  'exactOptionalPropertyTypes',
  'verbatimModuleSyntax',
])
  check(`base: ${f}`, base[f] === true);
const rootTs = json('tsconfig.json') ?? {};
check(
  'root tsconfig is solution-style (files: [], references all four)',
  Array.isArray(rootTs.files) &&
    rootTs.files.length === 0 &&
    PKGS.every((k) => (rootTs.references ?? []).some((r) => r.path.replace(/^\.\//, '') === k.dir)),
);
for (const k of PKGS) {
  const t = json(`${k.dir}/tsconfig.json`) ?? {};
  const refs = (t.references ?? []).map((r) =>
    r.path.replace(/^\.\.\/\.\.\//, '').replace(/^\.\.\//, ''),
  );
  const expected = k.deps.map((d) => d.replace('@minesweeper/', ''));
  check(`${k.dir}: extends the shared base`, /tsconfig\.base\.json$/.test(t.extends ?? ''));
  check(
    `${k.dir}: references [${expected.join(', ')}]`,
    JSON.stringify(refs.map((r) => r.split('/').pop()).sort()) ===
      JSON.stringify([...expected].sort()),
    `got [${refs.join(', ')}]`,
  );
}
for (const k of PKGS.slice(0, 2)) {
  const o = json(`${k.dir}/tsconfig.json`)?.compilerOptions ?? {};
  check(
    `${k.dir}: composite, no DOM lib, no ambient @types (keeps it DOM- and Node-free)`,
    o.composite === true &&
      Array.isArray(o.types) &&
      o.types.length === 0 &&
      !(o.lib ?? []).some((l) => /dom|webworker/i.test(l)),
  );
}
check(
  'apps/server: Node types only',
  JSON.stringify(json('apps/server/tsconfig.json')?.compilerOptions?.types) === '["node"]',
);
check(
  'apps/web: DOM lib, JSX, bundler resolution, noEmit',
  (() => {
    const o = json('apps/web/tsconfig.json')?.compilerOptions ?? {};
    return (
      (o.lib ?? []).some((l) => /^dom$/i.test(l)) &&
      o.jsx === 'react-jsx' &&
      /bundler/i.test(o.moduleResolution ?? '') &&
      o.noEmit === true
    );
  })(),
);

console.log('Placeholders and documentation');
for (const k of PKGS) {
  const src = read(`${k.dir}/src/index.ts`);
  const stray = src
    .split('\n')
    .filter((l) => /^\s*export\b/.test(l) && !/^\s*export\s*\{\s*\}\s*;?\s*$/.test(l));
  check(
    `${k.dir}/src/index.ts is a module that exports nothing`,
    /^\s*export\s*\{\s*\}\s*;?\s*$/m.test(src) && stray.length === 0,
    stray.join(' | '),
  );
}
const arch = read('ARCHITECTURE.md');
for (const k of PKGS)
  check(
    `ARCHITECTURE.md documents ${k.dir} (${k.name})`,
    arch.includes(k.dir) && arch.includes(k.name),
  );
const dec = read('DECISIONS.md');
check('DECISIONS.md has a version table', /\|\s*Tool\s*\|/i.test(dec));
const pinned = manifests
  .flatMap(({ pkg }) => DEP_FIELDS.flatMap((f) => Object.entries(pkg[f] ?? {})))
  .filter(([, v]) => EXACT.test(v));
for (const [name, ver] of pinned)
  check(
    `DECISIONS.md lists ${name} ${ver}`,
    new RegExp(
      `\\|\\s*\`?${name.replace(/[/@.]/g, '\\$&')}\`?\\s*\\|\\s*\`?${ver.replace(/\./g, '\\.')}\`?\\s*\\|`,
    ).test(dec),
  );
const pm = /^pnpm@(.+)$/.exec(root.packageManager ?? '')?.[1];
check(
  'DECISIONS.md lists the pinned pnpm version',
  pm !== undefined &&
    new RegExp(`\\|\\s*\`?pnpm\`?\\s*\\|\\s*\`?${pm.replace(/\./g, '\\.')}\`?\\s*\\|`).test(dec),
);

if (full) {
  console.log('Full: install, typecheck, deliberate violations (needs pnpm and network)');
  // Typecheck runs the project's own tsc directly through Node, with no shell and no pnpm. On Windows a
  // global pnpm whose install script was blocked (npm 11 allow-scripts) has a broken .cmd shim, and a
  // spawned shell cannot launch it. The scaffold does not depend on that, so neither does this check.
  const tsc = p('node_modules', 'typescript', 'bin', 'tsc');
  const run = (cmd) => spawnSync(cmd, { cwd: ROOT, shell: true, encoding: 'utf8' });
  const typecheck = () => spawnSync(process.execPath, [tsc, '-b'], { cwd: ROOT, encoding: 'utf8' });
  const inst = run('pnpm install --frozen-lockfile');
  const instOut = `${inst.stdout ?? ''}${inst.stderr ?? ''}`;
  const launchFailure =
    inst.error !== undefined || /not recognized|not found|ENOENT|No such file/i.test(instOut);
  if (inst.status === 0) ok('pnpm install --frozen-lockfile');
  else if (launchFailure) {
    console.log(
      `  skip pnpm install --frozen-lockfile: pnpm could not be launched from Node (${instOut.trim().split('\n')[0]}). Run it yourself in a terminal.`,
    );
    skipped++;
  } else bad('pnpm install --frozen-lockfile', instOut.split('\n').slice(-8).join('\n         '));
  if (!existsSync(tsc)) bad('typescript is installed (run pnpm install first)', tsc);
  const tc = existsSync(tsc)
    ? typecheck()
    : { status: 1, stdout: '', stderr: 'typescript not installed' };
  check(
    'typecheck (tsc -b) passes on the clean scaffold',
    tc.status === 0,
    (tc.stdout + tc.stderr).split('\n').slice(-12).join('\n         '),
  );
  const violation = (label, file, source, code) => {
    mkdirSync(dirname(p(file)), { recursive: true });
    writeFileSync(p(file), source);
    try {
      const r = typecheck();
      const out = r.stdout + r.stderr;
      check(
        label,
        r.status !== 0 && out.includes(code) && out.includes(file.split('/').pop()),
        `exit ${r.status}; expected ${code} mentioning the fixture`,
      );
    } finally {
      rmSync(p(file), { force: true });
    }
  };
  violation(
    'apps/web importing apps/server fails to typecheck',
    'apps/web/src/zz-violation.ts',
    "import { nothing } from '@minesweeper/server';\nexport const x = nothing;\n",
    'TS2307',
  );
  violation(
    'engine importing protocol fails to typecheck',
    'packages/engine/src/zz-violation.ts',
    "import { nothing } from '@minesweeper/protocol';\nexport const x = nothing;\n",
    'TS2307',
  );
  violation(
    'engine using a DOM API fails to typecheck',
    'packages/engine/src/zz-violation.ts',
    'export const x = document.title;\n',
    'TS2584',
  );
  violation(
    'engine using a Node API fails to typecheck',
    'packages/engine/src/zz-violation.ts',
    'export const x = process.argv;\n',
    'TS2591',
  );
  const again = typecheck();
  check('typecheck passes again after the fixtures are removed', again.status === 0);
} else {
  console.log('Skipped: install, typecheck and violation fixtures (run with --full)');
}

console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ''}`);
process.exit(fail === 0 ? 0 : 1);
