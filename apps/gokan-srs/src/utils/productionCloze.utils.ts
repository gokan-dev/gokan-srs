import type { Sentence } from '../models/sentence.model';
import { hashString } from './deterministicPick';

/**
 * A single sentence chosen to drive the production cloze card (issue #72): the
 * target word's span within `sentence.original`, straight from the dataset's
 * `matches[vocabId]` - no tokenization needed, unlike the grammar activity's
 * word-by-word blanking (`computeBlankPlan`), since a vocab sentence only needs
 * one span blanked.
 */
export interface ProductionCloze {
    sentence: Sentence;
    blankStart: number;
    blankLength: number;
}

/**
 * Picks the sentence (and blank span within it) to drive this turn's production
 * cloze card, restricted to sentences carrying a usable `matches[vocabId]` entry
 * - a sentence with no match for this word cannot be blanked. When the word
 * appears more than once in the same sentence, the first occurrence is blanked;
 * "exactly one vocab word blanked" means one blank, not necessarily the only
 * occurrence of its surface form.
 *
 * Deterministic on `${vocabId}:${reviewCount}` (see deterministicPick.ts),
 * mirroring computeBlankPlan's example selection: the same turn always picks the
 * same sentence, but successive reviews (reviewCount increasing) cycle through
 * the word's other available sentences instead of re-rolling on every render.
 *
 * Returns null when no sentence has a usable match - the caller reads that as
 * "fall back to the gloss-prompt card" (VocabProductionQuizCard). Coverage is
 * inherently partial: not every vocab has sentences, and not every sentence a
 * word appears in was tokenized with a resolved match for it.
 */
export function pickProductionClozeSentence(
    vocabId: string,
    sentences: Sentence[],
    reviewCount: number
): ProductionCloze | null {
    const usable = sentences.filter(s => (s.matches?.[vocabId]?.length ?? 0) > 0);
    if (usable.length === 0) return null;

    const index = hashString(`${vocabId}:${reviewCount}`) % usable.length;
    const sentence = usable[index];
    const match = sentence.matches![vocabId][0];

    return { sentence, blankStart: match.start, blankLength: match.length };
}

/**
 * Splits a cloze's sentence into the literal text before/after the blanked span.
 * `before + blank + after` always reproduces `sentence.original` exactly - the
 * same invariant gokan-dictionary's `segmentSentence` relies on for the same
 * `matches` data (see that app's `sentenceSegments.ts`).
 */
export function splitSentenceAtBlank(cloze: ProductionCloze): { before: string; blank: string; after: string } {
    const { sentence, blankStart, blankLength } = cloze;
    return {
        before: sentence.original.slice(0, blankStart),
        blank: sentence.original.slice(blankStart, blankStart + blankLength),
        after: sentence.original.slice(blankStart + blankLength),
    };
}
