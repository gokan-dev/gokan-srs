// Builds the dictionary's own search index at prerender time (scripts/prerender.ts), from the
// compiled dataset rather than copying its index/search.json: ranking needs the frequency order,
// the JLPT level, the common flag and a word's conjugation class, which that file does not carry.
// The format is documented on SearchWordRow and SearchIndexFile (types.ts).

import { headwordOf, secondaryForm } from '@gokan/dataset-schema';
import type { GrammarPoint, Kanji, Vocabulary } from '@gokan/dataset-schema';
import { WORD_CLASSES, wordClassOf, type WordClass } from './conjugation';
import type { SearchGrammarRow, SearchIndexFile, SearchKanjiRow, SearchWordColumns, SearchWordRow } from './types';
import { SHORT_GLOSS_LENGTH, shortGloss, truncateAtWord } from './vocabSummary';
import { CLASS_SHIFT, classCodeOfRow, FLAG_COMMON, FLAG_USUALLY_KANA } from './searchRow';

/**
 * Words in the core file beyond the JLPT lists: the most frequent ones. As many as fit the core's
 * 300 KB gzip budget (scripts/check-build.ts) with every JLPT word, kanji and grammar point.
 */
export const CORE_FREQUENT_WORDS = 6500;


export function searchWordRow(vocab: Vocabulary): SearchWordRow {
    const wordClass = wordClassOf(vocab.senses.flatMap(sense => sense.pos));
    const flags = (vocab.isCommon ? FLAG_COMMON : 0)
        | (vocab.usuallyKana ? FLAG_USUALLY_KANA : 0)
        | ((wordClass ? WORD_CLASSES.indexOf(wordClass) + 1 : 0) << CLASS_SHIFT);
    return [vocab.id, headwordOf(vocab), secondaryForm(vocab), shortGloss(vocab), vocab.jlptLevel ?? 0, flags];
}

export function wordClassOfRow(row: SearchWordRow): WordClass | null {
    const code = classCodeOfRow(row);
    return code > 0 ? WORD_CLASSES[code - 1] : null;
}

export function searchKanjiRow(kanji: Kanji): SearchKanjiRow {
    return [kanji.character, kanji.steps.jlpt ?? 0, kanji.frequency ?? 0];
}

export function searchGrammarRow(point: GrammarPoint): SearchGrammarRow {
    return [point.id, point.title, point.romaji ?? '', truncateAtWord(point.shortExplanation, SHORT_GLOSS_LENGTH), point.jlptLevel];
}

/** Rows to the columnar file layout (SearchWordColumns). */
export function toColumns(rows: SearchWordRow[]): SearchWordColumns {
    const columns: SearchWordColumns = [[], [], [], [], [], []];
    for (const [id, headword, secondary, gloss, jlpt, flags] of rows) {
        columns[0].push(id);
        columns[1].push(headword);
        columns[2].push(secondary);
        columns[3].push(gloss);
        columns[4].push(jlpt);
        columns[5].push(flags);
    }
    return columns;
}

/** The columnar file layout back to rows. */
export function fromColumns([ids, headwords, secondary, glosses, jlpt, flags]: SearchWordColumns): SearchWordRow[] {
    return ids.map((id, i) => [id, headwords[i], secondary[i], glosses[i], jlpt[i], flags[i]]);
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
    return { core: { w: toColumns(core), k: kanji, g: grammar }, full: { w: toColumns(rest) } };
}
