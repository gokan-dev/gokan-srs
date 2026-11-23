import type { ExploreQuery, PreparedRowSearch, RankedHit, RankedSearchResults, SearchGrammarRow, SearchIndexColumns, SearchKanjiRow, SearchQuery, SearchWordRow, Vocabulary } from '@gokan/dataset-schema';
import { fromColumns, matchesExploreQuery, matchesSearchWord, prepareRowSearch, runRankedSearch } from '@gokan/dataset-schema';

export type AppSearchIndex = PreparedRowSearch;
export type AppSearchResults = RankedSearchResults<SearchWordRow, SearchKanjiRow, SearchGrammarRow>;
export type AppSearchHit = RankedHit<SearchWordRow, SearchKanjiRow, SearchGrammarRow>;

/**
 * The header search's index: every word (in frequency order), kanji and grammar point, as the
 * build writes them (scripts/searchEntries.ts, the dictionary's row format), prepared by the same
 * call as the dictionary's (`prepareRowSearch`: frequency order, the conjugation rules), so a
 * query lists the same rows in the same order in both apps.
 */
export function prepareAppSearch(entries: SearchIndexColumns): AppSearchIndex {
    return prepareRowSearch([entries]);
}

/**
 * The header search's hits for `query`: every match, words, kanji and grammar points as one list,
 * best first across types (`runRankedSearch`, the shared matcher's one scale). Nothing is capped:
 * the panel renders a page at a time as it is scrolled.
 */
export function searchApp(index: AppSearchIndex, query: string): AppSearchResults {
    return runRankedSearch(index, query);
}

/**
 * The vocabulary list's filter (/vocab): a word the header search would find for the same query
 * (written form, reading as typed or as romaji read, gloss), kept in the list's own order. The
 * query is read once by `readSearchQuery` (@gokan/dataset-schema).
 */
export function matchesVocabQuery(word: Pick<Vocabulary, 'writtenForm' | 'reading' | 'senses'>, query: SearchQuery): boolean {
    const gloss = word.senses.flatMap(sense => sense.glosses).join('; ');
    return matchesSearchWord({ row: word, forms: [word.writtenForm.kanji], reading: word.reading.primary, gloss }, query);
}

/** What a search says while its index loads, and when it could not load: the header search and every panel search alike. */
export const SEARCHING = 'Searching…';
export const SEARCH_UNAVAILABLE = 'Search could not load. Try again in a moment.';

/** The header search's word rows by id: what a panel search (useIndexSearch) reads, so the app holds one word index. */
export function wordRowsById(entries: Pick<SearchIndexColumns, 'w'>): ReadonlyMap<string, SearchWordRow> {
    return new Map(fromColumns(entries.w).map(row => [row[0], row]));
}

/** A panel search's match on a word's row: its headword, its secondary form (the reading, or the kanji of a word learned in kana) or its gloss. */
export function matchesWordRow(query: ExploreQuery, row: SearchWordRow | undefined): boolean {
    return row !== undefined && matchesExploreQuery(query, { english: [row[3]], japanese: [row[1], row[2]] });
}
