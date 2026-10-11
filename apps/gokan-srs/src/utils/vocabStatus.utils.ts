import type { VocabProgress } from "../models/vocabulary.model";
import type { UserSettings } from "../models/user.model";
import { isVocabDue, isVocabFullyMastered } from "../services/scheduling";

export type VocabStatusFilter = 'due' | 'learning' | 'mastered' | 'struggling' | 'all';

export const VOCAB_STATUS_LABEL: Record<VocabStatusFilter, string> = {
    due: 'Due now',
    learning: 'Learning',
    mastered: 'Mastered',
    struggling: 'Struggling',
    all: 'All',
};

/**
 * 3 or more `wrong` results among the word's last 10 reviews, every direction
 * (reading, meaning, production) merged by date: a word that keeps failing
 * regardless of which direction it fails in, not three separate near-misses.
 */
export function isVocabStruggling(vocab: Pick<VocabProgress, 'reading' | 'meaning' | 'production'>): boolean {
    const recent = [...vocab.reading.history, ...vocab.meaning.history, ...(vocab.production?.history ?? [])]
        .sort((a, b) => b.date - a.date)
        .slice(0, 10);
    return recent.filter(log => log.result === 'wrong').length >= 3;
}

/** Whether a word matches one status filter of the Vocabulary list's toolbar. */
export function matchesVocabStatus(
    vocab: VocabProgress,
    status: VocabStatusFilter,
    settings: Pick<UserSettings, 'enableMeaningQuiz' | 'enableProductionQuiz'> | undefined,
    now: Date,
): boolean {
    switch (status) {
        case 'all': return true;
        case 'due': return isVocabDue(vocab, settings, now);
        case 'mastered': return isVocabFullyMastered(vocab, settings);
        case 'learning': return !isVocabFullyMastered(vocab, settings);
        case 'struggling': return isVocabStruggling(vocab);
    }
}
