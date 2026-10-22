/**
 * How a mix-up was graded: accepted short of the word asked, neutral (no credit,
 * no penalty), or marked wrong.
 */
export type MixupOutcome = 'accepted' | 'neutral' | 'wrong';

/**
 * One time the learner typed something else than the word asked, on the card it
 * happened on, stored in `UserProgress.mixups`. Written by applyEffects from a
 * `mixup` effect, on any slot asking for a word: production, the production cloze, a
 * grammar sentence's word blanks, retries included. The pair itself is read live
 * from the dataset (wordRelation.ts), so a record keeps no tier.
 */
export interface MixupRecord {
    /** The vocab id asked. */
    asked: string;
    /** The answer as typed, always. */
    answer: string;
    outcome: MixupOutcome;
    /**
     * The vocab id of the word typed, only when the answer was that word: one of its
     * forms, or an inflection of one. Never a typo of it, a loose kanji match or a
     * raw answer looked up by reading: those name words the learner never typed.
     */
    typed?: string;
    /** The shared meaning the card's text used, when the answer was accepted in context. */
    meaning?: string;
    /** The card's English sentence; absent on the gloss card. */
    cue?: string;
    /** Epoch milliseconds. */
    date: number;
}
