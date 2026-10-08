import { describe, it, expect } from 'vitest';
import { initialState, quizReducer } from './quizReducer';
import type { QuizState } from './quizReducer';
import type { GrammarPoint } from '@gokan/dataset-schema';
import { grammarPoint, grammarProgress, userProgress } from '../../test/fixtures';
import { grammarExercise } from '../../services/exercise/builders';
import { newTurn } from './exerciseReducer';

const makeGrammarPoint = (id = 'n5-001'): GrammarPoint => grammarPoint({ id });
/** The fixture point's example, shown to study (nothing in it is blankable). */
const studyCard = () => grammarExercise(grammarPoint(), { exampleIndex: 0, blankWordIndices: [], blankWordSpans: [], slots: [], readOnly: true });

describe('grammarReducer (via quizReducer)', () => {
    it('GRAMMAR_LOAD_START sets isLoadingGrammar and currentGrammarQuizItem, and clears the card on screen', () => {
        const state: QuizState = { ...initialState, turns: { vocab: null, grammar: newTurn(studyCard()) } };
        const next = quizReducer(state, { type: 'GRAMMAR_LOAD_START', payload: { grammarId: 'n5-001' } });

        expect(next.isLoadingGrammar).toBe(true);
        expect(next.currentGrammarQuizItem).toEqual({ grammarId: 'n5-001' });
        expect(next.turns.grammar).toBeNull();
    });

    it('GRAMMAR_LOAD_SUCCESS sets the point and its exercise, ready to answer', () => {
        const point = makeGrammarPoint();
        const exercise = studyCard();
        const next = quizReducer(initialState, { type: 'GRAMMAR_LOAD_SUCCESS', payload: { point, exercise } });

        expect(next.currentGrammarPoint).toBe(point);
        expect(next.turns.grammar).toEqual(newTurn(exercise));
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
