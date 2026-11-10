// Verifies the M0-T06 deliverables (ADR-001..008, the Better Auth re-verification, the license decision
// and the M0 close-out). Static checks always run; `--full` also runs the whole toolchain and the earlier
// verify scripts, to prove nothing regressed.
// Usage: node tools/verify-t06.mjs [--full]
// Tools are launched with `node <script>` rather than through pnpm, because the pnpm shim can be broken on
// some Windows setups (seen in M0-T02). This script only reads the repository; it writes nothing.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const full = process.argv.includes('--full');
let passed = 0;
let failed = 0;

// An empty or missing path reads as '' so a missing deliverable fails its checks instead of crashing.
const read = (file) =>
  file && existsSync(path.join(root, file)) && statSync(path.join(root, file)).isFile()
    ? readFileSync(path.join(root, file), 'utf8')
    : '';
function check(name, ok, detail = '') {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : detail ? `: ${detail}` : ''}`);
}
const tail = (result, lines = 6) =>
  `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split('\n').slice(-lines).join(' | ');
function node(script, args = []) {
  return spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}
/** Returns the first phrase (string or RegExp) that the text does not contain, or undefined. */
function missing(text, phrases) {
  return phrases.find((p) => (p instanceof RegExp ? !p.test(text) : !text.includes(p)));
}
const words = (text) => text.split(/\s+/).filter(Boolean).length;

// ---------------------------------------------------------------------------------------------------
// What each record must say. Base titles match the index in DECISIONS.md (the master plan's ADR plan).
const ADRS = [
  {
    n: 1,
    title: 'Monorepo and modular monolith',
    settles: 'none',
    phrases: [
      'modular monolith',
      'pnpm',
      '@minesweeper/engine',
      '@minesweeper/protocol',
      '@minesweeper/server',
      '@minesweeper/web',
      /microservice/i,
    ],
  },
  {
    n: 2,
    title: 'Deterministic engine',
    settles: 'none',
    phrases: [
      'Math.random',
      'Date',
      'performance',
      'window',
      'document',
      'process',
      /integer/i,
      /replay/i,
      /command/i,
    ],
  },
  {
    n: 3,
    title: 'Server-authoritative play',
    settles: 'none',
    phrases: [/mine positions/i, /rate-limit/i, 'Zod', /D-10/, /solver/i],
  },
  {
    n: 4,
    title: '`GameSession` adapter',
    settles: 'none',
    phrases: ['GameSession', 'LocalSession', 'RemoteSession', 'Adapter', 'Transport'],
  },
  {
    n: 5,
    title: 'Technology stack',
    settles: 'none',
    phrases: [
      'pnpm',
      'React',
      'Vite',
      'Zustand',
      'Tailwind',
      'Canvas',
      'Fastify',
      'Zod',
      'PostgreSQL',
      'Drizzle',
      'Better Auth',
      'Vitest',
      'Playwright',
      'GitHub Actions',
      'Docker',
      'TypeScript 6.0',
      /typedoc/i,
      /14 days/,
    ],
  },
  {
    n: 6,
    title: 'Git workflow',
    settles: 'none',
    phrases: [
      'trunk-based',
      'squash',
      'commitlint',
      '[Mn-Tnn]',
      'm<n>/',
      'feat',
      'refactor',
      'chore',
      'engine',
      'protocol',
      'server',
      'web',
      'docs',
      'm<n>-complete',
      'pre-push',
    ],
  },
  {
    n: 7,
    title: 'Code documentation',
    settles: 'none',
    phrases: [
      'TSDoc',
      'TypeDoc',
      'Doxygen',
      'eslint-plugin-tsdoc',
      'eslint-plugin-jsdoc',
      '@example',
      'M5-T03',
      /warnings? (are|as) errors?/i,
    ],
  },
  {
    n: 8,
    title: 'License',
    settles: 'D-12',
    phrases: ['All rights reserved', 'D-12', 'v1.0.0', 'UNLICENSED', 'LICENSE', /public/i],
  },
];

console.log('ADR files');
const adrDir = path.join(root, 'docs/adr');
const adrFiles = existsSync(adrDir) ? readdirSync(adrDir).filter((f) => f.endsWith('.md')) : [];
const adrText = new Map();
const adrFile = new Map();
for (const adr of ADRS) {
  const id = `ADR-${String(adr.n).padStart(3, '0')}`;
  const matches = adrFiles.filter((f) => f.startsWith(`${id}-`));
  check(`${id} exists exactly once in docs/adr/`, matches.length === 1, matches.join(','));
  const file = matches[0] ? `docs/adr/${matches[0]}` : '';
  adrFile.set(adr.n, file);
  const text = read(file);
  adrText.set(adr.n, text);
  if (!text) continue;

  check(
    `${id} file name is a lower-case slug`,
    /^ADR-\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(matches[0] ?? ''),
    matches[0],
  );
  check(
    `${id} heading is "# ${id}: ${adr.title}..."`,
    new RegExp(`^# ${id}: ${adr.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm').test(text),
  );
  check(`${id} status is Accepted`, /^- Status: Accepted\s*$/m.test(text));
  check(`${id} has an ISO date`, /^- Date: 20\d\d-\d\d-\d\d\s*$/m.test(text));
  check(`${id} names its task M0-T06`, /^- Task: M0-T06\s*$/m.test(text));
  check(
    `${id} settles ${adr.settles}`,
    new RegExp(`^- Settles: ${adr.settles}\\s*$`, 'm').test(text),
  );

  // The four sections of the repository template, in order, each with real content.
  const sections = ['Context', 'Decision', 'Consequences', 'Alternatives'];
  const at = sections.map((s) => text.indexOf(`\n## ${s}\n`));
  check(
    `${id} has Context, Decision, Consequences, Alternatives in order`,
    at.every((p, i) => p >= 0 && (i === 0 || p > (at[i - 1] ?? 0))),
    at.join(','),
  );
  for (const [i, section] of sections.entries()) {
    const start = at[i] ?? -1;
    if (start < 0) continue;
    const end = at[i + 1] && at[i + 1] > start ? at[i + 1] : text.length;
    const body = text.slice(start, end);
    check(`${id} ${section} has real content (40+ words)`, words(body) >= 40, String(words(body)));
  }
  check(
    `${id} has no template remnants or placeholders`,
    !/<(title|situation|what|options?|YYYY|Mn-Tnn|D-nn)[^>]*>|\b(TBD|lorem ipsum|XXX)\b|fill in later/i.test(
      text,
    ),
  );
  const gap = missing(text, adr.phrases);
  check(`${id} covers its required points`, gap === undefined, String(gap));
}

console.log('ADR-005 Better Auth re-verification');
const adr5 = adrText.get(5) ?? '';
for (const [name, phrase] of [
  ['date of the check', '2026-11-09'],
  ['the pinned version', '1.7.18'],
  ['the fixed-in version of the November release', '1.7.16'],
  ['the November security release', '2026-11-03'],
  ['the 12 advisories', /12 advisories/],
  ['maintenance status', /maintenance/i],
  ['release cadence', /cadence/i],
  ['open security advisories', /advisor/i],
  ['Drizzle adapter support', /@better-auth\/drizzle-adapter/],
  ['the anonymous (guest) plugin', /anonymous/i],
  ['a verdict', /verdict/i],
  ['a fallback if it fails', /fallback/i],
  ['the 14-day rule exception', /exception/i],
  ['what could not be checked', /could not|not checked|not verified/i],
  ['the pin the developer chose is a decision, not an assumption', /chose|decided|accepted/i],
]) {
  check(`ADR-005 records ${name}`, !missing(adr5, [phrase]));
}

console.log('ADR-006, ADR-007 agree with the configuration they describe');
const commitlint = read('commitlint.config.js');
const adr6 = adrText.get(6) ?? '';
for (const type of ['feat', 'fix', 'refactor', 'test', 'docs', 'chore', 'ci']) {
  check(
    `commitlint allows "${type}" and ADR-006 names it`,
    commitlint.includes(`'${type}'`) && adr6.includes(type),
  );
}
const pkg = JSON.parse(read('package.json') || '{}');
const adr5Typescript = /typescript[^\n]*6\.0\.3|6\.0\.3[^\n]*typescript/i.test(adr5);
check(
  'ADR-005 cites the installed TypeScript version',
  pkg.devDependencies?.typescript === '6.0.3' && adr5Typescript,
);
const adr2 = adrText.get(2) ?? '';
const eslintConfig = read('eslint.config.js');
for (const banned of ['Math.random', 'performance', 'window', 'document', 'process']) {
  check(
    `eslint config bans ${banned} and ADR-002 names it`,
    eslintConfig.includes(banned) && adr2.includes(banned),
  );
}

console.log('DECISIONS.md');
const dec = read('DECISIONS.md');
const rows = new Map();
for (const line of dec.split('\n')) {
  const cells = line.split('|').map((c) => c.trim());
  if (cells.length >= 6 && /^\[?ADR-\d{3}\b/.test(cells[1] ?? ''))
    rows.set(cells[1].match(/ADR-\d{3}/)[0], cells);
}
for (const adr of ADRS) {
  const id = `ADR-${String(adr.n).padStart(3, '0')}`;
  const cells = rows.get(id) ?? [];
  check(`index row ${id} is Accepted`, cells[4] === 'Accepted', cells[4]);
  check(
    `index row ${id} links its file`,
    cells[1]?.includes(`(${adrFile.get(adr.n)})`) === true &&
      existsSync(path.join(root, adrFile.get(adr.n) ?? '')),
    cells[1],
  );
}
for (let n = 9; n <= 16; n += 1) {
  const id = `ADR-${String(n).padStart(3, '0')}`;
  check(`index row ${id} is still Planned`, rows.get(id)?.[4] === 'Planned', rows.get(id)?.[4]);
}
check('index no longer says "None written yet"', !/None written yet/i.test(dec));
const d12 = dec.split('\n').find((l) => /^\|\s*D-12\s*\|/.test(l)) ?? '';
check('D-12 is settled by ADR-008', /Settled by \[?ADR-008/.test(d12), d12);
for (const id of [
  'D-01',
  'D-02',
  'D-03',
  'D-04',
  'D-05',
  'D-06',
  'D-07',
  'D-08',
  'D-09',
  'D-11',
  'D-13',
]) {
  const row = dec.split('\n').find((l) => new RegExp(`^\\|\\s*${id}\\s*\\|`).test(l)) ?? '';
  check(`${id} is untouched (still Open)`, /\|\s*Open\s*\|\s*$/.test(row), row.slice(-40));
}
const baRow = dec.split('\n').find((l) => /^\|\s*`better-auth`\s*\|/.test(l)) ?? '';
// The note in the row may mention the old pin (1.7.12) to explain the change; only the pin cell counts.
check(
  'pin table pins better-auth at 1.7.18',
  baRow.split('|')[2]?.trim() === '1.7.18',
  baRow.slice(0, 80),
);
check(
  'pin table row says the pin is a security exception',
  /security/i.test(baRow) && /exception/i.test(baRow),
);
check(
  'pin rule text allows a security-fix exception',
  /security[^\n]*(exception|fix)|(exception|fix)[^\n]*security/i.test(
    dec.split('### Runtime and package manager')[0] ?? '',
  ),
);
for (const kept of [
  'ADR-005 input: dependency pins',
  'M0-T03 verification notes',
  'M0-T04 verification notes',
  'GitHub Actions pins (M0-T04)',
  'M0-T03 inputs for ADR-006 and ADR-007',
  'M0-T04 inputs for ADR-005, ADR-006 and ADR-007',
]) {
  check(
    `keeps section "${kept}"`,
    dec.split('\n').some((l) => l.replace(/^#+ /, '').trim() === kept && l.startsWith('#')),
  );
}
check(
  'adds the "M0-T06 verification notes" section',
  /^#{2,3} M0-T06 verification notes\s*$/m.test(dec),
);

console.log('License');
const license = read('LICENSE');
check('LICENSE exists and says all rights reserved', /all rights reserved/i.test(license));
check(
  'LICENSE grants no permission until a license is published',
  /no (permission|license)/i.test(license),
);
for (const file of [
  'package.json',
  'packages/engine/package.json',
  'packages/protocol/package.json',
  'apps/server/package.json',
  'apps/web/package.json',
]) {
  const json = JSON.parse(read(file) || '{}');
  check(
    `${file} declares "license": "UNLICENSED"`,
    json.license === 'UNLICENSED',
    String(json.license),
  );
}

console.log('Close-out: ROADMAP, CHANGELOG, session log, review');
const roadmap = read('ROADMAP.md');
const task = new Map();
for (const line of roadmap.split('\n')) {
  const cells = line.split('|').map((c) => c.trim());
  if (cells.length >= 7 && /^M\d+-T\d+$/.test(cells[1] ?? ''))
    task.set(cells[1], cells.slice(2, 7));
}
check('ROADMAP still has 78 task rows', task.size === 78, String(task.size));
for (const [id, sha] of [
  ['M0-T01', 'cc51e30'],
  ['M0-T02', '80f3dfc'],
  ['M0-T03', 'd90869d'],
  ['M0-T04', '722bf34'],
  ['M0-T05', 'cab55e4'],
]) {
  check(
    `${id} keeps Done and its commit ${sha}`,
    task.get(id)?.[1] === 'Done' && task.get(id)?.[3] === sha,
    JSON.stringify(task.get(id)),
  );
}
check('M0-T06 is Done', task.get('M0-T06')?.[1] === 'Done', JSON.stringify(task.get('M0-T06')));
check(
  'no task after M0-T06 was started',
  [...task]
    .filter(([id]) => id !== 'M0-T06' && !/^M0-T0[1-5]$/.test(id))
    .every(([, r]) => r[1] === 'Not started'),
);
const changelog = read('CHANGELOG.md');
check('CHANGELOG has an M0-T06 entry', changelog.includes('M0-T06'));
check('CHANGELOG records the Better Auth pin change', /better-auth[^\n]*1\.7\.18/i.test(changelog));
check('CHANGELOG records the license decision', /all rights reserved/i.test(changelog));
const session = read('docs/workflow/sessions/2026-11-09-M0-T06.md');
check(
  'session log follows the template',
  !missing(session, [
    '# Session: M0-T06',
    '## Outcome',
    '## What changed',
    '## Verification',
    '## Decisions and deviations',
    '## Follow-ups',
    '## Git',
    '## Next',
  ]),
);
const review = read('docs/reviews/M0-review.md');
check(
  'milestone review exists with strengths, issues and an assessment',
  !missing(review, [/^# .*M0/m, /Strengths/i, /Issues/i, /Assessment/i]),
);
check(
  'the review does not pretend to be independent',
  /not an independent|same conversation/i.test(review),
);

console.log('Scope: nothing of later tasks leaked in');
check(
  'engine still exports only m0SampleAdd',
  /export \{ m0SampleAdd \}/.test(read('packages/engine/src/index.ts')) &&
    !/export \*/.test(read('packages/engine/src/index.ts')),
);
check('no ADR-009 or later file exists', !adrFiles.some((f) => /^ADR-0(09|1\d)/.test(f)));

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
    ['check:links', 'scripts/check-links.mjs', []],
    ['lint fixtures', 'tools/lint-fixtures/lint-fixtures.test.mjs', []],
    ['vitest run', 'node_modules/vitest/vitest.mjs', ['run']],
    ['typedoc', 'node_modules/typedoc/bin/typedoc', []],
    ['verify-t02', 'tools/verify-t02.mjs', []],
    ['verify-t03', 'tools/verify-t03.mjs', []],
    ['verify-t04', 'tools/verify-t04.mjs', []],
    ['verify-t05', 'tools/verify-t05.mjs', []],
  ];
  for (const [name, script, args] of steps) {
    // The lint-fixture suite is written for `node --test`; running it directly would execute it twice.
    const result =
      name === 'lint fixtures'
        ? spawnSync(process.execPath, ['--test', path.join(root, script)], {
            cwd: root,
            encoding: 'utf8',
          })
        : node(script, args);
    check(name, result.status === 0, tail(result, 5));
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
