// Splits a Sentence's `original` text into linkable and plain runs, so a vocab page can render
// its example sentences with every recognised word linked through to that word's own page.
//
// This is the static equivalent of gokan-srs's InteractiveSentence component. The compiled
// dataset gives each sentence a `matches` map of vocabId -> [{start, length, reading}] offsets
// into `original`, covering every vocab the sentence contains (commonly 5-15 of them, not just
// the word the sentence is filed under), which is what makes this worth doing at all.
//
// Grammar pages get the same effect a different way, from `GrammarExample.words[]`, because
// grammar examples carry a full tokenization while vocab sentences carry only offsets. Both
// paths exist to produce the same thing: a crawlable link graph between the ~36k vocab pages.

import type { Sentence } from '@gokan/dataset-schema';

export interface SentenceSegment {
    text: string;
    /** The vocab this run links to, or null for plain text between matches. */
    vocabId: string | null;
    /** True for the word the current page is about: rendered emphasised, never as a self-link. */
    isTarget: boolean;
}

/**
 * `targetVocabId` marks the word whose page this is, so it can be highlighted rather than
 * linked to itself.
 *
 * Overlapping matches are resolved by taking the earliest start and skipping anything that
 * begins before the previous match ended, mirroring gokan-srs's strict-skip rule. The builder
 * tries not to emit overlaps, but a dropped word is a far better failure than interleaved or
 * duplicated text.
 */
export function segmentSentence(sentence: Sentence, targetVocabId?: string): SentenceSegment[] {
    const text = sentence.original;
    const matches = sentence.matches ?? {};

    const flat: { vocabId: string; start: number; length: number }[] = [];
    for (const [vocabId, entries] of Object.entries(matches)) {
        if (!Array.isArray(entries)) continue;
        for (const entry of entries) {
            // Guard against offsets outside the string: a match that ran past the end would
            // silently truncate the sentence via substring, losing text with no error.
            if (entry.length <= 0 || entry.start < 0 || entry.start + entry.length > text.length) continue;
            flat.push({ vocabId, start: entry.start, length: entry.length });
        }
    }

    flat.sort((a, b) => a.start - b.start || b.length - a.length);

    const segments: SentenceSegment[] = [];
    let cursor = 0;

    for (const match of flat) {
        if (match.start < cursor) continue;

        if (match.start > cursor) {
            segments.push({ text: text.slice(cursor, match.start), vocabId: null, isTarget: false });
        }

        const end = match.start + match.length;
        segments.push({
            text: text.slice(match.start, end),
            vocabId: match.vocabId,
            isTarget: match.vocabId === targetVocabId,
        });
        cursor = end;
    }

    if (cursor < text.length) {
        segments.push({ text: text.slice(cursor), vocabId: null, isTarget: false });
    }

    return segments;
}
