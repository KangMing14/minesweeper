// Fails when a code, workflow or shell file contains a TODO, FIXME, XXX or HACK that does not name a task:
// `TODO(M6-T04)` is allowed, a bare TODO or `TODO:` is not (spec section 7.2: every TODO names a task, CI
// fails on a bare one). Markdown is not scanned: the documents discuss the rule.
// Usage: `node scripts/check-todos.mjs [file ...]`. Without arguments it scans the whole repository.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Matches a marker word when it is not immediately followed by a task reference. */
const BARE_TODO = /\b(?:TODO|FIXME|XXX|HACK)\b(?!\(M\d+-T\d+\))/g;

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.yml',
  '.yaml',
  '.sh',
]);
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.husky',
  '.worktrees',
  'worktrees',
]);
// Why skipped: fixtures contain bare TODOs on purpose, and docs/api is generated output.
const SKIPPED_PREFIXES = ['tools/lint-fixtures/cases/', 'docs/api/'];

/**
 * Finds every TODO in `text` that does not name a task.
 * @param {string} text - File contents.
 * @returns {{ line: number, text: string }[]} One entry per offending line.
 */
export function findBareTodos(text) {
  const found = [];
  text.split(/\r?\n/).forEach((lineText, index) => {
    BARE_TODO.lastIndex = 0;
    if (BARE_TODO.test(lineText)) found.push({ line: index + 1, text: lineText.trim() });
  });
  return found;
}

/**
 * Says whether the scan reads a file.
 * @param {string} relativePath - Repo-relative path.
 * @returns {boolean} `true` when the file is scanned.
 */
export function isChecked(relativePath) {
  const posix = relativePath.split(path.sep).join('/');
  if (posix === 'scripts/check-todos.mjs') return false; // this file documents the marker word
  if (SKIPPED_PREFIXES.some((prefix) => posix.startsWith(prefix))) return false;
  return SOURCE_EXTENSIONS.has(path.extname(posix));
}

function* walk(directory, root) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) yield* walk(path.join(directory, entry.name), root);
    } else if (entry.isFile()) {
      yield path.relative(root, path.join(directory, entry.name));
    }
  }
}

/**
 * Scans files and reports every bare TODO.
 * @param {string} root - Repository root.
 * @param {string[]} files - Repo-relative or absolute paths; empty means the whole repository.
 * @returns {string[]} Human-readable violations, empty when clean.
 */
export function scan(root, files = []) {
  const candidates =
    files.length > 0
      ? files.map((file) => path.relative(root, path.resolve(root, file)))
      : [...walk(root, root)];
  const violations = [];
  for (const relative of candidates) {
    if (
      !isChecked(relative) ||
      !statSync(path.join(root, relative), { throwIfNoEntry: false })?.isFile()
    )
      continue;
    for (const hit of findBareTodos(readFileSync(path.join(root, relative), 'utf8'))) {
      violations.push(
        `${relative}:${hit.line}: TODO, FIXME, XXX and HACK must name a task, e.g. TODO(M6-T04): ${hit.text}`,
      );
    }
  }
  return violations;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const violations = scan(root, process.argv.slice(2));
  if (violations.length > 0) {
    console.error(violations.join('\n'));
    console.error(`\n${violations.length} unnamed marker(s). Name the task: // TODO(M6-T04): ...`);
    process.exit(1);
  }
  console.log('[check:todos] ok');
}
