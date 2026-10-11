// Which example sentences a word page shows first, decided at prerender time. A learner should
// meet the easiest, most useful sentence first: one they can check against a translation, that
// spells the word the way its page does, and that is short.

import type { Sentence } from '@gokan/dataset-schema';

/** Sentences shown before the "More examples" disclosure. */
export const VISIBLE_SENTENCES = 5;
/** Sentences inside it, at most. */
export const MORE_SENTENCES = 10;
/** Shorter sentences (an exclamation, a one-word reply) teach little: they go last. */
const MIN_LENGTH = 6;

/**
 * Whether the sentence writes the word the way its page names it. ここ's sentences written 此処
 * use a spelling a reader of the page does not expect, so they go after those written ここ.
 * Compared on the first character, so a conjugated form (食べた for 食べる) still counts.
 */
function usesHeadwordSpelling(sentence: Sentence, vocabId: string, headword: string): boolean {
    const match = sentence.matches?.[vocabId]?.[0];
    if (!match) return false;
    return sentence.original[match.start] === headword[0];
}

/**
 * The sentences to show for a word, best first, at most VISIBLE_SENTENCES + MORE_SENTENCES:
 * translated before untranslated, the headword's own spelling before another, then shortest
 * first, with sentences under MIN_LENGTH characters last. Ties keep the dataset's order.
 */
export function orderSentences(sentences: Sentence[], vocabId: string, headword: string): Sentence[] {
    const keyed = sentences.map((sentence, index) => ({
        sentence,
        index,
        untranslated: sentence.en.length === 0 ? 1 : 0,
        otherSpelling: usesHeadwordSpelling(sentence, vocabId, headword) ? 0 : 1,
        tooShort: sentence.original.length < MIN_LENGTH ? 1 : 0,
        length: sentence.original.length,
    }));
    keyed.sort((a, b) =>
        a.untranslated - b.untranslated
        || a.otherSpelling - b.otherSpelling
        || a.tooShort - b.tooShort
        || a.length - b.length
        || a.index - b.index);
    return keyed.slice(0, VISIBLE_SENTENCES + MORE_SENTENCES).map(entry => entry.sentence);
}
