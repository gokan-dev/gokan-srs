import { insertAtFraction } from '../../utils/insertAtFraction';
import type { UserProgress } from '../../models/user.model';
import type { GrammarExample, GrammarPoint } from '@gokan/dataset-schema';
import type { AnswerResult } from '../../services/srs.service';
import { GrammarSRSService } from '../../services/grammarSrs.service';
import type { QuizState, SessionGains } from './quizReducer';
import type { AnswerSlot, Exercise } from '../../services/exercise/types';
import { clearedTurn, newTurn, withTurn } from './exerciseReducer';

/**
 * Set when the plan is a CONJUGATION drill rather than a sentence cloze - i.e.
 * the point is `kind: 'inflection'`, whose identity is an operation with no
 * invariant marker to blank.
 *
 * The drill deliberately reuses GrammarBlankPlan rather than introducing a
 * parallel state branch: a conjugation is a single answer slot, so the shared
 * grader, the answer/hint arrays, and the whole SRS path work unchanged.
 * `blankWordIndices` is `[0]` and its one slot is `core`, because the
 * derivation IS the point.
 */
export interface GrammarConjugationPrompt {
    lemma: string;
    lemmaReading: string;
    /** Shown as the prompt, e.g. "て-form". */
    formLabel: string;
    wordClass: 'godan' | 'ichidan' | 'irregular' | 'i-adjective' | 'na-adjective';
    /** The canonical answer, revealed by the hint and shown in feedback. */
    target: string;
    /**
     * The same answer in kana. Shown as furigana wherever `target` is displayed:
     * without it, a kanji-stemmed answer hides a READING error completely - a
     * learner who answered たくないです for 高くないです sees only the kanji form
     * back and cannot tell that what they got wrong was たか, not the inflection.
     */
    targetReading: string;
    /** Equally correct answers, so feedback can say so rather than implying one form. */
    alternatives?: string[];
}

export interface GrammarBlankPlan {
    exampleIndex: number;
    /**
     * The example the blanks were computed against, carried on the plan rather
     * than looked up as `point.examples[exampleIndex]`.
     *
     * For a variant group those are NOT the same object. `computeBlankPlan`
     * rotates in one realization and indexes into ITS examples, while the
     * orchestration dispatches the CANONICAL point (mastery lives on the
     * canonical's single SRS entry, so it has to). Rendering
     * `point.examples[exampleIndex]` therefore applied one sentence's blank
     * indices to a different sentence: n5-107's pattern [2,3,4] landed on
     * n5-105's どこ|に|も|お金|を|置いていません, blanking も and swallowing お金を
     * while どこに sat there as given text. Where the realization had MORE blanks
     * than the canonical sentence has words, the extra answer slot could never be
     * filled and `canSubmitGrammar` locked the card permanently.
     */
    example?: GrammarExample;
    /**
     * One entry per input, holding the FIRST word index that input covers.
     * See `blankWordSpans` for the rest of each span.
     */
    blankWordIndices: number[];
    /**
     * The word indices each input covers, in the same order as
     * `blankWordIndices`. Usually one index each - but a grammar pattern
     * regularly spans several tokens (どこ/に/も is three), and rendering one
     * input per token asks the learner to guess how the marker divides across
     * boxes, which is unanswerable. A contiguous run of pattern blanks becomes a
     * single input covering the whole run.
     */
    blankWordSpans: number[][];
    /**
     * One answer slot per input, same order as blankWordIndices: what it accepts,
     * its near-miss tier (a realization in the wrong register, the dictionary form
     * of a conjugated word), whether it decides the point's result (`core`, the
     * pattern markers) or only scales the reward (`support`, vocab reinforcement),
     * and what its hint shows. Built once at load time, so grading is the shared
     * engine's pure gradeExercise.
     */
    slots: AnswerSlot[];
    /** True when no word in ANY of the point's examples resolved to a vocab id - nothing gradable, rendered as read-only study material instead of a quiz. */
    readOnly: boolean;
    /**
     * Present only for a conjugation drill (an `inflection` point). When set,
     * the card renders GrammarConjugationCard instead of the sentence cloze, and
     * `exampleIndex` is meaningless - there is no sentence.
     */
    conjugation?: GrammarConjugationPrompt;
    /**
     * Set when this turn is drilling one realization of a variant group. The
     * realization rotates between reviews, so the learner meets every form of the
     * rule while a single SRS entry (the canonical's) carries the mastery.
     */
    realization?: {
        /** The point id actually being drilled, which may not be the canonical. */
        pointId: string;
        canonicalId: string;
        /** 1-based position and group size, for "2 of 6" style display. */
        index: number;
        total: number;
        /**
         * The SHOWN realization's register. The card's formality hint is the only
         * thing telling the learner which of several near-identical forms is
         * wanted, so it has to come from the realization, not the canonical.
         */
        formalityLevel?: GrammarPoint['formalityLevel'];
    };
}

/** A grammar point has exactly one quiz type, so this is just an id - no quizType/quizMode to track. */
export interface PendingGrammarQuizItem {
    grammarId: string;
}

/**
 * Grammar's equivalent of vocab's SessionTracking - the set of grammar points
 * committed to the current study session, captured once when the session
 * begins and extended only by the user's own "Learn" choices. A GrammarProgress
 * has a single SRSEntry/quiz type, so the committed set is just grammar ids
 * (no per-quiz-type task keys the way vocab needs).
 */
export interface GrammarSessionTracking {
    committed: string[];
    /** Epoch ms at which a consult page paused the session; absent while it runs. See SessionTracking. */
    suspendedAt?: number;
}

export interface GrammarQuizState {
    currentGrammarPoint: GrammarPoint | null;
    currentGrammarQuizItem: PendingGrammarQuizItem | null;
    isLoadingGrammar: boolean;
    /** Potential new grammar points, not yet in grammarQueue - mirrors introCandidates. */
    grammarIntroCandidates: GrammarPoint[];
    /** Task set of the active grammar study session (null between sessions). See GrammarSessionTracking. */
    grammarSession: GrammarSessionTracking | null;
    /** Cumulative knowledge points earned this session, both the grammar point's own and the reinforced vocab's (`vocab`) - see SessionGains in quizReducer.ts. */
    grammarSessionGains: SessionGains;
    grammarSessionHistory: GrammarHistoryItem[];
}

/** One answered grammar card in the session ticker. */
export interface GrammarHistoryItem {
    grammarId: string;
    title: string;
    result: AnswerResult;
    delta: number;
    /** Knowledge points the same answer credited to the sentence's vocabulary. Absent when nothing was reinforced. */
    vocabDelta?: number;
    /** Per-word split of vocabDelta, biggest gain first, for the ticker's hover detail. */
    vocabBreakdown?: { label: string; delta: number }[];
}

export const initialGrammarState: GrammarQuizState = {
    currentGrammarPoint: null,
    currentGrammarQuizItem: null,
    isLoadingGrammar: false,
    grammarIntroCandidates: [],
    grammarSession: null,
    grammarSessionGains: { net: 0, gained: 0, lost: 0, vocab: 0 },
    grammarSessionHistory: [],
};

export type GrammarQuizAction =
    | { type: 'GRAMMAR_LOAD_START'; payload: PendingGrammarQuizItem }
    /** The loaded point and the exercise built from its blank plan (services/exercise/builders.ts); both null when nothing is due. */
    | { type: 'GRAMMAR_LOAD_SUCCESS'; payload: { point: GrammarPoint | null; exercise: Exercise | null } }
    | { type: 'GRAMMAR_LOAD_ERROR'; payload: { grammarId: string; error: unknown } }
    | { type: 'GRAMMAR_ADVANCE_QUEUE'; payload: { progress: UserProgress; candidates?: GrammarPoint[] } }
    | {
        type: 'GRAMMAR_INTRO_CHOICE'; grammarId: string; choice: 'learn' | 'skip'; grammarPoint?: GrammarPoint;
        /** Where (0..1) a point added from outside the candidates is slotted in among them. Random, chosen by the caller. */
        insertionFraction?: number;
    }
    | { type: 'GRAMMAR_SESSION_START'; payload: { grammarIds: string[]; progress?: UserProgress } }
    | { type: 'GRAMMAR_SESSION_END' }
    | { type: 'GRAMMAR_SESSION_SUSPEND'; payload: { now: number } }
    | { type: 'GRAMMAR_SESSION_RESUME' }
    | { type: 'GRAMMAR_CHAPTER_COMPLETE'; payload: { chapterId: string } }
    | { type: 'GRAMMAR_RESET_PROGRESS'; payload: { progress: UserProgress } };

/** Every grammar action is prefixed GRAMMAR_ so quizReducer can delegate to this module without the two action unions needing to know about each other's cases. */
export function isGrammarAction(action: { type: string }): action is GrammarQuizAction {
    return action.type.startsWith('GRAMMAR_');
}

export function grammarReducer(state: QuizState, action: GrammarQuizAction): QuizState {
    switch (action.type) {
        case 'GRAMMAR_LOAD_START':
            return { ...withTurn(state, 'grammar', null), isLoadingGrammar: true, currentGrammarQuizItem: action.payload };

        case 'GRAMMAR_LOAD_SUCCESS':
            return {
                ...withTurn(state, 'grammar', action.payload.exercise && newTurn(action.payload.exercise)),
                currentGrammarPoint: action.payload.point,
                isLoadingGrammar: false,
            };

        case 'GRAMMAR_LOAD_ERROR':
            return {
                ...state,
                isLoadingGrammar: false,
                fatalError: `Failed to load grammar data for ID: ${action.payload.grammarId}. The application data may be corrupted. Please reload or contact support.`,
            };

        case 'GRAMMAR_ADVANCE_QUEUE':
            return {
                ...withTurn(state, 'grammar', state.turns.grammar && clearedTurn(state.turns.grammar)),
                progress: action.payload.progress,
                grammarIntroCandidates: action.payload.candidates ?? state.grammarIntroCandidates,
            };
        case 'GRAMMAR_SESSION_START':
            // Snapshot the session's committed grammar-id set. Computed with `now` in
            // the orchestration layer (keeping this reducer free of Date.now) and passed in.
            // `progress` is only present when clearStaleGrammarNeedsRetry (issue #36)
            // actually cleared a stale cross-session retry flag colliding with a fresh
            // due review.
            return {
                ...state,
                ...(action.payload.progress ? { progress: action.payload.progress } : {}),
                grammarSession: { committed: action.payload.grammarIds },
                // Fresh session -> fresh ticker, so the gains/losses summary reflects
                // only this session's answers.
                grammarSessionHistory: [],
                grammarSessionGains: { net: 0, gained: 0, lost: 0, vocab: 0 },
            };

        case 'GRAMMAR_SESSION_END':
            return state.grammarSession ? { ...state, grammarSession: null } : state;

        case 'GRAMMAR_SESSION_SUSPEND':
            // Mirrors SESSION_SUSPEND: keeps the committed set, history and gains.
            return state.grammarSession && state.grammarSession.suspendedAt === undefined
                ? { ...state, grammarSession: { ...state.grammarSession, suspendedAt: action.payload.now } }
                : state;

        case 'GRAMMAR_SESSION_RESUME': {
            if (!state.grammarSession || state.grammarSession.suspendedAt === undefined) return state;
            const running = { ...state.grammarSession };
            delete running.suspendedAt;
            return { ...state, grammarSession: running };
        }

        /**
         * Records that a chapter's end-of-chapter step has been handled - either
         * shown and acknowledged, or (a chapter with no anchored lessons)
         * silently skipped. Union-style add: a no-op if the id is already
         * present, so a duplicate dispatch (e.g. two effects racing after a
         * Drive merge) can't grow the array.
         */
        case 'GRAMMAR_CHAPTER_COMPLETE': {
            if (!state.progress) return state;
            const existing = state.progress.completedChapters ?? [];
            if (existing.includes(action.payload.chapterId)) return state;
            return {
                ...state,
                progress: { ...state.progress, completedChapters: [...existing, action.payload.chapterId] },
            };
        }

        case 'GRAMMAR_INTRO_CHOICE': {
            if (!state.progress) return state;

            const newProgressItem = GrammarSRSService.createGrammarProgress(action.grammarId);
            const processedItem = GrammarSRSService.applyGrammarIntroChoice(newProgressItem, action.choice);

            const existingIndex = state.progress.grammarQueue.findIndex(g => g.grammarId === action.grammarId);
            let updatedQueue;

            if (existingIndex >= 0) {
                updatedQueue = [...state.progress.grammarQueue];
                updatedQueue[existingIndex] = {
                    ...updatedQueue[existingIndex],
                    ...processedItem,
                    entry: { ...processedItem.entry, history: updatedQueue[existingIndex].entry.history },
                };
            } else {
                updatedQueue = [...state.progress.grammarQueue, processedItem];
            }

            const wasInCandidates = state.grammarIntroCandidates.some(c => c.id === action.grammarId);
            let nextCandidates = state.grammarIntroCandidates.filter(c => c.id !== action.grammarId);

            if (!wasInCandidates && action.grammarPoint) {
                nextCandidates = insertAtFraction(nextCandidates, action.grammarPoint, action.insertionFraction ?? 0);
            }

            // A point the user chooses to Learn becomes part of the current session's
            // committed workload (its single entry is now due immediately), mirroring
            // VOCAB_INTRO_CHOICE. Skipped points graduate straight away and add nothing.
            let nextGrammarSession = state.grammarSession;
            if (nextGrammarSession && action.choice === 'learn') {
                if (!nextGrammarSession.committed.includes(action.grammarId)) {
                    nextGrammarSession = { ...nextGrammarSession, committed: [...nextGrammarSession.committed, action.grammarId] };
                }
            }

            return {
                ...state,
                progress: { ...state.progress, grammarQueue: updatedQueue },
                grammarIntroCandidates: nextCandidates,
                grammarSession: nextGrammarSession,
            };
        }

        /**
         * Wipes grammar progress and nothing else. Every in-flight grammar view
         * is reset alongside the queue - leaving `currentGrammarPoint` and its
         * blank plan in place would keep a card on screen whose SRS entry no
         * longer exists, and answering it would recreate the entry the user just
         * removed. Vocab, kanji and settings are untouched by construction:
         * `grammarQueue` is the only grammar field on UserProgress.
         */
        case 'GRAMMAR_RESET_PROGRESS':
            return {
                ...withTurn(state, 'grammar', null),
                ...initialGrammarState,
                progress: action.payload.progress,
            };

        default:
            return state;
    }
}
