import type { SRSEntry, VocabProgress } from "../models/vocabulary.model";
import type { UserSettings } from "../models/user.model";
import { CONSTANTS } from "../commons/constants";
import type { QuizType } from "../utils/srs.utils";
import { frequencyModifierOf, modifierAt, type PacingSettings } from "./calibration";

const MAX_MEMORY_STRENGTH = CONSTANTS.srs.formula.mastery.maxMemoryStrength;

/**
 * Single source of truth for "when is this vocab due". Previously this question
 * was answered independently by VocabProgress.nextReviewAt (hand-synced by
 * applyAnswer), reading.dueDate, and meaning.dueDate, which could drift out of
 * agreement - e.g. disabling meaning quizzes left a stale meaning.dueDate able
 * to make nextReviewAt report "due" while the queue-selection logic had already
 * stopped considering meaning reviews entirely.
 */

/**
 * What scheduling reads off the settings: which quiz types are on, and review
 * pacing. Pacing is optional so a caller with no settings reads stored dates as
 * they are (a ratio of 1).
 */
export type SchedulingSettings = Pick<UserSettings, 'enableMeaningQuiz' | 'enableProductionQuiz'> & Partial<PacingSettings>;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When an entry is really due, under the CURRENT review pacing. The one reader of
 * a stored `dueDate`: every due check, count and forecast goes through it.
 *
 * Stored dates are never rewritten when the pacing slider moves. A bulk
 * reschedule changes due dates without a review, and the Drive merge resolves an
 * entry by `lastReviewedAt` (local on a tie), so the other device would keep its
 * old dates and upload them back. Instead the effective date is derived: the
 * interval was set at `dueDate - interval`, under the pacing in effect then
 * (`modifierAt`), so the effective interval is `interval x current / then`,
 * clamped to the formula's bounds, counted from that same moment. Moving the
 * slider writes nothing, two devices with the same synced history derive the same
 * dates, moving it back restores the stored date exactly, and a review after the
 * change schedules under the new value (ratio 1).
 *
 * Bounds: never over `maxInterval`, and never pulled under the success floor
 * (`minIntervalAfterSuccess`), or under the stored interval when that was already
 * shorter (a wrong answer's penalty), or under `minInterval`.
 */
export function effectiveDueDate(
    entry: Pick<SRSEntry, 'dueDate' | 'interval'>,
    settings?: Partial<PacingSettings> | null
): Date | null {
    const { dueDate, interval } = entry;
    if (dueDate === null) return null;
    if (!settings?.intervalModifierHistory || !(interval > 0)) return dueDate;
    const setAt = dueDate.getTime() - interval * DAY_MS;
    const then = modifierAt(settings.intervalModifierHistory, setAt);
    if (then === null || then <= 0) return dueDate;
    const current = settings.intervalModifier === undefined ? then : frequencyModifierOf(settings);
    if (current === then) return dueDate;
    const F = CONSTANTS.srs.formula;
    const floor = Math.max(F.minInterval, Math.min(interval, F.minIntervalAfterSuccess));
    const effective = Math.min(Math.max(interval * current / then, floor), Math.max(F.maxInterval, interval));
    return new Date(setAt + effective * DAY_MS);
}

/** True if the entry has a review due by `now`, under the current pacing. */
export function isEntryDue(
    entry: Pick<SRSEntry, 'dueDate' | 'interval'> | undefined,
    settings: Partial<PacingSettings> | null | undefined,
    now: Date
): boolean {
    const due = entry ? effectiveDueDate(entry, settings) : null;
    return due !== null && due <= now;
}

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

/** What scheduling reads off a vocab: its entries, and whether it has a reading direction at all. */
export type ScheduledVocab = Pick<VocabProgress, 'reading' | 'meaning' | 'production' | 'usuallyKana'>;

/**
 * Whether the reading quiz applies to this word. A word learned in kana is shown
 * by its reading (ここ), so asking for that reading tests nothing: its reading
 * entry is ignored by mastery and due dates, whatever it holds.
 */
export function isReadingRelevant(vocab: { usuallyKana?: boolean }): boolean {
    return !vocab.usuallyKana;
}

/**
 * The quiz type a word is first asked in once the learner chooses to learn it:
 * reading, or for a word learned in kana the first enabled direction after it.
 * Null when no direction applies (a word learned in kana, with meaning and
 * production both disabled), which is why such a word is never offered then.
 */
export function introQuizType(
    vocab: { usuallyKana?: boolean },
    settings?: Pick<UserSettings, 'enableMeaningQuiz' | 'enableProductionQuiz'>
): QuizType | null {
    if (isReadingRelevant(vocab)) return 'reading';
    if (isMeaningQuizEnabled(settings)) return 'meaning';
    if (isProductionQuizEnabled(settings)) return 'production';
    return null;
}

/**
 * True if this vocab is fully mastered given whether meaning quizzes are enabled.
 * When meaning quizzes are disabled, meaning mastery is irrelevant to graduation -
 * a word can graduate on reading mastery alone.
 */
export function isVocabFullyMastered(
    vocab: ScheduledVocab,
    settings?: Pick<UserSettings, 'enableMeaningQuiz' | 'enableProductionQuiz'>
): boolean {
    const readingMastered = !isReadingRelevant(vocab) || isEntryMastered(vocab.reading);
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
    vocab: ScheduledVocab,
    settings?: SchedulingSettings
): Date | null {
    if (isVocabFullyMastered(vocab, settings)) return null;

    const readingMastered = !isReadingRelevant(vocab) || isEntryMastered(vocab.reading);
    const meaningRelevant = isMeaningQuizEnabled(settings);
    const meaningMastered = !meaningRelevant || isEntryMastered(vocab.meaning);
    const production = relevantProductionEntry(vocab, settings);

    const rDue = readingMastered ? null : effectiveDueDate(vocab.reading, settings);
    const mDue = meaningMastered ? null : effectiveDueDate(vocab.meaning, settings);
    const pDue = !production || isEntryMastered(production) ? null : effectiveDueDate(production, settings);

    return [rDue, mDue, pDue].reduce<Date | null>(
        (earliest, due) => (due && (!earliest || due < earliest) ? due : earliest),
        null
    );
}

/** True if the given vocab has a review due now (never true for graduated items). */
export function isVocabDue(
    vocab: ScheduledVocab & Pick<VocabProgress, 'stage'>,
    settings: SchedulingSettings | undefined,
    now: Date = new Date()
): boolean {
    if (vocab.stage === 'graduated') return false;
    const due = vocabNextReviewAt(vocab, settings);
    return due !== null && due <= now;
}
