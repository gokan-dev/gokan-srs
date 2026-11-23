import type { PreparedSearch, RankedHit, RankedSearchResults, SearchGrammarRow, SearchIndex, SearchIndexEntry, SearchKanjiRow, SearchQuery, SearchWordInput, Vocabulary } from '@gokan/dataset-schema';
import { grammarRowInput, kanjiRowInput, matchesSearchWord, prepareSearch, runRankedSearch } from '@gokan/dataset-schema';

export type AppSearchIndex = PreparedSearch<SearchIndexEntry, SearchKanjiRow, SearchGrammarRow>;
export type AppSearchResults = RankedSearchResults<SearchIndexEntry, SearchKanjiRow, SearchGrammarRow>;
export type AppSearchHit = RankedHit<SearchIndexEntry, SearchKanjiRow, SearchGrammarRow>;

/** A row of index/search.json as the shared matcher reads it: a word learned in kana is shown, and searched first, in kana. */
function entryInput(entry: SearchIndexEntry): SearchWordInput<SearchIndexEntry> {
    return { row: entry, forms: entry.u ? [entry.r, entry.w] : [entry.w], reading: entry.r, gloss: entry.m };
}

/**
 * The header search's index: the words of index/search.json, in its (kanji-spelling) order, and
 * the kanji and grammar rows the build writes (vite.config.ts). Ranked by the shared matcher
 * (@gokan/dataset-schema's search.ts), the dictionary's too: search.json is not in frequency
 * order, so within a tier a shorter form ranks first.
 */
export function prepareAppSearch(words: SearchIndex, kanji: readonly SearchKanjiRow[] = [], grammar: readonly SearchGrammarRow[] = []): AppSearchIndex {
    return prepareSearch({ words: words.map(entryInput), kanji: kanji.map(kanjiRowInput), grammar: grammar.map(grammarRowInput) }, { frequencyOrdered: false });
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
