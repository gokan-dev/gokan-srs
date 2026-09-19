import type { VocabProgress } from '../../models/vocabulary.model';
import type { Sentence } from '../../models/sentence.model';
import type { SessionState } from '../../models/state.model';
import type { UserSettings } from '../../models/user.model';
import { getNextVocabToStudy, isReadingActionable, isMeaningActionable, isProductionActionable } from '../../utils/srs.utils';
import type { QuizType } from '../../utils/srs.utils';
import { CONSTANTS } from '../../commons/constants';
import type { QuizState, PendingQuizItem, TaskKey } from './quizReducer';
import { taskKey } from './quizReducer';
import { computeSessionState } from './sessionState';
import { computeSessionStats } from './sessionStats';

/**
 * Single source of truth for "what should the quiz screen show right now".
 * Replaces three previously-independent decision points that had to be kept in
 * agreement by hand: the `nextDue` memo (queue-level "what to load"),
 * `computeSessionView` (session-level "what mode are we in"), and QuizScreen's
 * own ad-hoc `currentProgress.introductionAt` check (intro-vs-quiz).
 */
export interface NextViewResult {
    /** The queue item that should be loaded/displayed next, or null if nothing is due/learnable right now. */
    queueItem: PendingQuizItem | null;
    sessionState: SessionState;
    nextReviewAt: Date | null;
    /** True when the currently-loaded vocab hasn't been introduced yet and should show the intro card. */
    shouldShowIntro: boolean;
}

export function selectNextView(
    state: Pick<QuizState, 'progress' | 'settings' | 'introCandidates' | 'currentVocab' | 'currentQuizItem' | 'nextKanjiToLearn' | 'session'>,
    hasMoreLearnable: boolean,
    now: Date = new Date()
): NextViewResult {
    const { progress, settings, introCandidates } = state;

    // Hint getNextVocabToStudy to stay on whichever quiz type is currently on
    // screen (see its doc comment) - prevents a reading item becoming actionable
    // mid-meaning-batch (or vice versa) from hijacking the next card.
    const preferredType = state.currentQuizItem?.quizType;

    // The active session's committed task set bounds what can be served, so the
    // per-session cap (capSessionCommit) actually limits the sitting rather than
    // just the progress counter. No session means no bound (the queue is live).
    const committed = state.session ? new Set(state.session.committed) : undefined;

    const queueItem: PendingQuizItem | null = introCandidates.length > 0
        ? { vocabId: introCandidates[0].id, quizType: 'reading', quizMode: 'base' }
        : getNextVocabToStudy(progress?.learningQueue, settings ?? undefined, now, preferredType, committed);

    const { sessionState, nextReviewAt } = computeSessionState<VocabProgress, SessionState>(
        progress && settings ? progress.learningQueue : undefined,
        {
            isLearning: v => v.stage === 'learning',
            isDue: v => !!v.nextReviewAt && v.nextReviewAt <= now,
            nextReviewAtOf: v => v.nextReviewAt,
            canLearn: hasMoreLearnable || introCandidates.length > 0,
            states: { review: 'review', learn: 'learn', waiting: 'waiting', exhausted: 'exhausted' },
            extraState: state.nextKanjiToLearn ? 'learn-kanji' : null,
        }
    );

    let shouldShowIntro = false;
    if (state.currentVocab && progress) {
        const vocabProgress = progress.learningQueue.find(v => v.vocabId === state.currentVocab!.id);
        shouldShowIntro = !vocabProgress || !vocabProgress.introductionAt;
    }

    // The session cleared everything it committed to, but the cap (or work that came
    // due mid-session) left actionable reviews outside that set. Without this the
    // screen would sit on a loading gate forever: sessionState stays 'review' off the
    // live queue while selection, bounded to the committed set, has nothing to hand back.
    if (
        committed &&
        !queueItem &&
        introCandidates.length === 0 &&
        progress &&
        collectActionableTaskKeys(progress.learningQueue, settings ?? undefined, now)
            .some(key => !committed.has(key))
    ) {
        return { queueItem, sessionState: 'session-complete', nextReviewAt, shouldShowIntro };
    }

    return { queueItem, sessionState, nextReviewAt, shouldShowIntro };
}

export interface NextSessionPreview {
    review: number;
    new: number;
    retries: number;
    /**
     * Quiz cards that are due but will NOT fit in the next session, because
     * `capSessionCommit` truncates it to CONSTANTS.srs.sessionQuizCap. Zero when
     * everything due fits, which is the normal case.
     */
    remaining: number;
}

/**
 * Preview of what the next study session will contain, counted in **quiz cards**
 * and run through the session's own pipeline (`collectActionableTaskKeys` then
 * `capSessionCommit`), so the number on the Main hub is literally the number of
 * cards the session will commit to.
 *
 * It used to count distinct *vocab* instead, which broke twice over once a third
 * quiz type existed. Its due-check listed reading and meaning by hand and was
 * never extended to production, so a queue with only production due reported "all
 * caught up" while the session had work. And counting words understated a session
 * that asks up to three cards per word, which matters much more now that the cap
 * bounds the sitting: "12 review" for 30 committed cards is not a useful preview.
 *
 * Deriving it from the same two functions the session uses means it cannot drift
 * from them again: a fourth quiz type, or any change to how the cap is composed,
 * is reflected here without touching this code.
 *
 * Buckets are mutually exclusive per card, first match wins: a card awaiting a
 * retry counts as a retry, a card on a word never yet reviewed counts as new, and
 * everything else is a review.
 */
export function selectNextSessionPreview(
    state: Pick<QuizState, 'progress' | 'settings'>,
    now: Date = new Date()
): NextSessionPreview {
    const empty = { review: 0, new: 0, retries: 0, remaining: 0 };
    if (!state.progress) return empty;

    const queue = state.progress.learningQueue;
    const settings = state.settings ?? undefined;

    const actionable = collectActionableTaskKeys(queue, settings, now);
    const committed = capSessionCommit(actionable);

    const byId = new Map(queue.map(v => [v.vocabId, v]));
    const preview = { ...empty, remaining: actionable.length - committed.length };
    // Every word that contributed a committed task, so the pass below cannot count
    // it a second time. A word flagged for retry counts as a retry and nothing else,
    // even when it has also never been reviewed.
    const alreadyCounted = new Set<string>();

    for (const key of committed) {
        const { vocabId, quizType } = parseTaskKey(key);
        const vocab = byId.get(vocabId);
        if (!vocab || vocab.stage === 'graduated') continue;

        alreadyCounted.add(vocabId);
        if (vocab.needsRetry?.[quizType]) preview.retries++;
        else if (vocab.totalReviews === 0) preview.new++;
        else preview.review++;
    }

    // `new` stays a count of WORDS, not cards, and includes words that are queued
    // but not yet actionable (introduced-but-not-due, or not yet introduced at all).
    // Those produce no task key, so the actionable pipeline above cannot see them,
    // yet they are exactly what the session will introduce once reviews run out.
    // Counting them as cards would be guesswork anyway: how many cards a new word
    // becomes depends on choices the learner has not made yet.
    for (const vocab of queue) {
        if (vocab.stage === 'graduated') continue;
        if (vocab.totalReviews !== 0) continue;
        if (alreadyCounted.has(vocab.vocabId)) continue;
        preview.new++;
        alreadyCounted.add(vocab.vocabId);
    }

    return preview;
}

export function selectCurrentProgress(
    state: Pick<QuizState, 'currentVocab' | 'progress'>
): VocabProgress | null {
    if (!state.currentVocab || !state.progress) return null;
    return state.progress.learningQueue.find(v => v.vocabId === state.currentVocab!.id) ?? null;
}

export function selectCurrentSentence(
    state: Pick<QuizState, 'currentSentences' | 'currentSentenceId'>
): Sentence | null {
    if (!state.currentSentences || !state.currentSentenceId) return null;
    return state.currentSentences.find(s => s.id === state.currentSentenceId) ?? null;
}

/** Every quiz task actionable right now, as task keys (`vocabId:quizType`). */
export function collectActionableTaskKeys(
    queue: VocabProgress[],
    settings: UserSettings | undefined,
    now: Date
): TaskKey[] {
    const keys: TaskKey[] = [];
    for (const v of queue) {
        if (isReadingActionable(v, now)) keys.push(taskKey(v.vocabId, 'reading'));
        if (isMeaningActionable(v, settings, now)) keys.push(taskKey(v.vocabId, 'meaning'));
        if (isProductionActionable(v, settings, now)) keys.push(taskKey(v.vocabId, 'production'));
    }
    return keys;
}

function parseTaskKey(key: string): { vocabId: string; quizType: QuizType } {
    const idx = key.lastIndexOf(':');
    return { vocabId: key.slice(0, idx), quizType: key.slice(idx + 1) as QuizType };
}

/**
 * Truncates a session-commit snapshot to `cap` tasks, split as evenly as possible
 * across the quiz types present so every type gets worked on in a single sitting.
 *
 * Taking a plain prefix of the snapshot would not do: getNextVocabToStudy clears
 * every actionable reading before any meaning, so a user with 400 due tasks and a
 * 200 cap would answer 200 readings and zero meanings, session after session,
 * while the meaning backlog only grew.
 *
 * Quotas spill: types are filled smallest-pool-first, so a type with less work than
 * its share hands the surplus to the others rather than cutting the session short.
 *
 * Input order is preserved in the result, so the committed set stays as
 * deterministic as the snapshot it came from.
 */
export function capSessionCommit(
    taskKeys: TaskKey[],
    cap: number = CONSTANTS.srs.sessionQuizCap
): TaskKey[] {
    if (cap <= 0) return [];
    if (taskKeys.length <= cap) return taskKeys;

    const byType = new Map<QuizType, TaskKey[]>();
    for (const key of taskKeys) {
        const { quizType } = parseTaskKey(key);
        const bucket = byType.get(quizType);
        if (bucket) bucket.push(key);
        else byType.set(quizType, [key]);
    }

    // Smallest pool first: each type takes at most an equal share of whatever is
    // left, so a short pool's unused share is redistributed over the types still
    // to be filled instead of being lost.
    const pools = [...byType.values()].sort((a, b) => a.length - b.length);

    const selected = new Set<TaskKey>();
    let remaining = cap;
    let poolsLeft = pools.length;

    for (const pool of pools) {
        const share = Math.floor(remaining / poolsLeft);
        const take = Math.min(pool.length, share);
        for (let i = 0; i < take; i++) selected.add(pool[i]);
        remaining -= take;
        poolsLeft--;
    }

    // Integer division leaves a remainder of up to (types - 1) tasks. Hand it to
    // whichever pools still have something left, so the session fills the cap exactly.
    if (remaining > 0) {
        for (const pool of pools) {
            for (const key of pool) {
                if (remaining === 0) break;
                if (selected.has(key)) continue;
                selected.add(key);
                remaining--;
            }
            if (remaining === 0) break;
        }
    }

    return taskKeys.filter(key => selected.has(key));
}

export interface SessionStats {
    /** Committed session tasks the user has cleared (answered, deferred, or graduated out). */
    done: number;
    /** Size of the committed session task set - the stable progress denominator. */
    total: number;
    /** Committed tasks currently awaiting a retry (a wrong answer this session). Shown highlighted. */
    retriesPending: number;
    /** Distinct vocab with tasks due now that are NOT part of this session (came due mid-session). */
    waiting: number;
    /** True when brand-new vocab can still be learned beyond this session (the "+" in "n+ waiting"). */
    moreNew: boolean;
}

/**
 * Session-progress bookkeeping, computed against the session's frozen committed
 * task set (see SessionTracking) rather than the live due count.
 *
 * The previous implementation derived `total` from `done + liveDueReviews`, which
 * shrank on every wrong answer: a wrong answer pushes the item's due date ~12h out
 * (so it leaves `liveDueReviews`) without incrementing `done` (wrong answers were
 * filtered out), and the pending retry was never re-counted. The denominator
 * therefore ticked *down* as the user worked. Now `total` is the committed set's
 * fixed size; `done` counts committed tasks that are no longer actionable; retries
 * and mid-session arrivals are surfaced separately instead of corrupting the total.
 *
 * `total`/`waiting` are computed against the **raw, unfiltered** `session.committed`
 * (the same set `selectNextView` uses to bound what gets served, and the same set
 * `selectNextSessionPreview` counts) - a task committed here always counts toward
 * `total` and is never reported as `waiting`, because it genuinely is part of this
 * session. An earlier version dropped a vocab's `meaning` key from this count
 * whenever its `reading` key was also committed, reasoning that a correct reading
 * answer would stagger the meaning's due date 12h forward (SRSService.applyAnswer)
 * before it could ever be shown. That reasoning doesn't hold unconditionally - a
 * wrong reading answer doesn't stagger meaning at all, and even a correct one only
 * staggers it if meaning was already due at THAT answer's moment - so the dropped
 * key could still end up served this session while permanently excluded from the
 * denominator. That desync is exactly what made the Main hub's preview (unfiltered,
 * "6 review") disagree with the in-session bar ("0/3") and mislabel the other 3 as
 * "waiting after this session" when they were in fact this session's own committed
 * work (issue: staging report from raphaeltamayo). `done` counting a staggered-away
 * task as complete is intentional, not a regression: `done` = "committed tasks no
 * longer actionable", and a task the session silently resolved without requiring a
 * separate answer is exactly that.
 */
export function selectSessionStats(
    state: Pick<QuizState, 'progress' | 'settings' | 'session'>,
    hasMoreLearnable: boolean,
    now: Date = new Date()
): SessionStats {
    if (!state.progress) {
        return { done: 0, total: 0, retriesPending: 0, waiting: 0, moreNew: hasMoreLearnable };
    }

    const queue = state.progress.learningQueue;
    const byId = new Map(queue.map(v => [v.vocabId, v]));

    const core = computeSessionStats({
        committed: state.session?.committed ?? [],
        actionable: collectActionableTaskKeys(queue, state.settings ?? undefined, now),
        isRetry: key => {
            const { vocabId, quizType } = parseTaskKey(key);
            return byId.get(vocabId)?.needsRetry?.[quizType] === true;
        },
        // Distinct vocab: a word's reading + meaning both waiting count once.
        waitingCountOf: keys => new Set(keys.map(k => parseTaskKey(k).vocabId)).size,
    });

    return { ...core, moreNew: hasMoreLearnable };
}
