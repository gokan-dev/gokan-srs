// Builds the dictionary's own search index at prerender time (scripts/prerender.ts), from the
// compiled dataset rather than copying its index/search.json: ranking needs the frequency order,
// the JLPT level, the common flag and a word's conjugation class, which that file does not carry.
// The format is documented on SearchWordRow and SearchIndexFile (types.ts).

import { headwordOf, secondaryForm } from '@gokan/dataset-schema';
import type { GrammarPoint, Kanji, Vocabulary } from '@gokan/dataset-schema';
import { WORD_CLASSES, wordClassOf, type WordClass } from './conjugation';
import type { SearchGrammarRow, SearchIndexFile, SearchKanjiRow, SearchWordRow } from './types';
import { SHORT_GLOSS_LENGTH, shortGloss, truncateAtWord } from './vocabSummary';

/** Words in the core file beyond the JLPT lists: the most frequent ones. */
export const CORE_FREQUENT_WORDS = 8000;

const FLAG_COMMON = 1;
const FLAG_USUALLY_KANA = 2;
/** The conjugation class is stored above the two flags, as its WORD_CLASSES position plus one. */
const CLASS_SHIFT = 2;

export function searchWordRow(vocab: Vocabulary): SearchWordRow {
    const wordClass = wordClassOf(vocab.senses.flatMap(sense => sense.pos));
    const flags = (vocab.isCommon ? FLAG_COMMON : 0)
        | (vocab.usuallyKana ? FLAG_USUALLY_KANA : 0)
        | ((wordClass ? WORD_CLASSES.indexOf(wordClass) + 1 : 0) << CLASS_SHIFT);
    return [vocab.id, headwordOf(vocab), secondaryForm(vocab), shortGloss(vocab), vocab.jlptLevel ?? 0, flags];
}

export const isCommonRow = (row: SearchWordRow): boolean => (row[5] & FLAG_COMMON) !== 0;

/** The kana reading of a row: the headword itself for a word learned in kana. */
export const readingOfRow = (row: SearchWordRow): string => ((row[5] & FLAG_USUALLY_KANA) !== 0 ? row[1] : row[2]);

export function wordClassOfRow(row: SearchWordRow): WordClass | null {
    const code = row[5] >> CLASS_SHIFT;
    return code > 0 ? WORD_CLASSES[code - 1] : null;
}

export function searchKanjiRow(kanji: Kanji): SearchKanjiRow {
    return [kanji.character, kanji.steps.jlpt ?? 0, kanji.frequency ?? 0];
}

export function searchGrammarRow(point: GrammarPoint): SearchGrammarRow {
    return [point.id, point.title, point.romaji ?? '', truncateAtWord(point.shortExplanation, SHORT_GLOSS_LENGTH), point.jlptLevel];
}

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
    return { core: { w: core, k: kanji, g: grammar }, full: { w: rest } };
}
