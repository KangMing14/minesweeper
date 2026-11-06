// ESLint flat config. Enforces three things automatically (spec sections 4.1, 4.2 and 7.2):
//   1. documentation: TSDoc syntax everywhere, doc comments on exports;
//   2. architecture: the inward dependency rule between packages;
//   3. engine purity: no clocks, randomness, DOM or Node APIs inside `packages/engine`.
// Rule behaviour is pinned by the fixtures in tools/lint-fixtures (run `pnpm test:lint-fixtures`).
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import jsdoc from 'eslint-plugin-jsdoc';
import tsdoc from 'eslint-plugin-tsdoc';
import tseslint from 'typescript-eslint';

const TS_FILES = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];
const PACKAGE_PREFIX = '@minesweeper/';

// Why a list of names rather than a plugin: the engine must stay free of anything that makes a game
// non-reproducible (time, randomness) or environment-bound (DOM, Node). Time enters as `Command.t`.
const ENGINE_BANNED_GLOBALS = ['Date', 'performance', 'window', 'document', 'process'];

const bannedGlobalMessage = (name) => ({
  name,
  message: `\`${name}\` is not allowed in packages/engine: the engine is deterministic and free of clocks, DOM and Node APIs (spec 4.1).`,
});

const engineBannedProperties = [
  {
    object: 'Math',
    property: 'random',
    message: 'Math.random is not allowed in packages/engine: use the seeded Prng (spec 4.1).',
  },
  // `globalThis.X` would sidestep no-restricted-globals.
  ...ENGINE_BANNED_GLOBALS.map((name) => ({
    object: 'globalThis',
    property: name,
    message: `globalThis.${name} is not allowed in packages/engine (spec 4.1).`,
  })),
];

/** Builds a no-restricted-imports option that forbids workspace packages (except the allowed ones). */
const workspaceImports = (allowed, why) => ({
  patterns: [
    {
      group: [`${PACKAGE_PREFIX}*`, ...allowed.map((name) => `!${PACKAGE_PREFIX}${name}`)],
      message: why,
    },
  ],
});

const requireJsdocOptions = {
  publicOnly: { esm: true, cjs: false, window: false },
  require: {
    FunctionDeclaration: true,
    ClassDeclaration: true,
    ArrowFunctionExpression: false,
    FunctionExpression: false,
    MethodDefinition: false,
  },
  // Exports that are not functions or classes: interfaces, type aliases, enums and constants.
  contexts: [
    'TSInterfaceDeclaration',
    'TSTypeAliasDeclaration',
    'TSEnumDeclaration',
    'VariableDeclaration',
  ],
  checkConstructors: false,
};

// Spec 7.2: `@example` is required on the public API of engine and protocol. `jsdoc/require-example`
// has no `publicOnly` option, so the exported declarations are selected directly. Limit: a symbol that is
// declared first and exported later (`export { name }`) is covered by require-jsdoc but not by this rule,
// so declare and export in one statement.
const requireExampleOptions = {
  // Selecting the export statement (not the declaration inside it) is what makes `export const` work:
  // jsdoc does not resolve the comment of a variable declaration nested in an export.
  contexts: ['ExportNamedDeclaration', 'ExportDefaultDeclaration'],
};

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    'docs/api/**',
    '.husky/_/**',
    // Fixtures are deliberately broken. They are linted as virtual files by the fixture tests.
    'tools/lint-fixtures/cases/**',
  ]),

  js.configs.recommended,

  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      // Tooling scripts run on Node. Listed by hand to avoid a dependency on the `globals` package.
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly', Buffer: 'readonly' },
    },
  },

  {
    files: TS_FILES,
    extends: [tseslint.configs.recommended],
    plugins: { tsdoc, jsdoc },
    rules: {
      'tsdoc/syntax': 'error',
    },
  },

  // Documentation: errors in the packages that form the public contract, warnings in the apps.
  {
    files: ['packages/engine/**/*.ts', 'packages/protocol/**/*.ts'],
    rules: {
      'jsdoc/require-jsdoc': ['error', requireJsdocOptions],
      'jsdoc/require-example': ['error', requireExampleOptions],
    },
  },
  {
    // Tests rarely export anything, and an example on a test helper is noise.
    files: ['packages/engine/**/*.test.ts', 'packages/protocol/**/*.test.ts'],
    rules: { 'jsdoc/require-example': 'off' },
  },
  {
    files: ['apps/*/**/*.ts', 'apps/*/**/*.tsx'],
    rules: {
      // TODO(M5-T03): change this to 'error' (spec 7.2: warning until M5, error afterwards).
      'jsdoc/require-jsdoc': ['warn', requireJsdocOptions],
    },
  },

  // Dependency direction: engine <- protocol <- apps; the two apps never import each other.
  {
    files: ['packages/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [`${PACKAGE_PREFIX}*`],
              message: 'engine imports nothing project-internal (spec 4.1).',
            },
            {
              group: ['**/packages/**', '**/apps/**'],
              message: 'engine imports nothing outside its own src.',
            },
            { group: ['node:*'], message: 'engine must not use Node APIs (spec 4.1).' },
          ],
        },
      ],
      'no-restricted-globals': ['error', ...ENGINE_BANNED_GLOBALS.map(bannedGlobalMessage)],
      'no-restricted-properties': ['error', ...engineBannedProperties],
    },
  },
  {
    // Tests may measure time (the 16 ms flood-fill budget is a performance test), so only globals are relaxed.
    files: ['packages/engine/**/*.test.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  {
    files: ['packages/protocol/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...workspaceImports(['engine'], 'protocol imports only engine types (spec 4.1).')
              .patterns,
            { group: ['**/apps/**'], message: 'protocol must not import from apps.' },
            { group: ['node:*'], message: 'protocol is shared with the browser: no Node APIs.' },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/server/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: [`${PACKAGE_PREFIX}web`], message: 'apps/server must not import apps/web.' },
            {
              group: ['**/apps/web/**', '**/web/src/**'],
              message: 'apps/server must not import apps/web.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [`${PACKAGE_PREFIX}server`],
              message: 'apps/web must not import apps/server.',
            },
            {
              group: ['**/apps/server/**', '**/server/src/**'],
              message: 'apps/web must not import apps/server.',
            },
          ],
        },
      ],
    },
  },
]);
