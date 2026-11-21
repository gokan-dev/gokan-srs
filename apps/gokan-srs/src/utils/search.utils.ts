import type { PreparedSearch, SearchGrammarRow, SearchIndex, SearchIndexEntry, SearchKanjiRow, SearchQuery, SearchResults, SearchWordInput, Vocabulary } from '@gokan/dataset-schema';
import { grammarRowInput, kanjiRowInput, matchesSearchWord, prepareSearch, runSearch } from '@gokan/dataset-schema';

/** How many hits of each group the header search shows, at most. */
export interface SearchLimits {
    /** Words when no other group follows them. */
    words: number;
    /**
     * Words when kanji or grammar are shown below them: past 20 word rows a reader never reached
     * them (on a phone the kanji for `water` started about 1,600px down), and at 8 the desktop
     * panel's height still held Words alone. At 5 the next group's label shows at rest there too.
     */
    wordsBeforeOthers: number;
    kanji: number;
    grammar: number;
}

/**
 * Words were 50 when they were all it showed; 20 when they are alone, 5 above another group, and a
 * few of each of the others (a kanji's reading matches dozens: すい is 20 kanji).
 */
export const SEARCH_LIMITS: SearchLimits = { words: 20, wordsBeforeOthers: 5, kanji: 5, grammar: 5 };

export type AppSearchIndex = PreparedSearch<SearchIndexEntry, SearchKanjiRow, SearchGrammarRow>;
export type AppSearchResults = SearchResults<SearchIndexEntry, SearchKanjiRow, SearchGrammarRow>;

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

/** The header search's hits for `query`, each group best first and capped at `limits`, with the order to show the groups in. */
export function searchApp(index: AppSearchIndex, query: string, limits: SearchLimits = SEARCH_LIMITS): AppSearchResults {
    const results = runSearch(index, query);
    const kanji = results.kanji.slice(0, limits.kanji);
    const grammar = results.grammar.slice(0, limits.grammar);
    const shown = { kanji: kanji.length, grammar: grammar.length };
    const othersFollow = results.groups
        .slice(results.groups.indexOf('words') + 1)
        .some(group => group !== 'words' && shown[group] > 0);
    return {
        ...results,
        words: results.words.slice(0, othersFollow ? limits.wordsBeforeOthers : limits.words),
        kanji,
        grammar,
    };
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
