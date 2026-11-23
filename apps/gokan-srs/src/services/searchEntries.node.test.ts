import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { kanjiFromColumns } from '@gokan/dataset-schema';
import { searchEntries, searchEntriesModule } from '../../scripts/searchEntries';
import { prepareAppSearch, searchApp } from '../utils/search.utils';

// The header search's rows as the build writes them (virtual:gokan-search-entries),
// from the real dataset checkout, and the issue's queries against them (#264).
const COMPILED = fileURLToPath(new URL('../../dataset/compiled/', import.meta.url));
const entries = searchEntries(COMPILED);
const index = prepareAppSearch(entries);

describe('the build\'s search entries', () => {
    it('holds every word in frequency order, every kanji with its meanings and readings, and every grammar point', () => {
        expect(entries.w[0].length).toBeGreaterThan(30000);
        expect(entries.k[0].length).toBeGreaterThan(2000);
        expect(entries.g.length).toBeGreaterThan(700);
        expect(kanjiFromColumns(entries.k).find(row => row[0] === '水')).toEqual(['水', 5, expect.any(Number), 'water', expect.stringContaining('スイ')]);
    });

    it('finds the word 水 first for water and みず', () => {
        for (const query of ['water', 'みず']) expect(searchApp(index, query).hits.find(hit => hit.group === 'words')?.hit.row[1]).toBe('水');
    });

    it('finds the kanji 水 by its character, meaning and readings', () => {
        for (const query of ['水', 'water', 'みず', 'すい', 'sui']) expect(searchApp(index, query).hits.find(hit => hit.group === 'kanji')?.row[0]).toBe('水');
    });

    it('finds the point てから by its title and romaji', () => {
        for (const query of ['てから', 'te kara', 'tekara']) expect(searchApp(index, query).hits.find(hit => hit.group === 'grammar')?.row[1]).toContain('てから');
    });

    it('writes a module of the three lists', () => {
        expect(searchEntriesModule(COMPILED)).toMatch(/^export const words = \[.*\];\nexport const kanji = \[.*\];\nexport const grammar = \[.*\];\n$/s);
    });
});
