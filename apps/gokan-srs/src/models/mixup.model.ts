import type { SynonymRelation } from "@gokan/dataset-schema";

/**
 * One time the learner produced another word than the one asked, stored in
 * `UserProgress.mixups`. Written by applyEffects from a `mixup` effect, on any slot
 * asking for a word: production, the production cloze, a grammar sentence's word
 * blanks, retries included.
 */
export interface MixupRecord {
    /** The vocab id asked. */
    asked: string;
    /** The vocab id typed instead, when grading identified it as one of the asked word's pairs. */
    typed?: string;
    /**
     * The answer as typed, only on a `wrong` answer grading did not identify: the two
     * words have no pair, which is why it graded wrong. Resolved to words when shown.
     */
    answer?: string;
    /** The pair's tier (relationOf), when `typed` is set. */
    tier?: SynonymRelation;
    /** The pair's tier was set by hand. */
    curated?: true;
    /** The meanings the two words share (relationOf), when `typed` is set. */
    shared?: string[];
    /** The shared meaning the card's text used, when it used one: the answer was accepted in context. */
    meaning?: string;
    /** Epoch milliseconds. */
    date: number;
}
