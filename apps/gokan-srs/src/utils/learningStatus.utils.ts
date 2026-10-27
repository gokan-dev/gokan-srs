import type { SRSEntry, VocabProgress } from "../models/vocabulary.model";
import type { GrammarProgress } from "../models/grammar.model";
import type { UserSettings } from "../models/user.model";
import { isEntryMastered, isVocabFullyMastered } from "../services/scheduling";
import { formatDate, nextReviewPhrase } from "./time.utils";
import { isGrammarFullyMastered } from "../services/grammarScheduling";

export type LearningStatus = 'new' | 'learning' | 'mastered';

export const STATUS_LABEL: Record<LearningStatus, string> = {
    new: 'New',
    learning: 'Learning',
    mastered: 'Mastered',
};

/** A word's learning status: New until it is in the learner's queue. */
export function vocabLearningStatus(
    progress: VocabProgress | undefined,
    settings: Pick<UserSettings, 'enableMeaningQuiz' | 'enableProductionQuiz'> | undefined,
): LearningStatus {
    if (!progress) return 'new';
    return isVocabFullyMastered(progress, settings) ? 'mastered' : 'learning';
}

/** A grammar point's learning status: New until it has been introduced. */
export function grammarLearningStatus(progress: Pick<GrammarProgress, 'entry' | 'introductionAt'> | undefined): LearningStatus {
    if (!progress?.introductionAt) return 'new';
    return isGrammarFullyMastered(progress) ? 'mastered' : 'learning';
}

/**
 * What follows the status in a detail header ("Learning · Due now"), or null
 * when nothing should: a mastered item with nothing scheduled shows only its
 * status, never "Mastered" a second time. `due` comes from scheduling
 * (`vocabNextReviewAt`, `grammarNextReviewAt`).
 */
export function statusReviewPhrase(status: LearningStatus, due: Date | null, now: number): string | null {
    if (due) return nextReviewPhrase(due, now);
    return status === 'mastered' ? null : 'Not scheduled yet';
}

/**
 * One direction's line in "Your progress": "Not started" until the direction is
 * activated (production starts lazily), "Mastered" once it is, otherwise when it
 * is next reviewed ("Due now", "Next review in 3 days").
 */
export function directionStatus(entry: SRSEntry | undefined, activated: boolean, now: number): string {
    if (!entry || !activated) return 'Not started';
    if (isEntryMastered(entry)) return 'Mastered';
    if (!entry.dueDate) return 'Not started';
    return nextReviewPhrase(entry.dueDate, now);
}

/** When a studied item was added and how often reviewed: "Added Sep 12, 2026 · 14 reviews". */
export function addedLine(introductionAt: Date, totalReviews: number): string {
    return `Added ${formatDate(introductionAt)} · ${totalReviews.toLocaleString('en-US')} review${totalReviews === 1 ? '' : 's'}`;
}
