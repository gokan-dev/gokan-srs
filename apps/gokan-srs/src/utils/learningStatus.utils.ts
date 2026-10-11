import type { VocabProgress } from "../models/vocabulary.model";
import type { GrammarProgress } from "../models/grammar.model";
import type { UserSettings } from "../models/user.model";
import { isVocabFullyMastered } from "../services/scheduling";
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
