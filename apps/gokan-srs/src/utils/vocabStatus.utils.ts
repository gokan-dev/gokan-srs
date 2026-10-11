import type { VocabProgress } from "../models/vocabulary.model";
import type { UserSettings } from "../models/user.model";
import { isVocabDue, isVocabFullyMastered, vocabNextReviewAt } from "../services/scheduling";
import { countWrongReviews } from "./winRate.utils";

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

export type VocabSort = 'next_review' | 'recent' | 'frequency' | 'mistakes' | 'reading' | 'meaning' | 'production';

export const VOCAB_SORT_LABEL: Record<VocabSort, string> = {
    next_review: 'Next review',
    recent: 'Recently added',
    frequency: 'Frequency',
    mistakes: 'Most mistakes',
    reading: 'Reading mastery',
    meaning: 'Meaning mastery',
    production: 'Production mastery',
};

/**
 * The key each sort orders by, ascending, so that each sort's natural order comes
 * first: the soonest review, the most recently added, the most frequent word, the
 * most mistakes, the strongest direction. Words with no due date (mastered) and
 * words without a frequency rank sort last.
 */
export function vocabSortKey(
    vocab: VocabProgress,
    sort: VocabSort,
    context: {
        settings: Pick<UserSettings, 'enableMeaningQuiz' | 'enableProductionQuiz'> | undefined;
        frequencyRank: ReadonlyMap<string, number>;
    },
): number {
    switch (sort) {
        case 'next_review': return vocabNextReviewAt(vocab, context.settings)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        case 'recent': return -(vocab.introductionAt?.getTime() ?? 0);
        case 'frequency': return context.frequencyRank.get(vocab.vocabId) ?? Number.MAX_SAFE_INTEGER;
        case 'mistakes': return -countWrongReviews(vocab);
        case 'reading': return -vocab.reading.memoryStrength;
        case 'meaning': return -vocab.meaning.memoryStrength;
        case 'production': return -(vocab.production?.memoryStrength ?? 0);
    }
}
