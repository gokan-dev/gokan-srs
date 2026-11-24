// Search behaves the same in both apps: for the same query, gokan-srs's header search and the
// dictionary's header panel and /search/ page list the same rows in the same order. Each side is
// built as it ships, from the dataset checkout: the app's index as its build writes it
// (apps/gokan-srs/scripts/searchEntries.ts), the dictionary's English index as its prerender
// writes it (pagesOf(...).searchIndex(), the core and full files), each searched through its own
// app's call (searchApp, rankedSearch). Lives here, outside both apps, because neither may import
// the other.

import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { RankedHit } from '@gokan/dataset-schema';
import { searchEntries } from '../apps/gokan-srs/scripts/searchEntries';
import { prepareAppSearch, searchApp } from '../apps/gokan-srs/src/utils/search.utils';
import { checkoutData } from '../apps/gokan-dictionary/src/lib/dataset.server';
import { pagesOf } from '../apps/gokan-dictionary/src/lib/server/pages';
import { prepareIndex, rankedSearch } from '../apps/gokan-dictionary/src/lib/searchQuery';

const COMPILED = fileURLToPath(new URL('../apps/gokan-srs/dataset/compiled/', import.meta.url));

/** A hit as `type:id`, the same for both apps' rows. */
function label(hit: RankedHit<readonly [string, ...unknown[]], readonly [string, ...unknown[]], readonly [string, ...unknown[]]>): string {
    switch (hit.group) {
        case 'words': return `word:${hit.hit.row[0]}`;
        case 'kanji': return `kanji:${hit.row[0]}`;
        case 'grammar': return `grammar:${hit.row[0]}`;
    }
}

const QUERIES = ['water', 'sui', '水', 'から', 'taberu', '食べた', 'te form', 'gaku'];

describe('search parity between gokan-srs and the dictionary', async () => {
    const app = prepareAppSearch(searchEntries(COMPILED));
    const { core, full } = await pagesOf(checkoutData(COMPILED, 'en'), 'en').searchIndex();
    const dictionary = prepareIndex([core, full], 'en');

    it.each(QUERIES)('lists the same rows in the same order for %s', query => {
        const appRows = searchApp(app, query).hits.map(label);
        const dictionaryRows = rankedSearch(dictionary, query).hits.map(label);
        expect(appRows.length).toBeGreaterThan(0);
        expect(appRows).toEqual(dictionaryRows);
    });

    it('keeps the kanji 水 near the top for water, and a grammar point first for から', () => {
        expect(searchApp(app, 'water').hits.slice(0, 5).map(label)).toContain('kanji:水');
        expect(searchApp(app, 'から').hits[0]?.group).toBe('grammar');
    });
}, 120_000);
