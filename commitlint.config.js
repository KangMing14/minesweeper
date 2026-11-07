// Conventional Commits plus the project rules of spec section 7.1: a fixed set of types and scopes, and a
// task ID (`[M1-T04]`, or `[chore]` for work that belongs to no task) at the end of the subject.
// GitHub appends ` (#12)` when it squash-merges a PR, so that suffix is allowed after the task ID.
const TASK_ID_AT_END = /\[(?:M\d+-T\d+|chore)\](?: \(#\d+\))?$/;

export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'task-id-in-subject': ({ header }) => [
          TASK_ID_AT_END.test(header ?? ''),
          'the subject must end with a task ID such as [M1-T04], or [chore] for work outside any task',
        ],
      },
    },
  ],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'test', 'docs', 'chore', 'ci']],
    // Scope is optional: repository-wide changes omit it. When present it must be a package or docs.
    'scope-enum': [2, 'always', ['engine', 'protocol', 'server', 'web', 'docs']],
    'task-id-in-subject': [2, 'always'],
    // Subjects often start with an acronym (PRNG, ADR, API), which the default case rule would reject.
    'subject-case': [0],
  },
};
