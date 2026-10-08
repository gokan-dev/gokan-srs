import { describe, it, expect } from 'vitest';
import { initialState, quizReducer } from './quizReducer';
import type { QuizState } from './quizReducer';
import type { GrammarPoint } from '@gokan/dataset-schema';
import { answerSlot, grammarPoint, grammarProgress, userProgress, vocabProgress } from '../../test/fixtures';
import type { Effect } from '../../services/exercise/effects';
import type { HostItem } from '../../services/exercise/types';

const makeGrammarPoint = (id = 'n5-001'): GrammarPoint => grammarPoint({ id });
/** A pattern blank (すし) then a vocab blank (なか). */
const twoSlots = () => [answerSlot({ accept: ['すし'], gloss: 'sushi' }), answerSlot({ accept: ['なか'], gloss: 'inside', role: 'support' })];

describe('grammarReducer (via quizReducer)', () => {
    it('GRAMMAR_LOAD_START sets isLoadingGrammar and currentGrammarQuizItem, clears prior answers/hints/feedback', () => {
        const state: QuizState = {
            ...initialState,
            grammarAnswers: ['stale'],
            grammarHintLevels: [2],
            grammarFeedback: { show: true, correct: true, type: 'correct', message: '', matchedAnswers: [], perBlankResults: [], effects: [] },
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
                    slots: [answerSlot({ accept: ['なか'], gloss: 'inside' }), answerSlot({ accept: ['すし'], gloss: 'sushi' })],
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
                    slots: twoSlots(),
                    readOnly: false,
                },
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
                    slots: twoSlots(),
                    readOnly: false,
                },
            };
            const next = quizReducer(state, { type: 'GRAMMAR_REVEAL_HINT', payload: { index: 0 } });

            expect(next.grammarAnswers).toEqual(['', '']);
        });
    });

    it('GRAMMAR_SUBMIT_ANSWER shows feedback with correct=true only for a strict correct result', () => {
        const next = quizReducer(initialState, {
            type: 'GRAMMAR_SUBMIT_ANSWER',
            payload: { type: 'minor_error', message: 'Close.', matchedAnswers: ['えいが'], perBlankResults: ['minor_error'], effects: [] },
        });

        expect(next.grammarFeedback?.show).toBe(true);
        expect(next.grammarFeedback?.correct).toBe(false);
        expect(next.grammarFeedback?.perBlankResults).toEqual(['minor_error']);
    });

    describe('GRAMMAR_UPDATE_AFTER_ANSWER', () => {
        const now = new Date('2026-06-10T00:00:00Z');
        const point: HostItem = { kind: 'grammar', grammarId: 'n5-001' };
        const review: Effect = { kind: 'review', item: point, label: 'A が いちばん～', result: 'correct', strengthModifier: 1, latencyMs: 4000, blankCount: 1 };
        const studying = () => userProgress({
            grammarQueue: [grammarProgress({ totalReviews: 1 })],
            learningQueue: [vocabProgress({ vocabId: 'v-sushi', totalReviews: 1 })],
        });
        const update = (state: QuizState, effects: Effect[]) => quizReducer(state, { type: 'GRAMMAR_UPDATE_AFTER_ANSWER', payload: { effects, now } });

        it('writes the effects and clears feedback/answers/hints', () => {
            const state: QuizState = {
                ...initialState,
                progress: studying(),
                grammarFeedback: { show: true, correct: true, type: 'correct', message: '', matchedAnswers: [], perBlankResults: [], effects: [review] },
                grammarAnswers: ['x'],
                grammarHintLevels: [2],
            };
            const next = update(state, [review]);

            expect(next.progress!.grammarQueue[0].entry.memoryStrength).toBeGreaterThan(state.progress!.grammarQueue[0].entry.memoryStrength);
            expect(next.grammarFeedback).toBeNull();
            expect(next.grammarAnswers).toEqual([]);
            expect(next.grammarHintLevels).toEqual([]);
        });

        it('prepends the answer to the ticker, with the vocab it credited', () => {
            const next = update({ ...initialState, progress: studying() }, [review, { kind: 'reinforce', vocabId: 'v-sushi', label: '寿司', result: 'correct' }]);

            expect(next.grammarSessionHistory[0]).toMatchObject({ grammarId: 'n5-001', title: 'A が いちばん～', result: 'correct' });
            expect(next.grammarSessionHistory[0].vocabBreakdown?.[0].label).toBe('寿司');
            expect(next.grammarSessionGains.vocab).toBe(next.grammarSessionHistory[0].vocabDelta);
        });

        it('leaves the ticker and the gains untouched on the study card (no credit)', () => {
            const state: QuizState = {
                ...initialState,
                progress: studying(),
                grammarSessionHistory: [{ grammarId: 'existing', title: 'x', result: 'correct', delta: 5 }],
                grammarSessionGains: { net: 10, gained: 10, lost: 0, vocab: 3 },
            };
            const next = update(state, [{ kind: 'defer', item: point }]);

            expect(next.grammarSessionHistory).toEqual(state.grammarSessionHistory);
            expect(next.grammarSessionGains).toEqual({ net: 10, gained: 10, lost: 0, vocab: 3 });
        });

        // issue #80: grammarSessionHistory is capped at 50 for the ticker, but the
        // session point total must keep growing past that.
        it('accumulates grammarSessionGains past the 50-entry history cap', () => {
            let state: QuizState = { ...initialState, progress: studying() };
            let total = 0;
            for (let i = 0; i < 60; i++) {
                state = update(state, [review]);
                total += state.grammarSessionHistory[0].delta;
            }

            expect(state.grammarSessionHistory).toHaveLength(50);
            expect(state.grammarSessionGains.net).toBeCloseTo(total, 6);
        });
    });

    describe('GRAMMAR_SESSION_START / GRAMMAR_SESSION_END', () => {
        it('GRAMMAR_SESSION_START snapshots the committed grammar ids', () => {
            const next = quizReducer(initialState, { type: 'GRAMMAR_SESSION_START', payload: { grammarIds: ['n5-001', 'n5-002'] } });
            expect(next.grammarSession).toEqual({ committed: ['n5-001', 'n5-002'] });
        });

        it('GRAMMAR_SESSION_START leaves progress untouched when no updated progress is supplied', () => {
            const progress = userProgress();
            const state: QuizState = { ...initialState, progress };
            const next = quizReducer(state, { type: 'GRAMMAR_SESSION_START', payload: { grammarIds: ['n5-001'] } });
            expect(next.progress).toBe(progress);
        });

        // issue #36: useGrammarOrchestration passes an updated `progress` alongside
        // grammarIds when clearStaleGrammarNeedsRetry actually cleared a stale
        // cross-session retry flag colliding with a fresh due review - the reducer
        // just assigns it.
        it('GRAMMAR_SESSION_START assigns the supplied progress (stale needsRetry already cleared upstream)', () => {
            const state: QuizState = { ...initialState, progress: userProgress() };
            const clearedProgress = userProgress({
                grammarQueue: [grammarProgress({ needsRetry: false })],
            });
            const next = quizReducer(state, {
                type: 'GRAMMAR_SESSION_START',
                payload: { grammarIds: ['n5-001'], progress: clearedProgress },
            });
            expect(next.progress).toBe(clearedProgress);
            expect(next.grammarSession).toEqual({ committed: ['n5-001'] });
        });

        it('GRAMMAR_SESSION_START resets grammarSessionGains to zero', () => {
            const state: QuizState = {
                ...initialState,
                grammarSessionGains: { net: 42, gained: 42, lost: 0, vocab: 8 },
            };
            const next = quizReducer(state, { type: 'GRAMMAR_SESSION_START', payload: { grammarIds: ['n5-001'] } });
            expect(next.grammarSessionGains).toEqual({ net: 0, gained: 0, lost: 0, vocab: 0 });
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

    describe('GRAMMAR_SESSION_SUSPEND / GRAMMAR_SESSION_RESUME', () => {
        const history = [{ grammarId: 'n5-001', title: 'けど', result: 'correct' as const, delta: 6 }];
        const running: QuizState = {
            ...initialState,
            grammarSession: { committed: ['n5-001', 'n5-002'] },
            grammarSessionHistory: history,
            grammarSessionGains: { net: 6, gained: 6, lost: 0, vocab: 0 },
        };

        it('suspend stamps the pause and keeps the committed set, history and gains', () => {
            const next = quizReducer(running, { type: 'GRAMMAR_SESSION_SUSPEND', payload: { now: 42 } });
            expect(next.grammarSession).toEqual({ committed: ['n5-001', 'n5-002'], suspendedAt: 42 });
            expect(next.grammarSessionHistory).toBe(history);
            expect(next.grammarSessionGains).toBe(running.grammarSessionGains);
        });

        it('resume clears the pause and keeps history and gains', () => {
            const paused = quizReducer(running, { type: 'GRAMMAR_SESSION_SUSPEND', payload: { now: 42 } });
            const next = quizReducer(paused, { type: 'GRAMMAR_SESSION_RESUME' });
            expect(next.grammarSession).toEqual({ committed: ['n5-001', 'n5-002'] });
            expect(next.grammarSessionHistory).toBe(history);
        });

        it('both are no-ops when there is nothing to pause or resume', () => {
            expect(quizReducer(initialState, { type: 'GRAMMAR_SESSION_SUSPEND', payload: { now: 1 } })).toBe(initialState);
            expect(quizReducer(running, { type: 'GRAMMAR_SESSION_RESUME' })).toBe(running);
        });
    });

    describe('GRAMMAR_CHAPTER_COMPLETE', () => {
        it('appends the chapter id to completedChapters', () => {
            const state: QuizState = { ...initialState, progress: userProgress({ completedChapters: ['c00'] }) };
            const next = quizReducer(state, { type: 'GRAMMAR_CHAPTER_COMPLETE', payload: { chapterId: 'c01' } });
            expect(next.progress!.completedChapters).toEqual(['c00', 'c01']);
        });

        it('is a no-op (same reference) when the chapter is already recorded', () => {
            const state: QuizState = { ...initialState, progress: userProgress({ completedChapters: ['c01'] }) };
            const next = quizReducer(state, { type: 'GRAMMAR_CHAPTER_COMPLETE', payload: { chapterId: 'c01' } });
            expect(next).toBe(state);
        });

        it('is a no-op when there is no progress to update', () => {
            const next = quizReducer(initialState, { type: 'GRAMMAR_CHAPTER_COMPLETE', payload: { chapterId: 'c01' } });
            expect(next).toBe(initialState);
        });
    });

    it('GRAMMAR_ADVANCE_QUEUE assigns progress and appends candidates when provided', () => {
        const progress = userProgress();
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
            const state: QuizState = { ...initialState, progress: userProgress() };
            const next = quizReducer(state, { type: 'GRAMMAR_INTRO_CHOICE', grammarId: 'n5-001', choice: 'learn' });

            const added = next.progress!.grammarQueue.find(g => g.grammarId === 'n5-001');
            expect(added).toBeDefined();
            expect(added!.nextReviewAt).not.toBeNull();
            expect(added!.stage).toBe('learning');
        });

        it('skip: appends a graduated GrammarProgress', () => {
            const state: QuizState = { ...initialState, progress: userProgress() };
            const next = quizReducer(state, { type: 'GRAMMAR_INTRO_CHOICE', grammarId: 'n5-001', choice: 'skip' });

            const added = next.progress!.grammarQueue.find(g => g.grammarId === 'n5-001');
            expect(added!.stage).toBe('graduated');
        });

        it('removes the point from grammarIntroCandidates when it was already there', () => {
            const point = makeGrammarPoint();
            const state: QuizState = {
                ...initialState,
                progress: userProgress(),
                grammarIntroCandidates: [point],
            };
            const next = quizReducer(state, { type: 'GRAMMAR_INTRO_CHOICE', grammarId: point.id, choice: 'learn', grammarPoint: point });

            expect(next.grammarIntroCandidates).toEqual([]);
        });

        it('inserts an out-of-band grammarPoint (detail-page style "learn") into candidates rather than requiring it be there first', () => {
            const point = makeGrammarPoint('n5-999');
            const state: QuizState = { ...initialState, progress: userProgress(), grammarIntroCandidates: [] };
            const next = quizReducer(state, { type: 'GRAMMAR_INTRO_CHOICE', grammarId: point.id, choice: 'learn', grammarPoint: point });

            expect(next.grammarIntroCandidates).toEqual([point]);
        });

        it('is a no-op without progress', () => {
            const next = quizReducer(initialState, { type: 'GRAMMAR_INTRO_CHOICE', grammarId: 'n5-001', choice: 'learn' });
            expect(next).toBe(initialState);
        });

        it('learn with an active session adds the grammarId to grammarSession.committed', () => {
            const state: QuizState = { ...initialState, progress: userProgress(), grammarSession: { committed: [] } };
            const next = quizReducer(state, { type: 'GRAMMAR_INTRO_CHOICE', grammarId: 'n5-001', choice: 'learn' });

            expect(next.grammarSession).toEqual({ committed: ['n5-001'] });
        });

        it('skip with an active session does not add the grammarId', () => {
            const state: QuizState = { ...initialState, progress: userProgress(), grammarSession: { committed: [] } };
            const next = quizReducer(state, { type: 'GRAMMAR_INTRO_CHOICE', grammarId: 'n5-001', choice: 'skip' });

            expect(next.grammarSession).toEqual({ committed: [] });
        });

        it('learn without an active session leaves grammarSession null', () => {
            const state: QuizState = { ...initialState, progress: userProgress(), grammarSession: null };
            const next = quizReducer(state, { type: 'GRAMMAR_INTRO_CHOICE', grammarId: 'n5-001', choice: 'learn' });

            expect(next.grammarSession).toBeNull();
        });
    });
});
