import { describe, it, expect } from 'vitest';
import {
    indexLearnerVocab,
    productionRing,
    wordRole,
    scoreSentence,
    compareSentenceScores,
    pickMostProductive,
    pickSentenceForVocab,
} from './sentenceRanking';
import type { VocabProgress } from '../models/vocabulary.model';
import { DEFAULT_VOCABULARY_PROGRESS } from '../models/vocabulary.model';
import type { Sentence } from '../models/sentence.model';
import { CONSTANTS } from '../commons/constants';

const past = new Date('2026-06-01T00:00:00Z');
const future = new Date('2026-07-01T00:00:00Z');
const SOFT_CAP = CONSTANTS.srs.formula.mastery.visualSoftCap;

/** An introduced word whose production entry is activated at the given strength. */
function learning(vocabId: string, productionStrength?: number): VocabProgress {
    return {
        ...DEFAULT_VOCABULARY_PROGRESS,
        vocabId,
        introductionAt: past,
        ...(productionStrength !== undefined ? {
            production: {
                memoryStrength: productionStrength,
                interval: 1,
                difficulty: 0.5,
                lastReviewedAt: past,
                dueDate: future,
                history: [],
            },
        } : {}),
    };
}

function sentence(id: string, vocabIds: string[]): Sentence {
    return { id, original: id, en: [{ id: `${id}-en`, text: id }], vocabIds };
}

describe('productionRing / wordRole', () => {
    it('reads 0 while production is not activated, and the word is still a target', () => {
        const learner = indexLearnerVocab([learning('v1')]);
        expect(productionRing(learner.get('v1')!)).toBe(0);
        expect(wordRole('v1', learner)).toBe('target');
    });

    it('is unknown when the word is absent or queued but never introduced', () => {
        const learner = indexLearnerVocab([{ ...DEFAULT_VOCABULARY_PROGRESS, vocabId: 'queued', introductionAt: null }]);
        expect(wordRole('absent', learner)).toBe('unknown');
        expect(wordRole('queued', learner)).toBe('unknown');
    });

    it('turns into context exactly when the production ring fills its first loop', () => {
        const learner = indexLearnerVocab([learning('below', SOFT_CAP * 0.9), learning('full', SOFT_CAP)]);
        expect(productionRing(learner.get('below')!)).toBeLessThan(100);
        expect(wordRole('below', learner)).toBe('target');
        expect(productionRing(learner.get('full')!)).toBe(100);
        expect(wordRole('full', learner)).toBe('context');
    });
});

describe('scoreSentence', () => {
    it('counts targets, unknowns and the targets\' summed production ring', () => {
        const learner = indexLearnerVocab([learning('t1', 10), learning('t2'), learning('ctx', SOFT_CAP)]);
        const score = scoreSentence(['t1', 't2', 'ctx', 'u1', 'u2'], learner);
        expect(score.targets).toBe(2);
        expect(score.unknowns).toBe(2);
        expect(score.progress).toBeCloseTo(productionRing(learner.get('t1')!));
    });

    it('counts a repeated word once and skips excluded ids', () => {
        const learner = indexLearnerVocab([learning('t1'), learning('self')]);
        const score = scoreSentence(['t1', 't1', 'self'], learner, new Set(['self']));
        expect(score).toEqual({ targets: 1, unknowns: 0, progress: 0 });
    });
});

describe('compareSentenceScores', () => {
    it('ranks more targets first', () => {
        expect(compareSentenceScores(
            { targets: 3, unknowns: 0, progress: 0 },
            { targets: 2, unknowns: 0, progress: 0 },
        )).toBeLessThan(0);
    });

    it('penalises unknown words so a readable sentence beats a harder one with the same targets', () => {
        expect(compareSentenceScores(
            { targets: 2, unknowns: 0, progress: 0 },
            { targets: 2, unknowns: 3, progress: 500 },
        )).toBeLessThan(0);
    });

    it('breaks an equal target/unknown count on the summed production ring, highest first', () => {
        expect(compareSentenceScores(
            { targets: 3, unknowns: 1, progress: 210 },
            { targets: 3, unknowns: 1, progress: 90 },
        )).toBeLessThan(0);
    });

    it('reports an exact tie as 0', () => {
        const s = { targets: 1, unknowns: 2, progress: 40 };
        expect(compareSentenceScores(s, { ...s })).toBe(0);
    });
});

describe('pickMostProductive', () => {
    const score = (targets: number, progress = 0) => ({ targets, unknowns: 0, progress });

    it('returns null for no candidates', () => {
        expect(pickMostProductive([], () => score(0), () => '', 'seed')).toBeNull();
    });

    it('resolves an exact tie the same way whatever the candidate order', () => {
        const items = ['a', 'b', 'c', 'd'];
        const forward = pickMostProductive(items, () => score(1), s => s, 'seed');
        const reversed = pickMostProductive([...items].reverse(), () => score(1), s => s, 'seed');
        expect(forward).toBe(reversed);
    });
});

describe('pickSentenceForVocab', () => {
    it('ignores the tested word itself and ranks by the words around it', () => {
        const learner = indexLearnerVocab([learning('self'), learning('t1'), learning('t2')]);
        const sentences = [
            sentence('one-target', ['self', 't1']),
            sentence('two-targets', ['self', 't1', 't2']),
        ];
        expect(pickSentenceForVocab('self', sentences, learner)?.id).toBe('two-targets');
    });

    it('prefers a sentence of known words over one thick with unknown words', () => {
        const learner = indexLearnerVocab([learning('self'), learning('t1')]);
        const sentences = [
            sentence('hard', ['self', 't1', 'u1', 'u2', 'u3']),
            sentence('easy', ['self', 't1']),
        ];
        expect(pickSentenceForVocab('self', sentences, learner)?.id).toBe('easy');
    });

    it('keeps the same sentence while its words progress, then rotates once one reaches the ring ceiling', () => {
        const sentences = [
            sentence('A', ['self', 'a1', 'a2']),
            sentence('B', ['self', 'b1', 'b2']),
        ];
        // A's words are further along: A wins the progress tie-break and keeps winning as they grow.
        const early = indexLearnerVocab([learning('self'), learning('a1', 20), learning('a2', 20), learning('b1', 5), learning('b2', 5)]);
        expect(pickSentenceForVocab('self', sentences, early)?.id).toBe('A');
        const later = indexLearnerVocab([learning('self'), learning('a1', 150), learning('a2', 150), learning('b1', 5), learning('b2', 5)]);
        expect(pickSentenceForVocab('self', sentences, later)?.id).toBe('A');

        // a1 fills its first loop: it no longer counts, A drops to one target, B takes over.
        const rotated = indexLearnerVocab([learning('self'), learning('a1', SOFT_CAP), learning('a2', 150), learning('b1', 5), learning('b2', 5)]);
        expect(pickSentenceForVocab('self', sentences, rotated)?.id).toBe('B');
    });

    it('returns null for no sentences', () => {
        expect(pickSentenceForVocab('self', [], indexLearnerVocab([]))).toBeNull();
    });
});
