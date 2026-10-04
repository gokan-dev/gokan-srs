import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import { useLocation } from 'react-router-dom';
import type { KanjiKnowledge, UserProgress, UserSettings } from '../../models/user.model';
import type { Vocabulary, VocabProgress } from '../../models/vocabulary.model';
import type { SynonymRelation } from '../../models/index.model';
import { StorageService } from '../../services/storage.service';
import { VocabularyService } from '../../services/vocabulary.service';
import { SRSService } from '../../services/srs.service';
import type { AnswerResult, ProductionSynonymCandidate } from '../../services/srs.service';
import { MigrationService } from '../../services/migration.service';
import { LLMService } from '../../services/llm.service';
import { CONSTANTS } from '../../commons/constants';
import { DEFAULT_SETTINGS } from '../../models/user.model';
import type { SetupValues } from '../../models/state.model';
import { calculateMasteryPercentage, clearStaleNeedsRetry } from '../../utils/srs.utils';
import { clozeAcceptedForms, pickProductionClozeSentence } from '../../utils/productionCloze.utils';
import { indexLearnerVocab, pickSentenceForVocab } from '../../utils/sentenceRanking';
import {
    frequencyModifierOf, growthLevelOf, isCalibratedVocabReview, recordCalibratedAnswer, withCalibrationDefaults,
} from '../../services/calibration';
import { mergeProgress, mergeSettings } from '../../services/sync/mergeProgress';
import type { ProgressWithMetadata } from '../../services/sync/types';
import { useGoogleDrive } from '../GoogleDriveContext';
import type { QuizState, QuizAction, SynonymWord } from './quizReducer';
import { selectNextView, selectCurrentProgress, selectSessionStats, selectNextSessionPreview, collectActionableTaskKeys, capSessionCommit, dedupTaskKeysByVocab } from './quizSelectors';
import { useSessionLifecycle } from './useSessionLifecycle';
import { sessionRouteRole } from './sessionRoutes';
import { refillCandidates } from './refillCandidates';
import { progressUploadSignature, stableStringify } from "../../services/progressSerialization";
import { embeddedSynonymCandidate, orderSynonymsForCue, productionCueOf, sharedMeaningUsed, synonymOutcome } from '../../utils/synonymContext.utils';
import type { ProductionCue } from '../../utils/synonymContext.utils';
import type { VocabSynonym } from '../../models/index.model';

/**
 * Finds which of the target's near-synonyms the learner typed. Each entry
 * carries the other word's forms, so this is normally a local check with no
 * request at all; only an entry without them (older data) fetches that word's
 * vocab file. Entries whose shared meaning the card uses are tried first.
 */
async function findProductionSynonym(input: string, entries: VocabSynonym[], cue: ProductionCue) {
    const ordered = orderSynonymsForCue(entries, cue);
    const embedded = ordered.map(embeddedSynonymCandidate);
    const local = SRSService.evaluateProductionSynonyms(
        input, embedded.filter((c): c is ProductionSynonymCandidate => c !== null)
    );
    if (local) return local;

    const unembedded = ordered.filter((_, i) => embedded[i] === null);
    const load = async (group: VocabSynonym[]) => (await Promise.all(group.map(async (entry): Promise<ProductionSynonymCandidate | null> => {
        try {
            const vocab = await VocabularyService.loadVocab(entry.id);
            return { vocabId: entry.id, relation: entry.relation, vocab, shared: entry.shared, curated: entry.curated };
        } catch (e) {
            // A stale reference (e.g. a retired vocab id) drops just that candidate.
            console.error('[useQuizOrchestration] Failed to load synonym candidate', entry.id, e);
            return null;
        }
    }))).filter((c): c is ProductionSynonymCandidate => c !== null);

    // In batches, in priority order: stop at the first batch containing a match.
    const BATCH = 25;
    for (let i = 0; i < unembedded.length; i += BATCH) {
        const match = SRSService.evaluateProductionSynonyms(input, await load(unembedded.slice(i, i + BATCH)));
        if (match) return match;
    }
    return null;
}

export interface QuizActions {
    setupComplete(values: SetupValues): Promise<void>;
    setAnswer(answer: string): void;
    /** Progressive hint for the CURRENT production cloze card (gloss, then reveal). No-op outside a cloze card. */
    revealProductionHint(): void;
    submitAnswer(): Promise<void>;
    advanceQueue({ now, overrideDailyLimit }: { now: Date, overrideDailyLimit?: boolean }): void;
    continueToNext(): Promise<void>;
    /** Ends the finished session so the lifecycle effect immediately commits a fresh capped one. */
    startNewSession(): void;
    saveSettings(settings: UserSettings): void;
    updateKanjiKnowledge(knowledge: KanjiKnowledge): void;
    overrideDailyLimit(): Promise<void>;
    saveVocabIntroChoice(vocabulary: Vocabulary, choice: 'learn' | 'skip'): void;
    learnNextKanji(): Promise<void>;
    /** Wipes grammar progress only, keeping vocab, kanji and settings. */
    resetGrammarProgress(): Promise<void>;
    reset(): void;
}

/**
 * All side effects and business-logic actions for the quiz state machine:
 * vocab/sentence loading, auto-advance timing, daily reset, persistence,
 * migration triggering, and Drive sync wiring. QuizProvider stays a thin
 * assembler that just wires this hook's output into React context.
 */
export function useQuizOrchestration(state: QuizState, dispatch: Dispatch<QuizAction>) {
    const {
        logout,
        uploadProgress,
        uploadAuthoritative,
        isAuthenticated,
        isDownloading,
        isInitialLoadComplete,
        lastDownloadTime,
        lastBackgroundMergeTime,
    } = useGoogleDrive();

    const location = useLocation();

    const startTimeRef = useRef<number | null>(null);
    // Latency captured at the moment the user SUBMITS their answer, not when they
    // later click Continue. Otherwise time spent reviewing the revealed correct
    // answer would inflate the latency and skew the SRS speed multiplier.
    const submitLatencyRef = useRef<number | null>(null);
    const dayBoundaryCheckedRef = useRef(false);
    const migrationTriggeredRef = useRef(false);
    // Identifies the most recently dispatched vocab load ("vid:quizType:quizMode").
    // A ref (not a per-effect-invocation local) because the load-vocab effect below
    // re-runs on every render while its own guard keeps returning early for the
    // same target (loading it doesn't change until the fetch resolves) - a plain
    // closure-scoped "alive" flag would get reset to false by each of those
    // no-op re-runs' cleanup, discarding the one fetch that's actually in flight
    // before it ever gets to dispatch its result.
    const loadingKeyRef = useRef<string | null>(null);

    const progressSignature = useMemo(() => progressUploadSignature(state.progress), [state.progress]);
    // Content signature for settings, for the same reason as progressSignature:
    // reconciles produce fresh (but content-identical) settings objects, and a raw
    // reference dependency would re-fire the auto-upload effect on every sync.
    const settingsSignature = useMemo(
        () => (state.settings ? stableStringify(state.settings) : null),
        [state.settings]
    );

    /* ---------- One-time startup checks ---------- */

    // Check day boundary using localStorage, exactly once when progress first loads.
    useEffect(() => {
        if (!state.progress || dayBoundaryCheckedRef.current) return;
        dayBoundaryCheckedRef.current = true;

        const lastAccessKey = 'GOKAN_LAST_ACCESS_DATE';
        const lastAccess = localStorage.getItem(lastAccessKey);
        const now = new Date();
        const today = now.toDateString();

        if (lastAccess !== today) {
            dispatch({ type: 'RESET_DAILY_STATS' });
            localStorage.setItem(lastAccessKey, today);
        }
    }, [state.progress]);

    // Run the async homograph-merge migration exactly once when progress first loads.
    useEffect(() => {
        if (!state.progress || migrationTriggeredRef.current) return;
        if (!MigrationService.needsMigration(state.progress)) return;
        migrationTriggeredRef.current = true;

        MigrationService.migrateAsync(state.progress).then(updatedProgress => {
            if (updatedProgress !== state.progress) {
                dispatch({
                    type: 'SETUP_COMPLETE',
                    payload: { progress: updatedProgress, settings: state.settings! }
                });
                // Persist immediately so the version bump isn't dropped if the user
                // closes/refreshes before any learning action triggers a save.
                StorageService.saveProgress(updatedProgress);
            }
        }).catch(err => {
            console.error('[useQuizOrchestration] Async migration failed:', err);
        });
    }, [state.progress, state.settings]);

    /* ---------- Derived view ---------- */

    const [hasMoreLearnable, setHasMoreLearnable] = useState(false);

    useEffect(() => {
        if (!state.progress || !state.settings) return;
        SRSService.hasMoreLearnableVocabulary(state.progress, state.settings).then(setHasMoreLearnable);
    }, [state.progress, state.settings]);

    const nextView = useMemo(
        () => selectNextView(state, hasMoreLearnable),
        [state.progress, state.settings, state.introCandidates, state.currentVocab, state.currentQuizItem, state.nextKanjiToLearn, state.session, hasMoreLearnable]
    );

    const currentProgress = useMemo(() => selectCurrentProgress(state), [state.currentVocab, state.progress]);

    const sessionStats = useMemo(
        () => selectSessionStats(state, hasMoreLearnable),
        [state.progress, state.settings, state.session, hasMoreLearnable]
    );

    const nextSessionPreview = useMemo(
        () => selectNextSessionPreview(state),
        [state.progress, state.settings]
    );

    /* ---------- Session lifecycle ---------- */

    // A "session" is the current continuous run of studying on the /quiz activity
    // page. It begins the moment there is work to do (review/learn) AND the user is
    // actually on /quiz, and ends when either stops holding: the queue runs dry
    // (waiting/exhausted) or the user navigates to another page (Main hub, Settings,
    // etc.) - leaving early ends the session exactly the same way as running out
    // naturally, per the Main-hub activity model where quiz sessions are explicit and
    // boundable. On start we snapshot the tasks due right then as the session's
    // committed workload; SessionProgress counts against that fixed set. Snapshotting
    // in onStart (rather than in the reducer) keeps the reducer free of Date.now().
    // Resuming later (navigating back to /quiz) starts a brand new session against
    // whatever is available then, rather than reopening the old one. The generic
    // edge-detection is shared with grammar via useSessionLifecycle.
    // 'session-complete' keeps the session alive on purpose: the completion screen is
    // still part of this session, and tearing it down here would immediately satisfy
    // the start condition again (work is still due) and silently commit a fresh capped
    // set, making the cap invisible. Starting another one is the user's call, via
    // actions.startNewSession below.
    //
    // A consult page (a word, kanji or grammar point's detail page, see
    // sessionRoutes.ts) pauses the session instead of ending it, so a learner can
    // look up the answer they just missed and come back to the same card, progress
    // bar and ticker. Coming back within the TTL resumes it; see useSessionLifecycle.
    const sessionRole = sessionRouteRole(location.pathname, 'vocab');
    const sessionHasWork =
        nextView.sessionState === 'review' ||
        nextView.sessionState === 'learn' ||
        nextView.sessionState === 'session-complete';

    useSessionLifecycle({
        role: sessionRole,
        hasWork: sessionHasWork,
        session: state.session,
        onStart: (now) => {
            if (!state.progress || !state.settings) return;

            // Clear any needsRetry flag inherited from a previous session that now
            // collides with that same quiz type's regular due review (issue #36) -
            // before it can otherwise slip into the committed set as an actionable
            // task and, once answered, immediately resurface as a "fresh" due review
            // (the retry-answer branch never advances dueDate). Only ever run here,
            // at the session boundary, so a same-session retry is untouched.
            const clearedQueue = clearStaleNeedsRetry(state.progress.learningQueue, state.settings, now);
            const progress = clearedQueue === state.progress.learningQueue
                ? state.progress
                : { ...state.progress, learningQueue: clearedQueue };

            // Committed holds every actionable task, deduped to at most one per vocab
            // (reading > meaning > production - see dedupTaskKeysByVocab) and then
            // capped. selectSessionStats counts this same set directly, so the Main hub
            // preview (selectNextSessionPreview, which runs the identical dedup+cap
            // pipeline) and the in-session progress bar always agree on what "this
            // session" contains.
            const taskKeys = capSessionCommit(
                dedupTaskKeysByVocab(collectActionableTaskKeys(progress.learningQueue, state.settings, now))
            );
            dispatch({
                type: 'SESSION_START',
                payload: { taskKeys, progress: progress === state.progress ? undefined : progress },
            });
        },
        onEnd: () => dispatch({ type: 'SESSION_END' }),
        onSuspend: (now) => dispatch({ type: 'SESSION_SUSPEND', payload: { now: now.getTime() } }),
        onResume: () => {
            // A card left unanswered must not be scored on the time spent away.
            // Latency after an answer is already frozen at submit (submitLatencyRef).
            if (!state.feedback?.show && startTimeRef.current !== null) startTimeRef.current = Date.now();
            dispatch({ type: 'SESSION_RESUME' });
        },
    });

    /* =========================
       ACTIONS
       ========================= */

    const actions: QuizActions = {
        async setupComplete({ kanjiKnowledge, settings }: SetupValues) {
            const progress: UserProgress = {
                kanjiKnowledge,
                learningQueue: [],
                grammarQueue: [],
                completedChapters: [],
                stats: {
                    newLearnedToday: 0,
                    totalLearned: 0,
                    totalReviews: 0,
                },
                dailyOverride: false,
                adaptive: {
                    level: 1.0,
                    history: []
                }
            };

            dispatch({ type: 'SETUP_COMPLETE', payload: { progress, settings } });
        },

        setAnswer(answer) {
            dispatch({ type: 'SET_ANSWER', payload: answer });
        },

        revealProductionHint() {
            dispatch({ type: 'REVEAL_PRODUCTION_HINT' });
        },

        async submitAnswer() {
            if (!state.currentVocab || state.feedback?.show || !state.currentQuizItem || state.isEvaluatingAi) return;

            // Freeze the answer latency here (start -> submit), before any AI
            // evaluation delay and before the user reviews the correct answer.
            submitLatencyRef.current = startTimeRef.current ? Date.now() - startTimeRef.current : null;

            const quizType = state.currentQuizItem.quizType;
            let result: AnswerResult;
            let matchedAnswer: string;
            let message = 'Incorrect.';
            // Set only on a near-synonym collision (issue #71 Part B) - see
            // continueToNext, which routes a 'confusable' collision through
            // SRSService.applyConfusableSynonymAnswer instead of the normal
            // applyAnswer path.
            let synonymRelation: SynonymRelation | undefined;
            let synonymWord: SynonymWord | undefined;

            if (quizType === 'reading') {
                const evaluation = SRSService.evaluateAnswer(state.userAnswer, state.currentVocab.reading);
                result = evaluation.result;
                matchedAnswer = evaluation.matchedAnswer;
            } else if (quizType === 'production') {
                // A fully-revealed hint (cloze card only - see productionHintLevel) always
                // grades minor_error regardless of what userAnswer holds, mirroring
                // gradeGrammarAnswers' treatment of a revealed grammar blank: giving up on
                // a word still leaves an impression from reading the answer.
                if (state.productionHintLevel >= 2) {
                    result = 'minor_error';
                    matchedAnswer = state.currentVocab.reading.primary;
                } else {
                    // Graded against the full accept-list (readings + written forms, see
                    // evaluateProductionAnswer) rather than the reading quiz's reading-only
                    // list - a production answer given in kanji is a correct answer, not a
                    // wrong one (issue #71 Part A). Shared by both production cards (gloss
                    // and the sentence-cloze card, issue #72): both set quizType
                    // 'production', so this is the one place either grades through.
                    const evaluation = SRSService.evaluateProductionAnswer(
                        state.userAnswer,
                        state.currentVocab,
                        clozeAcceptedForms(state.currentProductionCloze)
                    );
                    result = evaluation.result;
                    matchedAnswer = evaluation.matchedAnswer;

                    // A wrong answer might still be a genuine OTHER word from this
                    // word's near-synonym cluster (issue #71 Part B). Checked only once
                    // the target itself has graded wrong.
                    //
                    // A pair is a synonym IN A SENSE: 狭い and 小さい share only "small".
                    // So the outcome depends on the card's own text (synonymOutcome):
                    // if the sentence or printed glosses use a shared meaning, the
                    // answer is correct; otherwise the pair's tier decides between a
                    // minor error and no credit / no penalty.
                    const entries = state.currentVocab.synonyms ?? [];
                    if (result === 'wrong' && entries.length > 0) {
                        const cue = productionCueOf(state.currentVocab.senses, state.currentProductionCloze);
                        // Candidates are fetched only now, on a wrong answer: a word can
                        // list hundreds of pairs, far too many to fetch for every card.
                        dispatch({ type: 'EVALUATING_AI_START' });
                        const synonymMatch = await findProductionSynonym(state.userAnswer, entries, cue);

                        if (synonymMatch) {
                            const { candidate } = synonymMatch;
                            const candidateLabel = `${candidate.vocab.writtenForm.kanji} (${candidate.vocab.reading.primary})`;
                            const targetLabel = `${state.currentVocab.writtenForm.kanji} (${state.currentVocab.reading.primary})`;
                            const outcome = synonymOutcome(candidate, cue);
                            const meaning = sharedMeaningUsed(candidate.shared ?? [], cue);
                            synonymWord = { vocabId: candidate.vocabId, written: candidate.vocab.writtenForm.kanji };

                            if (outcome === 'correct') {
                                result = 'correct';
                                synonymRelation = 'interchangeable';
                                message = `Correct: ${candidateLabel} also means "${meaning}" here. The word being tested was ${targetLabel}.`;
                            } else if (outcome === 'minor_error') {
                                result = 'minor_error';
                                synonymRelation = 'interchangeable';
                                message = `${candidateLabel} is also accepted here - the word being tested was ${targetLabel}.`;
                            } else {
                                // confusable: no penalty, no credit - needsRetry.production
                                // re-asks until the target itself is produced (see
                                // continueToNext and SRSService.applyConfusableSynonymAnswer).
                                synonymRelation = 'confusable';
                                message = `${candidateLabel} is a close synonym but not interchangeable here - the word being tested was ${targetLabel}.`;
                            }
                        }
                    }
                }
            } else {
                const meanings = state.currentVocab.senses.flatMap(s => s.glosses);
                const evaluation = SRSService.evaluateMeaning(state.userAnswer, meanings);
                result = evaluation.result;
                matchedAnswer = evaluation.matchedAnswer;

                // Gemini API contextual validation, only when in 'context' mode and
                // the user has the feature enabled (enableGeminiContext is the Settings
                // master toggle - a leftover geminiApiKey from before the user disabled
                // it must not silently keep triggering AI calls).
                if (quizType === 'meaning' && state.currentQuizItem.quizMode === 'context' &&
                    state.settings?.enableGeminiContext &&
                    state.settings?.geminiApiKey &&
                    state.currentSentenceId &&
                    state.currentSentences &&
                    state.userAnswer.trim().length > 0) {

                    // If alwaysUseAiForMeaningContext is true, AI validates ALL answers, even strict-correct.
                    // If false, only strict-wrong/minor_error answers get AI-validated.
                    const shouldEvaluate = state.settings.alwaysUseAiForMeaningContext ||
                        (result === 'wrong' || result === 'minor_error');

                    if (shouldEvaluate) {
                        const sentence = state.currentSentences.find(s => s.id === state.currentSentenceId);

                        if (sentence) {
                            try {
                                dispatch({ type: 'EVALUATING_AI_START' });

                                const aiEvaluation = await LLMService.validateMeaningContext(
                                    state.settings.geminiApiKey,
                                    state.currentVocab,
                                    sentence,
                                    state.userAnswer
                                );

                                if (aiEvaluation.result === 'correct' || aiEvaluation.result === 'minor_error') {
                                    result = aiEvaluation.result;
                                    matchedAnswer = state.userAnswer;
                                    message = result === 'correct'
                                        ? `Correct. (AI Validated: ${aiEvaluation.reason})`
                                        : `Close. ${aiEvaluation.reason}`;
                                } else {
                                    result = 'wrong';
                                    if (aiEvaluation.reason) {
                                        message = `Incorrect. (AI: ${aiEvaluation.reason})`;
                                    }
                                }
                            } catch (e) {
                                console.error('[useQuizOrchestration] AI evaluation failed, falling back to strict result.', e);
                            }
                        }
                    }
                }
            }

            if (result === 'correct' && !message.includes('AI Validated') && !synonymRelation) message = 'Correct.';
            // Skip the generic "Close." default when a synonym collision already
            // wrote a message naming the word being tested (issue #71 Part B).
            else if (result === 'minor_error' && !synonymRelation && !message.includes('Close.')) message = 'Close.';

            dispatch({ type: 'SUBMIT_ANSWER', payload: { type: result, message, matchedAnswer, synonymRelation, synonymWord } });
        },

        async advanceQueue({ now }) {
            const updatedQueue = state.progress!.learningQueue;

            const nowDueCount = updatedQueue.filter(v => v.nextReviewAt && v.nextReviewAt <= now).length;
            const canAddNew = nowDueCount === 0 && nextView.sessionState !== 'waiting';
            const needsCandidates = canAddNew && state.introCandidates.length === 0;

            let newCandidates: Vocabulary[] = [];

            if (needsCandidates) {
                const { newCandidates: loaded, criticalErrorId } = await refillCandidates<Vocabulary>({
                    existing: state.introCandidates,
                    batchSize: CONSTANTS.srs.newVocabBatchSize,
                    getNextIds: (maxToFind, ignored) => SRSService.getNextCandidates(
                        updatedQueue, state.progress!.kanjiKnowledge, state.settings!, maxToFind, ignored
                    ),
                    loadItem: (id) => VocabularyService.loadVocab(id),
                    logLabel: 'useQuizOrchestration',
                });

                // Prevent an infinite loading loop if files are missing but listed in the index.
                if (criticalErrorId) {
                    dispatch({
                        type: 'LOAD_VOCAB_ERROR',
                        payload: { vocabId: criticalErrorId, error: new Error('Candidate vocabulary files could not be loaded. Data might be corrupted or out-of-sync.') }
                    });
                    return;
                }
                newCandidates = loaded;
            }

            // If no candidates found, and we're not exhausted/blocked, prepare next kanji step.
            if (newCandidates.length === 0 && canAddNew && state.progress!.kanjiKnowledge.method === 'kklc') {
                try {
                    const kanjiIndex = await VocabularyService.loadKKLCKanjiIndex();
                    if (kanjiIndex) {
                        const nextStep = state.progress!.kanjiKnowledge.step + 1;
                        if (kanjiIndex[nextStep]) {
                            dispatch({ type: 'SET_NEXT_KANJI', payload: { step: nextStep, kanjis: kanjiIndex[nextStep] } });
                        }
                    }
                } catch (e) {
                    console.error('[useQuizOrchestration] Failed to load kanji index for next step', e);
                }
            } else if (newCandidates.length > 0 && state.nextKanjiToLearn) {
                dispatch({ type: 'SET_NEXT_KANJI', payload: null });
            }

            dispatch({
                type: 'ADVANCE_QUEUE',
                payload: {
                    progress: { ...state.progress!, learningQueue: updatedQueue },
                    candidates: newCandidates.length > 0 ? [...state.introCandidates, ...newCandidates] : undefined
                },
            });
        },

        async continueToNext() {
            if (!state.progress || !state.feedback || !state.currentVocab || !state.currentQuizItem) return;

            const now = new Date();
            const id = state.currentVocab.id;
            // Use the latency frozen at submit time, not the time up to this Continue
            // click (which would also count answer-review time).
            const latency = submitLatencyRef.current ?? 5000;

            const target = state.progress.learningQueue.find(v => v.vocabId === id);
            let historyItem = null;

            // Calibration (services/calibration.ts): only a real review enters its
            // quiz type's window. A confusable-synonym collision is not graded at all,
            // so it is not one either.
            const quizType = state.currentQuizItem.quizType;
            const counted = !!target && state.feedback.synonymRelation !== 'confusable'
                && isCalibratedVocabReview(target, quizType);
            const calibration = counted
                ? recordCalibratedAnswer(state.progress.calibration, quizType, state.feedback.type)
                : withCalibrationDefaults(state.progress.calibration);
            const growthLevel = growthLevelOf(calibration, quizType);

            const frequencyModifier = frequencyModifierOf(state.settings);
            const meaningQuizEnabled = state.settings?.enableMeaningQuiz !== false;
            const productionQuizEnabled = state.settings?.enableProductionQuiz !== false;

            // Apply the SRS update exactly once per answer, then reuse the single
            // result both for the mastery-delta history entry and the queue update.
            let updatedTarget: typeof target | null = null;

            if (target) {
                // A 'confusable' synonym collision (issue #71 Part B) bypasses the
                // normal grading path entirely: it reuses the existing per-quiz-type
                // retry machinery instead, leaving memoryStrength/interval/difficulty
                // untouched, rescheduling at the unchanged interval, and flagging
                // needsRetry.production so the card re-asks until the TARGET itself
                // is produced - see SRSService.applyConfusableSynonymAnswer.
                const updated = state.feedback.synonymRelation === 'confusable'
                    ? SRSService.applyConfusableSynonymAnswer(target, now, meaningQuizEnabled, productionQuizEnabled)
                    : SRSService.applyAnswer(
                        target,
                        state.currentQuizItem.quizType,
                        state.currentQuizItem.quizMode,
                        state.userAnswer,
                        state.feedback.matchedAnswer,
                        latency,
                        now,
                        state.feedback.type,
                        growthLevel,
                        frequencyModifier,
                        meaningQuizEnabled,
                        productionQuizEnabled
                    ).updated;
                updatedTarget = updated;

                // Keyed rather than a reading/meaning ternary: with a third type, a
                // ternary would silently report the meaning entry's delta for a
                // production answer.
                const strengthOf = (v: VocabProgress) =>
                    state.currentQuizItem!.quizType === 'reading' ? v.reading.memoryStrength
                        : state.currentQuizItem!.quizType === 'production' ? (v.production?.memoryStrength ?? 0)
                            : v.meaning.memoryStrength;

                const oldStrength = strengthOf(target);
                const newStrength = strengthOf(updated);

                const delta = calculateMasteryPercentage(newStrength) - calculateMasteryPercentage(oldStrength);

                historyItem = {
                    vocabId: id,
                    writtenForm: state.currentVocab.writtenForm.kanji,
                    result: state.feedback.type,
                    delta
                };
            }

            const updatedQueue = state.progress.learningQueue.map(v =>
                v.vocabId === id && updatedTarget ? updatedTarget : v
            );

            dispatch({
                type: 'UPDATE_AFTER_ANSWER',
                payload: {
                    progress: {
                        ...state.progress,
                        learningQueue: updatedQueue,
                        stats: {
                            ...state.progress.stats,
                            totalReviews: state.progress.stats.totalReviews + 1,
                        },
                        calibration,
                    },
                    historyItem: historyItem!
                },
            });
        },

        startNewSession() {
            // useSessionLifecycle re-fires onStart on the next render (the route is
            // still /quiz and work is still due), snapshotting and capping afresh.
            dispatch({ type: 'SESSION_END' });
        },

        saveSettings(settings) {
            dispatch({ type: 'SAVE_SETTINGS', payload: settings });
        },

        updateKanjiKnowledge(knowledge) {
            dispatch({ type: 'UPDATE_KANJI_KNOWLEDGE', payload: knowledge });
        },

        async overrideDailyLimit() {
            dispatch({ type: 'OVERRIDE_DAILY_LIMIT' });
        },

        async saveVocabIntroChoice(vocabulary, choice) {
            if (!state.progress) return;
            dispatch({ type: 'VOCAB_INTRO_CHOICE', choice, vocabId: vocabulary.id, vocabulary });
        },

        async learnNextKanji() {
            if (!state.progress || !state.nextKanjiToLearn) return;

            const newKanjiSet = new Set(state.progress.kanjiKnowledge.kanjiSet);
            state.nextKanjiToLearn.kanjis.forEach(k => newKanjiSet.add(k));

            const updatedProgress: UserProgress = {
                ...state.progress,
                kanjiKnowledge: {
                    ...state.progress.kanjiKnowledge,
                    step: state.nextKanjiToLearn.step,
                    kanjiSet: newKanjiSet
                }
            };

            dispatch({ type: 'LEARN_NEXT_KANJI', payload: updatedProgress });
        },

        /**
         * Wipes grammar progress only, keeping vocab, kanji and settings.
         *
         * Exists because the old teaching order was alphabetical and anyone who
         * started before the curriculum landed has a queue built on it; there is
         * no sensible migration from "learned in the wrong order" to "learned in
         * the right one", so starting the grammar activity over is the honest
         * option.
         *
         * The Drive push is AUTHORITATIVE and awaited. Both matter:
         *
         * - Authoritative, because mergeGrammarQueues is a pure union by id.
         *   A normal upload fetches the remote copy and merges it, so every entry
         *   just deleted comes straight back and the reset silently undoes
         *   itself. This is the only place in the app that needs to express a
         *   deletion, and the merge has no way to represent one.
         * - Awaited, so a failure surfaces to the caller instead of leaving local
         *   and remote disagreeing, with the remote due to win on next load.
         */
        async resetGrammarProgress() {
            if (!state.progress) return;
            const progress = { ...state.progress, grammarQueue: [] };

            StorageService.saveProgress(progress);
            dispatch({ type: 'GRAMMAR_RESET_PROGRESS', payload: { progress } });

            if (isAuthenticated && state.settings) {
                await uploadAuthoritative({ progress, settings: state.settings });
            }
        },

        reset() {
            StorageService.clearProgress();
            try {
                logout();
            } catch (e) {
                console.error('[useQuizOrchestration] Failed to logout during reset', e);
            }
            dispatch({ type: 'RESET' });
        },
    };

    /* ---------- Persistence ---------- */

    useEffect(() => {
        if (state.progress) StorageService.saveProgress(state.progress);
    }, [state.progress]);

    useEffect(() => {
        if (state.settings) StorageService.saveSettings(state.settings);
    }, [state.settings]);

    /* ---------- Auto-sync & reactivity ---------- */

    // Auto-upload: whenever progress or settings CONTENT changes, push to Drive in
    // the background. Deps are content signatures (not object references) so the
    // fresh-but-identical objects produced by each reconcile don't re-trigger it.
    useEffect(() => {
        if (!progressSignature || !state.progress || !state.settings || isDownloading) return;
        uploadProgress({ progress: state.progress, settings: state.settings }).catch(err => {
            console.error('[useQuizOrchestration] Auto-upload failed', err);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [progressSignature, settingsSignature, isDownloading, uploadProgress]);

    // React to a completed download: reload data when lastDownloadTime changes.
    useEffect(() => {
        if (!lastDownloadTime) return;

        const refreshedProgress = StorageService.loadProgress();
        const refreshedSettings = StorageService.loadSettings() ?? DEFAULT_SETTINGS;

        if (refreshedProgress) {
            setTimeout(() => {
                dispatch({
                    type: 'SETUP_COMPLETE',
                    payload: { progress: refreshedProgress, settings: refreshedSettings }
                });
                // Calibration transition, only now that the Drive sync has brought the
                // state up to date: it then rebases the merged state, and the auto-upload
                // effect publishes the result. Dispatched after SETUP_COMPLETE so it
                // applies to the reloaded progress, never to a pre-sync snapshot. It is
                // idempotent (see rebaseStrengthsToSchedule), so a later re-download
                // simply normalizes anything an older build wrote in the meantime.
                dispatch({ type: 'REBASE_STRENGTHS', payload: { frequencyModifier: frequencyModifierOf(refreshedSettings) } });
            }, 0);
        }
    }, [lastDownloadTime]);

    // The same transition for a user not signed in to Drive: there is no sync to
    // wait for, so it runs once the initial load is complete.
    const localRebaseDoneRef = useRef(false);
    useEffect(() => {
        if (localRebaseDoneRef.current || !state.progress || !state.settings) return;
        if (!isInitialLoadComplete || isAuthenticated) return;
        localRebaseDoneRef.current = true;
        dispatch({ type: 'REBASE_STRENGTHS', payload: { frequencyModifier: frequencyModifierOf(state.settings) } });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.progress, state.settings, isInitialLoadComplete, isAuthenticated]);

    // React to a background sync that PULLED IN REMOTE CHANGES (routine uploads of
    // local-only changes never bump lastBackgroundMergeTime - see GoogleDriveContext).
    // Reconcile (merge) those changes into live state rather than wholesale-replacing
    // it, so an in-flight answer submitted during the sync round-trip is never lost.
    useEffect(() => {
        if (!lastBackgroundMergeTime || !state.progress || !state.settings) return;

        const fromDisk = StorageService.loadProgress();
        const settingsFromDisk = StorageService.loadSettings() ?? DEFAULT_SETTINGS;
        if (!fromDisk) return;

        const liveVersion = (state.progress as ProgressWithMetadata)._sync?.version ?? 0;
        const diskVersion = (fromDisk as ProgressWithMetadata)._sync?.version ?? 0;

        // Nothing new landed on disk since we last reconciled - avoid a redundant dispatch.
        if (diskVersion <= liveVersion) return;

        const reconciledProgress = mergeProgress(
            state.progress as ProgressWithMetadata,
            fromDisk as ProgressWithMetadata,
            state.settings
        );
        const reconciledSettings = mergeSettings(state.settings, settingsFromDisk, liveVersion, diskVersion);

        if (!reconciledProgress) return;

        dispatch({ type: 'RECONCILE_REMOTE', payload: { progress: reconciledProgress, settings: reconciledSettings } });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastBackgroundMergeTime]);

    /* ---------- Load vocab ---------- */

    useEffect(() => {
        // Only load/advance while the quiz activity is actually on screen - otherwise
        // browsing Settings/Stats/the Main hub would keep fetching vocab JSON and
        // silently advancing the queue in the background for a card nobody is looking
        // at (and, worse, doing so before a session has even started for the page the
        // user is about to land on).
        if (location.pathname !== '/quiz') return;

        const queueItem = nextView.queueItem;

        if (!queueItem) {
            dispatch({ type: 'LOAD_VOCAB_SUCCESS', payload: { vocab: null, sentences: null, selectedSentenceId: null } });

            if (state.progress && state.settings && (nextView.sessionState === 'learn' || nextView.sessionState === 'exhausted')) {
                actions.advanceQueue({ now: new Date() });
            }
            return;
        }

        const vid = 'vocabId' in queueItem ? queueItem.vocabId : queueItem.vocab.vocabId;
        const quizType = queueItem.quizType;

        // Exactly this card is already loaded OR currently being loaded
        // (selectNextView returns a fresh queueItem object on every recompute, so
        // the effect dep alone can't tell "same card"). Compare against
        // currentQuizItem rather than currentVocab: LOAD_VOCAB_START sets
        // currentQuizItem synchronously, before the async fetch even starts, so
        // currentVocab (which only updates once loading finishes) can't detect
        // the in-flight case. Without this, dispatching LOAD_VOCAB_START itself
        // changes currentQuizItem - a nextView dependency - so a load already in
        // flight retriggers itself on every render until the fetch resolves: a
        // real "Maximum update depth exceeded" loop, hammering the same vocab
        // JSON over and over, not just a hypothetical race.
        const currentTargetVid = state.currentQuizItem
            ? ('vocabId' in state.currentQuizItem ? state.currentQuizItem.vocabId : state.currentQuizItem.vocab.vocabId)
            : null;

        if (
            currentTargetVid === vid &&
            state.currentQuizItem?.quizType === quizType &&
            state.currentQuizItem?.quizMode === queueItem.quizMode
        ) {
            return;
        }

        dispatch({ type: 'LOAD_VOCAB_START', payload: queueItem });

        // Identifies THIS fetch, via a ref rather than a closure-scoped boolean.
        // While this load is in flight, the guard above keeps returning early on
        // every re-render (the target doesn't change until the fetch resolves) -
        // an effect *cleanup* still runs on each of those no-op re-runs, though,
        // since nextView.queueItem gets a fresh object reference every recompute.
        // A boolean "alive" flag closed over by this specific invocation would be
        // flipped false by that cleanup, silently discarding this exact fetch's
        // result before it ever gets to dispatch - which is why the card used to
        // get stuck on "Loading..." forever despite the network request having
        // already completed. Comparing against the ref (which only changes when a
        // *different* target starts loading) correctly lets this fetch's own
        // callback still fire normally.
        const loadKey = `${vid}:${quizType}:${queueItem.quizMode}`;
        loadingKeyRef.current = loadKey;

        // Every production card needs sentences fetched up front to decide whether a
        // usable cloze match exists at all - unlike meaning's context mode, that
        // decision can't be made before the fetch (it depends on which sentences the
        // dataset actually resolved a match for), so it happens below once loaded
        // rather than by picking a quizMode synchronously in getNextVocabToStudy.
        const needsSentences = (quizType === 'meaning' && queueItem.quizMode === 'context') || quizType === 'production';

        Promise.all([
            VocabularyService.loadVocab(vid),
            needsSentences ? VocabularyService.loadSentences(vid) : Promise.resolve(null),
        ]).then(async ([vocab, sentences]) => {
            if (loadingKeyRef.current !== loadKey) return; // superseded by a newer target

            let selectedSentenceId: string | null = null;
            let productionCloze = null;

            // Both sentence-driven cards rank the word's sentences with the shared
            // ranker (utils/sentenceRanking.ts), the same rule the grammar review uses.
            const learner = indexLearnerVocab(state.progress?.learningQueue);

            // Near-synonyms need nothing loaded here: each entry on the vocab file
            // carries the other word's forms, and submitAnswer checks them only
            // after a wrong answer (findProductionSynonym).
            if (quizType === 'production') {
                if (sentences && sentences.length > 0) {
                    productionCloze = pickProductionClozeSentence(vid, sentences, learner);
                }
            } else if (sentences && sentences.length > 0) {
                selectedSentenceId = pickSentenceForVocab(vid, sentences, learner)?.id ?? null;
            }

            dispatch({
                type: 'LOAD_VOCAB_SUCCESS',
                // Production's own sentences aren't the meaning-context ones -
                // currentSentences/currentSentenceId stay scoped to meaning, so they're
                // left null here rather than carrying data nothing else reads.
                payload: { vocab, sentences: quizType === 'production' ? null : sentences, selectedSentenceId, productionCloze },
            });
            startTimeRef.current = Date.now();
        }).catch(err => {
            if (loadingKeyRef.current !== loadKey) return;
            console.error('[useQuizOrchestration] Failed to load vocab/sentences', err);
            dispatch({ type: 'LOAD_VOCAB_ERROR', payload: { vocabId: vid, error: err } });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nextView.queueItem, state.progress, state.settings, nextView.sessionState, location.pathname]);

    useEffect(() => {
        // Meaning quizzes have rich context (sentences) the user might want to read, so they don't auto-advance.
        // Neither does a correct near-synonym answer: its message names the word
        // that was actually being tested, which is the point of showing it.
        // Only on the quiz itself: a session paused on a consult page stays frozen
        // until the learner comes back.
        if (sessionRole === 'activity' && state.feedback?.correct && !state.feedback.synonymRelation && state.currentQuizItem?.quizType !== 'meaning') {
            const timer = setTimeout(() => {
                actions.continueToNext().then();
            }, CONSTANTS.quiz.correctAnswerAutoAdvanceDelay);

            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.feedback?.correct, state.feedback?.synonymRelation, state.currentQuizItem, sessionRole]);

    /* =========================
       COMPUTED FLAGS
       ========================= */

    const computed = {
        canSubmit:
            !!state.userAnswer.trim() &&
            !!state.currentVocab &&
            !state.feedback?.show &&
            !state.isLoadingVocab &&
            !state.isEvaluatingAi,

        canContinue: !!(state.feedback?.show && (!state.feedback.correct || !!state.feedback.synonymRelation || state.currentQuizItem?.quizType === 'meaning')),

        isReady: !!state.currentVocab && !state.isLoadingVocab && !state.isEvaluatingAi,
    };

    return { actions, nextView, currentProgress, computed, sessionStats, nextSessionPreview };
}
