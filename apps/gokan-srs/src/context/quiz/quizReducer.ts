import type {
    KanjiKnowledge,
    UserProgress,
    UserSettings,
} from '../../models/user.model';
import type { Vocabulary } from '../../models/vocabulary.model';
import type { Sentence } from '../../models/sentence.model';
import type { WatchedEpisode } from '../../models/media.model';
import type { AnswerResult } from '../../services/srs.service';
import { SRSService } from '../../services/srs.service';
import { rebaseStrengthsToSchedule } from '../../services/calibration';
import type { QuizItem, QuizType, QuizMode, TaskKey } from '../../utils/srs.utils';
import { taskKey } from '../../utils/srs.utils';
import type { ProductionCloze } from '../../utils/productionCloze.utils';
import type { SynonymRelation } from '../../models/index.model';
import type { GrammarQuizState, GrammarQuizAction } from './grammarReducer';
import { initialGrammarState, isGrammarAction, grammarReducer } from './grammarReducer';

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
/** A word the feedback can link to its detail page. */
export interface SynonymWord {
    vocabId: string;
    written: string;
}

export interface SessionTracking {
    committed: TaskKey[];
    /**
     * Epoch ms at which a consult page (a word, kanji or grammar point's detail
     * page) paused the session; absent while it runs. A paused session keeps its
     * committed set, history and gains, and resumes on return to /quiz within
     * CONSTANTS.srs.sessionSuspendTtlMinutes (see useSessionLifecycle).
     */
    suspendedAt?: number;
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
    /** Grammar only: points credited to reinforced vocabulary. Always 0 for vocab's own sessionGains. */
    vocab: number;
}

export const ZERO_SESSION_GAINS: SessionGains = { net: 0, gained: 0, lost: 0, vocab: 0 };

interface QuizStateBase {
    progress: UserProgress | null;
    settings: UserSettings | null;
    currentVocab: Vocabulary | null;
    currentSentences: Sentence[] | null;
    currentSentenceId: string | null;
    /**
     * The sentence + blank span driving the CURRENT production quiz card (issue
     * #72), when one could be found. Null means "no usable sentence match for
     * this word" - VocabQuizScreen falls back to the gloss-prompt
     * VocabProductionQuizCard - or simply that the current card isn't a
     * production quiz at all. Resolved once at load time (see
     * useQuizOrchestration's loading effect), same pattern as
     * currentGrammarBlankPlan, so grading stays synchronous.
     */
    currentProductionCloze: ProductionCloze | null;
    /**
     * Progressive hint level for the CURRENT production cloze card: 0 = none,
     * 1 = gloss shown, 2 = answer revealed into userAnswer (grades
     * 'minor_error' regardless of what was typed) - mirrors grammarHintLevels,
     * just for a single blank instead of one per word.
     */
    productionHintLevel: number;
    currentQuizItem: PendingQuizItem | null;
    userAnswer: string;
    feedback: {
        show: boolean;
        correct: boolean; // true only for strict 'correct', not minor_error
        type: AnswerResult;
        message: string;
        matchedAnswer: string;
        /**
         * Set only when this answer collided with a near-synonym of the target
         * (issue #71 Part B) - 'interchangeable' grades minor_error normally,
         * 'confusable' tells continueToNext to route through
         * SRSService.applyConfusableSynonymAnswer instead of the normal
         * applyAnswer path (no strength change, just sets needsRetry.production).
         */
        synonymRelation?: SynonymRelation;
        /**
         * The near-synonym the learner actually typed, when synonymRelation is set,
         * so the card can link it next to the tested word for a side-by-side look.
         */
        synonymWord?: SynonymWord;
    } | null;
    isLoadingVocab: boolean;
    isEvaluatingAi: boolean;
    introCandidates: Vocabulary[]; // Potential new items, not yet in learningQueue
    nextKanjiToLearn: { step: number; kanjis: string[] } | null;
    sessionHistory: Array<{
        vocabId: string;
        writtenForm: string;
        result: AnswerResult;
        delta: number;
    }>;
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
 * sync for free instead of duplicating that wiring.
 */
export type QuizState = QuizStateBase & GrammarQuizState;

export type QuizAction =
    | { type: 'SETUP_COMPLETE'; payload: { progress: UserProgress; settings: UserSettings } }
    | { type: 'LOAD_VOCAB_START'; payload: PendingQuizItem }
    | { type: 'LOAD_VOCAB_SUCCESS'; payload: { vocab: Vocabulary | null; sentences: Sentence[] | null; selectedSentenceId: string | null; productionCloze?: ProductionCloze | null } }
    | { type: 'LOAD_VOCAB_ERROR'; payload: { vocabId: string, error: any } }
    | { type: 'EVALUATING_AI_START' }
    | { type: 'SET_ANSWER'; payload: string }
    | { type: 'REVEAL_PRODUCTION_HINT' }
    | { type: 'SUBMIT_ANSWER'; payload: { type: AnswerResult; message: string; matchedAnswer: string; synonymRelation?: SynonymRelation; synonymWord?: SynonymWord } }
    | { type: 'UPDATE_AFTER_ANSWER'; payload: { progress: UserProgress; historyItem: { vocabId: string, writtenForm: string, result: AnswerResult, delta: number } } }
    | { type: 'ADVANCE_QUEUE'; payload: { progress: UserProgress, candidates?: Vocabulary[] } }
    | { type: 'CLEAR_FEEDBACK' }
    | { type: 'UPDATE_KANJI_KNOWLEDGE'; payload: KanjiKnowledge }
    | { type: 'SAVE_SETTINGS'; payload: UserSettings }
    | { type: 'OVERRIDE_DAILY_LIMIT' }
    | { type: 'RESET' }
    | { type: 'VOCAB_INTRO_CHOICE'; vocabId: string; choice: 'learn' | 'skip'; vocabulary?: Vocabulary; }
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
    | GrammarQuizAction;

export const initialState: QuizState = {
    ...initialGrammarState,
    progress: null,
    settings: null,
    currentVocab: null,
    currentSentences: null,
    currentSentenceId: null,
    currentProductionCloze: null,
    productionHintLevel: 0,
    currentQuizItem: null,
    userAnswer: '',
    feedback: null,
    isLoadingVocab: false,
    isEvaluatingAi: false,
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
            return {
                ...state,
                isLoadingVocab: true,
                currentQuizItem: action.payload,
                currentSentences: null,
                currentSentenceId: null,
                currentProductionCloze: null,
                productionHintLevel: 0,
                userAnswer: '',
                feedback: null,
            };

        case 'LOAD_VOCAB_SUCCESS':
            return {
                ...state,
                currentVocab: action.payload.vocab,
                currentSentences: action.payload.sentences,
                currentSentenceId: action.payload.selectedSentenceId,
                currentProductionCloze: action.payload.productionCloze ?? null,
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
            console.error(`[quizReducer] CRITICAL: Failed to load vocab ${action.payload.vocabId}`, action.payload.error);
            return {
                ...state,
                isLoadingVocab: false,
                fatalError: `Failed to load vocabulary data for ID: ${action.payload.vocabId}. The application data may be corrupted. Please reload or contact support.`,
            };

        case 'EVALUATING_AI_START':
            return { ...state, isEvaluatingAi: true };

        case 'SET_ANSWER':
            return { ...state, userAnswer: action.payload };

        case 'REVEAL_PRODUCTION_HINT': {
            const next = Math.min(2, state.productionHintLevel + 1);

            // Reaching level 2 writes the primary reading into userAnswer rather than
            // leaving the card to substitute it at render time - same reasoning as
            // GRAMMAR_REVEAL_HINT: the input has to show what state actually holds, or
            // Submit stays disabled (canSubmit requires a non-empty userAnswer) even
            // though the card looks answered. Grading is unaffected either way (a
            // revealed blank is forced to 'minor_error' by productionHintLevel, not by
            // what userAnswer contains).
            // On a cloze card the revealed answer is the blank's own reading
            // (たべたら), so what fills the input fits the sentence.
            if (next === 2 && state.currentVocab) {
                const revealed = state.currentProductionCloze?.blankReading ?? state.currentVocab.reading.primary;
                return { ...state, productionHintLevel: next, userAnswer: revealed };
            }

            return { ...state, productionHintLevel: next };
        }

        case 'SUBMIT_ANSWER':
            return {
                ...state,
                isEvaluatingAi: false,
                feedback: {
                    show: true,
                    correct: action.payload.type === 'correct',
                    type: action.payload.type,
                    message: action.payload.message,
                    matchedAnswer: action.payload.matchedAnswer,
                    synonymRelation: action.payload.synonymRelation,
                    synonymWord: action.payload.synonymWord,
                },
            };

        case 'UPDATE_AFTER_ANSWER': {
            const { delta } = action.payload.historyItem;
            return {
                ...state,
                progress: action.payload.progress,
                feedback: null,
                userAnswer: '',
                sessionHistory: [action.payload.historyItem, ...state.sessionHistory].slice(0, 50),
                sessionGains: {
                    net: state.sessionGains.net + delta,
                    gained: state.sessionGains.gained + (delta > 0 ? delta : 0),
                    lost: state.sessionGains.lost + (delta < 0 ? -delta : 0),
                    vocab: state.sessionGains.vocab,
                },
                introCandidates: state.introCandidates.filter(c => c.id !== action.payload.historyItem.vocabId),
            };
        }

        case 'ADVANCE_QUEUE':
            return {
                ...state,
                progress: action.payload.progress,
                introCandidates: action.payload.candidates ?? state.introCandidates,
                feedback: null,
                userAnswer: '',
            };

        case 'CLEAR_FEEDBACK':
            return { ...state, feedback: null };

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

        case 'RECONCILE_REMOTE':
            // The merge itself (reconciling remote changes against whatever the user
            // is doing right now) already happened in useQuizOrchestration before this
            // was dispatched - the reducer just assigns the reconciled result. Everything
            // else (currentVocab, userAnswer, feedback) is left untouched so an in-flight
            // answer isn't interrupted by a background sync.
            return {
                ...state,
                progress: action.payload.progress,
                settings: action.payload.settings,
            };

        case 'VOCAB_INTRO_CHOICE': {
            if (!state.progress) return state;

            // Create new VocabProgress and APPEND to queue
            const newProgressItem = SRSService.createVocabProgress(action.vocabId);
            const processedItem = SRSService.applyVocabIntroChoice(newProgressItem, action.choice);

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

            if (!wasInCandidates && action.vocabulary) {
                const insertAt = Math.floor(Math.random() * (nextCandidates.length + 1));
                nextCandidates = [
                    ...nextCandidates.slice(0, insertAt),
                    action.vocabulary,
                    ...nextCandidates.slice(insertAt),
                ];
            }

            // A word the user chooses to Learn becomes part of the current session's
            // committed workload (its reading is now due immediately). Skipped words
            // graduate straight away and never produce a quiz, so they add nothing.
            // Meaning is staggered +12h and typically lands after this session, so it
            // is intentionally left to surface as "waiting" rather than inflating the total.
            let nextSession = state.session;
            if (nextSession && action.choice === 'learn') {
                const key = taskKey(action.vocabId, 'reading');
                if (!nextSession.committed.includes(key)) {
                    nextSession = { ...nextSession, committed: [...nextSession.committed, key] };
                }
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
