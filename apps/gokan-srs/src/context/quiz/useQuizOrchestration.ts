import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import { useLocation } from 'react-router-dom';
import type { KanjiKnowledge, UserProgress, UserSettings } from '../../models/user.model';
import type { Sentence, Vocabulary } from '@gokan/dataset-schema';
import { StorageService } from '../../services/storage.service';
import { VocabularyService, VocabNotFoundError } from '../../services/vocabulary.service';
import { SRSService } from '../../services/srs.service';
import { vocabExercise } from '../../services/exercise/builders';
import { refineMeaningWithAi } from '../../services/exercise/aiRefine';
import { MigrationService } from '../../services/migration.service';
import { CONSTANTS } from '../../commons/constants';
import { DEFAULT_SETTINGS } from '../../models/user.model';
import type { SetupValues } from '../../models/state.model';
import { clearStaleNeedsRetry, syncUsuallyKana } from '../../utils/srs.utils';
import { usuallyKanaBudget } from '../../utils/usuallyKana.utils';
import { pickProductionClozeSentence } from '../../utils/productionCloze.utils';
import type { ProductionCloze } from '../../utils/productionCloze.utils';
import { indexLearnerVocab, pickSentenceForVocab } from '../../utils/sentenceRanking';
import { frequencyModifierOf } from '../../services/calibration';
import { mergeProgress, mergeSettings } from '../../services/sync/mergeProgress';
import { useGoogleDrive } from '../useGoogleDrive';
import type { QuizState, QuizAction } from './quizReducer';
import { useExerciseTurn } from './useExerciseTurn';
import { selectNextView, selectCurrentProgress, selectSessionStats, selectNextSessionPreview, collectActionableTaskKeys, capSessionCommit, dedupTaskKeysByVocab } from './quizSelectors';
import { useSessionLifecycle } from './useSessionLifecycle';
import { sessionRouteRole } from './sessionRoutes';
import { refillCandidates } from './refillCandidates';
import { progressUploadSignature, stableStringify } from "../../services/progressSerialization";
import { episodeKey } from '../../utils/mediaCoverage.utils';
import type { WatchedEpisode } from '../../models/media.model';

export interface QuizActions {
    setupComplete: (values: SetupValues) => void;
    advanceQueue: ({ now, overrideDailyLimit }: { now: Date, overrideDailyLimit?: boolean }) => Promise<void>;
    /** Ends the finished session so the lifecycle effect immediately commits a fresh capped one. */
    startNewSession: () => void;
    saveSettings: (settings: UserSettings) => void;
    updateKanjiKnowledge: (knowledge: KanjiKnowledge) => void;
    overrideDailyLimit: () => void;
    /**
     * Marks or un-marks listening-library episodes of one title in a single update
     * (one episode, or a whole series). Each episode's `coverage` (0..1) is
     * recorded when it is marked watched.
     */
    setEpisodesWatched: (mediaId: string, episodes: { number: number; coverage?: number }[], watched: boolean) => void;
    saveVocabIntroChoice: (vocabulary: Vocabulary, choice: 'learn' | 'skip') => void;
    learnNextKanji: () => void;
    /** Wipes grammar progress only, keeping vocab, kanji and settings. */
    resetGrammarProgress: () => Promise<void>;
    reset: () => void;
}

/**
 * All side effects and business-logic actions for the quiz state machine:
$1 */
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

        const lastAccess = StorageService.loadLastAccessDay();
        const now = new Date();
        const today = now.toDateString();

        if (lastAccess !== today) {
            dispatch({ type: 'RESET_DAILY_STATS' });
            StorageService.saveLastAccessDay(today);
        }
    }, [state.progress, dispatch]);

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
    }, [state.progress, state.settings, dispatch]);

    /* ---------- Derived view ---------- */

    const [hasMoreLearnable, setHasMoreLearnable] = useState(false);

    useEffect(() => {
        if (!state.progress || !state.settings) return;
        void SRSService.hasMoreLearnableVocabulary(state.progress, state.settings).then(setHasMoreLearnable);
    }, [state.progress, state.settings]);

    // The dataset decides which words are learned in kana; progress keeps a copy for
    // scheduling (VocabProgress.usuallyKana). Synced on load and whenever the queue
    // changes (a reconcile can bring in words added on another build), dispatching
    // only when something actually differs.
    const [usuallyKanaIds, setUsuallyKanaIds] = useState<ReadonlySet<string> | null>(null);
    useEffect(() => {
        if (!state.progress || usuallyKanaIds) return;
        void VocabularyService.loadUsuallyKanaIds().then(setUsuallyKanaIds);
    }, [state.progress, usuallyKanaIds]);
    useEffect(() => {
        if (!state.progress || !usuallyKanaIds) return;
        const now = new Date();
        if (syncUsuallyKana(state.progress.learningQueue, usuallyKanaIds, state.settings ?? undefined, now) === state.progress.learningQueue) return;
        dispatch({ type: 'SYNC_USUALLY_KANA', payload: { ids: usuallyKanaIds, now } });
    }, [state.progress, state.settings, usuallyKanaIds, dispatch]);

    // The selectors are pure: each memo hands them exactly the state it depends on, and the
    // current time as of that state change (the orchestration layer owns the clock).
    const { progress, settings, introCandidates, currentVocab, currentQuizItem, nextKanjiToLearn, session } = state;

    const nextView = useMemo(
        () => selectNextView({ progress, settings, introCandidates, currentVocab, currentQuizItem, nextKanjiToLearn, session }, hasMoreLearnable, new Date()),
        [progress, settings, introCandidates, currentVocab, currentQuizItem, nextKanjiToLearn, session, hasMoreLearnable]
    );

    const currentProgress = useMemo(() => selectCurrentProgress({ progress, currentVocab }), [currentVocab, progress]);

    const sessionStats = useMemo(
        () => selectSessionStats({ progress, settings, session }, hasMoreLearnable, new Date()),
        [progress, settings, session, hasMoreLearnable]
    );

    const nextSessionPreview = useMemo(
        () => selectNextSessionPreview({ progress, settings }, new Date()),
        [progress, settings]
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

    // Answering, hints, submit and Continue: the flow every exercise shares. The
    // meaning card in context mode may ask Gemini for a second opinion, only when
    // the Settings toggle is on (a leftover API key must not keep triggering calls).
    const { api: exercise, restartClock } = useExerciseTurn({
        host: 'vocab',
        turn: state.turns.vocab,
        dispatch,
        active: sessionRole === 'activity',
        loading: state.isLoadingVocab,
        refine: (current, grade, answers, onStart) => {
            const settings = state.settings;
            const check = settings?.enableGeminiContext && settings.geminiApiKey
                ? { apiKey: settings.geminiApiKey, always: !!settings.alwaysUseAiForMeaningContext }
                : null;
            return state.currentVocab
                ? refineMeaningWithAi(current, grade, answers[0] ?? '', state.currentVocab, check, onStart)
                : Promise.resolve(grade);
        },
    });
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
            restartClock();
            dispatch({ type: 'SESSION_RESUME' });
        },
    });

    /* =========================
       ACTIONS
       ========================= */

    const actions: QuizActions = {
        setupComplete({ kanjiKnowledge, settings }: SetupValues) {
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
                        updatedQueue, state.progress!.kanjiKnowledge, state.settings!, maxToFind, ignored,
                        usuallyKanaBudget(
                            CONSTANTS.srs.newUsuallyKanaPerSession,
                            state.session?.usuallyKanaIntroduced ?? 0,
                            state.introCandidates
                        )
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

        overrideDailyLimit() {
            dispatch({ type: 'OVERRIDE_DAILY_LIMIT' });
        },

        setEpisodesWatched(mediaId, episodes, watched) {
            const updatedAt = Date.now();
            const entries: Record<string, WatchedEpisode> = {};
            for (const { number, coverage } of episodes) {
                entries[episodeKey(mediaId, number)] = {
                    watched,
                    updatedAt,
                    ...(watched && coverage !== undefined ? { coverageAtWatch: coverage } : {}),
                };
            }
            dispatch({ type: 'SET_EPISODES_WATCHED', payload: { entries } });
        },

        saveVocabIntroChoice(vocabulary, choice) {
            if (!state.progress) return;
            dispatch({ type: 'VOCAB_INTRO_CHOICE', choice, vocabId: vocabulary.id, vocabulary, insertionFraction: Math.random() });
        },

        learnNextKanji() {
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
        // Debounced and fire-and-forget: uploadProgress reports its own failures.
        uploadProgress({ progress: state.progress, settings: state.settings });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on content signatures so identical reconciled objects never re-upload; progress and settings are read, not tracked
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
    }, [lastDownloadTime, dispatch]);

    // The same transition for a user not signed in to Drive: there is no sync to
    // wait for, so it runs once the initial load is complete.
    const localRebaseDoneRef = useRef(false);
    useEffect(() => {
        if (localRebaseDoneRef.current || !state.progress || !state.settings) return;
        if (!isInitialLoadComplete || isAuthenticated) return;
        localRebaseDoneRef.current = true;
        dispatch({ type: 'REBASE_STRENGTHS', payload: { frequencyModifier: frequencyModifierOf(state.settings) } });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once (guarded by a ref) after the initial load; progress and settings changes must not re-trigger it
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

        const liveVersion = state.progress._sync?.version ?? 0;
        const diskVersion = fromDisk._sync?.version ?? 0;

        // Nothing new landed on disk since we last reconciled - avoid a redundant dispatch.
        if (diskVersion <= liveVersion) return;

        const reconciledProgress = mergeProgress(state.progress, fromDisk, state.settings);
        const reconciledSettings = mergeSettings(state.settings, settingsFromDisk, liveVersion, diskVersion);

        if (!reconciledProgress) return;

        dispatch({ type: 'RECONCILE_REMOTE', payload: { progress: reconciledProgress, settings: reconciledSettings } });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reconciles only when a background merge lands; reacting to local state changes would merge on every answer
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
            dispatch({ type: 'LOAD_VOCAB_SUCCESS', payload: { vocab: null, exercise: null } });

            if (state.progress && state.settings && (nextView.sessionState === 'learn' || nextView.sessionState === 'exhausted')) {
                void actions.advanceQueue({ now: new Date() });
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
        ]).then(([vocab, sentences]) => {
            if (loadingKeyRef.current !== loadKey) return; // superseded by a newer target

            let sentence: Sentence | null = null;
            let cloze: ProductionCloze | null = null;

            // Both sentence-driven cards rank the word's sentences with the shared
            // ranker (utils/sentenceRanking.ts), the same rule the grammar review uses.
            const learner = indexLearnerVocab(state.progress?.learningQueue);

            // Near-synonyms need nothing loaded here: each entry on the vocab file
            // carries the other word's forms, which the grader checks only after a
            // wrong answer (services/exercise/grading.ts).
            if (quizType === 'production') {
                if (sentences && sentences.length > 0) {
                    // Pass the loaded vocab so the cloze guard rejects a sentence whose
                    // blanked span is a differently-read homograph (遊ぶ/あそぶ matched to
                    // the rare すさぶ entry) - see pickProductionClozeSentence.
                    cloze = pickProductionClozeSentence(vid, sentences, learner, vocab);
                }
            } else if (sentences && sentences.length > 0) {
                sentence = pickSentenceForVocab(vid, sentences, learner) ?? null;
            }

            // The card's exercise is built once, here: what it asks, what decides a
            // synonym, and what it shows (services/exercise/builders.ts).
            dispatch({ type: 'LOAD_VOCAB_SUCCESS', payload: { vocab, exercise: vocabExercise(vocab, queueItem, { sentence, cloze }) } });
        }).catch(err => {
            if (loadingKeyRef.current !== loadKey) return;
            // A vocab the dataset dropped (file genuinely absent) is retired, not
            // fatal: it leaves the queue and is tombstoned so it never returns. A
            // transient failure is NOT VocabNotFoundError, so it still fatal-errors.
            if (err instanceof VocabNotFoundError) {
                console.warn(`[useQuizOrchestration] Retiring vocab ${vid}: data no longer exists in the dataset`);
                dispatch({ type: 'RETIRE_VOCAB', payload: { vocabId: vid } });
                return;
            }
            console.error('[useQuizOrchestration] Failed to load vocab/sentences', err);
            dispatch({ type: 'LOAD_VOCAB_ERROR', payload: { vocabId: vid, error: err as unknown } });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the next item, progress and route; the load guard compares currentQuizItem, so helpers are stable inputs
    }, [nextView.queueItem, state.progress, state.settings, nextView.sessionState, location.pathname]);

    return { actions, exercise, nextView, currentProgress, sessionStats, nextSessionPreview };
}
