import { describe, it, expect } from 'vitest';
import { countWrongReviews, percentOf, winRatesByQuizType } from './winRate.utils';
import type { LoggedProgress, LoggedVocab } from './winRate.utils';
import type { AnswerResult } from '../services/srs.service';

const logs = (...results: AnswerResult[]) => results.map((result, i) => ({ date: i, result, interval: 1, latency: 1000 }));

describe('winRatesByQuizType', () => {
    const progress: LoggedProgress = {
        learningQueue: [
            { reading: { history: logs('correct', 'wrong') }, meaning: { history: logs('minor_error') }, production: { history: logs('wrong', 'pass') } },
            { reading: { history: logs('correct') }, meaning: { history: [] } },
        ],
        grammarQueue: [{ entry: { history: logs('correct', 'correct', 'wrong') } }],
    };

    it('tallies each quiz type separately, excluding pass', () => {
        const { byType } = winRatesByQuizType(progress);
        expect(byType.reading).toEqual({ answers: 3, correct: 2 });
        expect(byType.meaning).toEqual({ answers: 1, correct: 1 });
        expect(byType.production).toEqual({ answers: 1, correct: 0 });
        expect(byType.grammar).toEqual({ answers: 3, correct: 2 });
    });

    it('the global rate covers every quiz type, grammar and production included', () => {
        const { global } = winRatesByQuizType(progress);
        expect(global).toEqual({ answers: 8, correct: 5 });
        expect(percentOf(global)).toBe(63);
    });

    it('reports null for a quiz type with no reviews', () => {
        expect(percentOf({ answers: 0, correct: 0 })).toBeNull();
    });
});

describe('countWrongReviews', () => {
    it('counts wrong answers across reading, meaning and production', () => {
        const vp: LoggedVocab = {
            reading: { history: logs('wrong', 'correct') },
            meaning: { history: logs('wrong') },
            production: { history: logs('wrong', 'wrong', 'minor_error') },
        };
        expect(countWrongReviews(vp)).toBe(4);
    });

    it('tolerates a word with no production entry', () => {
        const vp: LoggedVocab = { reading: { history: logs('wrong') }, meaning: { history: [] } };
        expect(countWrongReviews(vp)).toBe(1);
    });
});
