// Pure projections from a full Vocabulary to what other pages show of it: the VocabSummary of a
// word list row and the short gloss a list or search row carries. Separated from
// lib/server/pages.ts so they're unit-testable without the dataset or the Svelte loader.

import { FLAG_USUALLY_KANA, headwordOf, SEARCH_EXPLANATION_LENGTH, shortGloss, truncateAtWord } from '@gokan/dataset-schema';
import type { Vocabulary } from '@gokan/dataset-schema';
import type { SearchWordRow, VocabSummary } from './types';

/** Longest short gloss, in characters: one line of a list row or a search result, as a grammar row's explanation is cut. */
export const SHORT_GLOSS_LENGTH = SEARCH_EXPLANATION_LENGTH;

// The short gloss is the search rows' (@gokan/dataset-schema), so a list row and a search row agree.
export { shortGloss, truncateAtWord };

/**
 * A word's summary from its search row (searchWordRow), equal to vocabSummaryFrom of the word: a
 * page rendered on request lists other words from the search index the build writes, rather than
 * reading each word's file. A row's secondary form is the reading, or for a word learned in kana
 * (its headword already the reading) its kanji spelling, which a summary never shows.
 */
export function vocabSummaryOfRow([id, word, secondary, gloss, jlpt, flags]: SearchWordRow): VocabSummary {
    const reading = (flags & FLAG_USUALLY_KANA) !== 0 ? word : secondary;
    return {
        id,
        word,
        ...(reading !== word ? { reading } : {}),
        ...(gloss ? { gloss } : {}),
        ...(jlpt ? { jlpt } : {}),
    };
}

export function vocabSummaryFrom(vocab: Vocabulary): VocabSummary {
    const word = headwordOf(vocab);
    const reading = vocab.reading.primary;
    const gloss = shortGloss(vocab);
    return {
        id: vocab.id,
        word,
        ...(reading !== word ? { reading } : {}),
        ...(gloss ? { gloss } : {}),
        ...(vocab.jlptLevel ? { jlpt: vocab.jlptLevel } : {}),
    };
}
