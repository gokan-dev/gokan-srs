/**
 * A learner's progress on one word. The word itself (Vocabulary, Sense, ...) is part of
 * the dataset contract in @gokan/dataset-schema.
 */

export interface ReviewLog {
    date: number;
    result: 'correct' | 'minor_error' | 'wrong' | 'pass';
    interval: number;
    latency: number; // ms
    /**
     * Set when the log was written by something other than this quiz type's own
     * review: 'reinforcement' is grammar's positive-only vocab credit onto the
     * production entry. The SRS calibration skips it (not a real review).
     */
    source?: 'reinforcement';
}

export interface SRSEntry {
    memoryStrength: number;
    interval: number; // days
    difficulty: number; // 0.0 (hard) to 1.0 (easy) - default 0.3
    lastReviewedAt: Date | null;
    dueDate: Date | null;
    history: ReviewLog[];
}

/** Per-quiz-type immediate-retry flag. A wrong reading answer only forces a reading
 *  retry; it never blocks meaning or production reviews (and vice versa). */
export interface NeedsRetryFlags {
    reading?: boolean;
    meaning?: boolean;
    production?: boolean;
}

export interface VocabProgress {
    vocabId: string;
    stage: 'learning' | 'graduated';
    introductionAt: Date | null;
    nextReviewAt: Date | null;
    lastReviewedAt: Date | null;
    totalReviews: number;
    consecutiveFailures: number;

    // Detailed SRS data
    reading: SRSEntry;
    meaning: SRSEntry;
    /**
     * Production direction: English meaning prompt, Japanese reading answer. The
     * only recall direction that starts from English, so it is a genuinely distinct
     * skill from `reading` (kanji to reading) and `meaning` (Japanese to English)
     * and carries its own schedule rather than sharing either of theirs.
     *
     * Optional on the type because progress saved before this existed has no such
     * field; every read path goes through the migration, which fills it in. A freshly
     * filled entry has `dueDate: null`, which no due-check ever matches, so it stays
     * inert until something activates it (see SRSService.seedProductionEntry).
     */
    production?: SRSEntry;
    needsRetry?: NeedsRetryFlags;
    /**
     * The word is learned in kana (the dataset's `Vocabulary.usuallyKana`: ここ, not
     * 此処), so it has no reading direction: a card showing ここ and asking its
     * reading tests nothing. Its reading entry is ignored by scheduling and mastery,
     * and its first review is meaning (or production).
     *
     * A copy of dataset knowledge, kept on the progress so the pure scheduling
     * functions can answer without the dataset. Set when the word is added and
     * re-synced from the frequency index on every load (syncUsuallyKana), so a
     * dataset change reaches existing progress. Required, not optional, so every
     * object handed to scheduling has to say which it is.
     */
    usuallyKana: boolean;
}

export const DEFAULT_SRS_ENTRY: SRSEntry = {
    memoryStrength: 1.0, // Default start strength (days)
    interval: 0,
    difficulty: 0.3, // Default difficulty
    lastReviewedAt: null,
    dueDate: null,
    history: []
};

export const DEFAULT_VOCABULARY_PROGRESS: VocabProgress = {
    vocabId: '',
    stage: 'learning',
    introductionAt: null,
    nextReviewAt: null,
    lastReviewedAt: null,
    totalReviews: 0,
    consecutiveFailures: 0,
    reading: { ...DEFAULT_SRS_ENTRY },
    meaning: { ...DEFAULT_SRS_ENTRY },
    production: { ...DEFAULT_SRS_ENTRY },
    usuallyKana: false,
};