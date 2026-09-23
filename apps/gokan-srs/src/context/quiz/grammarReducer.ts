import type { UserProgress } from '../../models/user.model';
import type { GrammarExample, GrammarPoint } from '../../models/grammar.model';
import type { AnswerResult } from '../../services/srs.service';
import { GrammarSRSService } from '../../services/grammarSrs.service';
import type { QuizState } from './quizReducer';

/** Which example (by index) and which of its words became blanks for the CURRENT quiz turn - fixed at load time so grading matches what was shown. */
/**
 * Set when the plan is a CONJUGATION drill rather than a sentence cloze - i.e.
 * the point is `kind: 'inflection'`, whose identity is an operation with no
 * invariant marker to blank.
 *
 * The drill deliberately reuses GrammarBlankPlan rather than introducing a
 * parallel state branch: a conjugation is a single blank with an accept-list, so
 * `gradeGrammarAnswers`, the answer/hint arrays, and the whole SRS path work
 * unchanged. `blankWordIndices` is `[0]` and `isPatternBlank` is `[true]`,
 * because the derivation IS the point.
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
     * Per-blank flag (same order as blankWordIndices): true when this blank is one
     * of the point's grammar-pattern markers (example.patternWordIndices), false
     * when it's a vocab word blanked as secondary reinforcement. Grading treats the
     * two differently - the pattern blanks decide the grammar point's result, the
     * vocab blanks only modulate the reward (see gradeGrammarAnswers). Empty/all-false
     * on the fallback examples that had no locatable pattern.
     */
    isPatternBlank: boolean[];
    /** Per-blank list of accepted answer forms (surface, reading, kanji alternatives, ...), same order as blankWordIndices - resolved once at load time so grading stays synchronous. */
    acceptLists: string[][];
    /** Per-blank English gloss for the hint control, same order as blankWordIndices. Empty string when unavailable. */
    glosses: string[];
    /** True when no word in ANY of the point's examples resolved to a vocab id - nothing gradable, rendered as read-only study material instead of a quiz. */
    readOnly: boolean;
    /**
     * Present only for a conjugation drill (an `inflection` point). When set,
     * the card renders GrammarConjugationCard instead of the sentence cloze, and
     * `exampleIndex` is meaningless - there is no sentence.
     */
    conjugation?: GrammarConjugationPrompt;
    /**
     * Per-blank forms that are ACCEPTED BUT NOT IDEAL, graded `minor_error`
     * instead of `wrong` (same order as blankWordIndices, empty array when none).
     *
     * Used by realization-variant drills: within a variant group, a sibling that
     * differs only by a substitutable particle is genuinely interchangeable and
     * grades `correct`, but one that differs in POLITENESS is the wrong register
     * for the hint the learner was shown - a near miss, not a failure.
     */
    acceptListsMinor?: string[][];
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
}

export interface GrammarQuizState {
    currentGrammarPoint: GrammarPoint | null;
    currentGrammarQuizItem: PendingGrammarQuizItem | null;
    currentGrammarBlankPlan: GrammarBlankPlan | null;
    /** One answer per entry in currentGrammarBlankPlan.blankWordIndices, same order. */
    grammarAnswers: string[];
    /** Per-blank progressive hint level, same order as blankWordIndices: 0 = none, 1 = gloss shown, 2 = answer revealed (grades as 'pass'). */
    grammarHintLevels: number[];
    grammarFeedback: {
        show: boolean;
        correct: boolean; // true only when every blank was strictly correct (drives auto-advance)
        type: AnswerResult; // the grammar point's result: pattern blanks decide it, not worst-of-all
        message: string;
        matchedAnswers: string[]; // same order as blankWordIndices
        perBlankResults: AnswerResult[]; // same order as blankWordIndices - which specific blank(s) were wrong
        /** Coefficient in [floor, 1] applied to the grammar point's strength gain, from how many vocab blanks were right. 1 = full gain. */
        strengthDeltaModifier: number;
        /** Vocab blanks the user got right (non-pattern, not revealed) - fed as positive-only credit to those words' own SRS on continue. */
        vocabCredits: { vocabId: string; result: AnswerResult }[];
    } | null;
    isLoadingGrammar: boolean;
    /** Potential new grammar points, not yet in grammarQueue - mirrors introCandidates. */
    grammarIntroCandidates: GrammarPoint[];
    /** Task set of the active grammar study session (null between sessions). See GrammarSessionTracking. */
    grammarSession: GrammarSessionTracking | null;
    grammarSessionHistory: Array<{
        grammarId: string;
        title: string;
        result: AnswerResult;
        delta: number;
        /** Knowledge points the same answer credited to the sentence's vocabulary via
         *  applyVocabReinforcement. Absent when nothing was reinforced. */
        vocabDelta?: number;
        /** Per-word split of vocabDelta, biggest gain first, for the ticker's hover detail. */
        vocabBreakdown?: { label: string; delta: number }[];
    }>;
}

export const initialGrammarState: GrammarQuizState = {
    currentGrammarPoint: null,
    currentGrammarQuizItem: null,
    currentGrammarBlankPlan: null,
    grammarAnswers: [],
    grammarHintLevels: [],
    grammarFeedback: null,
    isLoadingGrammar: false,
    grammarIntroCandidates: [],
    grammarSession: null,
    grammarSessionHistory: [],
};

export type GrammarQuizAction =
    | { type: 'GRAMMAR_LOAD_START'; payload: PendingGrammarQuizItem }
    | { type: 'GRAMMAR_LOAD_SUCCESS'; payload: { point: GrammarPoint | null; blankPlan: GrammarBlankPlan | null } }
    | { type: 'GRAMMAR_LOAD_ERROR'; payload: { grammarId: string; error: any } }
    | { type: 'GRAMMAR_SET_ANSWER'; payload: { index: number; value: string } }
    | { type: 'GRAMMAR_REVEAL_HINT'; payload: { index: number } }
    | { type: 'GRAMMAR_SUBMIT_ANSWER'; payload: { type: AnswerResult; message: string; matchedAnswers: string[]; perBlankResults: AnswerResult[]; strengthDeltaModifier: number; vocabCredits: { vocabId: string; result: AnswerResult }[] } }
    | { type: 'GRAMMAR_UPDATE_AFTER_ANSWER'; payload: { progress: UserProgress; historyItem?: { grammarId: string; title: string; result: AnswerResult; delta: number; vocabDelta?: number; vocabBreakdown?: { label: string; delta: number }[] } | null } }
    | { type: 'GRAMMAR_ADVANCE_QUEUE'; payload: { progress: UserProgress; candidates?: GrammarPoint[] } }
    | { type: 'GRAMMAR_INTRO_CHOICE'; grammarId: string; choice: 'learn' | 'skip'; grammarPoint?: GrammarPoint }
    | { type: 'GRAMMAR_CLEAR_FEEDBACK' }
    | { type: 'GRAMMAR_SESSION_START'; payload: { grammarIds: string[]; progress?: UserProgress } }
    | { type: 'GRAMMAR_SESSION_END' }
    | { type: 'GRAMMAR_CHAPTER_COMPLETE'; payload: { chapterId: string } }
    | { type: 'GRAMMAR_RESET_PROGRESS'; payload: { progress: UserProgress } };

/** Every grammar action is prefixed GRAMMAR_ so quizReducer can delegate to this module without the two action unions needing to know about each other's cases. */
export function isGrammarAction(action: { type: string }): action is GrammarQuizAction {
    return action.type.startsWith('GRAMMAR_');
}

export function grammarReducer(state: QuizState, action: GrammarQuizAction): QuizState {
    switch (action.type) {
        case 'GRAMMAR_LOAD_START':
            return {
                ...state,
                isLoadingGrammar: true,
                currentGrammarQuizItem: action.payload,
                grammarAnswers: [],
                grammarHintLevels: [],
                grammarFeedback: null,
            };

        case 'GRAMMAR_LOAD_SUCCESS': {
            const blankCount = action.payload.blankPlan?.blankWordIndices.length ?? 0;
            return {
                ...state,
                currentGrammarPoint: action.payload.point,
                currentGrammarBlankPlan: action.payload.blankPlan,
                grammarAnswers: new Array(blankCount).fill(''),
                grammarHintLevels: new Array(blankCount).fill(0),
                isLoadingGrammar: false,
            };
        }

        case 'GRAMMAR_LOAD_ERROR':
            console.error(`[grammarReducer] CRITICAL: Failed to load grammar point ${action.payload.grammarId}`, action.payload.error);
            return {
                ...state,
                isLoadingGrammar: false,
                fatalError: `Failed to load grammar data for ID: ${action.payload.grammarId}. The application data may be corrupted. Please reload or contact support.`,
            };

        case 'GRAMMAR_SET_ANSWER': {
            const answers = [...state.grammarAnswers];
            answers[action.payload.index] = action.payload.value;
            return { ...state, grammarAnswers: answers };
        }

        case 'GRAMMAR_REVEAL_HINT': {
            const levels = [...state.grammarHintLevels];
            const current = levels[action.payload.index] ?? 0;
            const next = Math.min(2, current + 1);
            levels[action.payload.index] = next;

            // Reaching level 2 writes the revealed form into grammarAnswers rather
            // than leaving the card to substitute it at render time. The card used to
            // display `revealed ? acceptLists[i][0] : answers[i]`, so what the learner
            // saw in the input and what the state held disagreed: the input showed the
            // answer while grammarAnswers[i] stayed empty. That divergence is what
            // blocked submission when the last remaining blank was revealed.
            // Grading is unaffected (a revealed blank is forced to 'minor_error' by
            // its hint level, whatever the text says).
            if (next === 2) {
                const revealed = state.currentGrammarBlankPlan?.acceptLists[action.payload.index]?.[0];
                if (revealed) {
                    const answers = [...state.grammarAnswers];
                    answers[action.payload.index] = revealed;
                    return { ...state, grammarHintLevels: levels, grammarAnswers: answers };
                }
            }

            return { ...state, grammarHintLevels: levels };
        }

        case 'GRAMMAR_SUBMIT_ANSWER':
            return {
                ...state,
                grammarFeedback: {
                    show: true,
                    // Auto-advance only when EVERY blank was strictly correct - a
                    // pattern-correct answer with a missed vocab blank still reports
                    // 'correct' as the grammar result, but should pause so the user
                    // can see which word they got wrong before continuing.
                    correct: action.payload.perBlankResults.every(r => r === 'correct'),
                    type: action.payload.type,
                    message: action.payload.message,
                    matchedAnswers: action.payload.matchedAnswers,
                    perBlankResults: action.payload.perBlankResults,
                    strengthDeltaModifier: action.payload.strengthDeltaModifier,
                    vocabCredits: action.payload.vocabCredits,
                },
            };

        case 'GRAMMAR_UPDATE_AFTER_ANSWER':
            return {
                ...state,
                progress: action.payload.progress,
                grammarFeedback: null,
                grammarAnswers: [],
                grammarHintLevels: [],
                grammarSessionHistory: action.payload.historyItem
                    ? [action.payload.historyItem, ...state.grammarSessionHistory].slice(0, 50)
                    : state.grammarSessionHistory,
            };

        case 'GRAMMAR_ADVANCE_QUEUE':
            return {
                ...state,
                progress: action.payload.progress,
                grammarIntroCandidates: action.payload.candidates ?? state.grammarIntroCandidates,
                grammarFeedback: null,
                grammarAnswers: [],
                grammarHintLevels: [],
            };

        case 'GRAMMAR_CLEAR_FEEDBACK':
            return { ...state, grammarFeedback: null };

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
            };

        case 'GRAMMAR_SESSION_END':
            return state.grammarSession ? { ...state, grammarSession: null } : state;

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
                const insertAt = Math.floor(Math.random() * (nextCandidates.length + 1));
                nextCandidates = [
                    ...nextCandidates.slice(0, insertAt),
                    action.grammarPoint,
                    ...nextCandidates.slice(insertAt),
                ];
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
                ...state,
                ...initialGrammarState,
                progress: action.payload.progress,
            };

        default:
            return state;
    }
}
