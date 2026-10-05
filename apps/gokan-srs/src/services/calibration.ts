import { CONSTANTS } from '../commons/constants';
import type { AdaptiveStats, CalibratedQuizType, Calibration, UserProgress, UserSettings } from '../models/user.model';
import { CALIBRATED_QUIZ_TYPES } from '../models/user.model';
import type { ReviewLog, SRSEntry, VocabProgress } from '../models/vocabulary.model';
import type { GrammarProgress } from '../models/grammar.model';
import type { AnswerResult } from './srs.service';
import type { Stored } from './progressHydration';

/**
 * SRS calibration: each quiz type adapts its strength growth to its OWN recent
 * win rate, one mechanism for every quiz, vocab and grammar alike.
 *
 * Why growth and not the interval: the scheduler targets ~75% recall at each
 * review (formula.targetRecall). A learner well above that is being reviewed too
 * often, and the fix used to stretch intervals only (an "adaptive level" on the
 * interval, capped at x3). Strength itself kept growing by the same fixed factor
 * for everyone, so the rings, knowledge points and mastery never reflected how
 * strong the learner's memory really was: after a year at a 92% win rate, the
 * best word sat at 80% of the first loop while being recalled at 85 days.
 *
 * Now the level multiplies a SUCCESSFUL answer's strength gain, and the interval
 * is plain strength x lnTarget x frequency preference. It corrects itself: above
 * target, strength grows faster, intervals lengthen, the win rate falls toward
 * target, the level settles. Failures are not scaled, so a strong learner's rare
 * miss costs what it always did.
 *
 * Only real reviews count: a retry is answered right after seeing the answer, and
 * a word's first review comes right after its intro card; both are near-certain
 * successes that inflated the old single window.
 */

/** One quiz type's stats with any missing field filled in (level 1, empty window). */
export function adaptiveStatsWithDefaults(stats: Stored<AdaptiveStats> | undefined): AdaptiveStats {
    return { level: stats?.level ?? 1.0, history: [...(stats?.history ?? [])] };
}

/** Fills in any missing quiz type or field (older saves, partial remote data). */
export function withCalibrationDefaults(calibration: Stored<Calibration> | undefined): Calibration {
    return {
        reading: adaptiveStatsWithDefaults(calibration?.reading),
        meaning: adaptiveStatsWithDefaults(calibration?.meaning),
        production: adaptiveStatsWithDefaults(calibration?.production),
        grammar: adaptiveStatsWithDefaults(calibration?.grammar),
    };
}

const isSuccess = (result: AnswerResult) => result === 'correct' || result === 'minor_error';

/**
 * Adds one real review to a quiz type's rolling window and adjusts its level:
 * up while the window's win rate is above the band, down while below.
 */
export function updateAdaptiveStats(stats: AdaptiveStats, result: AnswerResult): AdaptiveStats {
    const { historySize, minHistory, increaseThreshold, decreaseThreshold, levelStep, minLevel, maxLevel } = CONSTANTS.srs.adaptive;
    const history = [...stats.history, isSuccess(result)].slice(-historySize);
    let level = stats.level;
    if (history.length >= minHistory) {
        const winRate = history.filter(Boolean).length / history.length;
        if (winRate > increaseThreshold) level = Math.min(level + levelStep, maxLevel);
        else if (winRate < decreaseThreshold) level = Math.max(level - levelStep, minLevel);
    }
    return { level: Number(level.toFixed(2)), history };
}

/* ---------- Seeding from the review logs ---------- */

/** A first review within this long of the intro card is the post-intro check, not a spaced review. */
const FIRST_REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000;

type LoggedEntry = { history?: ReviewLog[] } | undefined;
const timeOf = (value: Date | string | null | undefined): number | null => {
    if (!value) return null;
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? null : t;
};

/**
 * One quiz type's logged reviews as calibration answers. Retries never write a
 * log, so they are already absent; the item's earliest log is dropped when it
 * falls within FIRST_REVIEW_WINDOW_MS of the intro (the first review right after
 * the intro card), matching isCalibratedVocabReview. A mature item's retained
 * history (the merge keeps the last 20 logs) starts long after its intro, so its
 * earliest retained log is kept.
 */
function realReviewsOf(entry: LoggedEntry, introductionAt: Date | string | null | undefined, skipFirstReview: boolean) {
    const logs = (entry?.history ?? []).filter(log => log.source !== 'reinforcement').sort((a, b) => a.date - b.date);
    const intro = timeOf(introductionAt);
    const dropFirst = skipFirstReview && logs.length > 0 && intro !== null && logs[0].date - intro < FIRST_REVIEW_WINDOW_MS;
    return (dropFirst ? logs.slice(1) : logs).map(log => ({ date: log.date, result: log.result }));
}

/**
 * The calibration each quiz type would have reached, replaying its logged
 * reviews in date order through the same update rule the live window uses.
 * Seeds a quiz type so it starts where its history puts it, instead of at x1
 * with an empty window.
 */
export function calibrationFromHistory(progress: Pick<UserProgress, 'learningQueue' | 'grammarQueue'>): Calibration {
    const answers: Record<CalibratedQuizType, { date: number; result: AnswerResult }[]> = {
        reading: [], meaning: [], production: [], grammar: [],
    };
    for (const vp of progress.learningQueue ?? []) {
        // Only reading carries the post-intro first review: meaning and production
        // are first asked a day or more later, as genuinely spaced reviews.
        answers.reading.push(...realReviewsOf(vp.reading, vp.introductionAt, true));
        answers.meaning.push(...realReviewsOf(vp.meaning, vp.introductionAt, false));
        answers.production.push(...realReviewsOf(vp.production, vp.introductionAt, false));
    }
    for (const gp of progress.grammarQueue ?? []) {
        answers.grammar.push(...realReviewsOf(gp.entry, gp.introductionAt, true));
    }
    return Object.fromEntries(CALIBRATED_QUIZ_TYPES.map(type => {
        const replayed = answers[type]
            .sort((a, b) => a.date - b.date)
            .reduce<AdaptiveStats>((stats, answer) => updateAdaptiveStats(stats, answer.result), { level: 1.0, history: [] });
        return [type, replayed];
    })) as Calibration;
}

/**
 * The stored calibration, with any quiz type whose live window is shorter than
 * what its logs can reconstruct replaced by the replay. Run on every load: a
 * full live window always wins, so this only fills in history once, and it
 * self-heals a window that started empty (the first calibration release).
 */
export function seedCalibrationFromHistory(progress: Pick<UserProgress, 'learningQueue' | 'grammarQueue' | 'calibration'>): Calibration {
    const stored = withCalibrationDefaults(progress.calibration);
    const replayed = calibrationFromHistory(progress);
    return Object.fromEntries(CALIBRATED_QUIZ_TYPES.map(type => [
        type,
        stored[type].history.length >= replayed[type].history.length ? stored[type] : replayed[type],
    ])) as Calibration;
}

/** Records a real review for one quiz type, leaving the others untouched. */
export function recordCalibratedAnswer(
    calibration: Calibration | undefined,
    type: CalibratedQuizType,
    result: AnswerResult
): Calibration {
    const current = withCalibrationDefaults(calibration);
    return { ...current, [type]: updateAdaptiveStats(current[type], result) };
}

/**
 * Does this vocab answer count toward its quiz type's window? Not a retry (the
 * answer was just shown) and not the word's very first review, which comes right
 * after its intro card. Both are near-certain successes that say nothing about
 * whether the schedule is spaced right.
 */
export function isCalibratedVocabReview(vocab: VocabProgress, quizType: 'reading' | 'meaning' | 'production'): boolean {
    return !vocab.needsRetry?.[quizType] && vocab.totalReviews > 0;
}

/** Grammar's equivalent of isCalibratedVocabReview. */
export function isCalibratedGrammarReview(progress: GrammarProgress): boolean {
    return !progress.needsRetry && progress.totalReviews > 0;
}

/** The growth level to apply for a quiz type (1.0 when nothing is recorded yet). */
export function growthLevelOf(calibration: Calibration | undefined, type: CalibratedQuizType): number {
    return calibration?.[type]?.level ?? 1.0;
}

/** Recent win rate of a quiz type's window, or null while it is empty. */
export function recentWinRate(stats: AdaptiveStats | undefined): number | null {
    if (!stats || stats.history.length === 0) return null;
    return stats.history.filter(Boolean).length / stats.history.length;
}

/** The user's review-pacing preference, applied to every quiz type's interval. */
export function frequencyModifierOf(settings: Pick<UserSettings, 'learningFrequency'> | null | undefined): number {
    return CONSTANTS.srs.frequencyMultipliers[settings?.learningFrequency ?? 'medium'];
}

/**
 * Merges two devices' calibration, per quiz type. The windows are rolling
 * boolean lists with no timestamps, so they cannot be unioned: the side with
 * more recorded reviews wins, local on a tie (it holds unpushed answers).
 */
export function mergeCalibration(local: Calibration | undefined, remote: Calibration | undefined): Calibration {
    const l = withCalibrationDefaults(local);
    const r = withCalibrationDefaults(remote);
    return Object.fromEntries(CALIBRATED_QUIZ_TYPES.map(type => [
        type,
        r[type].history.length > l[type].history.length ? r[type] : l[type],
    ])) as Calibration;
}

/* ---------- One-time transition: strength catches up with the schedule ---------- */

/**
 * Raises an entry's strength to what its own scheduled interval demonstrates.
 *
 * Under the old formula an interval was strength x lnTarget x adaptiveLevel x
 * frequency, so `interval / (lnTarget x frequency)` recovers strength x
 * adaptiveLevel: exactly the rebase the calibration needs, per entry, with every
 * due date left as it is. Under the new formula the same expression gives back
 * the strength itself, so running this again changes nothing: it is idempotent
 * by construction rather than guarded by a stored marker. That matters because a
 * tab still running an older build merges with `...local` and would drop a
 * marker, and re-applying a plain "strength x level" would then double it.
 *
 * Left alone: an unscheduled entry (inert production, skipped words), an
 * already-mastered one, and an interval sitting at the 1-day success floor (that
 * is a scheduling floor, not demonstrated recall). Strength is only ever raised:
 * a wrong answer's shortened interval demonstrates less, never more.
 */
export function rebaseEntryToSchedule(entry: SRSEntry, frequencyModifier: number): SRSEntry {
    const F = CONSTANTS.srs.formula;
    if (entry.dueDate === null) return entry;
    if (entry.memoryStrength >= F.mastery.maxMemoryStrength) return entry;
    if (entry.interval <= F.minIntervalAfterSuccess + 1e-9) return entry;
    const demonstrated = Math.min(entry.interval, F.maxInterval) / (F.lnTarget * frequencyModifier);
    if (demonstrated <= entry.memoryStrength + 1e-9) return entry;
    return { ...entry, memoryStrength: demonstrated };
}

function rebaseVocab(vp: VocabProgress, frequencyModifier: number): VocabProgress {
    const reading = rebaseEntryToSchedule(vp.reading, frequencyModifier);
    const meaning = rebaseEntryToSchedule(vp.meaning, frequencyModifier);
    const production = vp.production ? rebaseEntryToSchedule(vp.production, frequencyModifier) : vp.production;
    if (reading === vp.reading && meaning === vp.meaning && production === vp.production) return vp;
    return { ...vp, reading, meaning, production };
}

function rebaseGrammar(gp: GrammarProgress, frequencyModifier: number): GrammarProgress {
    const entry = rebaseEntryToSchedule(gp.entry, frequencyModifier);
    return entry === gp.entry ? gp : { ...gp, entry };
}

/**
 * Applies rebaseEntryToSchedule to every vocab and grammar entry. Returns the
 * same reference when nothing changed, so a no-op run triggers no save or upload.
 * Stage and nextReviewAt are left as they are: the due dates do not move, and a
 * word that the rebase lifts past mastery graduates on its next answer through
 * the normal path, like any other entry that crossed the ceiling.
 */
export function rebaseStrengthsToSchedule<T extends Pick<UserProgress, 'learningQueue' | 'grammarQueue'>>(progress: T, frequencyModifier: number): T {
    let changed = false;
    const learningQueue = progress.learningQueue.map(vp => {
        const next = rebaseVocab(vp, frequencyModifier);
        if (next !== vp) changed = true;
        return next;
    });
    const grammarQueue = progress.grammarQueue.map(gp => {
        const next = rebaseGrammar(gp, frequencyModifier);
        if (next !== gp) changed = true;
        return next;
    });
    return changed ? { ...progress, learningQueue, grammarQueue } : progress;
}
