// Builds the dictionary's own search index at prerender time (lib/server/pages.ts, served as /data/search-*.json), from the
// compiled dataset rather than copying its index/search.json: ranking needs the frequency order,
// the JLPT level, the common flag and a word's conjugation class, which that file does not carry.
// The rows are the shared format (@gokan/dataset-schema's searchRows.ts), gokan-srs's header search
// builds the same ones; how they are split into files is documented on SearchIndexFile (types.ts).

import { kanjiToColumns, toColumns } from '@gokan/dataset-schema';
import type { SearchGrammarRow, SearchIndexFile, SearchKanjiRow, SearchWordRow } from './types';

/**
 * Words in the core file beyond the JLPT lists: the most frequent ones. As many as fit the core's
 * budget (BUDGETS.searchCore, checked by scripts/check-build.ts) with every JLPT word, kanji and grammar point:
 * 6500 until every kanji carried its meanings and readings (#264), 5500 since, to fit it (gzipped then, brotli since #268).
 */
export const CORE_FREQUENT_WORDS = 5500;

export { isSearchIndexPart, SEARCH_INDEX_PARTS, type SearchIndexPart } from './searchIndexParts';
// The rows and their columns are the shared format (@gokan/dataset-schema's searchRows.ts), gokan-srs's too.
export { fromColumns, kanjiFromColumns, kanjiToColumns, searchGrammarRow, searchKanjiRow, searchWordRow, toColumns, wordClassOfRow } from '@gokan/dataset-schema';

/**
 * Splits the index in two so most lookups never download the long tail: the core carries every
 * JLPT word, the CORE_FREQUENT_WORDS most frequent words, every kanji and every grammar point;
 * the full file the remaining words. `words` must be in frequency order, which both files keep.
 */
export function splitSearchIndex(
    words: SearchWordRow[],
    kanji: SearchKanjiRow[],
    grammar: SearchGrammarRow[],
): { core: SearchIndexFile; full: SearchIndexFile } {
    const core: SearchWordRow[] = [];
    const rest: SearchWordRow[] = [];
    words.forEach((row, rank) => (row[4] > 0 || rank < CORE_FREQUENT_WORDS ? core : rest).push(row));
    return { core: { w: toColumns(core), k: kanjiToColumns(kanji), g: grammar }, full: { w: toColumns(rest) } };
}
