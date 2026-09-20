import { describe, it, expect } from 'vitest';
import { quizReducer, initialState } from './quizReducer';
import type { QuizState } from './quizReducer';
import type { UserProgress } from '../../models/user.model';
import type { GrammarPoint, GrammarProgress } from '../../models/grammar.model';
import { DEFAULT_GRAMMAR_PROGRESS } from '../../models/grammar.model';

function makeProgress(overrides: Partial<UserProgress> = {}): UserProgress {
    return {
        kanjiKnowledge: { method: 'kklc', step: 10, kanjiSet: new Set(['日']) },
        learningQueue: [],
        grammarQueue: [],
        stats: { newLearnedToday: 0, totalLearned: 0, totalReviews: 0 },
        dailyOverride: false,
        adaptive: { level: 1.0, history: [] },
        ...overrides,
    };
}

function makeGrammarProgress(overrides: Partial<GrammarProgress> = {}): GrammarProgress {
    return { ...DEFAULT_GRAMMAR_PROGRESS, grammarId: 'n5-001', ...overrides };
}

function makeGrammarPoint(id = 'n5-001'): GrammarPoint {
    return {
        id,
        title: 'A が いちばん～',
        jlptLevel: 5,
        shortExplanation: 'superlative',
        longExplanation: 'superlative, in detail',
        formation: 'Noun + が + いちばん',
        examples: [{ jp: '寿司が一番好きです。', romaji: 'sushi ga ichiban suki desu', en: 'I like sushi the most.', patternWordIndices: [], words: [] }],
    };
}

describe('grammarReducer (via quizReducer)', () => {
    it('GRAMMAR_LOAD_START sets isLoadingGrammar and currentGrammarQuizItem, clears prior answers/hints/feedback', () => {
        const state: QuizState = {
            ...initialState,
            grammarAnswers: ['stale'],
            grammarHintLevels: [2],
            grammarFeedback: { show: true, correct: true, type: 'correct', message: '', matchedAnswers: [], perBlankResults: [], strengthDeltaModifier: 1, vocabCredits: [] },
        };
        const next = quizReducer(state, { type: 'GRAMMAR_LOAD_START', payload: { grammarId: 'n5-001' } });

        expect(next.isLoadingGrammar).toBe(true);
        expect(next.currentGrammarQuizItem).toEqual({ grammarId: 'n5-001' });
        expect(next.grammarAnswers).toEqual([]);
        expect(next.grammarHintLevels).toEqual([]);
        expect(next.grammarFeedback).toBeNull();
    });

    it('GRAMMAR_LOAD_SUCCESS sets the point/blankPlan and sizes grammarAnswers/grammarHintLevels to the blank count', () => {
        const point = makeGrammarPoint();
        const next = quizReducer(initialState, {
            type: 'GRAMMAR_LOAD_SUCCESS',
            payload: {
                point,
                blankPlan: {
                    exampleIndex: 0,
                    blankWordIndices: [1, 3],
                    blankWordSpans: [[1], [3]],
                    isPatternBlank: [false, false],
                    acceptLists: [['なか'], ['すし']],
                    glosses: ['inside', 'sushi'],
                    readOnly: false,
                },
            },
        });

        expect(next.currentGrammarPoint).toBe(point);
        expect(next.grammarAnswers).toEqual(['', '']);
        expect(next.grammarHintLevels).toEqual([0, 0]);
        expect(next.isLoadingGrammar).toBe(false);
    });

    it('GRAMMAR_LOAD_ERROR sets a fatalError, mirroring LOAD_VOCAB_ERROR', () => {
        const next = quizReducer(initialState, {
            type: 'GRAMMAR_LOAD_ERROR',
            payload: { grammarId: 'n5-001', error: new Error('boom') },
        });

        expect(next.fatalError).toContain('n5-001');
        expect(next.isLoadingGrammar).toBe(false);
    });

    it('GRAMMAR_SET_ANSWER updates only the targeted blank index', () => {
        const state: QuizState = { ...initialState, grammarAnswers: ['a', 'b', 'c'] };
        const next = quizReducer(state, { type: 'GRAMMAR_SET_ANSWER', payload: { index: 1, value: 'x' } });

        expect(next.grammarAnswers).toEqual(['a', 'x', 'c']);
    });

    describe('GRAMMAR_REVEAL_HINT', () => {
        it('increments only the targeted blank, first activation to 1 (gloss)', () => {
            const state: QuizState = { ...initialState, grammarHintLevels: [0, 0] };
            const next = quizReducer(state, { type: 'GRAMMAR_REVEAL_HINT', payload: { index: 0 } });

            expect(next.grammarHintLevels).toEqual([1, 0]);
        });

        it('second activation reaches 2 (revealed)', () => {
            const state: QuizState = { ...initialState, grammarHintLevels: [1, 0] };
            const next = quizReducer(state, { type: 'GRAMMAR_REVEAL_HINT', payload: { index: 0 } });

            expect(next.grammarHintLevels).toEqual([2, 0]);
        });

        it('caps at 2 - a third activation is a no-op', () => {
            const state: QuizState = { ...initialState, grammarHintLevels: [2, 0] };
            const next = quizReducer(state, { type: 'GRAMMAR_REVEAL_HINT', payload: { index: 0 } });

            expect(next.grammarHintLevels).toEqual([2, 0]);
        });

        it('writes the revealed form into grammarAnswers on reaching level 2', () => {
            // Regression: the reveal used to be a render-time display value only, so the
            // input showed the answer while grammarAnswers[i] stayed empty. Revealing the
            // last remaining blank then left the card unsubmittable with no way forward.
            const state: QuizState = {
                ...initialState,
                grammarHintLevels: [1, 0],
                grammarAnswers: ['', 'typed'],
                currentGrammarBlankPlan: {
                    exampleIndex: 0,
                    blankWordIndices: [0, 1],
                    blankWordSpans: [[0], [1]],
                    isPatternBlank: [true, false],
                    acceptLists: [['すし'], ['なか']],
                    glosses: ['sushi', 'inside'],
                    readOnly: false,
                } as QuizState['currentGrammarBlankPlan'],
            };
            const next = quizReducer(state, { type: 'GRAMMAR_REVEAL_HINT', payload: { index: 0 } });

            expect(next.grammarHintLevels).toEqual([2, 0]);
            expect(next.grammarAnswers).toEqual(['すし', 'typed']);
        });

        it('leaves answers untouched when only the gloss (level 1) is shown', () => {
            const state: QuizState = {
                ...initialState,
                grammarHintLevels: [0, 0],
                grammarAnswers: ['', ''],
                currentGrammarBlankPlan: {
                    exampleIndex: 0,
                    blankWordIndices: [0, 1],
                    blankWordSpans: [[0], [1]],
                    isPatternBlank: [true, false],
                    acceptLists: [['すし'], ['なか']],
                    glosses: ['sushi', 'inside'],
                    readOnly: false,
                } as QuizState['currentGrammarBlankPlan'],
            };
            const next = quizReducer(state, { type: 'GRAMMAR_REVEAL_HINT', payload: { index: 0 } });

            expect(next.grammarAnswers).toEqual(['', '']);
        });
    });

    it('GRAMMAR_SUBMIT_ANSWER shows feedback with correct=true only for a strict correct result', () => {
        const next = quizReducer(initialState, {
            type: 'GRAMMAR_SUBMIT_ANSWER',
            payload: { type: 'minor_error', message: 'Close.', matchedAnswers: ['えいが'], perBlankResults: ['minor_error'], strengthDeltaModifier: 1, vocabCredits: [] },
        });

        expect(next.grammarFeedback?.show).toBe(true);
        expect(next.grammarFeedback?.correct).toBe(false);
        expect(next.grammarFeedback?.perBlankResults).toEqual(['minor_error']);
    });

    it('GRAMMAR_UPDATE_AFTER_ANSWER assigns progress and clears feedback/answers/hints', () => {
        const progress = makeProgress({ grammarQueue: [makeGrammarProgress({ totalReviews: 1 })] });
        const state: QuizState = {
            ...initialState,
            grammarFeedback: { show: true, correct: true, type: 'correct', message: '', matchedAnswers: [], perBlankResults: [], strengthDeltaModifier: 1, vocabCredits: [] },
            grammarAnswers: ['x'],
            grammarHintLevels: [2],
        };
        const next = quizReducer(state, { type: 'GRAMMAR_UPDATE_AFTER_ANSWER', payload: { progress } });

        expect(next.progress).toBe(progress);
        expect(next.grammarFeedback).toBeNull();
        expect(next.grammarAnswers).toEqual([]);
        expect(next.grammarHintLevels).toEqual([]);
    });

    it('GRAMMAR_UPDATE_AFTER_ANSWER prepends a historyItem to grammarSessionHistory when provided', () => {
        const progress = makeProgress({ grammarQueue: [makeGrammarProgress({ totalReviews: 1 })] });
        const state: QuizState = { ...initialState, grammarSessionHistory: [] };
        const historyItem = { grammarId: 'n5-001', title: 'A が いちばん～', result: 'correct' as const, delta: 12 };
        const next = quizReducer(state, { type: 'GRAMMAR_UPDATE_AFTER_ANSWER', payload: { progress, historyItem } });

        expect(next.grammarSessionHistory).toEqual([historyItem]);
    });

    it('GRAMMAR_UPDATE_AFTER_ANSWER leaves grammarSessionHistory untouched without a historyItem (the read-only no-credit path)', () => {
        const progress = makeProgress({ grammarQueue: [makeGrammarProgress({ totalReviews: 1 })] });
        const state: QuizState = { ...initialState, grammarSessionHistory: [{ grammarId: 'existing', title: 'x', result: 'correct', delta: 5 }] };
        const next = quizReducer(state, { type: 'GRAMMAR_UPDATE_AFTER_ANSWER', payload: { progress } });

        expect(next.grammarSessionHistory).toEqual(state.grammarSessionHistory);
    });

    describe('GRAMMAR_SESSION_START / GRAMMAR_SESSION_END', () => {
        it('GRAMMAR_SESSION_START snapshots the committed grammar ids', () => {
            const next = quizReducer(initialState, { type: 'GRAMMAR_SESSION_START', payload: { grammarIds: ['n5-001', 'n5-002'] } });
            expect(next.grammarSession).toEqual({ committed: ['n5-001', 'n5-002'] });
        });

        it('GRAMMAR_SESSION_START leaves progress untouched when no updated progress is supplied', () => {
            const progress = makeProgress();
            const state: QuizState = { ...initialState, progress };
            const next = quizReducer(state, { type: 'GRAMMAR_SESSION_START', payload: { grammarIds: ['n5-001'] } });
            expect(next.progress).toBe(progress);
        });

        // issue #36: useGrammarOrchestration passes an updated `progress` alongside
        // grammarIds when clearStaleGrammarNeedsRetry actually cleared a stale
        // cross-session retry flag colliding with a fresh due review - the reducer
        // just assigns it.
        it('GRAMMAR_SESSION_START assigns the supplied progress (stale needsRetry already cleared upstream)', () => {
            const state: QuizState = { ...initialState, progress: makeProgress() };
            const clearedProgress = makeProgress({
                grammarQueue: [makeGrammarProgress({ needsRetry: false })],
            });
            const next = quizReducer(state, {
                type: 'GRAMMAR_SESSION_START',
                payload: { grammarIds: ['n5-001'], progress: clearedProgress },
            });
            expect(next.progress).toBe(clearedProgress);
            expect(next.grammarSession).toEqual({ committed: ['n5-001'] });
        });

        it('GRAMMAR_SESSION_END clears an active session', () => {
            const state: QuizState = { ...initialState, grammarSession: { committed: ['n5-001'] } };
            const next = quizReducer(state, { type: 'GRAMMAR_SESSION_END' });
            expect(next.grammarSession).toBeNull();
        });

        it('GRAMMAR_SESSION_END is a no-op (same reference) when no session is active', () => {
            const next = quizReducer(initialState, { type: 'GRAMMAR_SESSION_END' });
            expect(next).toBe(initialState);
        });
    });

    it('GRAMMAR_ADVANCE_QUEUE assigns progress and appends candidates when provided', () => {
        const progress = makeProgress();
        const point = makeGrammarPoint();
        const next = quizReducer(initialState, {
            type: 'GRAMMAR_ADVANCE_QUEUE',
            payload: { progress, candidates: [point] },
        });

        expect(next.progress).toBe(progress);
        expect(next.grammarIntroCandidates).toEqual([point]);
    });

    describe('GRAMMAR_INTRO_CHOICE', () => {
        it('learn: appends a new GrammarProgress with nextReviewAt set to now', () => {
            const state: QuizState = { ...initialState, progress: makeProgress() };
            const next = quizReducer(state, { type: 'GRAMMAR_INTRO_CHOICE', grammarId: 'n5-001', choice: 'learn' });

            const added = next.progress!.grammarQueue.find(g => g.grammarId === 'n5-001');
            expect(added).toBeDefined();
            expect(added!.nextReviewAt).not.toBeNull();
            expect(added!.stage).toBe('learning');
        });

        it('skip: appends a graduated GrammarProgress', () => {
            const state: QuizState = { ...initialState, progress: makeProgress() };
            const next = quizReducer(state, { type: 'GRAMMAR_INTRO_CHOICE', grammarId: 'n5-001', choice: 'skip' });

            const added = next.progress!.grammarQueue.find(g => g.grammarId === 'n5-001');
            expect(added!.stage).toBe('graduated');
        });

        it('removes the point from grammarIntroCandidates when it was already there', () => {
            const point = makeGrammarPoint();
            const state: QuizState = {
                ...initialState,
                progress: makeProgress(),
                grammarIntroCandidates: [point],
            };
            const next = quizReducer(state, { type: 'GRAMMAR_INTRO_CHOICE', grammarId: point.id, choice: 'learn', grammarPoint: point });

            expect(next.grammarIntroCandidates).toEqual([]);
        });

        it('inserts an out-of-band grammarPoint (detail-page style "learn") into candidates rather than requiring it be there first', () => {
            const point = makeGrammarPoint('n5-999');
            const state: QuizState = { ...initialState, progress: makeProgress(), grammarIntroCandidates: [] };
            const next = quizReducer(state, { type: 'GRAMMAR_INTRO_CHOICE', grammarId: point.id, choice: 'learn', grammarPoint: point });

            expect(next.grammarIntroCandidates).toEqual([point]);
        });

        it('is a no-op without progress', () => {
            const next = quizReducer(initialState, { type: 'GRAMMAR_INTRO_CHOICE', grammarId: 'n5-001', choice: 'learn' });
            expect(next).toBe(initialState);
        });

        it('learn with an active session adds the grammarId to grammarSession.committed', () => {
            const state: QuizState = { ...initialState, progress: makeProgress(), grammarSession: { committed: [] } };
            const next = quizReducer(state, { type: 'GRAMMAR_INTRO_CHOICE', grammarId: 'n5-001', choice: 'learn' });

            expect(next.grammarSession).toEqual({ committed: ['n5-001'] });
        });

        it('skip with an active session does not add the grammarId', () => {
            const state: QuizState = { ...initialState, progress: makeProgress(), grammarSession: { committed: [] } };
            const next = quizReducer(state, { type: 'GRAMMAR_INTRO_CHOICE', grammarId: 'n5-001', choice: 'skip' });

            expect(next.grammarSession).toEqual({ committed: [] });
        });

        it('learn without an active session leaves grammarSession null', () => {
            const state: QuizState = { ...initialState, progress: makeProgress(), grammarSession: null };
            const next = quizReducer(state, { type: 'GRAMMAR_INTRO_CHOICE', grammarId: 'n5-001', choice: 'learn' });

            expect(next.grammarSession).toBeNull();
        });
    });
});
