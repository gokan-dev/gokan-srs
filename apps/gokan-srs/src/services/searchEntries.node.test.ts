import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { searchEntries, searchEntriesModule } from '../../scripts/searchEntries';
import { prepareAppSearch, searchApp } from '../utils/search.utils';

// The header search's kanji and grammar rows as the build writes them (virtual:gokan-search-entries),
// from the real dataset checkout, and the issue's queries against them (#264).
const COMPILED = fileURLToPath(new URL('../../dataset/compiled/', import.meta.url));
const entries = searchEntries(COMPILED);
const index = prepareAppSearch([], entries.kanji, entries.grammar);

describe('the build\'s search entries', () => {
    it('holds every kanji with its meanings and readings, and every grammar point', () => {
        expect(entries.kanji.length).toBeGreaterThan(2000);
        expect(entries.grammar.length).toBeGreaterThan(700);
        expect(entries.kanji.find(row => row[0] === '水')).toEqual(['水', 5, expect.any(Number), 'water', expect.stringContaining('スイ')]);
    });

    it('finds the kanji 水 by its character, meaning and readings', () => {
        for (const query of ['水', 'water', 'みず', 'すい', 'sui']) expect(searchApp(index, query).kanji[0]?.[0]).toBe('水');
    });

    it('finds the point てから by its title and romaji', () => {
        for (const query of ['てから', 'te kara', 'tekara']) expect(searchApp(index, query).grammar[0]?.[1]).toContain('てから');
    });

    it('writes a module of the two lists', () => {
        expect(searchEntriesModule(COMPILED)).toMatch(/^export const kanji = \[.*\];\nexport const grammar = \[.*\];\n$/s);
    });
});
