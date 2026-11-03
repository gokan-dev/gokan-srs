import { describe, expect, it } from 'vitest';
import { indexLearnerVocab } from '../../utils/sentenceRanking';
import { pickProductionClozeSentence } from '../../utils/productionCloze.utils';
import { sentence, vocabProgress, vocabulary } from '../../test/fixtures';
import { awaitsIntro, needsSentences, resolveCardSentences, upcomingIntroIds } from './cardSentences';

const word = vocabulary({ id: 'v1', writtenForm: { kanji: '仕事', alternatives: [], containedKanji: ['仕', '事'] }, reading: { primary: 'しごと', alternatives: [] } });
const noLearner = indexLearnerVocab([]);

/** A sentence with 仕事 matched at `start`, read しごと unless told otherwise. */
const withWord = (id: string, original: string, reading = 'しごと') => sentence({
    id,
    original,
    matches: { v1: [{ start: original.indexOf('仕事'), length: 2, reading }] },
});

const sentences = [
    withWord('long', '彼は毎日遅くまで仕事をしているので疲れている。'),
    withWord('short', '仕事です。'),
    withWord('mid', '明日は仕事がある。'),
];

describe('resolveCardSentences, the intro', () => {
    it("picks the sentence the production cloze's own picker returns for that word and learner", () => {
        const learner = indexLearnerVocab([vocabProgress({ vocabId: 'other' })]);
        const expected = pickProductionClozeSentence('v1', sentences, learner, word)?.sentence;
        expect(expected).toBeDefined();
        for (const item of [{ quizType: 'reading', quizMode: 'base' }, { quizType: 'production', quizMode: 'base' }, { quizType: 'meaning', quizMode: 'context' }] as const) {
            expect(resolveCardSentences('v1', word, item, true, sentences, learner).introSentence).toBe(expected);
        }
    });

    it('has no sentence for a word whose sentences carry no usable match', () => {
        const unmatched = [sentence({ id: 'a', original: '仕事です。' })];
        // A match read as another word (the homograph guard) is not usable either.
        const misread = [withWord('b', '仕事です。', 'しわざ')];
        for (const list of [unmatched, misread, [], null]) {
            expect(resolveCardSentences('v1', word, { quizType: 'reading', quizMode: 'base' }, true, list, noLearner).introSentence).toBeNull();
        }
    });

    it('picks none for a word already introduced', () => {
        expect(resolveCardSentences('v1', word, { quizType: 'production', quizMode: 'base' }, false, sentences, noLearner).introSentence).toBeNull();
    });

    it('gives a base card no context sentence, though the intro fetched them', () => {
        const picked = resolveCardSentences('v1', word, { quizType: 'meaning', quizMode: 'base' }, true, sentences, noLearner);
        expect(picked.sentence).toBeNull();
        expect(picked.cloze).toBeNull();
        expect(picked.introSentence).not.toBeNull();
    });
});

describe('needsSentences', () => {
    it('fetches sentences for an intro whatever its first card, and for the cards that show one', () => {
        expect(needsSentences({ quizType: 'reading', quizMode: 'base' }, true)).toBe(true);
        expect(needsSentences({ quizType: 'reading', quizMode: 'base' }, false)).toBe(false);
        expect(needsSentences({ quizType: 'meaning', quizMode: 'context' }, false)).toBe(true);
        expect(needsSentences({ quizType: 'production', quizMode: 'base' }, false)).toBe(true);
    });
});

describe('upcomingIntroIds', () => {
    const introduced = new Date('2026-01-01');
    const queue = [
        vocabProgress({ vocabId: 'q1', introductionAt: introduced }),
        vocabProgress({ vocabId: 'q2', introductionAt: null }),
        vocabProgress({ vocabId: 'q3', introductionAt: null }),
    ];

    it('skips the current word and introduced words, keeping candidate then queue order', () => {
        expect(upcomingIntroIds([], queue, 'none', 5)).toEqual(['q2', 'q3']);
        expect(upcomingIntroIds([vocabulary({ id: 'c1' }), vocabulary({ id: 'c2' })], queue, 'c1', 5)).toEqual(['c2', 'q2', 'q3']);
        expect(upcomingIntroIds([vocabulary({ id: 'q1' })], queue, 'q2', 5)).toEqual(['q3']);
    });

    it('caps the count, at two by default', () => {
        const candidates = ['c1', 'c2', 'c3'].map(id => vocabulary({ id }));
        expect(upcomingIntroIds(candidates, queue, 'none')).toEqual(['c1', 'c2']);
        expect(upcomingIntroIds(candidates, queue, 'c1', 1)).toEqual(['c2']);
    });
});

describe('awaitsIntro', () => {
    it('is true for a word not in the queue or never introduced, false once introduced', () => {
        expect(awaitsIntro(undefined, 'v1')).toBe(true);
        expect(awaitsIntro([vocabProgress({ vocabId: 'v1', introductionAt: null })], 'v1')).toBe(true);
        expect(awaitsIntro([vocabProgress({ vocabId: 'v1', introductionAt: new Date('2026-01-01') })], 'v1')).toBe(false);
    });
});
