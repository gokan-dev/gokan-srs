// Example sentences as the pages render them: runs of text, each linked to its word and carrying
// furigana split by rubyParts (shared with the app), so the readings sit over the kanji only.
// Used by the word and grammar pages, at prerender time.

import { rubyParts, segmentInteractiveSentence } from '@gokan/dataset-schema';
import type { RubyPart, SegmentInteractiveSentenceOptions, Sentence } from '@gokan/dataset-schema';

export interface SentenceRun {
    parts: RubyPart[];
    /** The word this run links to; absent for plain text and for the page's own word. */
    vocabId?: string;
    /** The page's own word, or part of a grammar point's pattern: the current item. */
    emphasized: boolean;
}

/**
 * A sentence as runs, through the segmenter both apps share (segmentInteractiveSentence): every
 * recognised word with a reading gets furigana and a link, except the word whose page this is,
 * which is emphasised instead of linked to itself.
 */
export function sentenceRuns(sentence: Sentence, options: SegmentInteractiveSentenceOptions = {}): SentenceRun[] {
    return segmentInteractiveSentence(sentence, options).map(segment => ({
        parts: segment.type === 'match' ? rubyParts(segment.content, segment.reading) : [{ text: segment.content }],
        ...(segment.vocabId && !segment.isTarget ? { vocabId: segment.vocabId } : {}),
        emphasized: segment.isTarget || segment.isHighlighted,
    }));
}
