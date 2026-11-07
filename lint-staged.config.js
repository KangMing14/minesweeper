// Fast feedback on staged files (spec 7.1). CI is the authority; this just catches problems early.
import path from 'node:path';

/**
 * Quotes a staged file for the command line. lint-staged passes absolute paths; relative forward-slash
 * paths avoid doubled backslashes on Windows and keep the command output short.
 */
const quote = (file) =>
  JSON.stringify(path.relative(process.cwd(), file).split(path.sep).join('/'));

/** Workspace directories (e.g. `packages/engine`) that contain at least one staged TypeScript file. */
function stagedPackages(files) {
  const roots = new Set();
  for (const file of files) {
    const match = path
      .relative(process.cwd(), file)
      .split(path.sep)
      .join('/')
      .match(/^(packages|apps)\/[^/]+/);
    if (match) roots.add(match[0]);
  }
  return [...roots];
}

export default {
  '*.{ts,tsx,mts,cts}': (files) => [
    `eslint ${files.map(quote).join(' ')}`,
    `prettier --check ${files.map(quote).join(' ')}`,
    // Type-check each touched package (and, through project references, what it depends on).
    ...stagedPackages(files).map((dir) => `tsc -b ${dir}`),
    `node scripts/check-todos.mjs ${files.map(quote).join(' ')}`,
  ],
  '*.{js,mjs,cjs}': (files) => [
    `eslint ${files.map(quote).join(' ')}`,
    `prettier --check ${files.map(quote).join(' ')}`,
    `node scripts/check-todos.mjs ${files.map(quote).join(' ')}`,
  ],
  '*.{json,yml,yaml}': (files) => [`prettier --check ${files.map(quote).join(' ')}`],
};
