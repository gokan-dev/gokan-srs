import type { SessionGains } from './quizReducer';

/**
 * The session's running knowledge-point totals after one more answer: its own
 * mastery change, split into gained and lost, plus any credit it gave other words.
 * One function for both activities, so the two tickers cannot count differently.
 */
export function addToGains(gains: SessionGains, delta: number, vocabDelta: number = 0): SessionGains {
    return {
        net: gains.net + delta,
        gained: gains.gained + (delta > 0 ? delta : 0),
        lost: gains.lost + (delta < 0 ? -delta : 0),
        vocab: gains.vocab + vocabDelta,
    };
}
