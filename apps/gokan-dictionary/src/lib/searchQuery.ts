// The dictionary's search over its own index files: the shared matcher (@gokan/dataset-schema's
// search.ts) fed this index's rows through `prepareRowSearch`, the same call gokan-srs's header
// search prepares its rows with, so a query lists the same rows in the same order in both apps.
// Shared by the header panel, the /search/ results page (client/search.ts) and the build-time
// acceptance check (scripts/check-build.ts). Nothing is ranked here: what matches, and in which
// order, is the package's.

import { normalizeQuery, prepareRowSearch, runRankedSearch, runSearch, WORD_TIER } from '@gokan/dataset-schema';
import type { PreparedRowSearch, RankedHit, RankedSearchResults, SearchResults, WordHit } from '@gokan/dataset-schema';
import type { DatasetLanguage } from './locale';
import type { SearchGrammarRow, SearchIndexFile, SearchKanjiRow, SearchWordRow } from './types';

export { normalizeQuery };

/** The word tiers, best first (the package's WORD_TIER). */
export const TIER = WORD_TIER;

export type PreparedIndex = PreparedRowSearch;
export type IndexWordHit = WordHit<SearchWordRow>;
export type IndexResults = SearchResults<SearchWordRow, SearchKanjiRow, SearchGrammarRow>;
export type IndexRankedResults = RankedSearchResults<SearchWordRow, SearchKanjiRow, SearchGrammarRow>;
export type IndexRankedHit = RankedHit<SearchWordRow, SearchKanjiRow, SearchGrammarRow>;

/**
 * Words from every file, in order (core, then full: frequency order); the kanji and grammar of
 * whichever carries them. `glosses` is the language the files' word glosses are in: English's
 * index, or a locale's. Kanji meanings are English in every index: the dataset has no other yet.
 */
export function prepareIndex(files: SearchIndexFile[], glosses: DatasetLanguage = 'en'): PreparedIndex {
    return prepareRowSearch(files, glosses);
}

/** Every match for `raw`, best first, grouped as words, kanji and grammar (the build's acceptance check reads each group). */
export function search(index: PreparedIndex, raw: string): IndexResults {
    return runSearch(index, raw);
}

/**
 * Every match for `raw` as one list, best first across types (`runRankedSearch`): what the header
 * panel and /search/ list, in gokan-srs's order.
 */
export function rankedSearch(index: PreparedIndex, raw: string): IndexRankedResults {
    return runRankedSearch(index, raw);
}
