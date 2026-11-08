// Verifies the M0-T05 deliverables (documentation skeleton and the link checker). Static checks always
// run; `--full` also runs the whole toolchain (typecheck, lint, format, to-do check, tests, TypeDoc and the
// link checker) and the earlier verify scripts, to prove nothing regressed.
// Usage: node tools/verify-t05.mjs [--full]
// Tools are launched with `node <script>` rather than through pnpm, because the pnpm shim can be broken on
// some Windows setups (seen in M0-T02). Temporary files are created in the OS temp directory only.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
const tail = (result, lines = 6) =>
  `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split('\n').slice(-lines).join(' | ');
function node(script, args = [], cwd = root) {
  return spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd,
    encoding: 'utf8',
  });
}
/** True when every phrase (string or RegExp) occurs in the text. Returns the first missing one otherwise. */
function missing(text, phrases) {
  return phrases.find((p) => (p instanceof RegExp ? !p.test(text) : !text.includes(p)));
}
const headings = (text) =>
  text
    .split('\n')
    .filter((l) => /^#{1,6} /.test(l))
    .map((l) => l.replace(/^#+ /, '').trim());

// ---------------------------------------------------------------------------------------------------
console.log('Files');
const DOCS = [
  'README.md',
  'PROJECT_OVERVIEW.md',
  'ROADMAP.md',
  'ARCHITECTURE.md',
  'DEVELOPMENT_GUIDE.md',
  'DECISIONS.md',
  'CHANGELOG.md',
  'CLAUDE.md',
  'docs/handoffs/TEMPLATE.md',
  'scripts/check-links.mjs',
];
for (const file of DOCS) check(`${file} exists`, existsSync(path.join(root, file)));

console.log('No placeholders or stub banners');
const PLACEHOLDER = /\b(TBD|lorem ipsum|coming soon|fill in later)\b|^> Stub|still short|\bXXX\b/im;
for (const file of DOCS.filter((f) => f.endsWith('.md') && f !== 'docs/handoffs/TEMPLATE.md')) {
  const hit = read(file).match(PLACEHOLDER);
  check(`${file} has no placeholder text`, !hit, hit?.[0]);
}

console.log('ROADMAP.md');
const roadmap = read('ROADMAP.md');
const rows = new Map();
for (const line of roadmap.split('\n')) {
  const cells = line.split('|').map((c) => c.trim());
  if (cells.length >= 7 && /^M\d+-T\d+$/.test(cells[1] ?? ''))
    rows.set(cells[1], cells.slice(2, 7));
}
check('78 task rows', rows.size === 78, String(rows.size));
const STATUSES = new Set(['Not started', 'In progress', 'Done', 'Blocked']);
check(
  'every status is valid',
  [...rows.values()].every((r) => STATUSES.has(r[1])),
);
const titles = new Map();
const MILESTONE_FILES = [
  'M0-foundations',
  'M1-engine-core',
  'M2-deterministic-engine',
  'M3-local-solo-client',
  'M4-mode-framework-ghost-race',
  'M5-first-networked-race',
  'M6-lifecycle-reconnection',
  'M7-accounts-persistence',
  'M8-competitive-layer',
  'M9-staging-hardening',
  'M10-polish-alpha',
  'M11-launch-readiness',
];
for (const name of MILESTONE_FILES) {
  for (const line of read(`docs/milestones/${name}.md`).split('\n')) {
    const m = line.match(/^### (M\d+-T\d+) (.*)$/);
    if (m) titles.set(m[1], m[2].trim());
  }
}
check('milestone files hold 78 tasks', titles.size === 78, String(titles.size));
const wrong = [...titles].filter(([id, title]) => rows.get(id)?.[0] !== title).map(([id]) => id);
check('row titles equal the milestone-file headings', wrong.length === 0, wrong.join(', '));
// The developer filled these cells by hand after merging; this task must not disturb them.
for (const [id, sha] of [
  ['M0-T01', 'cc51e30'],
  ['M0-T02', '80f3dfc'],
  ['M0-T03', 'd90869d'],
  ['M0-T04', '722bf34'],
]) {
  check(
    `${id} keeps Done and its commit ${sha}`,
    rows.get(id)?.[1] === 'Done' && rows.get(id)?.[3] === sha,
    JSON.stringify(rows.get(id)),
  );
}
check('M0-T05 is no longer "Not started"', rows.get('M0-T05')?.[1] !== 'Not started');
check('M0-T06 is untouched ("Not started")', rows.get('M0-T06')?.[1] === 'Not started');
const indexSection = roadmap.split(/^## M0 Foundations/m)[0] ?? '';
check(
  'milestone index lists M0..M11 with file and tag',
  Array.from({ length: 12 }, (_, n) => n).every(
    (n) => indexSection.includes(`m${n}-complete`) && indexSection.includes(`| M${n} `),
  ),
);
check('index sits before the per-task tables', indexSection.includes('Milestone index'));

console.log('CLAUDE.md');
const claude = read('CLAUDE.md');
const order = [
  '`CLAUDE.md`',
  '`ROADMAP.md`',
  'milestone file',
  '`ARCHITECTURE.md`',
  '`DECISIONS.md`',
];
const positions = order.map((p) => claude.indexOf(p));
check(
  'read order: CLAUDE, ROADMAP, milestone file, ARCHITECTURE, DECISIONS',
  positions.every((p, i) => p >= 0 && (i === 0 || p > (positions[i - 1] ?? 0))),
  positions.join(','),
);
for (const [name, phrase] of [
  ['docs beat memory', /docs? (beat|win|override)/i],
  ['stop on ADR conflicts', /stop[^.\n]*(ADR|conflict)/i],
  ['engine-banned APIs', /Math\.random/],
  ['one task per conversation', /one task per conversation/i],
  ['canonical names are exact', /canonical names/i],
  ['real spec path', 'docs/superpowers/specs/'],
  ['commands listed', 'pnpm typecheck'],
]) {
  check(`mentions: ${name}`, !missing(claude, [phrase]));
}

console.log('ARCHITECTURE.md');
const arch = read('ARCHITECTURE.md');
const plan = read('docs/superpowers/plans/2026-11-04-competitive-minesweeper-roadmap.md');
const canon = (plan.split('### Canonical names')[1] ?? '').split('### ADR plan')[0] ?? '';
const canonRows = canon.split('\n').filter((l) => /^\| (`engine`|`protocol`|`apps\/)/.test(l));
check('plan canonical-names table has 4 rows', canonRows.length === 4, String(canonRows.length));
for (const row of canonRows) {
  check(`canonical row copied verbatim: ${row.slice(0, 22)}...`, arch.includes(row));
}
check('has at least two mermaid diagrams', (arch.match(/```mermaid/g) ?? []).length >= 2);
check(
  'system diagram and match lifecycle present',
  !missing(arch, ['flowchart LR', 'stateDiagram-v2', 'PlayerDisconnected']),
);
for (const kept of ['Package layout', 'Dependency rule', 'TypeScript configuration']) {
  check(`keeps section "${kept}"`, headings(arch).includes(kept));
}
check(
  'describes engine, protocol, session and server concepts',
  !missing(arch, ['GameSession', 'LocalSession', 'RemoteSession', 'BoardGenerator', 'Command']),
);
check(
  'states that canonical names are planned, not yet implemented',
  /not (yet )?implemented|planned/i.test(arch),
);

console.log('DECISIONS.md');
const dec = read('DECISIONS.md');
check(
  'keeps "ADR-005 input: dependency pins"',
  headings(dec).includes('ADR-005 input: dependency pins'),
);
for (const kept of [
  'M0-T03 verification notes',
  'M0-T04 verification notes',
  'GitHub Actions pins (M0-T04)',
  'M0-T03 inputs for ADR-006 and ADR-007',
  'M0-T04 inputs for ADR-005, ADR-006 and ADR-007',
]) {
  check(`keeps section "${kept}"`, headings(dec).includes(kept));
}
check(
  'has an ADR template',
  !missing(dec, ['Context', 'Decision', 'Consequences', 'Alternatives']),
);
for (let n = 1; n <= 16; n += 1) {
  const id = `ADR-${String(n).padStart(3, '0')}`;
  check(`ADR list names ${id}`, dec.includes(id));
}
for (let n = 1; n <= 13; n += 1) {
  const id = `D-${String(n).padStart(2, '0')}`;
  check(`open decisions include ${id}`, new RegExp(`\\|\\s*${id}\\s*\\|`).test(dec));
}
check('ADR files are append-only per the rules', /append-only/i.test(dec));
check(
  'no ADR claimed as written yet',
  !/\bAccepted\b/.test(dec) || /None written yet|not yet written/i.test(dec),
);

console.log('DEVELOPMENT_GUIDE.md');
const guide = read('DEVELOPMENT_GUIDE.md');
for (const section of [
  'Git workflow',
  'Tooling and enforcement (M0-T03)',
  'Tests, API docs and CI (M0-T04)',
]) {
  check(`keeps section "${section}"`, headings(guide).includes(section));
}
check(
  'adds the task loop, skills and link check',
  !missing(guide, [
    /task loop/i,
    '/test-driven-development',
    '/verification-before-completion',
    'pnpm check:links',
  ]),
);
check('has the Windows pnpm note', !missing(guide, ['allow-scripts=pnpm']));

console.log('CHANGELOG.md, PROJECT_OVERVIEW.md, README.md, handoff template');
const changelog = read('CHANGELOG.md');
check(
  'CHANGELOG is Keep-a-Changelog shaped',
  !missing(changelog, ['# Changelog', '## [Unreleased]']),
);
for (const id of ['M0-T01', 'M0-T02', 'M0-T03', 'M0-T04', 'M0-T05']) {
  check(`CHANGELOG has an entry for ${id}`, changelog.includes(id));
}
const overview = read('PROJECT_OVERVIEW.md');
check(
  'overview has concept, MVP, scope and glossary',
  !missing(overview, [
    /^## .*Concept/im,
    /^## .*MVP/im,
    /^## .*(Scope|Deferred)/im,
    /^## .*Glossary/im,
  ]),
);
for (const term of [
  'Chord',
  'Ghost',
  'Seed',
  'DNF',
  'Safe opening',
  'GameSession',
  'Replay',
  'Command log',
]) {
  check(`glossary defines "${term}"`, new RegExp(`\\*\\*${term}:?\\*\\*`, 'i').test(overview));
}
const readme = read('README.md');
check(
  'README links the other documents',
  !missing(readme, [
    'PROJECT_OVERVIEW.md',
    'ROADMAP.md',
    'ARCHITECTURE.md',
    'DECISIONS.md',
    'CLAUDE.md',
  ]),
);
check('README lists pnpm check:links', readme.includes('pnpm check:links'));
const template = read('docs/handoffs/TEMPLATE.md');
for (const section of [
  'Project context',
  'tasks to execute',
  'Prerequisites and completed dependencies',
  'Locked decisions',
  'Expected deliverables',
  'Acceptance criteria',
  'Required skills',
  'Documents to consult',
]) {
  check(
    `handoff template has "${section}"`,
    template.toLowerCase().includes(section.toLowerCase()),
  );
}

console.log('Path consistency and wiring');
check('plan section F uses docs/superpowers/specs, not docs/specs', !/`docs\/specs\/`/.test(plan));
const pkg = JSON.parse(read('package.json') || '{}');
check('script "check:links" defined', /check-links\.mjs/.test(pkg.scripts?.['check:links'] ?? ''));
const ci = read('.github/workflows/ci.yml');
check('CI runs pnpm check:links', /run:\s*pnpm check:links/.test(ci));
const jobNames = (ci.split(/^jobs:\s*$/m)[1] ?? '').match(/^ {2}[\w-]+:\s*$/gm) ?? [];
check(
  'CI still has a single job named ci',
  jobNames.length === 1 && /ci:/.test(jobNames[0] ?? ''),
  jobNames.join(','),
);

console.log('Link checker behaviour');
const sandbox = mkdtempSync(path.join(tmpdir(), 'linkcheck-'));
function sandboxRun(files) {
  const dir = mkdtempSync(path.join(sandbox, 'case-'));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), content);
  }
  return node('scripts/check-links.mjs', ['--root', dir]);
}
try {
  const good = sandboxRun({
    'a.md':
      '# A\n\nSee [b](docs/b.md#section-one), [self](#a), [dir](docs/), [web](https://example.com/x).\n',
    'docs/b.md': '# B\n\n## Section one\n\nText.\n',
  });
  check(
    'valid relative, anchor, directory and external links pass',
    good.status === 0,
    tail(good, 3),
  );
  const noFile = sandboxRun({ 'a.md': 'See [gone](missing.md).\n' });
  check(
    'missing target fails and is named',
    noFile.status !== 0 && /missing\.md/.test(noFile.stdout + noFile.stderr),
    tail(noFile, 3),
  );
  const noAnchor = sandboxRun({ 'a.md': '[x](b.md#nope)\n', 'b.md': '# B\n' });
  check(
    'missing anchor fails and is named',
    noAnchor.status !== 0 && /#nope/.test(noAnchor.stdout + noAnchor.stderr),
    tail(noAnchor, 3),
  );
  const inCode = sandboxRun({
    'a.md': '```md\n[bad](nowhere.md)\n```\n\nInline `[bad](nowhere.md)` too.\n',
  });
  check(
    'links inside code fences and code spans are ignored',
    inCode.status === 0,
    tail(inCode, 3),
  );
  const refStyle = sandboxRun({ 'a.md': '[x][ref]\n\n[ref]: nope.md\n' });
  check('reference-style definitions are checked', refStyle.status !== 0, tail(refStyle, 3));
  const dup = sandboxRun({ 'a.md': '[x](b.md#same-1)\n', 'b.md': '# Same\n\n# Same\n' });
  check('duplicate headings get -1 suffixes like GitHub', dup.status === 0, tail(dup, 3));
  const skipped = sandboxRun({
    'a.md': '# A\n',
    'node_modules/pkg/README.md': '[bad](nowhere.md)\n',
    'docs/api/index.md': '[bad](nowhere.md)\n',
  });
  check('node_modules and docs/api are not scanned', skipped.status === 0, tail(skipped, 3));
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
const real = node('scripts/check-links.mjs');
check('links in this repository resolve', real.status === 0, tail(real, 8));

// ---------------------------------------------------------------------------------------------------
if (full) {
  console.log('Full toolchain (--full)');
  const steps = [
    ['typecheck (tsc -b)', 'node_modules/typescript/bin/tsc', ['-b']],
    ['eslint', 'node_modules/eslint/bin/eslint.js', ['.']],
    [
      'prettier --check',
      'node_modules/prettier/bin/prettier.cjs',
      ['--check', '**/*.{ts,tsx,mts,cts,js,mjs,cjs,json,yml,yaml}'],
    ],
    ['check:todos', 'scripts/check-todos.mjs', []],
    ['vitest run', 'node_modules/vitest/vitest.mjs', ['run']],
    ['typedoc', 'node_modules/typedoc/bin/typedoc', []],
    ['verify-t02', 'tools/verify-t02.mjs', []],
    ['verify-t03', 'tools/verify-t03.mjs', []],
    ['verify-t04', 'tools/verify-t04.mjs', []],
  ];
  for (const [name, script, args] of steps) {
    const result = node(script, args);
    check(name, result.status === 0, tail(result, 5));
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
