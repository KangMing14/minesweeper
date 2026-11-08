// Checks every relative link in the repository's Markdown files (M0-T05).
// A link is broken when its target file or directory does not exist, or when its `#anchor` does not match
// a heading in the target Markdown file. External links (https:, mailto:, ...) are never fetched: a CI run
// must not depend on the network, and a flaky website must not block a merge.
// Usage: node scripts/check-links.mjs [--root <directory>]     (exit code 1 when any link is broken)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Directories that hold generated, vendored or third-party files, never hand-written project docs.
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.worktrees',
  'worktrees',
]);
// `docs/api` is the TypeDoc output (a CI artifact); it is matched by relative path below.
const SKIPPED_PATHS = new Set(['docs/api']);

/** Finds every `.md` file under `root`, skipping generated and vendored directories. */
function findMarkdown(root, relative = '') {
  const found = [];
  for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name) || SKIPPED_PATHS.has(child)) continue;
      found.push(...findMarkdown(root, child));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      found.push(child);
    }
  }
  return found.sort();
}

/**
 * Replaces fenced code blocks and inline code spans with blanks of the same length. Links shown as
 * examples inside code are documentation, not navigation, and line numbers must stay correct.
 */
function blankCode(text) {
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  return text
    .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, blank)
    .replace(/(`+)[^`\n]+?\1/g, blank);
}

/** GitHub's heading-to-anchor rule: lower case, drop punctuation, spaces become hyphens. */
function slug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');
}

/** All anchors a Markdown file offers, including GitHub's `-1`, `-2` suffixes for repeated headings. */
function anchorsOf(text) {
  const seen = new Map();
  const anchors = new Set();
  for (const line of blankCode(text).split('\n')) {
    const match = line.match(/^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$/);
    if (!match) continue;
    // Link text inside a heading contributes only its label to the anchor.
    const base = slug((match[1] ?? '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'));
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

/** Link targets with their 1-based line numbers: inline links, images and reference definitions. */
function extractLinks(text) {
  const links = [];
  const lines = blankCode(text).split('\n');
  lines.forEach((line, index) => {
    for (const m of line.matchAll(/!?\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) {
      links.push({ line: index + 1, target: (m[1] ?? '').replace(/^<|>$/g, '') });
    }
    const definition = line.match(/^ {0,3}\[[^\]]+\]:\s*(<[^>]*>|\S+)/);
    if (definition)
      links.push({ line: index + 1, target: (definition[1] ?? '').replace(/^<|>$/g, '') });
  });
  return links;
}

/** Checks one directory tree and returns a list of `file:line: problem` strings. */
export function checkLinks(root) {
  const problems = [];
  const anchorCache = new Map();
  const anchorsFor = (relative) => {
    if (!anchorCache.has(relative)) {
      anchorCache.set(relative, anchorsOf(readFileSync(path.join(root, relative), 'utf8')));
    }
    return anchorCache.get(relative);
  };

  for (const file of findMarkdown(root)) {
    const text = readFileSync(path.join(root, file), 'utf8');
    for (const { line, target } of extractLinks(text)) {
      // `https:`, `mailto:` and similar: not checked (see the header comment).
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      const [rawPath = '', ...rest] = target.split('#');
      const anchor = rest.join('#');
      const where = `${file}:${line}`;

      let resolved;
      if (rawPath === '') resolved = file;
      else {
        const clean = decodeURI(rawPath.split('?')[0] ?? '');
        // A leading slash means the repository root on GitHub.
        resolved = path
          .normalize(clean.startsWith('/') ? clean.slice(1) : path.join(path.dirname(file), clean))
          .split(path.sep)
          .join('/');
      }
      const absolute = path.join(root, resolved);
      if (resolved.startsWith('..') || !existsSync(absolute)) {
        problems.push(`${where}: broken link to ${target}: ${resolved} does not exist`);
        continue;
      }
      if (anchor && statSync(absolute).isFile() && resolved.endsWith('.md')) {
        let wanted = anchor;
        try {
          wanted = decodeURIComponent(anchor);
        } catch {
          // Keep the raw anchor: a malformed escape simply will not match a heading.
        }
        if (!anchorsFor(resolved).has(wanted.toLowerCase())) {
          problems.push(`${where}: broken anchor #${anchor} in ${resolved}`);
        }
      }
    }
  }
  return problems;
}

// Run as a command; importing the module (for a test) has no side effects.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rootFlag = process.argv.indexOf('--root');
  const root = path.resolve(
    rootFlag >= 0 && process.argv[rootFlag + 1]
      ? (process.argv[rootFlag + 1] ?? '.')
      : path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
  );
  const problems = checkLinks(root);
  if (problems.length > 0) {
    console.error(`[check:links] ${problems.length} broken link(s):`);
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log('[check:links] ok');
}
