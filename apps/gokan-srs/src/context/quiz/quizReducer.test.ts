import { describe, it, expect } from 'vitest';
import { quizReducer, initialState, taskKey } from './quizReducer';
import type { QuizState } from './quizReducer';
import type { UserProgress } from '../../models/user.model';
import type { Vocabulary, VocabProgress } from '../../models/vocabulary.model';
import { DEFAULT_VOCABULARY_PROGRESS } from '../../models/vocabulary.model';

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

function makeVocabProgress(overrides: Partial<VocabProgress> = {}): VocabProgress {
    return { ...DEFAULT_VOCABULARY_PROGRESS, vocabId: 'v1', ...overrides };
}

function makeVocab(id = 'v1'): Vocabulary {
    return {
        id,
        writtenForm: { kanji: '日本', alternatives: [], containedKanji: ['日', '本'] },
        reading: { primary: 'にほん', alternatives: [] },
        frequency: { kanjiRank: 1 },
        progression: { kklcStep: 1 },
        senses: [{ pos: ['n'], misc: { rawTags: [] }, glosses: ['Japan'], related: { compounds: [] } }],
    };
}

describe('quizReducer', () => {
    it('SETUP_COMPLETE sets progress and settings', () => {
        const progress = makeProgress();
        const settings = { preferredLearningOrder: 'frequency', enableMeaningQuiz: true, learningFrequency: 'medium' } as any;
        const state = quizReducer(initialState, { type: 'SETUP_COMPLETE', payload: { progress, settings } });

        expect(state.progress).toBe(progress);
        expect(state.settings).toBe(settings);
    });

    it('RESET_DAILY_STATS zeroes newLearnedToday and clears dailyOverride', () => {
        const state: QuizState = {
            ...initialState,
            progress: makeProgress({ stats: { newLearnedToday: 5, totalLearned: 10, totalReviews: 20 }, dailyOverride: true }),
        };
        const next = quizReducer(state, { type: 'RESET_DAILY_STATS' });

        expect(next.progress!.stats.newLearnedToday).toBe(0);
        expect(next.progress!.dailyOverride).toBe(false);
        expect(next.progress!.stats.totalLearned).toBe(10); // untouched
    });

    it('RESET_DAILY_STATS is a no-op without progress', () => {
        const next = quizReducer(initialState, { type: 'RESET_DAILY_STATS' });
        expect(next).toEqual(initialState);
    });

    it('LOAD_VOCAB_START sets loading state and resets sentence/answer/feedback', () => {
        const state: QuizState = { ...initialState, userAnswer: 'stale', feedback: { show: true, correct: true, type: 'correct', message: '', matchedAnswer: '' } };
        const queueItem = { vocabId: 'v1', quizType: 'reading' as const, quizMode: 'base' as const };
        const next = quizReducer(state, { type: 'LOAD_VOCAB_START', payload: queueItem });

        expect(next.isLoadingVocab).toBe(true);
        expect(next.currentQuizItem).toEqual(queueItem);
        expect(next.currentSentences).toBeNull();
        expect(next.currentSentenceId).toBeNull();
        expect(next.userAnswer).toBe('');
        expect(next.feedback).toBeNull();
    });

    it('LOAD_VOCAB_SUCCESS populates vocab/sentences and clears loading', () => {
        const vocab = makeVocab();
        const next = quizReducer(initialState, {
            type: 'LOAD_VOCAB_SUCCESS',
            payload: { vocab, sentences: null, selectedSentenceId: null },
        });

        expect(next.currentVocab).toBe(vocab);
        expect(next.isLoadingVocab).toBe(false);
    });

    it('LOAD_VOCAB_START resets currentProductionCloze and productionHintLevel too', () => {
        const cloze = {
            sentence: { id: 's1', original: '必ず来る', en: [{ id: 'e1', text: 'will certainly come' }], vocabIds: [] },
            blankStart: 0,
            blankLength: 2,
        };
        const state: QuizState = { ...initialState, currentProductionCloze: cloze, productionHintLevel: 2 };
        const queueItem = { vocabId: 'v1', quizType: 'production' as const, quizMode: 'base' as const };
        const next = quizReducer(state, { type: 'LOAD_VOCAB_START', payload: queueItem });

        expect(next.currentProductionCloze).toBeNull();
        expect(next.productionHintLevel).toBe(0);
    });

    it('LOAD_VOCAB_SUCCESS sets currentProductionCloze from the payload', () => {
        const vocab = makeVocab();
        const cloze = {
            sentence: { id: 's1', original: '必ず来る', en: [{ id: 'e1', text: 'will certainly come' }], vocabIds: [] },
            blankStart: 0,
            blankLength: 2,
        };
        const next = quizReducer(initialState, {
            type: 'LOAD_VOCAB_SUCCESS',
            payload: { vocab, sentences: null, selectedSentenceId: null, productionCloze: cloze },
        });

        expect(next.currentProductionCloze).toEqual(cloze);
    });

    it('LOAD_VOCAB_SUCCESS defaults currentProductionCloze to null when omitted (e.g. no queue item)', () => {
        const next = quizReducer(initialState, {
            type: 'LOAD_VOCAB_SUCCESS',
            payload: { vocab: null, sentences: null, selectedSentenceId: null },
        });

        expect(next.currentProductionCloze).toBeNull();
    });

    describe('REVEAL_PRODUCTION_HINT', () => {
        it('advances the hint level by one, starting from 0', () => {
            const next = quizReducer(initialState, { type: 'REVEAL_PRODUCTION_HINT' });
            expect(next.productionHintLevel).toBe(1);
        });

        it('caps at level 2 and does not advance further', () => {
            const state: QuizState = { ...initialState, productionHintLevel: 2 };
            const next = quizReducer(state, { type: 'REVEAL_PRODUCTION_HINT' });
            expect(next.productionHintLevel).toBe(2);
        });

        it('reaching level 2 writes the primary reading into userAnswer', () => {
            const vocab = makeVocab();
            const state: QuizState = { ...initialState, currentVocab: vocab, productionHintLevel: 1, userAnswer: 'partial' };
            const next = quizReducer(state, { type: 'REVEAL_PRODUCTION_HINT' });

            expect(next.productionHintLevel).toBe(2);
            expect(next.userAnswer).toBe(vocab.reading.primary);
        });

        it('does not touch userAnswer before reaching level 2', () => {
            const vocab = makeVocab();
            const state: QuizState = { ...initialState, currentVocab: vocab, productionHintLevel: 0, userAnswer: 'typed' };
            const next = quizReducer(state, { type: 'REVEAL_PRODUCTION_HINT' });

            expect(next.productionHintLevel).toBe(1);
            expect(next.userAnswer).toBe('typed');
        });

        it('is a no-op on userAnswer without a currentVocab even at level 2', () => {
            const state: QuizState = { ...initialState, currentVocab: null, productionHintLevel: 1, userAnswer: 'typed' };
            const next = quizReducer(state, { type: 'REVEAL_PRODUCTION_HINT' });

            expect(next.productionHintLevel).toBe(2);
            expect(next.userAnswer).toBe('typed');
        });
    });

    it('LOAD_VOCAB_ERROR sets a fatalError and clears loading', () => {
        const next = quizReducer(initialState, {
            type: 'LOAD_VOCAB_ERROR',
            payload: { vocabId: 'v1', error: new Error('boom') },
        });

        expect(next.isLoadingVocab).toBe(false);
        expect(next.fatalError).toContain('v1');
    });

    it('SUBMIT_ANSWER sets feedback.correct true only for strict correct', () => {
        const next = quizReducer(initialState, {
            type: 'SUBMIT_ANSWER',
            payload: { type: 'minor_error', message: 'Close.', matchedAnswer: 'x' },
        });

        expect(next.feedback?.show).toBe(true);
        expect(next.feedback?.correct).toBe(false);
        expect(next.feedback?.type).toBe('minor_error');
    });

    it('UPDATE_AFTER_ANSWER updates progress, clears feedback/answer, prepends history, and drops the item from introCandidates', () => {
        const vocab = makeVocab('v1');
        const state: QuizState = {
            ...initialState,
            userAnswer: 'answer',
            feedback: { show: true, correct: true, type: 'correct', message: 'Correct.', matchedAnswer: 'x' },
            introCandidates: [vocab, makeVocab('v2')],
            sessionHistory: [],
        };
        const newProgress = makeProgress();
        const historyItem = { vocabId: 'v1', writtenForm: '日本', result: 'correct' as const, delta: 5 };

        const next = quizReducer(state, { type: 'UPDATE_AFTER_ANSWER', payload: { progress: newProgress, historyItem } });

        expect(next.progress).toBe(newProgress);
        expect(next.feedback).toBeNull();
        expect(next.userAnswer).toBe('');
        expect(next.sessionHistory[0]).toEqual(historyItem);
        expect(next.introCandidates.map(v => v.id)).toEqual(['v2']);
    });

    it('UPDATE_AFTER_ANSWER caps sessionHistory at 50 entries', () => {
        const state: QuizState = {
            ...initialState,
            sessionHistory: Array.from({ length: 50 }, (_, i) => ({ vocabId: `old-${i}`, writtenForm: 'x', result: 'correct' as const, delta: 0 })),
        };
        const next = quizReducer(state, {
            type: 'UPDATE_AFTER_ANSWER',
            payload: { progress: makeProgress(), historyItem: { vocabId: 'new', writtenForm: 'x', result: 'correct', delta: 0 } },
        });

        expect(next.sessionHistory).toHaveLength(50);
        expect(next.sessionHistory[0].vocabId).toBe('new');
    });

    it('SAVE_SETTINGS clears introCandidates when preferredLearningOrder changes', () => {
        const state: QuizState = {
            ...initialState,
            settings: { preferredLearningOrder: 'frequency', kanjiCoverageTarget: 1 } as any,
            introCandidates: [makeVocab()],
        };
        const next = quizReducer(state, {
            type: 'SAVE_SETTINGS',
            payload: { preferredLearningOrder: 'kklc', kanjiCoverageTarget: 1 } as any,
        });

        expect(next.introCandidates).toEqual([]);
    });

    it('SAVE_SETTINGS preserves introCandidates when the learning order is unchanged', () => {
        const candidates = [makeVocab()];
        const state: QuizState = {
            ...initialState,
            settings: { preferredLearningOrder: 'frequency', kanjiCoverageTarget: 1 } as any,
            introCandidates: candidates,
        };
        const next = quizReducer(state, {
            type: 'SAVE_SETTINGS',
            payload: { preferredLearningOrder: 'frequency', kanjiCoverageTarget: 1, enableMeaningQuiz: false } as any,
        });

        expect(next.introCandidates).toBe(candidates);
    });

    it('UPDATE_KANJI_KNOWLEDGE clears introCandidates when the known kanji set changes', () => {
        const state: QuizState = {
            ...initialState,
            progress: makeProgress(),
            introCandidates: [makeVocab()],
            nextKanjiToLearn: { step: 11, kanjis: ['月'] },
        };
        const next = quizReducer(state, {
            type: 'UPDATE_KANJI_KNOWLEDGE',
            payload: { method: 'kklc', step: 10, kanjiSet: new Set(['日', '月']) },
        });

        expect(next.introCandidates).toEqual([]);
        expect(next.nextKanjiToLearn).toBeNull();
        expect(next.progress!.kanjiKnowledge.kanjiSet.has('月')).toBe(true);
    });

    it('UPDATE_KANJI_KNOWLEDGE clears introCandidates when only the step changes', () => {
        const state: QuizState = {
            ...initialState,
            progress: makeProgress(),
            introCandidates: [makeVocab()],
        };
        const next = quizReducer(state, {
            type: 'UPDATE_KANJI_KNOWLEDGE',
            payload: { method: 'kklc', step: 500, kanjiSet: new Set(['日']) },
        });

        expect(next.introCandidates).toEqual([]);
        expect(next.progress!.kanjiKnowledge.step).toBe(500);
    });

    it('UPDATE_KANJI_KNOWLEDGE is a no-op for an unchanged payload (the editor re-fires on mount)', () => {
        const candidates = [makeVocab()];
        const state: QuizState = {
            ...initialState,
            progress: makeProgress(),
            introCandidates: candidates,
        };
        const next = quizReducer(state, {
            type: 'UPDATE_KANJI_KNOWLEDGE',
            payload: { method: 'kklc', step: 10, kanjiSet: new Set(['日']) },
        });

        expect(next).toBe(state);
        expect(next.introCandidates).toBe(candidates);
    });

    it('SESSION_START stores the committed task set', () => {
        const keys = [taskKey('v1', 'reading'), taskKey('v2', 'meaning')];
        const next = quizReducer(initialState, { type: 'SESSION_START', payload: { taskKeys: keys } });
        expect(next.session).toEqual({ committed: keys });
    });

    it('SESSION_START leaves progress untouched when no updated progress is supplied', () => {
        const progress = makeProgress();
        const state: QuizState = { ...initialState, progress };
        const keys = [taskKey('v1', 'reading')];
        const next = quizReducer(state, { type: 'SESSION_START', payload: { taskKeys: keys } });
        expect(next.progress).toBe(progress);
    });

    // issue #36: useQuizOrchestration passes an updated `progress` alongside
    // taskKeys when clearStaleNeedsRetry actually cleared a stale cross-session
    // retry flag colliding with a fresh due review - the reducer just assigns it.
    it('SESSION_START assigns the supplied progress (stale needsRetry already cleared upstream)', () => {
        const state: QuizState = { ...initialState, progress: makeProgress() };
        const clearedProgress = makeProgress({
            learningQueue: [makeVocabProgress({ needsRetry: { reading: false } })],
        });
        const keys = [taskKey('v1', 'reading')];
        const next = quizReducer(state, { type: 'SESSION_START', payload: { taskKeys: keys, progress: clearedProgress } });
        expect(next.progress).toBe(clearedProgress);
        expect(next.session).toEqual({ committed: keys });
    });

    it('SESSION_END clears an active session', () => {
        const state: QuizState = {
            ...initialState,
            session: { committed: [taskKey('v1', 'reading')] },
        };
        const next = quizReducer(state, { type: 'SESSION_END' });
        expect(next.session).toBeNull();
    });

    it('SESSION_END is a no-op (same reference) when there is no active session', () => {
        const next = quizReducer(initialState, { type: 'SESSION_END' });
        expect(next).toBe(initialState);
    });

    it('UPDATE_AFTER_ANSWER leaves the committed session task set untouched', () => {
        const progress = makeProgress();
        const state: QuizState = {
            ...initialState,
            progress,
            session: { committed: [taskKey('v1', 'reading')] },
        };

        const next = quizReducer(state, {
            type: 'UPDATE_AFTER_ANSWER',
            payload: { progress, historyItem: { vocabId: 'v1', writtenForm: '日本', result: 'minor_error', delta: 1 } },
        });
        expect(next.session).toEqual({ committed: [taskKey('v1', 'reading')] });
    });

    it('UPDATE_AFTER_ANSWER leaves session untouched (null) when no session is active', () => {
        const progress = makeProgress();
        const state: QuizState = { ...initialState, progress, session: null };
        const next = quizReducer(state, {
            type: 'UPDATE_AFTER_ANSWER',
            payload: { progress, historyItem: { vocabId: 'v1', writtenForm: '日本', result: 'correct', delta: 5 } },
        });
        expect(next.session).toBeNull();
    });

    it('VOCAB_INTRO_CHOICE "learn" adds the reading task to the active session', () => {
        const state: QuizState = {
            ...initialState,
            progress: makeProgress(),
            introCandidates: [makeVocab('v1')],
            session: { committed: [] },
        };
        const next = quizReducer(state, { type: 'VOCAB_INTRO_CHOICE', vocabId: 'v1', choice: 'learn', vocabulary: makeVocab('v1') });
        expect(next.session?.committed).toEqual([taskKey('v1', 'reading')]);
    });

    it('VOCAB_INTRO_CHOICE "skip" adds nothing to the session (skips graduate immediately)', () => {
        const state: QuizState = {
            ...initialState,
            progress: makeProgress(),
            introCandidates: [makeVocab('v1')],
            session: { committed: [] },
        };
        const next = quizReducer(state, { type: 'VOCAB_INTRO_CHOICE', vocabId: 'v1', choice: 'skip', vocabulary: makeVocab('v1') });
        expect(next.session?.committed).toEqual([]);
    });

    it('VOCAB_INTRO_CHOICE leaves the session untouched when none is active', () => {
        const state: QuizState = {
            ...initialState,
            progress: makeProgress(),
            introCandidates: [makeVocab('v1')],
            session: null,
        };
        const next = quizReducer(state, { type: 'VOCAB_INTRO_CHOICE', vocabId: 'v1', choice: 'learn', vocabulary: makeVocab('v1') });
        expect(next.session).toBeNull();
    });

    it('VOCAB_INTRO_CHOICE appends a new item to the learning queue', () => {
        const state: QuizState = { ...initialState, progress: makeProgress(), introCandidates: [makeVocab('v1')] };
        const next = quizReducer(state, { type: 'VOCAB_INTRO_CHOICE', vocabId: 'v1', choice: 'learn' });

        expect(next.progress!.learningQueue).toHaveLength(1);
        expect(next.progress!.learningQueue[0].vocabId).toBe('v1');
        expect(next.progress!.stats.newLearnedToday).toBe(1);
        expect(next.progress!.stats.totalLearned).toBe(1);
        expect(next.introCandidates).toEqual([]);
    });

    it('VOCAB_INTRO_CHOICE "skip" does not increment newLearnedToday but does increment totalLearned', () => {
        const state: QuizState = { ...initialState, progress: makeProgress(), introCandidates: [makeVocab('v1')] };
        const next = quizReducer(state, { type: 'VOCAB_INTRO_CHOICE', vocabId: 'v1', choice: 'skip' });

        expect(next.progress!.stats.newLearnedToday).toBe(0);
        expect(next.progress!.stats.totalLearned).toBe(1);
        expect(next.progress!.learningQueue[0].stage).toBe('graduated');
    });

    it('VOCAB_INTRO_CHOICE from the detail page (not in introCandidates) inserts the vocab into introCandidates', () => {
        const vocab = makeVocab('detail-add');
        const state: QuizState = { ...initialState, progress: makeProgress(), introCandidates: [] };
        const next = quizReducer(state, { type: 'VOCAB_INTRO_CHOICE', vocabId: 'detail-add', choice: 'learn', vocabulary: vocab });

        expect(next.introCandidates.map(v => v.id)).toEqual(['detail-add']);
    });

    it('VOCAB_INTRO_CHOICE updates an existing queue entry rather than duplicating it, preserving history', () => {
        const existingHistory = [{ date: 1, result: 'correct' as const, interval: 1, latency: 100 }];
        const existing = makeVocabProgress({ vocabId: 'v1', reading: { ...DEFAULT_VOCABULARY_PROGRESS.reading, history: existingHistory } });
        const state: QuizState = { ...initialState, progress: makeProgress({ learningQueue: [existing] }), introCandidates: [makeVocab('v1')] };

        const next = quizReducer(state, { type: 'VOCAB_INTRO_CHOICE', vocabId: 'v1', choice: 'learn' });

        expect(next.progress!.learningQueue).toHaveLength(1);
        expect(next.progress!.learningQueue[0].reading.history).toEqual(existingHistory);
    });

    it('RESET restores the initial state', () => {
        const state: QuizState = { ...initialState, progress: makeProgress(), userAnswer: 'x' };
        const next = quizReducer(state, { type: 'RESET' });
        expect(next).toEqual(initialState);
    });

    it('RECONCILE_REMOTE assigns the already-merged progress/settings without touching in-flight quiz state', () => {
        // The actual merge happens in useQuizOrchestration before this is dispatched -
        // the reducer's job is just to assign the result while leaving whatever the
        // user is doing right now (currentVocab, userAnswer, feedback) untouched, so a
        // background sync can never interrupt an answer in progress.
        const inFlightVocab = { id: 'v1' } as Vocabulary;
        const state: QuizState = {
            ...initialState,
            progress: makeProgress({ stats: { newLearnedToday: 1, totalLearned: 1, totalReviews: 1 } }),
            settings: { preferredLearningOrder: 'frequency' } as any,
            currentVocab: inFlightVocab,
            userAnswer: 'partial-answer',
            feedback: { show: true, correct: false, type: 'wrong', message: 'Incorrect.', matchedAnswer: 'x' },
        };

        const reconciledProgress = makeProgress({ stats: { newLearnedToday: 5, totalLearned: 5, totalReviews: 5 } });
        const reconciledSettings = { preferredLearningOrder: 'kklc' } as any;

        const next = quizReducer(state, {
            type: 'RECONCILE_REMOTE',
            payload: { progress: reconciledProgress, settings: reconciledSettings },
        });

        expect(next.progress).toBe(reconciledProgress);
        expect(next.settings).toBe(reconciledSettings);
        // In-flight quiz state must survive untouched.
        expect(next.currentVocab).toBe(inFlightVocab);
        expect(next.userAnswer).toBe('partial-answer');
        expect(next.feedback).toEqual(state.feedback);
    });
});
