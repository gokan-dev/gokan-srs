import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { definitionsOf, equivalentsOf, isShown, translationsOf } from './text';

const VALUE_IMPORT = /^(?:import|export)\s+(?!type\b)[^;]*?\sfrom\s+'([^']+)'/gm;

/** Every module `entry` reaches through value imports (type-only ones carry no code). */
function valueImportsOf(entry: string, seen = new Set<string>()): Set<string> {
    if (seen.has(entry)) return seen;
    seen.add(entry);
    for (const [, specifier] of readFileSync(entry, 'utf8').matchAll(VALUE_IMPORT)) {
        if (!specifier.startsWith('.')) {
            seen.add(specifier);
            continue;
        }
        valueImportsOf(resolve(dirname(entry), `${specifier}.ts`), seen);
    }
    return seen;
}

describe('@gokan/dataset-schema/text', () => {
    it('imports nothing from node:, so it runs where the published dataset is read', () => {
        const reached = [...valueImportsOf(fileURLToPath(new URL('./text.ts', import.meta.url)))];
        // The acceptance rule and the accessors are reached, so the walk is following the re-exports.
        expect(reached.some(module => module.endsWith('text/acceptance.ts'))).toBe(true);
        expect(reached.some(module => module.endsWith('text/renderings.ts'))).toBe(true);
        expect(reached.filter(module => module.startsWith('node:'))).toEqual([]);
    });

    it('is the dataset\'s acceptance rule and accessors', () => {
        const source = { source: 'jawiktionary', ref: '飲む' };
        const text = {
            'zh-hans': {
                renderings: [
                    { id: 'a', role: 'equivalent' as const, source, match: 'spelling+reading' as const, status: 'corroborated' as const, value: '喝' },
                    { id: 'b', role: 'translation' as const, source: { source: 'tatoeba-cmn', ref: '1' }, match: 'id' as const, status: 'imported' as const, value: '我喝水。' },
                ],
            },
        };
        expect(equivalentsOf(text, 'zh-hans').map(equivalent => equivalent.id)).toEqual(['a']);
        expect(definitionsOf(text, 'zh-hans')).toEqual([]);
        expect(translationsOf(text, 'zh-hans')).toEqual([{ ref: '1', text: '我喝水。' }]);
        expect(isShown({ status: 'imported', source })).toBe(false);
        expect(isShown({ status: 'corroborated', source })).toBe(true);
        expect(isShown({ status: 'rejected', source: { source: 'zhwiktionary' } })).toBe(false);
    });
});
