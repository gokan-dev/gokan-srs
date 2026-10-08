import type {
    KanjiKnowledge,
    UserProgress,
    UserSettings,
} from '../../models/user.model';
import { insertAtFraction } from '../../utils/insertAtFraction';
import type { ProgressWithMetadata } from '../../services/sync/types';
import type { Vocabulary } from '@gokan/dataset-schema';
import type { WatchedEpisode } from '../../models/media.model';
import type { AnswerResult } from '../../services/srs.service';
import { SRSService } from '../../services/srs.service';
import { rebaseStrengthsToSchedule } from '../../services/calibration';
import type { QuizItem, QuizMode, QuizType, TaskKey } from '../../utils/srs.utils';
import { syncUsuallyKana, taskKey } from '../../utils/srs.utils';
import { introQuizType } from '../../services/scheduling';
import { grammarReducer, initialGrammarState, isGrammarAction } from './grammarReducer';
import type { GrammarQuizAction, GrammarQuizState } from './grammarReducer';
import { clearedTurn, exerciseReducer, initialExerciseTurns, isExerciseAction, newTurn, withTurn } from './exerciseReducer';
import type { ExerciseAction, ExerciseTurnsState } from './exerciseReducer';
import type { Exercise } from '../../services/exercise/types';

/* =========================
   STATE & TYPES
   ========================= */

// Union type for items we are about to study (Queue Item OR Intro Candidate)
export type PendingQuizItem = QuizItem | { vocabId: string; quizType: QuizType; quizMode: QuizMode; vocab?: undefined };

/**
 * A task key uniquely identifies one quiz to answer: `${vocabId}:${quizType}`.
 * Defined in srs.utils.ts (queue selection needs it to honour the committed set)
 * and re-exported here, which is where the rest of the app already imports it from.
 */
export type { TaskKey };
export { taskKey };

/**
 * The set of quiz tasks committed to the CURRENT study session, captured once when
 * the session begins (all tasks due at that moment) and extended only by the user's
 * own "Learn" choices. It never grows from background reviews coming due mid-session
 * - those are surfaced separately as "waiting after this session". This is what
 * keeps the session-progress counter's denominator stable instead of tracking the
 * live, ever-shifting due count (which shrank on every wrong answer).
 */
export interface SessionTracking {
    committed: TaskKey[];
    /**
     * Epoch ms at which a consult page (a word, kanji or grammar point's detail
     * page) paused the session; absent while it runs. A paused session keeps its
     * committed set, history and gains, and resumes on return to /quiz within
     * CONSTANTS.srs.sessionSuspendTtlMinutes (see useSessionLifecycle).
     */
    suspendedAt?: number;
    /**
     * Words learned in kana this session introduced (Learn), for the per-session
     * cap CONSTANTS.srs.newUsuallyKanaPerSession. Absent means none.
     */
    usuallyKanaIntroduced?: number;
}

/**
 * Cumulative knowledge-point totals for the CURRENT study session, tracked as
 * running scalar accumulators rather than derived by summing sessionHistory.
 * sessionHistory (and grammarSessionHistory) is deliberately capped at 50
 * entries for the ticker display - summing it for the session TOTAL meant the
 * total silently stopped growing (plateaued) once a session passed 50 answers,
 * since the oldest deltas fell out of the array (issue #80). Reset to zero on
 * SESSION_START/GRAMMAR_SESSION_START, incremented on every
 * UPDATE_AFTER_ANSWER/GRAMMAR_UPDATE_AFTER_ANSWER from the same delta already
 * pushed into the (capped) history array, so the two can never disagree on
 * a per-answer basis - only on how far back they remember.
 */
export interface SessionGains {
    net: number;
    gained: number;
    lost: number;
    /** Points credited to other words than the one asked: a grammar sentence's vocab blanks, a near-synonym typed. */
    vocab: number;
}

/** One answered card in the session ticker. */
export interface VocabHistoryItem {
    vocabId: string;
    writtenForm: string;
    result: AnswerResult;
    delta: number;
    /** Credit the answer gave another word (the near-synonym typed). Absent when none. */
    vocabDelta?: number;
    vocabBreakdown?: { label: string; delta: number }[];
}

export const ZERO_SESSION_GAINS: SessionGains = { net: 0, gained: 0, lost: 0, vocab: 0 };

interface QuizStateBase {
    /** Carries the Drive sync counter at runtime, so it is typed as what storage and the merge return. */
    progress: ProgressWithMetadata | null;
    settings: UserSettings | null;
    /** The word whose card is on screen; its exercise (answers, feedback) is turns.vocab. */
    currentVocab: Vocabulary | null;
    currentQuizItem: PendingQuizItem | null;
    isLoadingVocab: boolean;
    introCandidates: Vocabulary[]; // Potential new items, not yet in learningQueue
    nextKanjiToLearn: { step: number; kanjis: string[] } | null;
    sessionHistory: VocabHistoryItem[];
    /** Task set of the active study session (null between sessions). See SessionTracking. */
    session: SessionTracking | null;
    /** Cumulative knowledge points earned this session - see SessionGains. */
    sessionGains: SessionGains;
    fatalError: string | null;
}

/**
 * QuizState also carries the Grammar activity's UI-only fields, defined in
 * grammarReducer.ts and merged in here (via intersection) rather than owning a
 * separate provider/reducer. A second provider would need its own read/write
 * path onto the same persisted UserProgress (grammarQueue lives on the same
 * object as learningQueue), racing this provider's storage/Drive-sync effects
 * - which are keyed off `state.progress` reference changes generically, so
 * dispatching grammar actions through this single reducer gets persistence and
 * sync for free instead of duplicating that wiring. The exercise each activity has
 * on screen lives in one shared slice (exerciseReducer.ts).
 */
export type QuizState = QuizStateBase & GrammarQuizState & ExerciseTurnsState;

export type QuizAction =
    | { type: 'SETUP_COMPLETE'; payload: { progress: UserProgress; settings: UserSettings } }
    | { type: 'LOAD_VOCAB_START'; payload: PendingQuizItem }
    /** The loaded word and the exercise built for it (services/exercise/builders.ts); both null when nothing is due. */
    | { type: 'LOAD_VOCAB_SUCCESS'; payload: { vocab: Vocabulary | null; exercise: Exercise | null } }
    | { type: 'LOAD_VOCAB_ERROR'; payload: { vocabId: string, error: unknown } }
    /** The vocab's data no longer exists in the dataset: drop it from learningQueue and tombstone it in retiredVocabIds so it is never served again (even if a merge respawns it). See VocabNotFoundError. */
    | { type: 'RETIRE_VOCAB'; payload: { vocabId: string } }
    | { type: 'ADVANCE_QUEUE'; payload: { progress: UserProgress, candidates?: Vocabulary[] } }
    | { type: 'UPDATE_KANJI_KNOWLEDGE'; payload: KanjiKnowledge }
    | { type: 'SAVE_SETTINGS'; payload: UserSettings }
    | { type: 'OVERRIDE_DAILY_LIMIT' }
    | { type: 'RESET' }
    | {
        type: 'VOCAB_INTRO_CHOICE'; vocabId: string; choice: 'learn' | 'skip'; vocabulary: Vocabulary;
        /** Where (0..1) a word added from outside the candidates is slotted in among them. Random, chosen by the caller. */
        insertionFraction?: number;
    }
    | { type: 'SET_NEXT_KANJI'; payload: { step: number; kanjis: string[] } | null; }
    | { type: 'LEARN_NEXT_KANJI'; payload: UserProgress }
    | { type: 'RESET_DAILY_STATS' }
    /** Marks or un-marks listening-library episodes, one or a whole series at once. `updatedAt` is stamped by the caller, keeping this reducer free of Date.now. */
    | { type: 'SET_EPISODES_WATCHED'; payload: { entries: Record<string, WatchedEpisode> } }
    | { type: 'SESSION_START'; payload: { taskKeys: TaskKey[]; progress?: UserProgress } }
    | { type: 'SESSION_END' }
    | { type: 'SESSION_SUSPEND'; payload: { now: number } }
    | { type: 'SESSION_RESUME' }
    | { type: 'RECONCILE_REMOTE'; payload: { progress: UserProgress; settings: UserSettings } }
    /**
     * Folds the old interval-only adaptive level into strength (see
     * rebaseStrengthsToSchedule). Computed from the CURRENT progress in the
     * reducer rather than passed in, so it can never overwrite an answer that
     * landed between scheduling the rebase and applying it.
     */
    | { type: 'REBASE_STRENGTHS'; payload: { frequencyModifier: number } }
    /**
     * Brings the queue's usuallyKana flags in line with the dataset (syncUsuallyKana).
     * Like REBASE_STRENGTHS, applied to the CURRENT progress in the reducer, so an
     * answer landing in between is never overwritten. `now` comes from the caller.
     */
    | { type: 'SYNC_USUALLY_KANA'; payload: { ids: ReadonlySet<string>; now: Date } }
    | GrammarQuizAction
    | ExerciseAction;

export const initialState: QuizState = {
    ...initialGrammarState,
    ...initialExerciseTurns,
    progress: null,
    settings: null,
    currentVocab: null,
    currentQuizItem: null,
    isLoadingVocab: false,
    introCandidates: [],
    nextKanjiToLearn: null,
    sessionHistory: [],
    session: null,
    sessionGains: ZERO_SESSION_GAINS,
    fatalError: null,
};

function sameKanjiSet(a: Set<string>, b: Set<string>): boolean {
    if (a === b) return true;
    if (a.size !== b.size) return false;
    for (const k of a) if (!b.has(k)) return false;
    return true;
}

function sameKanjiKnowledge(a: KanjiKnowledge | undefined, b: KanjiKnowledge): boolean {
    if (!a) return false;
    return a.method === b.method && a.step === b.step && sameKanjiSet(a.kanjiSet, b.kanjiSet);
}

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
    if (isExerciseAction(action)) return exerciseReducer(state, action);
    if (isGrammarAction(action)) return grammarReducer(state, action);

    switch (action.type) {
        case 'SETUP_COMPLETE':
            return {
                ...state,
                progress: action.payload.progress,
                settings: action.payload.settings,
            };

        case 'RESET_DAILY_STATS':
            if (!state.progress) return state;
            return {
                ...state,
                progress: {
                    ...state.progress,
                    stats: {
                        ...state.progress.stats,
                        newLearnedToday: 0,
                    },
                    dailyOverride: false,
                },
            };

        case 'LOAD_VOCAB_START':
            return { ...withTurn(state, 'vocab', null), isLoadingVocab: true, currentQuizItem: action.payload };

        case 'LOAD_VOCAB_SUCCESS':
            return {
                ...withTurn(state, 'vocab', action.payload.exercise && newTurn(action.payload.exercise)),
                currentVocab: action.payload.vocab,
                isLoadingVocab: false,
            };

        case 'SET_NEXT_KANJI':
            return {
                ...state,
                nextKanjiToLearn: action.payload
            };

        case 'LEARN_NEXT_KANJI':
            return {
                ...state,
                progress: action.payload,
                nextKanjiToLearn: null
            };

        case 'LOAD_VOCAB_ERROR':
            return {
                ...state,
                isLoadingVocab: false,
                fatalError: `Failed to load vocabulary data for ID: ${action.payload.vocabId}. The application data may be corrupted. Please reload or contact support.`,
            };

        case 'RETIRE_VOCAB': {
            if (!state.progress) return state;
            const { vocabId } = action.payload;
            const retired = state.progress.retiredVocabIds ?? [];
            const alreadyRetired = retired.includes(vocabId);
            const inQueue = state.progress.learningQueue.some(v => v.vocabId === vocabId);
            if (alreadyRetired && !inQueue) return state; // nothing to change
            // Clear the failed load and reset selection so selectNextView recomputes
            // over a queue the retired word is no longer in and serves the next item.
            return {
                ...state,
                progress: {
                    ...state.progress,
                    learningQueue: state.progress.learningQueue.filter(v => v.vocabId !== vocabId),
                    retiredVocabIds: alreadyRetired ? retired : [...retired, vocabId],
                },
                currentVocab: null,
                currentQuizItem: null,
                isLoadingVocab: false,
                turns: { ...state.turns, vocab: null },
            };
        }

        case 'ADVANCE_QUEUE':
            return {
                ...withTurn(state, 'vocab', state.turns.vocab && clearedTurn(state.turns.vocab)),
                progress: action.payload.progress,
                introCandidates: action.payload.candidates ?? state.introCandidates,
            };

        case 'SAVE_SETTINGS': {
            const orderChanged =
                state.settings?.preferredLearningOrder !== action.payload.preferredLearningOrder ||
                state.settings?.kanjiCoverageTarget !== action.payload.kanjiCoverageTarget;

            return {
                ...state,
                settings: action.payload,
                introCandidates: orderChanged ? [] : state.introCandidates,
            };
        }

        case 'UPDATE_KANJI_KNOWLEDGE': {
            if (!state.progress) return state;

            // Which vocabulary is optimal to learn next depends directly on which
            // kanji the user knows, so a cached introCandidates buffer computed
            // under the old kanji set is stale the moment that set changes - the
            // same invalidation SAVE_SETTINGS does when the learning order changes.
            // Clearing it makes selectNextView return no queue item, which drives
            // useQuizOrchestration to re-run advanceQueue against the new knowledge.
            const changed = !sameKanjiKnowledge(state.progress.kanjiKnowledge, action.payload);

            // KanjiKnowledgeEditor fires its onChange on mount as well as on edit,
            // so an unchanged payload must not discard a perfectly good buffer.
            if (!changed) return state;

            return {
                ...state,
                progress: {
                    ...state.progress,
                    kanjiKnowledge: action.payload,
                },
                introCandidates: [],
                // A pending "unlock the next KKLC step" prompt was computed from the
                // old kanji set too; advanceQueue re-derives it.
                nextKanjiToLearn: null,
            };
        }

        case 'SET_EPISODES_WATCHED':
            if (!state.progress) return state;
            return {
                ...state,
                progress: {
                    ...state.progress,
                    watchedEpisodes: { ...state.progress.watchedEpisodes, ...action.payload.entries },
                },
            };

        case 'OVERRIDE_DAILY_LIMIT':
            return {
                ...state,
                progress: state.progress
                    ? { ...state.progress, dailyOverride: true }
                    : null,
            };

        case 'RESET':
            return { ...initialState };

        case 'SESSION_START':
            // Snapshot the session's committed task set. Computed with `now` in the
            // orchestration layer (keeping this reducer free of Date.now) and passed in.
            // `progress` is only present when clearStaleNeedsRetry (issue #36) actually
            // cleared a stale cross-session retry flag colliding with a fresh due review.
            return {
                ...state,
                ...(action.payload.progress ? { progress: action.payload.progress } : {}),
                session: { committed: action.payload.taskKeys },
                // Fresh session -> fresh ticker, so the gains/losses summary reflects
                // only this session's answers.
                sessionHistory: [],
                sessionGains: ZERO_SESSION_GAINS,
            };

        case 'SESSION_END':
            return state.session ? { ...state, session: null } : state;

        case 'SESSION_SUSPEND':
            // Pausing keeps everything (committed set, history, gains); only the
            // timestamp is new. `now` comes from the orchestration layer.
            return state.session && state.session.suspendedAt === undefined
                ? { ...state, session: { ...state.session, suspendedAt: action.payload.now } }
                : state;

        case 'SESSION_RESUME': {
            if (!state.session || state.session.suspendedAt === undefined) return state;
            const running = { ...state.session };
            delete running.suspendedAt;
            return { ...state, session: running };
        }

        case 'REBASE_STRENGTHS': {
            if (!state.progress) return state;
            const rebased = rebaseStrengthsToSchedule(state.progress, action.payload.frequencyModifier);
            return rebased === state.progress ? state : { ...state, progress: rebased };
        }

        case 'SYNC_USUALLY_KANA': {
            if (!state.progress) return state;
            const queue = syncUsuallyKana(state.progress.learningQueue, action.payload.ids, state.settings ?? undefined, action.payload.now);
            return queue === state.progress.learningQueue ? state : { ...state, progress: { ...state.progress, learningQueue: queue } };
        }

        case 'RECONCILE_REMOTE':
            // The merge itself (reconciling remote changes against whatever the user
            // is doing right now) already happened in useQuizOrchestration before this
            // was dispatched - the reducer just assigns the reconciled result. Everything
            // else (currentVocab, the exercise turns) is left untouched so an in-flight
            // answer isn't interrupted by a background sync.
            return {
                ...state,
                progress: action.payload.progress,
                settings: action.payload.settings,
            };

        case 'VOCAB_INTRO_CHOICE': {
            if (!state.progress) return state;

            // Create new VocabProgress and APPEND to queue
            const newProgressItem = SRSService.createVocabProgress(action.vocabulary);
            const processedItem = SRSService.applyVocabIntroChoice(newProgressItem, action.choice, state.settings ?? undefined);

            // Check if item already exists in queue to avoid duplicates
            const existingIndex = state.progress.learningQueue.findIndex(v => v.vocabId === action.vocabId);
            let updatedQueue;

            if (existingIndex >= 0) {
                // Update existing
                updatedQueue = [...state.progress.learningQueue];
                updatedQueue[existingIndex] = {
                    ...updatedQueue[existingIndex],
                    ...processedItem,
                    // Preserve history if any (though new items shouldn't have history)
                    reading: { ...processedItem.reading, history: updatedQueue[existingIndex].reading.history },
                    meaning: { ...processedItem.meaning, history: updatedQueue[existingIndex].meaning.history },
                };
            } else {
                // Append new
                updatedQueue = [...state.progress.learningQueue, processedItem];
            }

            // Determine new introCandidates:
            // - If vocab was already in candidates (intro card flow): remove it normally.
            // - If vocab was NOT in candidates (detail page "Add to Learning List"):
            //   insert it at a random position so it appears naturally among other candidates.
            const wasInCandidates = state.introCandidates.some(c => c.id === action.vocabId);
            let nextCandidates = state.introCandidates.filter(c => c.id !== action.vocabId);

            if (!wasInCandidates) {
                nextCandidates = insertAtFraction(nextCandidates, action.vocabulary, action.insertionFraction ?? 0);
            }

            // A word the user chooses to Learn becomes part of the current session's
            // committed workload (its first quiz is now due immediately: reading, or
            // for a word learned in kana the direction that replaces it). Skipped words
            // graduate straight away and never produce a quiz, so they add nothing.
            // The other directions are staggered and typically land after this session,
            // so they are intentionally left to surface as "waiting" rather than
            // inflating the total.
            let nextSession = state.session;
            const firstQuiz = introQuizType(processedItem, state.settings ?? undefined);
            if (nextSession && action.choice === 'learn' && firstQuiz) {
                const key = taskKey(action.vocabId, firstQuiz);
                if (!nextSession.committed.includes(key)) {
                    nextSession = { ...nextSession, committed: [...nextSession.committed, key] };
                }
            }
            if (nextSession && action.choice === 'learn' && processedItem.usuallyKana) {
                nextSession = { ...nextSession, usuallyKanaIntroduced: (nextSession.usuallyKanaIntroduced ?? 0) + 1 };
            }

            return {
                ...state,
                progress: {
                    ...state.progress,
                    learningQueue: updatedQueue,
                    stats: {
                        ...state.progress.stats,
                        newLearnedToday: state.progress.stats.newLearnedToday + (action.choice === 'learn' ? 1 : 0),
                        totalLearned: state.progress.stats.totalLearned + 1,
                    }
                },
                introCandidates: nextCandidates,
                session: nextSession,
            };
        }

        default:
            return state;
    }
}
