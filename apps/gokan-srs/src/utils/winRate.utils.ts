import type { CalibratedQuizType } from '../models/user.model';
import type { ReviewLog } from '../models/vocabulary.model';

/** What a win rate reads from an SRS entry: its review logs. */
interface Logged {
    history: readonly ReviewLog[];
}

/** What a win rate reads from a vocab item: the logs of each direction. */
export interface LoggedVocab {
    reading: Logged;
    meaning: Logged;
    production?: Logged;
}

/** What the per-quiz-type win rates read from the user's progress. */
export interface LoggedProgress {
    learningQueue: readonly LoggedVocab[];
    grammarQueue: readonly { entry: Logged }[];
}

export interface WinRateTally {
    /** Graded reviews ('pass' excluded: a skip is not a recall attempt). */
    answers: number;
    correct: number;
}

const emptyTally = (): WinRateTally => ({ answers: 0, correct: 0 });

function addLogs(tally: WinRateTally, history: readonly ReviewLog[] | undefined): void {
    for (const log of history ?? []) {
        if (log.result === 'pass') continue;
        tally.answers++;
        if (log.result === 'correct' || log.result === 'minor_error') tally.correct++;
    }
}

/**
 * Win rate per quiz type from the review logs stored on each entry, plus the
 * global total across all of them. The calibration uses its own per-type
 * windows (recent real reviews only); this is the learner-facing record of
 * every logged review, kept visible even though the calibration does not read it.
 */
export function winRatesByQuizType(progress: LoggedProgress): { byType: Record<CalibratedQuizType, WinRateTally>; global: WinRateTally } {
    const byType: Record<CalibratedQuizType, WinRateTally> = {
        reading: emptyTally(), meaning: emptyTally(), production: emptyTally(), grammar: emptyTally(),
    };
    for (const vp of progress.learningQueue) {
        addLogs(byType.reading, vp.reading.history);
        addLogs(byType.meaning, vp.meaning.history);
        addLogs(byType.production, vp.production?.history);
    }
    for (const gp of progress.grammarQueue) addLogs(byType.grammar, gp.entry.history);

    const global = emptyTally();
    for (const tally of Object.values(byType)) {
        global.answers += tally.answers;
        global.correct += tally.correct;
    }
    return { byType, global };
}

/** Wrong answers logged on a vocab across all three directions (the Stats list's failure sort). */
export function countWrongReviews(vp: LoggedVocab): number {
    return [vp.reading.history, vp.meaning.history, vp.production?.history]
        .reduce((sum, history) => sum + (history ?? []).filter(h => h.result === 'wrong').length, 0);
}

/** A tally as a rounded percentage, or null when there is nothing to show. */
export const percentOf = (tally: WinRateTally): number | null =>
    tally.answers > 0 ? Math.round((tally.correct / tally.answers) * 100) : null;
