import type { SRSEntry, VocabProgress } from "../models/vocabulary.model";
import type { UserSettings } from "../models/user.model";
import { CONSTANTS } from "../commons/constants";

const MAX_MEMORY_STRENGTH = CONSTANTS.srs.formula.mastery.maxMemoryStrength;

/**
 * Single source of truth for "when is this vocab due". Previously this question
 * was answered independently by VocabProgress.nextReviewAt (hand-synced by
 * applyAnswer), reading.dueDate, and meaning.dueDate, which could drift out of
 * agreement - e.g. disabling meaning quizzes left a stale meaning.dueDate able
 * to make nextReviewAt report "due" while the queue-selection logic had already
 * stopped considering meaning reviews entirely.
 */

export function isEntryMastered(entry: Pick<SRSEntry, 'memoryStrength'>): boolean {
    return entry.memoryStrength >= MAX_MEMORY_STRENGTH;
}

/**
 * The initial SRSEntry for a freshly-created progress item (before any review):
 * minimum strength, no interval, no due date, empty history. Shared by
 * SRSService.createVocabProgress (reading + meaning) and
 * GrammarSRSService.createGrammarProgress, which differ only in the initial
 * difficulty (vocab applies a per-user offset, grammar uses the default).
 */
export function newSRSEntry(difficulty: number = CONSTANTS.srs.formula.initialDifficulty): SRSEntry {
    return {
        memoryStrength: CONSTANTS.srs.formula.minMemoryStrength,
        interval: 0,
        difficulty,
        lastReviewedAt: null,
        dueDate: null,
        history: [],
    };
}

export function isMeaningQuizEnabled(settings?: Pick<UserSettings, 'enableMeaningQuiz'>): boolean {
    return settings?.enableMeaningQuiz !== false;
}

export function isProductionQuizEnabled(settings?: Pick<UserSettings, 'enableProductionQuiz'>): boolean {
    return settings?.enableProductionQuiz !== false;
}

/**
 * A vocab's production entry, or null when production is irrelevant to it right now:
 * the quiz type is off in settings, or the entry has never been activated (see
 * SRSService.seedProductionEntry). A never-activated entry must read as "not
 * relevant" rather than "due at strength 0", otherwise every word already in a
 * user's queue would count as unmastered the moment this quiz type shipped, which
 * is the release-day workload spike this whole lazy-activation design exists to avoid.
 */
function relevantProductionEntry(
    vocab: Pick<VocabProgress, 'production'>,
    settings?: Pick<UserSettings, 'enableProductionQuiz'>
): SRSEntry | null {
    if (!isProductionQuizEnabled(settings)) return null;
    const entry = vocab.production;
    if (!entry) return null;
    return isProductionActivated(entry) ? entry : null;
}

/** True once a production entry has been scheduled at least once. */
export function isProductionActivated(entry: SRSEntry | undefined): boolean {
    return !!entry && (entry.dueDate !== null || entry.lastReviewedAt !== null || entry.history.length > 0);
}

/**
 * True if this vocab is fully mastered given whether meaning quizzes are enabled.
 * When meaning quizzes are disabled, meaning mastery is irrelevant to graduation -
 * a word can graduate on reading mastery alone.
 */
export function isVocabFullyMastered(
    vocab: Pick<VocabProgress, 'reading' | 'meaning' | 'production'>,
    settings?: Pick<UserSettings, 'enableMeaningQuiz' | 'enableProductionQuiz'>
): boolean {
    const readingMastered = isEntryMastered(vocab.reading);
    const meaningRelevant = isMeaningQuizEnabled(settings);
    const production = relevantProductionEntry(vocab, settings);
    return readingMastered
        && (!meaningRelevant || isEntryMastered(vocab.meaning))
        && (!production || isEntryMastered(production));
}

/**
 * Derives the authoritative top-level `nextReviewAt` for a vocab: the earlier of
 * its non-mastered reading/meaning due dates, excluding meaning entirely when
 * meaning quizzes are disabled in settings. Never read `nextReviewAt` as an
 * independently-stored field - always recompute it from this function.
 */
export function vocabNextReviewAt(
    vocab: Pick<VocabProgress, 'reading' | 'meaning' | 'production'>,
    settings?: Pick<UserSettings, 'enableMeaningQuiz' | 'enableProductionQuiz'>
): Date | null {
    if (isVocabFullyMastered(vocab, settings)) return null;

    const readingMastered = isEntryMastered(vocab.reading);
    const meaningRelevant = isMeaningQuizEnabled(settings);
    const meaningMastered = !meaningRelevant || isEntryMastered(vocab.meaning);
    const production = relevantProductionEntry(vocab, settings);

    const rDue = readingMastered ? null : vocab.reading.dueDate;
    const mDue = meaningMastered ? null : vocab.meaning.dueDate;
    const pDue = !production || isEntryMastered(production) ? null : production.dueDate;

    return [rDue, mDue, pDue].reduce<Date | null>(
        (earliest, due) => (due && (!earliest || due < earliest) ? due : earliest),
        null
    );
}

/** True if the given vocab has a review due now (never true for graduated items). */
export function isVocabDue(
    vocab: Pick<VocabProgress, 'reading' | 'meaning' | 'production' | 'stage'>,
    settings: Pick<UserSettings, 'enableMeaningQuiz' | 'enableProductionQuiz'> | undefined,
    now: Date = new Date()
): boolean {
    if (vocab.stage === 'graduated') return false;
    const due = vocabNextReviewAt(vocab, settings);
    return due !== null && due <= now;
}
