import { describe, it, expect } from 'vitest';
import { initialState, quizReducer, taskKey } from './quizReducer';
import type { QuizState } from './quizReducer';
import type { ExerciseFeedback, ExerciseHost } from './exerciseReducer';
import { DEFAULT_SETTINGS } from '../../models/user.model';
import { grammarExercise, vocabExercise } from '../../services/exercise/builders';
import type { Effect } from '../../services/exercise/effects';
import type { HostItem } from '../../services/exercise/types';
import type { AnswerResult } from '../../utils/answerMatching';
import { answerSlot, grammarExample, grammarPoint, grammarProgress, userProgress, vocabProgress, vocabulary } from '../../test/fixtures';

const now = new Date('2026-06-10T00:00:00Z');

/** A reading card for the vocabulary fixture (日本). */
const readingCard = () => vocabExercise(vocabulary(), { quizType: 'reading', quizMode: 'base' }, { sentence: null, cloze: null });
/** A grammar sentence with a vocab blank (すし) then a pattern blank (が). */
const grammarCard = () => grammarExercise(grammarPoint(), {
    exampleIndex: 0,
    example: grammarExample({ words: [{ surface: 'すし', vocabId: 'v-sushi', reading: 'すし' }, { surface: 'が', vocabId: null }, { surface: '好き', vocabId: null }] }),
    blankWordIndices: [0, 1],
    blankWordSpans: [[0], [1]],
    slots: [answerSlot({ accept: ['すし'], gloss: 'sushi', role: 'support' }), answerSlot({ accept: ['が'] })],
    readOnly: false,
});

const withVocabCard = (state: QuizState = initialState) =>
    quizReducer(state, { type: 'LOAD_VOCAB_SUCCESS', payload: { vocab: vocabulary(), exercise: readingCard() } });
const withGrammarCard = (state: QuizState = initialState) =>
    quizReducer(state, { type: 'GRAMMAR_LOAD_SUCCESS', payload: { point: grammarPoint(), exercise: grammarCard() } });

const setAnswer = (state: QuizState, host: ExerciseHost, index: number, value: string) =>
    quizReducer(state, { type: 'EXERCISE_SET_ANSWER', host, index, value });
const revealHint = (state: QuizState, host: ExerciseHost, index: number, full?: boolean) =>
    quizReducer(state, { type: 'EXERCISE_REVEAL_HINT', host, index, ...(full ? { full } : {}) });
const continueWith = (state: QuizState, host: ExerciseHost, effects: Effect[]) =>
    quizReducer(state, { type: 'EXERCISE_CONTINUE', host, effects, now });

/** Progress studying these words and the grammar fixture's point, each already reviewed once. */
const studying = (...vocabIds: string[]) => userProgress({
    learningQueue: vocabIds.map(vocabId => vocabProgress({ vocabId, totalReviews: 1 })),
    grammarQueue: [grammarProgress({ totalReviews: 1 })],
});
const review = (vocabId: string, result: AnswerResult = 'correct'): Effect => ({
    kind: 'review', item: { kind: 'vocab', vocabId, quizType: 'reading', quizMode: 'base' }, label: '日本', result, strengthModifier: 1, latencyMs: 3000, blankCount: 1,
});
const point: HostItem = { kind: 'grammar', grammarId: 'n5-001' };
const grammarReview: Effect = { kind: 'review', item: point, label: 'A が いちばん～', result: 'correct', strengthModifier: 1, latencyMs: 4000, blankCount: 1 };
const feedbackOf = (effects: Effect[]): ExerciseFeedback => ({
    grade: { slots: [{ result: 'correct', shown: 'にほん' }], overall: 'correct', strengthModifier: 1, autoAdvance: true, message: 'Correct.' },
    effects,
});

describe('exerciseReducer (via quizReducer)', () => {
    it('loading a card sizes its answers and hints to its slots', () => {
        const next = withGrammarCard();
        expect(next.turns.grammar).toMatchObject({ answers: ['', ''], hintLevels: [0, 0], feedback: null, isEvaluating: false });
        expect(next.turns.vocab).toBeNull();
    });

    it('EXERCISE_SET_ANSWER updates only the targeted slot of the targeted activity', () => {
        const state = withVocabCard(withGrammarCard());
        const next = setAnswer(state, 'grammar', 1, 'x');

        expect(next.turns.grammar!.answers).toEqual(['', 'x']);
        expect(next.turns.vocab).toBe(state.turns.vocab);
    });

    it('every exercise action is a no-op without a card on screen', () => {
        expect(setAnswer(initialState, 'vocab', 0, 'x')).toBe(initialState);
        expect(revealHint(initialState, 'grammar', 0)).toBe(initialState);
    });

    describe('EXERCISE_REVEAL_HINT', () => {
        it('shows the gloss first, then the answer, capped there', () => {
            const once = revealHint(withGrammarCard(), 'grammar', 0);
            expect(once.turns.grammar!.hintLevels).toEqual([1, 0]);
            const twice = revealHint(once, 'grammar', 0);
            expect(twice.turns.grammar!.hintLevels).toEqual([2, 0]);
            expect(revealHint(twice, 'grammar', 0).turns.grammar!.hintLevels).toEqual([2, 0]);
        });

        it('writes the revealed form into the answer on reaching the answer, and only then', () => {
            // Regression: the reveal used to be a render-time display value only, so the
            // input showed the answer while state stayed empty. Revealing the last
            // remaining blank then left the card unsubmittable with no way forward.
            const typed = setAnswer(withGrammarCard(), 'grammar', 1, 'typed');
            const gloss = revealHint(typed, 'grammar', 0);
            expect(gloss.turns.grammar!.answers).toEqual(['', 'typed']);
            expect(revealHint(gloss, 'grammar', 0).turns.grammar!.answers).toEqual(['すし', 'typed']);
        });

        it('reveals the answer straight away when asked to in full', () => {
            const next = revealHint(withGrammarCard(), 'grammar', 1, true);
            expect(next.turns.grammar!.hintLevels).toEqual([0, 2]);
            expect(next.turns.grammar!.answers).toEqual(['', 'が']);
        });

        it('reveals a production cloze blank as the sentence writes it', () => {
            const taberu = vocabulary({
                id: 'taberu',
                writtenForm: { kanji: '食べる', alternatives: [], containedKanji: ['食'] },
                reading: { primary: 'たべる', alternatives: [] },
                senses: [{ pos: ['v1'], misc: { rawTags: [] }, glosses: ['to eat'], related: { compounds: [] } }],
            });
            const cloze = { sentence: { id: 's1', original: '野菜を食べたら？', en: [], vocabIds: ['taberu'] }, blankStart: 3, blankLength: 4, blankReading: 'たべたら' };
            const exercise = vocabExercise(taberu, { quizType: 'production', quizMode: 'base' }, { sentence: null, cloze });
            const loaded = quizReducer(initialState, { type: 'LOAD_VOCAB_SUCCESS', payload: { vocab: taberu, exercise } });

            expect(revealHint(loaded, 'vocab', 0, true).turns.vocab!.answers).toEqual(['食べたら']);
        });
    });

    it('EXERCISE_EVALUATING then EXERCISE_SUBMITTED: the feedback is kept and the evaluation ends', () => {
        const evaluating = quizReducer(withVocabCard(), { type: 'EXERCISE_EVALUATING', host: 'vocab' });
        expect(evaluating.turns.vocab!.isEvaluating).toBe(true);

        const feedback = feedbackOf([]);
        const next = quizReducer(evaluating, { type: 'EXERCISE_SUBMITTED', host: 'vocab', feedback });
        expect(next.turns.vocab!.feedback).toBe(feedback);
        expect(next.turns.vocab!.isEvaluating).toBe(false);
    });

    describe('EXERCISE_CONTINUE on a vocab card', () => {
        it('writes the effects, clears the answer for a retry, prepends history, and drops the word from introCandidates', () => {
            const state: QuizState = {
                ...setAnswer(withVocabCard(), 'vocab', 0, 'にほん'),
                progress: studying('v1'),
                introCandidates: [vocabulary({ id: 'v1' }), vocabulary({ id: 'v2' })],
            };
            const next = continueWith(state, 'vocab', [review('v1')]);

            expect(next.progress!.learningQueue[0].reading.memoryStrength).toBeGreaterThan(state.progress!.learningQueue[0].reading.memoryStrength);
            // The same exercise, ready to be answered again: a retry served straight back is not reloaded.
            expect(next.turns.vocab!.exercise).toBe(state.turns.vocab!.exercise);
            expect(next.turns.vocab!.answers).toEqual(['']);
            expect(next.sessionHistory[0]).toMatchObject({ vocabId: 'v1', writtenForm: '日本', result: 'correct' });
            expect(next.introCandidates.map(v => v.id)).toEqual(['v2']);
        });

        it('writes to the CURRENT progress: a reconcile landing after submit is kept', () => {
            const submitted = quizReducer({ ...withVocabCard(), progress: studying('v1') }, {
                type: 'EXERCISE_SUBMITTED', host: 'vocab', feedback: feedbackOf([review('v1')]),
            });
            const reconciled = quizReducer(submitted, { type: 'RECONCILE_REMOTE', payload: { progress: studying('v1', 'from-drive'), settings: DEFAULT_SETTINGS } });

            const next = continueWith(reconciled, 'vocab', submitted.turns.vocab!.feedback!.effects);

            expect(next.progress!.learningQueue.map(v => v.vocabId)).toEqual(['v1', 'from-drive']);
        });

        it('names the tested word in the ticker, crediting the near-synonym typed', () => {
            const retry: Effect = { kind: 'retry', item: { kind: 'vocab', vocabId: 'v1', quizType: 'production', quizMode: 'base' }, label: '狭い', result: 'correct' };
            const credit: Effect = { kind: 'reinforce', vocabId: 'v2', label: '小さい', result: 'correct' };

            const next = continueWith({ ...initialState, progress: studying('v1', 'v2') }, 'vocab', [retry, credit]);

            expect(next.sessionHistory[0]).toMatchObject({ vocabId: 'v1', writtenForm: '狭い', delta: 0 });
            expect(next.sessionHistory[0].vocabBreakdown?.[0].label).toBe('小さい');
            expect(next.sessionGains.vocab).toBe(next.sessionHistory[0].vocabDelta);
        });

        it('caps sessionHistory at 50 entries', () => {
            const state: QuizState = {
                ...initialState,
                progress: studying('new'),
                sessionHistory: Array.from({ length: 50 }, (_, i) => ({ vocabId: `old-${i}`, writtenForm: 'x', result: 'correct' as const, delta: 0 })),
            };
            const next = continueWith(state, 'vocab', [review('new')]);

            expect(next.sessionHistory).toHaveLength(50);
            expect(next.sessionHistory[0].vocabId).toBe('new');
        });

        // issue #80: sessionHistory is capped at 50 for the ticker, but the session
        // point total must keep growing past that - it must NOT be derived by
        // summing the (capped) history array.
        it('accumulates sessionGains past the 50-entry history cap', () => {
            let state: QuizState = { ...initialState, progress: studying('v1') };
            let total = 0;
            for (let i = 0; i < 60; i++) {
                state = continueWith(state, 'vocab', [review('v1')]);
                total += state.sessionHistory[0].delta;
            }

            expect(state.sessionHistory).toHaveLength(50);
            expect(state.sessionGains.net).toBeCloseTo(total, 6);
            expect(state.sessionGains.lost).toBe(0);
        });

        it('splits sessionGains into gained/lost by sign', () => {
            const gained = continueWith({ ...initialState, progress: studying('v1') }, 'vocab', [review('v1', 'correct')]);
            const lost = continueWith(gained, 'vocab', [review('v1', 'wrong')]);
            const [wrong, right] = lost.sessionHistory;

            expect(lost.sessionGains).toEqual({ net: right.delta + wrong.delta, gained: right.delta, lost: -wrong.delta, vocab: 0 });
        });

        it('leaves the committed session task set untouched, and a missing session missing', () => {
            const committed = [taskKey('v1', 'reading')];
            const inSession = continueWith({ ...initialState, progress: studying('v1'), session: { committed } }, 'vocab', [review('v1', 'minor_error')]);
            expect(inSession.session).toEqual({ committed });

            expect(continueWith({ ...initialState, progress: studying('v1') }, 'vocab', [review('v1')]).session).toBeNull();
        });
    });

    describe('EXERCISE_CONTINUE on a grammar card', () => {
        it('writes the effects and clears the answers and hints', () => {
            const state: QuizState = { ...revealHint(setAnswer(withGrammarCard(), 'grammar', 1, 'が'), 'grammar', 0), progress: studying('v-sushi') };
            const next = continueWith(state, 'grammar', [grammarReview]);

            expect(next.progress!.grammarQueue[0].entry.memoryStrength).toBeGreaterThan(state.progress!.grammarQueue[0].entry.memoryStrength);
            expect(next.turns.grammar).toMatchObject({ answers: ['', ''], hintLevels: [0, 0], feedback: null });
        });

        it('prepends the answer to the ticker, with the vocab it credited', () => {
            const next = continueWith({ ...initialState, progress: studying('v-sushi') }, 'grammar', [grammarReview, { kind: 'reinforce', vocabId: 'v-sushi', label: '寿司', result: 'correct' }]);

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
            const next = continueWith(state, 'grammar', [{ kind: 'defer', item: point }]);

            expect(next.grammarSessionHistory).toEqual(state.grammarSessionHistory);
            expect(next.grammarSessionGains).toEqual({ net: 10, gained: 10, lost: 0, vocab: 3 });
        });

        // issue #80, for grammar.
        it('accumulates grammarSessionGains past the 50-entry history cap', () => {
            let state: QuizState = { ...initialState, progress: studying() };
            let total = 0;
            for (let i = 0; i < 60; i++) {
                state = continueWith(state, 'grammar', [grammarReview]);
                total += state.grammarSessionHistory[0].delta;
            }

            expect(state.grammarSessionHistory).toHaveLength(50);
            expect(state.grammarSessionGains.net).toBeCloseTo(total, 6);
        });
    });
});
