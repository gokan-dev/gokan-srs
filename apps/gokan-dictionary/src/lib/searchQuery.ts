// The dictionary's search over its own index files: the shared matcher (@gokan/dataset-schema's
// search.ts, gokan-srs's too) fed this index's rows, with the conjugation rules (conjugation.ts)
// as its deinflector. Shared by the header panel, the /search/ results page (client/search.ts)
// and the build-time acceptance check (scripts/check-build.ts), so all three rank the same way.
// Nothing is ranked here: what matches, and in which order, is the package's.

import { kanjiRowMeanings, normalizeQuery, prepareSearch, runSearch, WORD_TIER } from '@gokan/dataset-schema';
import type { Deinflector, PreparedSearch, SearchGrammarInput, SearchKanjiInput, SearchResults, SearchWordInput, WordHit } from '@gokan/dataset-schema';
import { deinflect, type WordClass } from './conjugation';
import { fromColumns, kanjiFromColumns, wordClassOfRow } from './searchIndex';
import type { DatasetLanguage } from './locale';
import { FLAG_USUALLY_KANA, isCommonRow, readingOfRow } from './searchRow';
import type { SearchGrammarRow, SearchIndexFile, SearchKanjiRow, SearchWordRow } from './types';

export { normalizeQuery };

/** The word tiers, best first (the package's WORD_TIER). */
export const TIER = WORD_TIER;

export type PreparedIndex = PreparedSearch<SearchWordRow, SearchKanjiRow, SearchGrammarRow, WordClass>;
export type IndexWordHit = WordHit<SearchWordRow>;
export type IndexResults = SearchResults<SearchWordRow, SearchKanjiRow, SearchGrammarRow>;

/** A conjugated form's candidates may name a regular godan rule for 行く or 問う, whose other forms are regular. */
function classFits(wordClass: WordClass | null, ruleClass: WordClass): boolean {
    if (wordClass === ruleClass) return true;
    return ruleClass === 'godan' && (wordClass === 'godan-iku' || wordClass === 'godan-tou');
}

const DEINFLECTOR: Deinflector<WordClass> = { candidates: deinflect, fits: classFits };

function wordInput(row: SearchWordRow): SearchWordInput<SearchWordRow, WordClass> {
    // A word learned in kana shows its kana; its kanji spelling (the secondary form) still finds it.
    const usuallyKana = (row[5] & FLAG_USUALLY_KANA) !== 0;
    return {
        row,
        forms: usuallyKana ? [row[1], row[2]] : [row[1]],
        reading: readingOfRow(row),
        gloss: row[3],
        jlpt: row[4] > 0,
        common: isCommonRow(row),
        wordClass: wordClassOfRow(row),
    };
}

function kanjiInput(row: SearchKanjiRow): SearchKanjiInput<SearchKanjiRow> {
    return { row, character: row[0], meanings: kanjiRowMeanings(row), readings: row[4] ? row[4].split(' ') : [], jlpt: row[1], frequency: row[2] };
}

const grammarInput = (row: SearchGrammarRow): SearchGrammarInput<SearchGrammarRow> => ({ row, title: row[1], romaji: row[2], explanation: row[3] });

/**
 * Words from every file, in order (core, then full: frequency order); the kanji and grammar of
 * whichever carries them. `glosses` is the language the files' word glosses are in: English's
 * index, or a locale's. Kanji meanings are English in every index: the dataset has no other yet.
 */
export function prepareIndex(files: SearchIndexFile[], glosses: DatasetLanguage = 'en'): PreparedIndex {
    return prepareSearch({
        words: files.flatMap(file => fromColumns(file.w).map(wordInput)),
        kanji: files.flatMap(file => (file.k ? kanjiFromColumns(file.k) : []).map(kanjiInput)),
        grammar: files.flatMap(file => (file.g ?? []).map(grammarInput)),
    }, { glosses, frequencyOrdered: true, deinflector: DEINFLECTOR });
}

/** Every match for `raw`, best first, grouped as words, kanji and grammar, with the order to show the groups in. */
export function search(index: PreparedIndex, raw: string): IndexResults {
    return runSearch(index, raw);
}
