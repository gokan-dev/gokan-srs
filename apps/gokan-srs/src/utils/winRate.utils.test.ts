import { describe, it, expect } from 'vitest';
import { percentOf, winRatesByQuizType } from './winRate.utils';
import type { UserProgress } from '../models/user.model';
import type { AnswerResult } from '../services/srs.service';

const logs = (...results: AnswerResult[]) => results.map((result, i) => ({ date: i, result, interval: 1, latency: 1000 }));

describe('winRatesByQuizType', () => {
    const progress = {
        learningQueue: [
            { reading: { history: logs('correct', 'wrong') }, meaning: { history: logs('minor_error') }, production: { history: logs('wrong', 'pass') } },
            { reading: { history: logs('correct') }, meaning: { history: [] } },
        ],
        grammarQueue: [{ entry: { history: logs('correct', 'correct', 'wrong') } }],
    } as unknown as UserProgress;

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
