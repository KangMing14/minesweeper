// Checks a branch name against the git workflow (ADR-006, spec 7.1): `m<n>/M<n>-T<nn>-<slug>` for a task
// (the milestone number must match the task ID) and `chore/<slug>` for work that belongs to no task.
// Usage: `node scripts/check-branch-name.mjs <branch>`; CI passes the pull request's head branch.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TASK_BRANCH = /^m(\d+)\/M\1-T\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CHORE_BRANCH = /^chore\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validates a branch name.
 * @param {string} name - The branch name, for example `m1/M1-T04-iterative-flood-fill`.
 * @returns {string | null} `null` when the name is allowed, otherwise the reason it is not.
 */
export function checkBranchName(name) {
  if (TASK_BRANCH.test(name) || CHORE_BRANCH.test(name)) return null;
  return `Branch "${name}" is not allowed. Use m<n>/M<n>-T<nn>-<slug> (for example m1/M1-T04-iterative-flood-fill) or chore/<slug>, lower case, hyphens only.`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const name = process.argv[2] ?? '';
  const problem = checkBranchName(name);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
  console.log('[check:branch] ok');
}
