import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import { useLocation } from 'react-router-dom';
import type { GrammarPoint } from '../../models/grammar.model';
import { GrammarService } from '../../services/grammar.service';
import { GrammarSRSService } from '../../services/grammarSrs.service';
import { clearStaleGrammarNeedsRetry } from '../../services/grammarScheduling';
import type { AnswerResult } from '../../services/srs.service';
import { CONSTANTS } from '../../commons/constants';
import { calculateMasteryPercentage } from '../../utils/srs.utils';
import type { QuizState, QuizAction } from './quizReducer';
import {
    selectNextGrammarView,
    selectCurrentGrammarProgress,
    selectNextGrammarSessionPreview,
    selectGrammarSessionStats,
    collectActionableGrammarIds,
    computeBlankPlan,
    gradeGrammarAnswers,
} from './grammarSelectors';
import { useSessionLifecycle } from './useSessionLifecycle';
import { refillCandidates } from './refillCandidates';

export interface GrammarActions {
    setGrammarAnswer(index: number, value: string): void;
    revealGrammarHint(index: number): void;
    submitGrammarAnswer(): Promise<void>;
    advanceGrammarQueue(): Promise<void>;
    continueGrammarToNext(): Promise<void>;
    saveGrammarIntroChoice(grammarPoint: GrammarPoint, choice: 'learn' | 'skip'): void;
}

/**
 * Grammar's equivalent of useQuizOrchestration: loading, auto-advance timing,
 * and the submit/continue/advance/intro actions for the Grammar activity.
 * Deliberately does NOT duplicate persistence or Drive-sync wiring - those
 * effects in useQuizOrchestration already key off `state.progress` generically
 * (any dispatch that changes it gets saved/synced), and grammarQueue lives on
 * that same UserProgress object, so dispatching through the shared reducer
 * gets this for free.
 */
export function useGrammarOrchestration(state: QuizState, dispatch: Dispatch<QuizAction>) {
    const location = useLocation();

    const startTimeRef = useRef<number | null>(null);
    const submitLatencyRef = useRef<number | null>(null);
    const loadingKeyRef = useRef<string | null>(null);

    const [hasMoreLearnableGrammar, setHasMoreLearnableGrammar] = useState(false);

    useEffect(() => {
        if (!state.progress) return;
        GrammarSRSService.hasMoreLearnableGrammar(state.progress.grammarQueue).then(setHasMoreLearnableGrammar);
    }, [state.progress]);

    const grammarNextView = useMemo(
        () => selectNextGrammarView(state, hasMoreLearnableGrammar),
        [state.progress, state.grammarIntroCandidates, state.currentGrammarPoint, hasMoreLearnableGrammar]
    );

    const currentGrammarProgress = useMemo(
        () => selectCurrentGrammarProgress(state),
        [state.currentGrammarPoint, state.progress]
    );

    const nextGrammarSessionPreview = useMemo(
        () => selectNextGrammarSessionPreview(state),
        [state.progress]
    );

    const grammarSessionStats = useMemo(
        () => selectGrammarSessionStats(state, hasMoreLearnableGrammar),
        [state.progress, state.grammarSession, hasMoreLearnableGrammar]
    );

    /* ---------- Session lifecycle ---------- */

    // Mirrors useQuizOrchestration's vocab session lifecycle (see its doc comment
    // for the full rationale), sharing the generic edge-detection via
    // useSessionLifecycle: a grammar session is active only while the user is on
    // /grammar AND there is review/learn work, and ends the moment either
    // condition stops holding.
    const grammarSessionActive =
        location.pathname === '/grammar' &&
        (grammarNextView.sessionState === 'review' || grammarNextView.sessionState === 'learn');

    useSessionLifecycle({
        active: grammarSessionActive,
        hasSession: !!state.grammarSession,
        onStart: (now) => {
            if (!state.progress) return;

            // Clear a needsRetry flag inherited from a previous session that now
            // collides with this point's regular due review (issue #36) - see
            // clearStaleGrammarNeedsRetry's doc comment for why, mirroring the
            // vocab fix in useQuizOrchestration.
            const clearedQueue = clearStaleGrammarNeedsRetry(state.progress.grammarQueue, now);
            const progress = clearedQueue === state.progress.grammarQueue
                ? state.progress
                : { ...state.progress, grammarQueue: clearedQueue };

            const grammarIds = collectActionableGrammarIds(progress.grammarQueue, now);
            dispatch({
                type: 'GRAMMAR_SESSION_START',
                payload: { grammarIds, progress: progress === state.progress ? undefined : progress },
            });
        },
        onEnd: () => dispatch({ type: 'GRAMMAR_SESSION_END' }),
    });

    /* =========================
       ACTIONS
       ========================= */

    const grammarActions: GrammarActions = {
        setGrammarAnswer(index, value) {
            dispatch({ type: 'GRAMMAR_SET_ANSWER', payload: { index, value } });
        },

        revealGrammarHint(index) {
            dispatch({ type: 'GRAMMAR_REVEAL_HINT', payload: { index } });
        },

        async submitGrammarAnswer() {
            if (!state.currentGrammarPoint || state.grammarFeedback?.show || !state.currentGrammarBlankPlan) return;
            if (state.currentGrammarBlankPlan.readOnly) return; // nothing to grade - handled by continueGrammarToNext directly

            submitLatencyRef.current = startTimeRef.current ? Date.now() - startTimeRef.current : null;

            const plan = state.currentGrammarBlankPlan;
            const { perBlankResults, matchedAnswers, overall, strengthDeltaModifier } = gradeGrammarAnswers(
                plan,
                state.grammarAnswers,
                state.grammarHintLevels
            );

            // Positive-only vocab credit: the non-pattern (reinforcement) blanks the
            // user actually answered right, without revealing the hint. Applied to
            // those words' own SRS on continue - never for wrong/passed/revealed blanks.
            const example = state.currentGrammarPoint.examples[plan.exampleIndex];
            const vocabCredits: { vocabId: string; result: AnswerResult }[] = [];
            plan.blankWordIndices.forEach((wordIndex, i) => {
                if (plan.isPatternBlank[i]) return;
                if ((state.grammarHintLevels[i] ?? 0) >= 2) return;
                const r = perBlankResults[i];
                if (r !== 'correct' && r !== 'minor_error') return;
                const vocabId = example?.words[wordIndex]?.vocabId;
                if (vocabId) vocabCredits.push({ vocabId, result: r });
            });

            const allStrictlyCorrect = perBlankResults.every(r => r === 'correct');
            const message = overall === 'correct'
                // A correct grammar core with a missed vocab blank still grades
                // 'correct' (the point's result rides on the pattern) - say so
                // explicitly rather than a bare "Correct." next to a red blank.
                ? (allStrictlyCorrect ? 'Correct.' : 'Grammar correct - check the highlighted word(s).')
                : overall === 'pass'
                    ? 'Revealed - marked as passed.'
                    : overall === 'minor_error'
                        ? 'Close.'
                        : 'Incorrect.';

            dispatch({ type: 'GRAMMAR_SUBMIT_ANSWER', payload: { type: overall, message, matchedAnswers, perBlankResults, strengthDeltaModifier, vocabCredits } });
        },

        async advanceGrammarQueue() {
            if (!state.progress) return;
            const updatedQueue = state.progress.grammarQueue;
            const now = new Date();

            const nowDueCount = updatedQueue.filter(g => g.nextReviewAt && g.nextReviewAt <= now).length;
            const canAddNew = nowDueCount === 0 && grammarNextView.sessionState !== 'waiting';
            const needsCandidates = canAddNew && state.grammarIntroCandidates.length === 0;

            let newCandidates: GrammarPoint[] = [];

            if (needsCandidates) {
                const { newCandidates: loaded, criticalErrorId } = await refillCandidates<GrammarPoint>({
                    existing: state.grammarIntroCandidates,
                    batchSize: CONSTANTS.srs.newVocabBatchSize,
                    getNextIds: (maxToFind, ignored) => GrammarSRSService.getNextCandidates(updatedQueue, maxToFind, ignored),
                    loadItem: (id) => GrammarService.loadGrammarPoint(id),
                    logLabel: 'useGrammarOrchestration',
                });

                if (criticalErrorId) {
                    dispatch({
                        type: 'GRAMMAR_LOAD_ERROR',
                        payload: { grammarId: criticalErrorId, error: new Error('Candidate grammar files could not be loaded. Data might be corrupted or out-of-sync.') },
                    });
                    return;
                }
                newCandidates = loaded;
            }

            dispatch({
                type: 'GRAMMAR_ADVANCE_QUEUE',
                payload: {
                    progress: { ...state.progress, grammarQueue: updatedQueue },
                    candidates: newCandidates.length > 0 ? [...state.grammarIntroCandidates, ...newCandidates] : undefined,
                },
            });
        },

        async continueGrammarToNext() {
            if (!state.progress || !state.currentGrammarPoint) return;

            const now = new Date();
            const id = state.currentGrammarPoint.id;
            const title = state.currentGrammarPoint.title;

            const target = state.progress.grammarQueue.find(g => g.grammarId === id);
            if (!target) return;

            let updatedQueue;
            let updatedLearningQueue = state.progress.learningQueue;
            let historyItem: { grammarId: string; title: string; result: AnswerResult; delta: number; vocabDelta?: number } | null = null;

            if (state.currentGrammarBlankPlan?.readOnly) {
                // No blank-eligible word anywhere in this point's examples - there's
                // nothing to grade, so this must not touch memoryStrength/interval
                // (no SRS credit either way). Just defer the due date so the same
                // ungradable card doesn't reappear on the very next pick.
                const deferred = GrammarSRSService.deferWithoutCredit(target, now);
                updatedQueue = state.progress.grammarQueue.map(g => g.grammarId === id ? deferred : g);
            } else {
                if (!state.grammarFeedback) return;
                const latency = submitLatencyRef.current ?? 5000;
                const { updated } = GrammarSRSService.applyAnswer(
                    target, state.grammarFeedback.type, latency, now, 1.0, 1.0, state.grammarFeedback.strengthDeltaModifier
                );
                updatedQueue = state.progress.grammarQueue.map(g => g.grammarId === id ? updated : g);

                // Positive-only vocab reinforcement (skip on a grammar retry: it's a
                // training redo that would over-credit the same words on each loop).
                if (!target.needsRetry && state.settings) {
                    updatedLearningQueue = GrammarSRSService.applyVocabReinforcement(
                        state.progress.learningQueue, state.grammarFeedback.vocabCredits, now, state.settings
                    );
                }

                const delta = calculateMasteryPercentage(updated.entry.memoryStrength) - calculateMasteryPercentage(target.entry.memoryStrength);

                // Points the same answer credited to the sentence's vocabulary, summed
                // across every word reinforced. Measured by diffing the learning queue
                // rather than re-deriving from vocabCredits, so it reports what was
                // actually written (applyVocabReinforcement skips words not in the
                // queue, and is itself skipped entirely on a retry).
                let vocabDelta = 0;
                if (updatedLearningQueue !== state.progress.learningQueue) {
                    const before = new Map(state.progress.learningQueue.map(v => [v.vocabId, v]));
                    for (const after of updatedLearningQueue) {
                        const prior = before.get(after.vocabId);
                        if (!prior || prior === after) continue;
                        vocabDelta += calculateMasteryPercentage(after.reading.memoryStrength)
                            - calculateMasteryPercentage(prior.reading.memoryStrength);
                    }
                }

                historyItem = {
                    grammarId: id,
                    title,
                    result: state.grammarFeedback.type,
                    delta,
                    ...(vocabDelta > 0 ? { vocabDelta } : {}),
                };
            }

            dispatch({
                type: 'GRAMMAR_UPDATE_AFTER_ANSWER',
                payload: { progress: { ...state.progress, grammarQueue: updatedQueue, learningQueue: updatedLearningQueue }, historyItem },
            });
        },

        saveGrammarIntroChoice(grammarPoint, choice) {
            if (!state.progress) return;
            dispatch({ type: 'GRAMMAR_INTRO_CHOICE', choice, grammarId: grammarPoint.id, grammarPoint });
        },
    };

    /* ---------- Load grammar point ---------- */

    useEffect(() => {
        // Route-gated exactly like vocab's /quiz effect - browsing anywhere else
        // must not keep fetching grammar JSON or silently advancing the queue.
        if (location.pathname !== '/grammar') return;

        const queueItem = grammarNextView.queueItem;

        if (!queueItem) {
            dispatch({ type: 'GRAMMAR_LOAD_SUCCESS', payload: { point: null, blankPlan: null } });

            if (state.progress && (grammarNextView.sessionState === 'learn' || grammarNextView.sessionState === 'exhausted')) {
                grammarActions.advanceGrammarQueue();
            }
            return;
        }

        // Already loaded or currently loading exactly this grammar point -
        // GRAMMAR_LOAD_START sets currentGrammarQuizItem synchronously, so this
        // single comparison covers both cases (see useQuizOrchestration's
        // equivalent guard for why currentGrammarPoint alone can't detect the
        // in-flight case).
        if (state.currentGrammarQuizItem?.grammarId === queueItem.grammarId) {
            return;
        }

        dispatch({ type: 'GRAMMAR_LOAD_START', payload: queueItem });

        const loadKey = queueItem.grammarId;
        loadingKeyRef.current = loadKey;

        GrammarService.loadGrammarPoint(queueItem.grammarId).then(async point => {
            if (loadingKeyRef.current !== loadKey) return; // superseded by a newer target

            const existing = state.progress?.grammarQueue.find(g => g.grammarId === point.id);
            const blankPlan = await computeBlankPlan(point, state.progress, existing?.totalReviews ?? 0);
            if (loadingKeyRef.current !== loadKey) return; // superseded while awaiting the blank plan's vocab fetches

            dispatch({ type: 'GRAMMAR_LOAD_SUCCESS', payload: { point, blankPlan } });
            startTimeRef.current = Date.now();
        }).catch(err => {
            if (loadingKeyRef.current !== loadKey) return;
            console.error('[useGrammarOrchestration] Failed to load grammar point', err);
            dispatch({ type: 'GRAMMAR_LOAD_ERROR', payload: { grammarId: queueItem.grammarId, error: err } });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grammarNextView.queueItem, state.progress, grammarNextView.sessionState, location.pathname]);

    useEffect(() => {
        if (state.grammarFeedback?.correct) {
            const timer = setTimeout(() => {
                grammarActions.continueGrammarToNext().then();
            }, CONSTANTS.quiz.correctAnswerAutoAdvanceDelay);

            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.grammarFeedback?.correct]);

    /* =========================
       COMPUTED FLAGS
       ========================= */

    const grammarComputed = {
        // Deliberately does NOT require every blank to be filled. Requiring it made
        // the card blockable: any state where an input could not be filled left the
        // learner with no way forward at all, and revealing a blank via its hint
        // button was exactly that (the reveal was a render-time display value and
        // never reached grammarAnswers, so the "all filled" check stayed false).
        // Two earlier variants of the same trap are recorded on blankWordSpans and
        // on GrammarQuizState.example.
        //
        // An empty blank is now a legitimate answer meaning "I do not know this one":
        // it grades as 'pass' and the accepted form is revealed in the feedback, which
        // is what the learner wanted from the hint button anyway. Leaving Submit
        // always reachable also means no future blank-selection bug can strand a card.
        canSubmitGrammar:
            !!state.currentGrammarPoint &&
            !!state.currentGrammarBlankPlan &&
            !state.currentGrammarBlankPlan.readOnly &&
            state.currentGrammarBlankPlan.blankWordIndices.length > 0 &&
            !state.grammarFeedback?.show &&
            !state.isLoadingGrammar,

        canContinueGrammar: !!state.grammarFeedback?.show,

        isGrammarReady: !!state.currentGrammarPoint && !state.isLoadingGrammar,
    };

    return { grammarActions, grammarNextView, currentGrammarProgress, grammarComputed, nextGrammarSessionPreview, grammarSessionStats };
}
