/**
 * One ESLint config for the whole monorepo. Both apps share the same TypeScript rules, so
 * a rule tightened here applies everywhere at once instead of drifting between two copies.
 *
 * The rules below encode project conventions (AGENTS.md). Each one exists because
 * the problem it blocks has already happened in this codebase at least once; do not relax a
 * rule to make a change pass. Fix the code, or change the convention deliberately.
 */
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import svelte from 'eslint-plugin-svelte'
import tseslint from 'typescript-eslint'
import type { Linter } from 'eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const SRS = 'apps/gokan-srs'
const DICTIONARY = 'apps/gokan-dictionary'

/**
 * Casts that switch the type checker off as completely as `any` does. A value that does
 * not fit its type needs a real fix (a type guard, a corrected type, a full fixture).
 */
const TYPE_ESCAPE_HATCHES = [
  {
    selector: 'TSAsExpression > TSNeverKeyword.typeAnnotation',
    message: '`as never` disables type checking. Fix the type instead.',
  },
  {
    selector: "TSAsExpression[expression.type='TSAsExpression'][expression.typeAnnotation.type='TSUnknownKeyword']",
    message: '`as unknown as` disables type checking. Fix the type instead.',
  },
]

/** Everything is typed: no `any`, explicit or leaked through an untyped value. */
const typingRules: Linter.RulesRecord = {
  '@typescript-eslint/no-explicit-any': ['error', { fixToUnknown: false, ignoreRestArgs: false }],
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-argument': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
  '@typescript-eslint/no-unsafe-function-type': 'error',
  '@typescript-eslint/ban-ts-comment': [
    'error',
    {
      'ts-ignore': true,
      'ts-nocheck': true,
      'ts-check': false,
      'ts-expect-error': 'allow-with-description',
      minimumDescriptionLength: 10,
    },
  ],
  // An object literal asserted to a type skips the missing-property check entirely.
  '@typescript-eslint/consistent-type-assertions': [
    'error',
    { assertionStyle: 'as', objectLiteralTypeAssertions: 'allow-as-parameter' },
  ],
  // A union switch must name every member, so adding a SessionState (or any union member)
  // fails to compile everywhere it is not handled yet.
  '@typescript-eslint/switch-exhaustiveness-check': [
    'error',
    { considerDefaultExhaustiveForUnions: true, requireDefaultForNonUnion: false },
  ],
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
  ],
  'no-console': ['error', { allow: ['warn', 'error'] }],
  // One import statement per module (a separate 'import type' line is fine).
  'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],
  'no-restricted-syntax': ['error', ...TYPE_ESCAPE_HATCHES],
}

const LOCAL_STORAGE = { name: 'localStorage', message: 'Use StorageService (services/storage.service.ts).' }
const SESSION_STORAGE = { name: 'sessionStorage', message: 'Use usePersistedControls (hooks/usePersistedControls.ts).' }
const FETCH = { name: 'fetch', message: 'Network calls belong in a service under services/.' }

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/node_modules/**',
    '**/.deploy-stage/**',
    `${SRS}/dataset/**`,
    `${SRS}/public/**`,
    `${SRS}/terraform/**`,
  ]),

  // ---------------------------------------------------------------- every TypeScript file
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.svelte'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    // A disable comment that no longer suppresses anything is noise that hides the next real one.
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    languageOptions: {
      ecmaVersion: 2022,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
    rules: typingRules,
  },

  // ---------------------------------------------------------------- command-line scripts
  // Build and maintenance scripts run in Node/Bun, and their console output is their interface.
  {
    files: ['*.ts', 'scripts/**/*.ts', `${SRS}/scripts/**/*.ts`, `${DICTIONARY}/scripts/**/*.ts`],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },

  // ---------------------------------------------------------------- gokan-srs (React)
  {
    files: [`${SRS}/**/*.{ts,tsx}`],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
  },
  {
    files: [`${SRS}/scripts/**/*.ts`, `${SRS}/vite.config.ts`],
    languageOptions: { globals: globals.node },
  },
  {
    // Pure state: the reducers and selectors never read the clock or a random source. The
    // orchestration layer passes `now` (and any randomness) in, which is what keeps them
    // deterministic and unit-testable.
    files: [`${SRS}/src/context/quiz/*Reducer.ts`, `${SRS}/src/context/quiz/*Selectors.ts`],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...TYPE_ESCAPE_HATCHES,
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Reducers and selectors are pure: take `now` as an argument.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Reducers and selectors are pure: take `now` as an argument.',
        },
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'Reducers and selectors are pure: compute randomness in the orchestration layer and pass it in.',
        },
      ],
    },
  },
  // Persistence goes through one typed layer: StorageService for localStorage, and
  // usePersistedControls for per-screen UI state in sessionStorage. Direct access elsewhere
  // duplicates serialization and skips the guards a private window or a full quota needs.
  // Network access lives in services/, so pages and contexts never own HTTP details.
  {
    files: [`${SRS}/src/**/*.{ts,tsx}`],
    ignores: [`${SRS}/src/services/**`, `${SRS}/src/hooks/usePersistedControls.ts`, `${SRS}/src/**/*.test.ts`],
    rules: { 'no-restricted-globals': ['error', LOCAL_STORAGE, SESSION_STORAGE, FETCH] },
  },
  {
    files: [`${SRS}/src/services/**/*.ts`],
    ignores: [
      `${SRS}/src/services/storage.service.ts`,
      `${SRS}/src/**/*.test.ts`,
    ],
    rules: { 'no-restricted-globals': ['error', LOCAL_STORAGE, SESSION_STORAGE] },
  },
  {
    files: [`${SRS}/src/hooks/usePersistedControls.ts`],
    rules: { 'no-restricted-globals': ['error', LOCAL_STORAGE, FETCH] },
  },

  // ---------------------------------------------------------------- app boundaries
  // The apps never import from each other. Code both need goes in a package under packages/
  // (compiled-dataset types are @gokan/dataset-schema), never a second copy in each app.
  {
    files: [`${SRS}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['**/gokan-dictionary/**'], message: 'Share it through a package under packages/.' }] }],
    },
  },
  {
    files: [`${DICTIONARY}/**/*.{ts,svelte}`],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['**/gokan-srs/src/**'], message: 'Share it through a package under packages/.' }] }],
    },
  },

  // ---------------------------------------------------------------- gokan-dictionary (Svelte)
  {
    files: [`${DICTIONARY}/**/*.svelte`],
    extends: [svelte.configs.recommended],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    files: [`${DICTIONARY}/src/client/**/*.ts`, `${DICTIONARY}/src/pages/**/*.ts`],
    languageOptions: { globals: globals.browser },
  },
  {
    files: [`${DICTIONARY}/scripts/**/*.ts`, `${DICTIONARY}/src/lib/**/*.ts`, `${DICTIONARY}/vite.config.ts`],
    languageOptions: { globals: globals.node },
  },
])
