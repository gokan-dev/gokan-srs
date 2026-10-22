import { describe, it, expect } from 'vitest';
import { applyEffects, effectsOf } from './effects';
import type { Effect } from './effects';
import { gradeExercise, SUPPORT_COEFFICIENT_FLOOR } from './grading';
import { meaningSlot, wordSlot } from './slots';
import type { AnswerSlot, Exercise, HostItem, SynonymCandidate, WordForms } from './types';
import { SRSService } from '../srs.service';
import type { AnswerResult } from '../../utils/answerMatching';
import { CONSTANTS } from '../../commons/constants';
import type { VocabProgress } from '../../models/vocabulary.model';
import { answerSlot, grammarProgress, mixupRecord, srsEntry, userProgress, userSettings, vocabProgress } from '../../test/fixtures';

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
// 狭い / 小さい are auto confusable: they share only "small".
const chiisai: SynonymCandidate = { vocabId: 'chiisai', relation: 'confusable', vocab: forms('小さい', 'ちいさい'), shared: ['small'] };

const semaiItem: HostItem = { kind: 'vocab', vocabId: 'semai', quizType: 'production', quizMode: 'base' };
/** A production card for 狭い (せまい) whose cue decides whether 小さい answers it. */
function semaiCard(sentence: string): Exercise {
    return {
        kind: 'production',
        host: semaiItem,
        label: '狭い',
        slots: [wordSlot(forms('狭い', 'せまい'), { vocabId: 'semai', otherForm: 'correct', role: 'core', candidates: [chiisai] })],
        cue: { sentence },
    };
}
type Answered = Parameters<typeof effectsOf>[0] & Parameters<typeof gradeExercise>[0];
const answer = (exercise: Answered, answers: string[], hintLevels: number[] = answers.map(() => 0)) =>
    effectsOf(exercise, gradeExercise(exercise, answers, hintLevels), { latencyMs: 4000, hintLevels, answers });
/** The effects on SRS state alone, without the mix-ups remembered (tested on their own below). */
const srsEffects = (...args: Parameters<typeof answer>) => answer(...args).filter(e => e.kind !== 'mixup');

describe('effectsOf', () => {
    it('reviews the asked word on an ordinary answer', () => {
        const [effect, ...rest] = srsEffects(semaiCard('The street is narrow.'), ['せまい']);
        expect(effect).toMatchObject({ kind: 'review', item: semaiItem, result: 'correct', latencyMs: 4000 });
        expect(rest).toEqual([]);
    });

    it('retries the asked word and credits the one typed when a synonym answers the card', () => {
        expect(srsEffects(semaiCard('Japan is a small country.'), ['小さい'])).toEqual([
            { kind: 'retry', item: semaiItem, label: '狭い', result: 'correct', neutral: false },
            { kind: 'reinforce', vocabId: 'chiisai', label: '小さい', result: 'correct' },
        ]);
    });

    it('retries without crediting anyone when the synonym does not fit the card: a neutral retry', () => {
        expect(srsEffects(semaiCard('The street is narrow.'), ['小さい'])).toEqual([
            { kind: 'retry', item: semaiItem, label: '狭い', result: 'wrong', neutral: true },
        ]);
    });

    it('credits an interchangeable synonym out of context as a near miss, retrying the asked word (issue #150)', () => {
        const card: Exercise = { ...semaiCard('The street is narrow.'), slots: [wordSlot(forms('狭い', 'せまい'), {
            vocabId: 'semai', otherForm: 'correct', role: 'core', candidates: [{ ...chiisai, relation: 'interchangeable' }],
        })] };
        expect(srsEffects(card, ['小さい'])).toEqual([
            { kind: 'retry', item: semaiItem, label: '狭い', result: 'minor_error', neutral: false },
            { kind: 'reinforce', vocabId: 'chiisai', label: '小さい', result: 'minor_error' },
        ]);
    });

    describe('on a grammar card', () => {
        const point: HostItem = { kind: 'grammar', grammarId: 'n5-001' };
        const pattern = answerSlot({ accept: ['が'] });
        const blank = (vocabId: string, accept: string) => ({ ...answerSlot({ accept: [accept], role: 'support' }), word: { vocabId, label: accept, headword: accept, lemma: null, otherForm: 'minor_error' as const, candidates: [] } });
        const card = (slots: AnswerSlot[]): Answered => ({ kind: 'grammar-cloze', host: point, label: 'A が いちばん', slots, cue: {} });

        it('reviews the point and credits the vocab blanks answered right, once per word', () => {
            const effects = srsEffects(card([pattern, blank('sushi', 'すし'), blank('naka', 'なか'), blank('sushi', 'すし')]), ['が', 'すし', 'ねこ', 'すし']);
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
            const semaiBlank = wordSlot(forms('狭い', 'せまい'), { vocabId: 'semai', otherForm: 'minor_error', role: 'support', candidates: [chiisai] });
            const effects = srsEffects({ ...card([pattern, semaiBlank]), cue: { sentence: 'Japan is a small country.' } }, ['が', '小さい']);

            expect(effects.map(e => e.kind)).toEqual(['review', 'reinforce']);
            expect(effects[1]).toEqual({ kind: 'reinforce', vocabId: 'chiisai', label: '小さい', result: 'correct' });
            // Answered right, so the vocab blank does not discount the point's reward.
            const [asked] = effects;
            expect(asked.kind === 'review' && asked.strengthModifier).toBe(1);
        });

        it('retries the point when every deciding blank was a confusable near-synonym', () => {
            const decider = { ...wordSlot(forms('狭い', 'せまい'), { vocabId: 'semai', otherForm: 'minor_error', role: 'core', candidates: [chiisai] }) };
            const effects = srsEffects(card([decider]), ['小さい']);
            expect(effects).toEqual([{ kind: 'retry', item: point, label: 'A が いちばん', result: 'wrong', neutral: true }]);
        });
    });

    it('retries a demonstrative answered with a sibling\'s meaning: neither credit nor penalty (issue #123)', () => {
        const item: HostItem = { kind: 'vocab', vocabId: 'sore', quizType: 'meaning', quizMode: 'base' };
        const card: Answered = { kind: 'meaning', host: item, label: 'それ', slots: [meaningSlot(['that', 'it'], 'それ')], cue: {} };
        expect(answer(card, ['this'])).toEqual([{ kind: 'retry', item, label: 'それ', result: 'wrong', neutral: true }]);

        // A graduated word keeps its stage, its strength and its next review.
        const sore = word('sore', { stage: 'graduated', nextReviewAt: new Date('2026-07-01T00:00:00Z') });
        const { progress: next, record } = applyEffects(userProgress({ learningQueue: [sore] }), answer(card, ['this']), { now, settings });
        const [after] = next.learningQueue;
        expect(after.stage).toBe('graduated');
        expect(after.nextReviewAt).toEqual(sore.nextReviewAt);
        expect(after.meaning.memoryStrength).toBe(sore.meaning.memoryStrength);
        expect(after.meaning.interval).toBe(sore.meaning.interval);
        expect(next.calibration!.meaning.history).toHaveLength(0);
        // The ticker shows it as neutral, as the card does, not as the miss `result` reads as.
        expect(record).toMatchObject({ delta: 0, result: 'wrong', shown: 'neutral' });
    });

    describe('mix-ups', () => {
        const mixupsOf = (effects: Effect[]) => effects.flatMap(e => (e.kind === 'mixup' ? [e.mixup] : []));

        it('remembers a synonym grading identified, with the answer, how it was graded and the card', () => {
            expect(mixupsOf(answer(semaiCard('Japan is a small country.'), ['小さい']))).toEqual([
                { asked: 'semai', answer: '小さい', outcome: 'accepted', typed: 'chiisai', meaning: 'small', cue: 'Japan is a small country.' },
            ]);
            expect(mixupsOf(answer(semaiCard('The street is narrow.'), ['小さい']))).toEqual([
                { asked: 'semai', answer: '小さい', outcome: 'neutral', typed: 'chiisai', cue: 'The street is narrow.' },
            ]);
        });

        describe('names the other word only when the answer was that word', () => {
            const adjective = (kanji: string, reading: string): WordForms => ({ ...forms(kanji, reading), senses: [{ pos: ['adj-i'], glosses: [], misc: { rawTags: [] }, related: { compounds: [] } }] });
            const chiisaiAdj: SynonymCandidate = { ...chiisai, vocab: adjective('小さい', 'ちいさい') };
            const card = (candidate: SynonymCandidate, cue: Exercise['cue']): Exercise => ({
                ...semaiCard(''), cue,
                slots: [wordSlot(forms('狭い', 'せまい'), { vocabId: 'semai', otherForm: 'correct', role: 'core', candidates: [candidate] })],
            });
            const small = { sentence: 'Japan is a small country.' };

            it('an inflection of one of its forms names it', () => {
                expect(mixupsOf(answer(card(chiisaiAdj, small), ['小さかった']))).toEqual([
                    { asked: 'semai', answer: '小さかった', outcome: 'accepted', typed: 'chiisai', meaning: 'small', cue: small.sentence },
                ]);
            });

            it('a typo of it, which grading still reads as that synonym, keeps the answer as typed', () => {
                const effects = answer(card(chiisaiAdj, small), ['ちいさいい']);
                expect(effects.find(e => e.kind === 'reinforce')).toMatchObject({ vocabId: 'chiisai' });
                expect(mixupsOf(effects)).toEqual([{ asked: 'semai', answer: 'ちいさいい', outcome: 'accepted', meaning: 'small', cue: small.sentence }]);
            });

            it('a loose kanji match (止む, through 止す\'s 止 plus any kana) keeps the answer as typed', () => {
                const yosu: SynonymCandidate = { vocabId: 'yosu', relation: 'confusable', shared: ['stop'], vocab: { ...forms('止す', 'よす'), senses: [{ pos: ['v5s'], glosses: [], misc: { rawTags: [] }, related: { compounds: [] } }] } };
                const effects = answer(card(yosu, { glosses: ['to fill'] }), ['止む']);
                expect(gradeExercise(card(yosu, { glosses: ['to fill'] }), ['止む'], [0]).slots[0].synonym?.vocabId).toBe('yosu');
                expect(mixupsOf(effects)).toEqual([{ asked: 'semai', answer: '止む', outcome: 'neutral' }]);
            });
        });

        it('keeps no meaning for a curated confusable pair, which the card using it leaves neutral', () => {
            const curated: Exercise = {
                ...semaiCard('Japan is a small country.'),
                slots: [wordSlot(forms('狭い', 'せまい'), { vocabId: 'semai', otherForm: 'correct', role: 'core', candidates: [{ ...chiisai, curated: true }] })],
            };
            expect(mixupsOf(answer(curated, ['小さい']))).toEqual([
                { asked: 'semai', answer: '小さい', outcome: 'neutral', typed: 'chiisai', cue: 'Japan is a small country.' },
            ]);
        });

        it("keeps a sentence card's English as the cue, and none on the gloss card", () => {
            const glossCard: Exercise = { ...semaiCard(''), cue: { glosses: ['narrow', 'small'] } };
            expect(mixupsOf(answer(glossCard, ['小さい']))).toEqual([{ asked: 'semai', answer: '小さい', outcome: 'accepted', typed: 'chiisai', meaning: 'small' }]);
        });

        it('remembers the text of a wrong answer grading did not identify', () => {
            expect(mixupsOf(answer(semaiCard('The street is narrow.'), [' てらす ']))).toEqual([{ asked: 'semai', answer: 'てらす', outcome: 'wrong', cue: 'The street is narrow.' }]);
        });

        it('remembers nothing for a right answer, a typo, a skip or a revealed answer', () => {
            expect(mixupsOf(answer(semaiCard('x'), ['せまい']))).toEqual([]);
            expect(mixupsOf(answer(semaiCard('x'), ['せまいい']))).toEqual([]);
            expect(mixupsOf(answer(semaiCard('x'), ['']))).toEqual([]);
            expect(mixupsOf(answer(semaiCard('x'), ['ねこ'], [2]))).toEqual([]);
        });

        it('remembers a grammar sentence\'s word blank, never a pattern blank', () => {
            const point: HostItem = { kind: 'grammar', grammarId: 'n5-001' };
            const pattern = answerSlot({ accept: ['が'], role: 'core' });
            const blank = wordSlot(forms('狭い', 'せまい'), { vocabId: 'semai', otherForm: 'minor_error', role: 'support', candidates: [] });
            const card: Answered = { kind: 'grammar-cloze', host: point, label: 'A が いちばん', slots: [pattern, blank], cue: {} };
            expect(mixupsOf(answer(card, ['を', 'ひろい']))).toEqual([{ asked: 'semai', answer: 'ひろい', outcome: 'wrong' }]);
        });

        it('records the same word typed for the same word in two blanks once', () => {
            const point: HostItem = { kind: 'grammar', grammarId: 'n5-001' };
            const blank = wordSlot(forms('狭い', 'せまい'), { vocabId: 'semai', otherForm: 'minor_error', role: 'support', candidates: [] });
            const card: Answered = { kind: 'grammar-cloze', host: point, label: 'A が いちばん', slots: [answerSlot({ accept: ['が'], role: 'core' }), blank, blank], cue: {} };
            expect(mixupsOf(answer(card, ['が', 'ひろい', 'ひろい']))).toEqual([{ asked: 'semai', answer: 'ひろい', outcome: 'wrong' }]);
        });

        it('writes them dated, after the existing ones, on a retry too', () => {
            const progress = userProgress({ learningQueue: [word('semai', { needsRetry: { production: true } })], mixups: [mixupRecord()] });
            const { progress: next } = applyEffects(progress, answer(semaiCard('The street is narrow.'), ['小さい']), { now, settings });
            expect(next.mixups).toEqual([mixupRecord(), { asked: 'semai', answer: '小さい', outcome: 'neutral', typed: 'chiisai', cue: 'The street is narrow.', date: now.getTime() }]);
        });

        it('adds no field to progress that never mixed a word up', () => {
            const { progress: next } = applyEffects(userProgress({ learningQueue: [word('semai')] }), answer(semaiCard('x'), ['せまい']), { now, settings });
            expect(next).not.toHaveProperty('mixups');
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
    const retry: Effect = { kind: 'retry', item: semaiItem, label: '狭い', result: 'correct', neutral: false };

    it('reviews the asked word, counts the answer and records its mastery change', () => {
        const progress = userProgress({ learningQueue: [word('semai')] });
        const { progress: next, record } = applyEffects(progress, [review('correct')], { now, settings });

        expect(next.learningQueue[0].production!.memoryStrength).toBeGreaterThan(100);
        expect(next.stats.totalReviews).toBe(1);
        expect(record).toMatchObject({ item: semaiItem, label: '狭い', result: 'correct', shown: 'correct', vocabDelta: 0 });
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
