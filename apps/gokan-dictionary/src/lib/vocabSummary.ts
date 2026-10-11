// Pure projections from a full Vocabulary to what other pages show of it: the VocabSummary of a
// word list row and the short gloss a list or search row carries. Separated from
// scripts/prerender.ts so they're unit-testable without the dataset or the Svelte loader.

import { headwordOf } from '@gokan/dataset-schema';
import type { Vocabulary } from '@gokan/dataset-schema';
import type { VocabSummary } from './types';

/** Longest short gloss, in characters: one line of a list row or a search result. */
export const SHORT_GLOSS_LENGTH = 60;

/**
 * `text` cut at a word boundary to at most `max` characters, with an ellipsis when cut. A single
 * word longer than `max` is cut mid-word rather than dropped.
 */
export function truncateAtWord(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max - 1);
    const boundary = cut.lastIndexOf(' ');
    return `${(boundary > 0 ? cut.slice(0, boundary) : cut).replace(/[\s;,]+$/, '')}…`;
}

/** The first sense's glosses joined with "; ", cut to SHORT_GLOSS_LENGTH. */
export function shortGloss(vocab: Pick<Vocabulary, 'senses'>): string {
    return truncateAtWord(vocab.senses[0]?.glosses.join('; ') ?? '', SHORT_GLOSS_LENGTH);
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
    };
}
