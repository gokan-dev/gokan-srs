import { describe, it, expect } from 'vitest';
import { applyEffects, effectsOf } from './effects';
import type { Effect } from './effects';
import { gradeExercise, SUPPORT_COEFFICIENT_FLOOR } from './grading';
import { wordSlot } from './slots';
import type { AnswerSlot, Exercise, HostItem, SynonymCandidate, WordForms } from './types';
import { SRSService } from '../srs.service';
import type { AnswerResult } from '../../utils/answerMatching';
import { CONSTANTS } from '../../commons/constants';
import type { VocabProgress } from '../../models/vocabulary.model';
import { answerSlot, grammarProgress, srsEntry, userProgress, userSettings, vocabProgress } from '../../test/fixtures';

const now = new Date('2026-06-10T00:00:00Z');
const settings = userSettings({ learningFrequency: 'medium', enableMeaningQuiz: true, enableProductionQuiz: true });

/** A studied word whose three directions are active, so the seed-first path is not what a test exercises. */
function word(vocabId: string, overrides: Partial<VocabProgress> = {}): VocabProgress {
    const entry = () => srsEntry({ memoryStrength: 100, interval: 1, difficulty: 0.5, dueDate: now });
    return vocabProgress({
        vocabId, introductionAt: new Date('2026-06-01T00:00:00Z'), nextReviewAt: now, totalReviews: 1,
        reading: entry(), meaning: entry(), production: entry(), ...overrides,
    });
}

const forms = (kanji: string, reading: string): WordForms => ({
    reading: { primary: reading, alternatives: [] }, writtenForm: { kanji, alternatives: [], containedKanji: [] },
});
const chiisai: SynonymCandidate = { vocabId: 'chiisai', relation: 'interchangeable', vocab: forms('小さい', 'ちいさい'), shared: ['small'] };

const semaiItem: HostItem = { kind: 'vocab', vocabId: 'semai', quizType: 'production', quizMode: 'base' };
/** A production card for 狭い (せまい) whose cue decides whether 小さい answers it. */
function semaiCard(sentence: string): Exercise {
    return {
        kind: 'production',
        host: semaiItem,
        label: '狭い',
        slots: [wordSlot(forms('狭い', 'せまい'), { vocabId: 'semai', otherForm: 'correct', role: 'core', synonyms: [chiisai] })],
        cue: { sentence },
    };
}
type Answered = Parameters<typeof effectsOf>[0] & Parameters<typeof gradeExercise>[0];
const answer = (exercise: Answered, answers: string[], hintLevels: number[] = answers.map(() => 0)) =>
    effectsOf(exercise, gradeExercise(exercise, answers, hintLevels), { latencyMs: 4000, hintLevels });

describe('effectsOf', () => {
    it('reviews the asked word on an ordinary answer', () => {
        const [effect, ...rest] = answer(semaiCard('The street is narrow.'), ['せまい']);
        expect(effect).toMatchObject({ kind: 'review', item: semaiItem, result: 'correct', latencyMs: 4000 });
        expect(rest).toEqual([]);
    });

    it('retries the asked word and credits the one typed when a synonym answers the card', () => {
        expect(answer(semaiCard('Japan is a small country.'), ['小さい'])).toEqual([
            { kind: 'retry', item: semaiItem, label: '狭い', result: 'correct' },
            { kind: 'reinforce', vocabId: 'chiisai', label: '小さい', result: 'correct' },
        ]);
    });

    it('retries without crediting anyone when the synonym does not fit the card', () => {
        expect(answer(semaiCard('The street is narrow.'), ['小さい'])).toEqual([
            { kind: 'retry', item: semaiItem, label: '狭い', result: 'wrong' },
        ]);
    });

    describe('on a grammar card', () => {
        const point: HostItem = { kind: 'grammar', grammarId: 'n5-001' };
        const pattern = answerSlot({ accept: ['が'] });
        const blank = (vocabId: string, accept: string) => ({ ...answerSlot({ accept: [accept], role: 'support' }), word: { vocabId, label: accept, headword: accept, lemma: null, otherForm: 'minor_error' as const, synonyms: [] } });
        const card = (slots: AnswerSlot[]): Answered => ({ kind: 'grammar-cloze', host: point, label: 'A が いちばん', slots, cue: {} });

        it('reviews the point and credits the vocab blanks answered right, once per word', () => {
            const effects = answer(card([pattern, blank('sushi', 'すし'), blank('naka', 'なか'), blank('sushi', 'すし')]), ['が', 'すし', 'ねこ', 'すし']);
            expect(effects.map(e => e.kind)).toEqual(['review', 'reinforce']);
            expect(effects[1]).toMatchObject({ vocabId: 'sushi', result: 'correct' });
            const [asked] = effects;
            expect(asked.kind === 'review' && asked.blankCount).toBe(4);
            // Two of the three vocab blanks right.
            expect(asked.kind === 'review' && asked.strengthModifier).toBeCloseTo(SUPPORT_COEFFICIENT_FLOOR + (1 - SUPPORT_COEFFICIENT_FLOOR) * (2 / 3));
        });

        it('credits nothing for a blank whose hint was revealed: it was read, not produced', () => {
            const effects = answer(card([pattern, blank('sushi', 'すし')]), ['が', 'すし'], [0, 2]);
            expect(effects.map(e => e.kind)).toEqual(['review']);
        });

        it('credits the word typed, never the blank\'s word, for a near-synonym that fits the sentence', () => {
            const semaiBlank = wordSlot(forms('狭い', 'せまい'), { vocabId: 'semai', otherForm: 'minor_error', role: 'support', synonyms: [chiisai] });
            const effects = answer({ ...card([pattern, semaiBlank]), cue: { sentence: 'Japan is a small country.' } }, ['が', '小さい']);

            expect(effects.map(e => e.kind)).toEqual(['review', 'reinforce']);
            expect(effects[1]).toEqual({ kind: 'reinforce', vocabId: 'chiisai', label: '小さい', result: 'correct' });
            // Answered right, so the vocab blank does not discount the point's reward.
            const [asked] = effects;
            expect(asked.kind === 'review' && asked.strengthModifier).toBe(1);
        });

        it('retries the point when every deciding blank was a confusable near-synonym', () => {
            const decider = { ...wordSlot(forms('狭い', 'せまい'), { vocabId: 'semai', otherForm: 'minor_error', role: 'core', synonyms: [chiisai] }) };
            const effects = answer(card([decider]), ['小さい']);
            expect(effects).toEqual([{ kind: 'retry', item: point, label: 'A が いちばん', result: 'wrong' }]);
        });
    });

    it('only defers the study card: nothing was asked', () => {
        const point: HostItem = { kind: 'grammar', grammarId: 'n5-001' };
        expect(answer({ kind: 'study', host: point, label: 'A が いちばん', slots: [], cue: {} }, [])).toEqual([{ kind: 'defer', item: point }]);
    });
});

describe('applyEffects', () => {
    const review = (result: AnswerResult): Effect =>
        ({ kind: 'review', item: semaiItem, label: '狭い', result, strengthModifier: 1, latencyMs: 4000, blankCount: 1 });
    const reinforce = (vocabId: string, result: 'correct' | 'minor_error' = 'correct'): Effect => ({ kind: 'reinforce', vocabId, label: vocabId, result });
    const retry: Effect = { kind: 'retry', item: semaiItem, label: '狭い', result: 'correct' };

    it('reviews the asked word, counts the answer and records its mastery change', () => {
        const progress = userProgress({ learningQueue: [word('semai')] });
        const { progress: next, record } = applyEffects(progress, [review('correct')], { now, settings });

        expect(next.learningQueue[0].production!.memoryStrength).toBeGreaterThan(100);
        expect(next.stats.totalReviews).toBe(1);
        expect(record).toMatchObject({ item: semaiItem, label: '狭い', result: 'correct', vocabDelta: 0 });
        expect(record!.delta).toBeGreaterThan(0);
    });

    it('records a calibrated review only for a review, never for a retry or a credit', () => {
        const progress = userProgress({ learningQueue: [word('semai'), word('chiisai')] });
        const reviewed = applyEffects(progress, [review('correct')], { now, settings }).progress;
        const retried = applyEffects(progress, [retry, reinforce('chiisai')], { now, settings }).progress;

        expect(reviewed.calibration!.production.history).toHaveLength(1);
        expect(retried.calibration!.production.history).toHaveLength(0);
    });

    it('retries without credit: strength untouched, the direction flagged, the due date settled', () => {
        const progress = userProgress({ learningQueue: [word('semai')] });
        const { progress: next, record } = applyEffects(progress, [retry], { now, settings });

        expect(next.learningQueue[0].production!.memoryStrength).toBe(100);
        expect(next.learningQueue[0].needsRetry?.production).toBe(true);
        expect(next.learningQueue[0].production!.dueDate!.getTime()).toBeGreaterThan(now.getTime());
        expect(record).toMatchObject({ delta: 0 });
    });

    it('credits the word typed on the first synonym answer, and nothing on the retry loop', () => {
        // Answering the retry with the synonym again must not farm its credit: the
        // asked word is already flagged, and indirect credit is never granted on a retry.
        const first = applyEffects(userProgress({ learningQueue: [word('semai'), word('chiisai')] }), [retry, reinforce('chiisai')], { now, settings });
        expect(first.record!.vocabDelta).toBeGreaterThan(0);
        expect(first.record!.vocabBreakdown).toEqual([{ label: 'chiisai', delta: first.record!.vocabDelta }]);

        const second = applyEffects(first.progress, [retry, reinforce('chiisai')], { now, settings });
        expect(second.progress.learningQueue[1]).toBe(first.progress.learningQueue[1]);
        expect(second.record!.vocabDelta).toBe(0);
    });

    describe('indirect credit (reinforce)', () => {
        const point: HostItem = { kind: 'grammar', grammarId: 'n5-001' };
        const grammarReview: Effect = { kind: 'review', item: point, label: 'A が いちばん', result: 'correct', strengthModifier: 1, latencyMs: 4000, blankCount: 2 };
        const run = (queue: VocabProgress[], effects: Effect[], s = settings) =>
            applyEffects(userProgress({ learningQueue: queue, grammarQueue: [grammarProgress({ grammarId: 'n5-001', totalReviews: 1 })] }), [grammarReview, ...effects], { now, settings: s });

        it('boosts only the PRODUCTION entry of the credited word, tagged so calibration skips it', () => {
            // Filling a blank is English in, Japanese out: production, never reading.
            const { progress } = run([word('v-1'), word('v-2')], [reinforce('v-1')]);
            const [v1, v2] = progress.learningQueue;
            expect(v1.production!.memoryStrength).toBeGreaterThan(100);
            expect(v1.reading.memoryStrength).toBe(100);
            expect(v1.meaning.memoryStrength).toBe(100);
            const log = v1.production!.history;
            expect(log[log.length - 1].source).toBe('reinforcement');
            expect(v2.production!.memoryStrength).toBe(100);
        });

        it('credits less than a real production answer would, for the same result', () => {
            const queue = [word('v-1')];
            const reinforced = run(queue, [reinforce('v-1')]).progress.learningQueue[0];
            const full = SRSService.applyAnswer(queue[0], 'production', 'base', 'correct', CONSTANTS.srs.quizProperties.production.expectedLatency, now).updated;
            expect(reinforced.production!.memoryStrength).toBeLessThan(full.production!.memoryStrength);
        });

        it('seeds an unactivated production entry before crediting it', () => {
            const inert = word('v-1', {
                meaning: srsEntry({ memoryStrength: 400, interval: 1, difficulty: 0.5, dueDate: now }),
                production: srsEntry({ memoryStrength: 1, interval: 0, difficulty: 0.5, dueDate: null }),
            });
            const credited = run([inert], [reinforce('v-1')]).progress.learningQueue[0];
            expect(credited.production!.memoryStrength).toBeGreaterThan(400 * CONSTANTS.srs.production.seedStrengthRatio);
            expect(credited.production!.dueDate).not.toBeNull();
        });

        it('does nothing when production quizzes are disabled, or for a word not being studied', () => {
            const queue = [word('v-1')];
            expect(run(queue, [reinforce('v-1')], userSettings({ enableProductionQuiz: false })).progress.learningQueue[0]).toBe(queue[0]);
            expect(run(queue, [reinforce('v-missing')]).progress.learningQueue[0]).toBe(queue[0]);
        });

        it('lists the credited words on the record, biggest gain first, summing to its vocab delta', () => {
            const strong = word('strong', { production: srsEntry({ memoryStrength: 300, interval: 5, difficulty: 0.5, dueDate: now }) });
            const { record } = run([strong, word('weak')], [reinforce('strong'), reinforce('weak')]);
            const deltas = record!.vocabBreakdown.map(b => b.delta);
            expect(deltas).toHaveLength(2);
            expect(deltas).toEqual([...deltas].sort((a, b) => b - a));
            expect(record!.vocabDelta).toBeCloseTo(deltas.reduce((sum, d) => sum + d, 0), 6);
        });
    });

    it('defers the study card without credit or a ticker entry', () => {
        const point: HostItem = { kind: 'grammar', grammarId: 'n5-001' };
        const progress = userProgress({ grammarQueue: [grammarProgress({ grammarId: 'n5-001', entry: srsEntry({ memoryStrength: 42, dueDate: now }) })] });
        const { progress: next, record } = applyEffects(progress, [{ kind: 'defer', item: point }], { now, settings });

        expect(next.grammarQueue[0].entry.memoryStrength).toBe(42);
        expect(next.grammarQueue[0].entry.dueDate!.getTime()).toBeGreaterThan(now.getTime());
        expect(record).toBeNull();
    });
});
