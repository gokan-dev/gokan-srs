// The index both apps search, prepared from the shared rows (searchRows.ts): the words read as the
// matcher reads them, with the conjugation rules (conjugation.ts) as the deinflector. Apart from
// searchRows.ts so the matcher and the rules load only with a search engine: the dictionary's
// page-wide script reads rows from there, and its query engine, a chunk of its own, prepares
// them here.

import { deinflect, WORD_CLASSES, type ConjugationClass } from './conjugation';
import { prepareSearch } from './search';
import type { Deinflector, PreparedSearch, SearchGlossLanguage, SearchWordInput } from './search';
import {
    classCodeOfRow, fromColumns, grammarRowInput, isCommonRow, isUsuallyKanaRow, kanjiFromColumns, kanjiRowInput, readingOfRow,
    type SearchGrammarRow, type SearchIndexColumns, type SearchKanjiRow, type SearchWordRow,
} from './searchRows';

export function wordClassOfRow(row: SearchWordRow): ConjugationClass | null {
    const code = classCodeOfRow(row);
    return code > 0 ? WORD_CLASSES[code - 1] : null;
}

/** A word row as the matcher reads it: a word learned in kana shows its kana, and its kanji spelling (the secondary form) still finds it. */
export function wordRowInput(row: SearchWordRow): SearchWordInput<SearchWordRow, ConjugationClass> {
    return {
        row,
        forms: isUsuallyKanaRow(row) ? [row[1], row[2]] : [row[1]],
        reading: readingOfRow(row),
        gloss: row[3],
        jlpt: row[4] > 0,
        common: isCommonRow(row),
        wordClass: wordClassOfRow(row),
    };
}

/** A conjugated form's candidates may name a regular godan rule for 行く or 問う, whose other forms are regular. */
function classFits(wordClass: ConjugationClass | null, ruleClass: ConjugationClass): boolean {
    if (wordClass === ruleClass) return true;
    return ruleClass === 'godan' && (wordClass === 'godan-iku' || wordClass === 'godan-tou');
}

/** The conjugation rules (conjugation.ts) walked backwards, so a search for 食べた finds 食べる. */
export const SEARCH_DEINFLECTOR: Deinflector<ConjugationClass> = { candidates: deinflect, fits: classFits };

export type PreparedRowSearch = PreparedSearch<SearchWordRow, SearchKanjiRow, SearchGrammarRow, ConjugationClass>;

/**
 * The index both apps search: the words of every file, in order (frequency order), and the kanji
 * and grammar of whichever carries them, with the conjugation rules as the deinflector. `glosses`
 * is the language the files' word glosses are in. Kanji meanings are English in every index.
 */
export function prepareRowSearch(files: readonly SearchIndexColumns[], glosses: SearchGlossLanguage = 'en'): PreparedRowSearch {
    return prepareSearch({
        words: files.flatMap(file => fromColumns(file.w).map(wordRowInput)),
        kanji: files.flatMap(file => (file.k ? kanjiFromColumns(file.k) : []).map(kanjiRowInput)),
        grammar: files.flatMap(file => (file.g ?? []).map(grammarRowInput)),
    }, { glosses, frequencyOrdered: true, deinflector: SEARCH_DEINFLECTOR });
}
