/**
 * Duplicate-code check (`bun run check:duplicates`), two passes over the same sources:
 *  - production code at a strict floor: any copied block worth sharing fails;
 *  - tests at a higher floor: a short repeated arrange step is normal test style, but a
 *    copied fixture factory or a large pasted block is not (fixtures live in src/test/fixtures.ts).
 *
 * jscpd ignores a config file's `path` list, so the paths are passed here explicitly.
 */
import { spawnSync } from 'node:child_process';

const SOURCES = ['apps/gokan-srs/src', 'apps/gokan-srs/scripts', 'apps/gokan-dictionary/src', 'apps/gokan-dictionary/scripts', 'packages', 'scripts'];
const TESTS = ['**/*.test.ts', '**/*.test.tsx', '**/__fixtures__/**'];

const passes = [
    { name: 'production code', minTokens: 60, minLines: 6, ignore: TESTS },
    { name: 'tests', minTokens: 120, minLines: 12, ignore: [] as string[] },
];

let failed = false;
for (const pass of passes) {
    const args = [
        'jscpd', ...SOURCES,
        '--config', '.jscpd.json',
        '--min-tokens', String(pass.minTokens),
        '--min-lines', String(pass.minLines),
        ...(pass.ignore.length ? ['--ignore', ['**/node_modules/**', '**/dist/**', ...pass.ignore].join(',')] : []),
    ];
    console.log(`\nDuplicates in ${pass.name} (>= ${pass.minTokens} tokens, ${pass.minLines} lines):`);
    const result = spawnSync('bunx', args, { stdio: 'inherit', shell: process.platform === 'win32' });
    if (result.status !== 0) failed = true;
}
if (failed) {
    console.error('\nDuplicated code found. Share it (a component, hook, util or fixture) instead of copying it. See AGENTS.md.');
    process.exit(1);
}
