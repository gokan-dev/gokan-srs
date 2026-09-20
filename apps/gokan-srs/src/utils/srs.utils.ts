import type { VocabProgress } from "../models/vocabulary.model";
import type { UserSettings } from "../models/user.model";
import { CONSTANTS } from "../commons/constants";
import { isMeaningQuizEnabled, isProductionQuizEnabled } from "../services/scheduling";
import { pickStable as pickStableGeneric } from "./deterministicPick";

/**
 * 'reading'    kanji prompt, hiragana answer (recognition)
 * 'meaning'    Japanese prompt, English answer (recognition)
 * 'production' English prompt, Japanese reading answer (production)
 */
export type QuizType = 'reading' | 'meaning' | 'production';
export type QuizMode = 'base' | 'context';

/**
 * A task key uniquely identifies one quiz to answer: `${vocabId}:${quizType}`.
 * Defined here rather than in quizReducer (which re-exports it for compatibility)
 * so queue selection below can be handed a committed-set filter without the
 * context layer having to import from the reducer, or this module duplicating
 * the key format.
 */
export type TaskKey = `${string}:${QuizType}`;

export function taskKey(vocabId: string, quizType: QuizType): TaskKey {
    return `${vocabId}:${quizType}`;
}

export interface QuizItem {
    vocab: VocabProgress;
    quizType: QuizType;
    quizMode: QuizMode;
}

/**
 * Return the next quiz item (vocab + type) that is ready to be studied now.
 * Implements prioritized flow (Successive Batches):
 * 1. Retries (High priority, immediate re-test)
 * 2. Due Readings (Batch 1)
 * 3. Due Meanings (Batch 2)
 * 4. New Intros (Batch 3, if allowed)
 * 5. First Reviews (Newly introduced, not yet tested)
 */
/**
 * Is this vocab's READING quiz due for a genuine, regularly-scheduled review
 * (first review or a due review) - independent of any `needsRetry` flag.
 * Factored out of isReadingActionable so clearStaleNeedsRetry (below) can ask
 * "is there a real review here" without also matching on the retry flag it's
 * trying to decide whether to clear.
 */
function isReadingDue(v: VocabProgress, now: Date): boolean {
    const isFirstReview =
        v.totalReviews === 0 &&
        v.introductionAt !== null &&
        v.nextReviewAt !== null &&
        v.nextReviewAt <= now &&
        v.stage !== 'graduated';

    const isDueReading =
        v.totalReviews > 0 &&
        v.reading.dueDate !== null &&
        v.reading.dueDate <= now;

    return isFirstReview || isDueReading;
}

/** Is this vocab's MEANING quiz due for a genuine, regularly-scheduled review - independent of `needsRetry`. See isReadingDue. */
function isMeaningDue(v: VocabProgress, now: Date): boolean {
    return v.totalReviews > 0 && v.meaning.dueDate !== null && v.meaning.dueDate <= now;
}

/** Is this vocab's PRODUCTION quiz due for a genuine, regularly-scheduled review - independent of `needsRetry`. See isReadingDue. */
function isProductionDue(v: VocabProgress, now: Date): boolean {
    const entry = v.production;
    return v.totalReviews > 0 && !!entry && entry.dueDate !== null && entry.dueDate <= now;
}

/**
 * Is this vocab's READING quiz actionable right now (first review, due review, or
 * a pending reading retry)? Single source of truth shared by queue selection and
 * the session-progress counter, so the two can never disagree about what counts
 * as "a quiz the user has to do now".
 */
export function isReadingActionable(v: VocabProgress, now: Date = new Date()): boolean {
    return isReadingDue(v, now) || v.needsRetry?.reading === true;
}

/** Is this vocab's MEANING quiz actionable right now (due review or pending retry)?
 *  Always false when meaning quizzes are disabled in settings. */
export function isMeaningActionable(
    v: VocabProgress,
    settings: UserSettings | undefined,
    now: Date = new Date()
): boolean {
    if (!isMeaningQuizEnabled(settings)) return false;
    return isMeaningDue(v, now) || v.needsRetry?.meaning === true;
}

/** Is this vocab's PRODUCTION quiz actionable right now (due review or pending retry)?
 *  Always false when production quizzes are disabled, and for a word whose production
 *  entry has never been activated (dueDate null, so isProductionDue cannot match). */
export function isProductionActionable(
    v: VocabProgress,
    settings: UserSettings | undefined,
    now: Date = new Date()
): boolean {
    if (!isProductionQuizEnabled(settings)) return false;
    return isProductionDue(v, now) || v.needsRetry?.production === true;
}

/**
 * Clears a `needsRetry` flag that has persisted across a session boundary and
 * has now collided with that same quiz type's regular due review (issue #36):
 * a wrong answer sets `needsRetry.<type>` AND pushes that entry's `dueDate`
 * forward by the wrong-answer penalty interval; if the session ends before the
 * user retries, by the next session both the stale retry flag and the now-
 * elapsed due date can be true at once. Answering it once then only walks the
 * SRSService.applyAnswer *retry* branch (needsRetry takes priority there,
 * intentionally, so a same-session retry never double-dips on SRS credit) -
 * which does NOT advance dueDate, so the very same item immediately becomes
 * actionable again as a "fresh" due review, producing a second encounter for
 * what the user experiences as one item.
 *
 * Called once, at session start, only for items whose regular review is ALSO
 * due right now - a fresh scheduled review already re-tests the exact recall
 * the stale retry existed to correct, so the retry is redundant. Deliberately
 * does NOT touch a same-session retry (dueDate for a wrong answer is pushed
 * well past "now" by calculateNextState, so it can't also read as due until
 * long after the session that set it has ended) - only ever called from the
 * session-start effect, never mid-session.
 */
export function clearStaleNeedsRetry(
    queue: VocabProgress[],
    settings: UserSettings | undefined,
    now: Date = new Date()
): VocabProgress[] {
    let changed = false;

    const next = queue.map(v => {
        if (!v.needsRetry) return v;

        const clearReading = v.needsRetry.reading === true && isReadingDue(v, now);
        const clearMeaning = v.needsRetry.meaning === true && isMeaningQuizEnabled(settings) && isMeaningDue(v, now);
        const clearProduction = v.needsRetry.production === true && isProductionQuizEnabled(settings) && isProductionDue(v, now);
        if (!clearReading && !clearMeaning && !clearProduction) return v;

        changed = true;
        return {
            ...v,
            needsRetry: {
                ...v.needsRetry,
                ...(clearReading ? { reading: false } : {}),
                ...(clearMeaning ? { meaning: false } : {}),
                ...(clearProduction ? { production: false } : {}),
            },
        };
    });

    return changed ? next : queue;
}

/**
 * `allowed` is the active session's committed task set (see SessionTracking).
 * When given, only tasks in it are ever served, which is what makes the
 * per-session quiz cap actually bind: without it, capping the committed set
 * would only shrink the progress counter's denominator while selection kept
 * handing out every due card anyway.
 *
 * When the cap has left actionable work out of the committed set, this returns
 * null rather than falling through to new intros, so the caller can surface
 * 'session-complete' instead of starting the user on new vocabulary while
 * reviews they have not been offered are still due.
 */
export function getNextVocabToStudy(
    queue?: VocabProgress[],
    settings?: UserSettings,
    now: Date = new Date(),
    preferredType?: QuizType,
    allowed?: ReadonlySet<TaskKey>
): QuizItem | null {
    if (!queue || queue.length === 0) return null;

    // 1. Priority: ALL Readings (First Reviews + Due Readings + Retries)
    // We want to clear all reading quizzes before moving to meanings.
    const allActionableReadings = queue.filter(v => isReadingActionable(v, now));

    const allActionableMeanings = isMeaningQuizEnabled(settings)
        ? queue.filter(v => isMeaningActionable(v, settings, now))
        : [];

    const allReadings = allowed
        ? allActionableReadings.filter(v => allowed.has(taskKey(v.vocabId, 'reading')))
        : allActionableReadings;

    const allActionableProductions = isProductionQuizEnabled(settings)
        ? queue.filter(v => isProductionActionable(v, settings, now))
        : [];

    const dueMeanings = allowed
        ? allActionableMeanings.filter(v => allowed.has(taskKey(v.vocabId, 'meaning')))
        : allActionableMeanings;

    const dueProductions = allowed
        ? allActionableProductions.filter(v => allowed.has(taskKey(v.vocabId, 'production')))
        : allActionableProductions;

    const pickReading = (): QuizItem => ({ vocab: pickStable(allReadings)!, quizType: 'reading', quizMode: 'base' });
    const pickProduction = (): QuizItem => ({ vocab: pickStable(dueProductions)!, quizType: 'production', quizMode: 'base' });
    const pickMeaning = (): QuizItem => {
        const vocab = pickStable(dueMeanings)!;
        const mastery = calculateMasteryPercentage(vocab.meaning.memoryStrength);
        // Resolve the configured threshold level (default 'normal' = 50%)
        const thresholdKey = settings?.meaningContextThreshold ?? 'normal';
        const masteryThreshold = CONSTANTS.srs.meaningContextThresholds[thresholdKey];
        const mode: QuizMode = mastery >= masteryThreshold ? 'context' : 'base';
        return { vocab, quizType: 'meaning', quizMode: mode };
    };

    // Stay on whichever quiz TYPE is currently active (the type of the card the
    // user is looking at right now) as long as that pool still has work, before
    // falling back to the reading > meaning priority below. Without this, a
    // reading item becoming actionable mid-way through a run of meaning quizzes
    // (a retry flag flipping, or a review simply coming due while the user is
    // mid-session) would hijack the very next card - interrupting a meaning batch
    // with a surprise reading quiz the user, mentally still in "meaning mode",
    // is primed to answer wrong.
    if (preferredType === 'reading' && allReadings.length > 0) return pickReading();
    if (preferredType === 'meaning' && dueMeanings.length > 0) return pickMeaning();
    if (preferredType === 'production' && dueProductions.length > 0) return pickProduction();

    // Production last: it is the hardest direction, so it reads better after the
    // word has already been seen in the easier ones this session.
    if (allReadings.length > 0) return pickReading();
    if (dueMeanings.length > 0) return pickMeaning();
    if (dueProductions.length > 0) return pickProduction();

    // The session's committed workload is cleared but reviews the cap left out are
    // still due. Stop here instead of introducing new vocabulary on top of a backlog
    // the user has not been offered yet; the caller reads this null as
    // 'session-complete' and offers another session.
    if (allowed && (allActionableReadings.length > 0 || allActionableMeanings.length > 0 || allActionableProductions.length > 0)) {
        return null;
    }

    // 4. Priority: New Intros (not introduced yet)
    // When introducing, we start with Reading quiz? Or just distinct Intro card?
    // The intro card leads to a "Learn" choice, which sets nextReviewAt=NOW.
    // Then it falls into "First Reviews".
    const newIntros = queue.filter(v =>
        v.introductionAt === null &&
        v.stage !== 'graduated'
    );
    if (newIntros.length > 0) {
        // Intros are type-agnostic until "Learn" is clicked, but we need a type.
        // We default to 'reading' as the primary entry point.
        return { vocab: pickStable(newIntros)!, quizType: 'reading', quizMode: 'base' };
    }

    return null;
}



/**
 * Vocab wrapper over the shared pickStable (utils/deterministicPick.ts): seeds
 * the deterministic choice on each item's per-review state, so every answer
 * (including retry-flag flips) naturally reshuffles the order. See the shared
 * helper's doc comment for why the pick has to be stable per pool state.
 */
function pickStable(items: VocabProgress[]): VocabProgress | null {
    return pickStableGeneric(items, v => {
        const reviewedAt = v.lastReviewedAt instanceof Date ? v.lastReviewedAt.getTime() : 0;
        const retry = `${v.needsRetry?.reading ? 1 : 0}${v.needsRetry?.meaning ? 1 : 0}`;
        return `${v.vocabId}:${v.totalReviews}:${reviewedAt}:${retry}`;
    });
}

/**
 * The two-loop mastery curve: p1 is progress through the "learning" loop
 * (0 -> visualSoftCap), p2 is progress through the "refining" loop
 * (visualSoftCap -> maxMemoryStrength). Exposed separately so MasteryRing can
 * render its two rings without reimplementing this math - the single source
 * of truth for the mastery curve lives here.
 */
export function calculateMasteryLoops(strength: number): { p1: number; p2: number } {
    const sMin = CONSTANTS.srs.formula.minMemoryStrength;
    const sSoft = CONSTANTS.srs.formula.mastery.visualSoftCap;
    const sMax = CONSTANTS.srs.formula.mastery.maxMemoryStrength;

    if (strength <= sMin) return { p1: 0, p2: 0 };

    let p1 = 0;
    if (strength >= sSoft) {
        p1 = 100;
    } else {
        const numer = Math.log(strength / sMin);
        const denom = Math.log(sSoft / sMin);
        p1 = (numer / denom) * 100;
    }

    let p2 = 0;
    if (strength > sSoft) {
        const numer = Math.log(strength / sSoft);
        const denom = Math.log(sMax / sSoft);
        p2 = (numer / denom) * 100;
    }

    return {
        p1: Math.min(Math.max(p1, 0), 100),
        p2: Math.min(Math.max(p2, 0), 100),
    };
}

export function calculateMasteryPercentage(strength: number): number {
    const { p1, p2 } = calculateMasteryLoops(strength);
    return Math.min(Math.max(p1 + p2, 0), 200);
}