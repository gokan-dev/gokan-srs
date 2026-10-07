import { describe, it, expect } from 'vitest';
import { buildReviewForecast } from './reviewForecast.utils';
import type { SRSEntry, VocabProgress } from '../models/vocabulary.model';
import { DEFAULT_VOCABULARY_PROGRESS } from '../models/vocabulary.model';
import { CONSTANTS } from '../commons/constants';

// Fixed local noon, so "later today" and "tomorrow" are unambiguous.
const NOW = new Date(2026, 9, 2, 12, 0, 0);
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3600_000);

const entry = (overrides: Partial<SRSEntry> = {}): SRSEntry => ({
    memoryStrength: 10, interval: 1, difficulty: 0.3, lastReviewedAt: null, dueDate: null, history: [], ...overrides,
});

const vocab = (overrides: Partial<VocabProgress> = {}): VocabProgress => ({
    ...DEFAULT_VOCABULARY_PROGRESS,
    vocabId: 'v1',
    stage: 'learning',
    reading: entry(),
    meaning: entry(),
    production: entry(),
    ...overrides,
});

const total = (b: { reading: number; meaning: number; production: number }) => b.reading + b.meaning + b.production;

describe('buildReviewForecast', () => {
    it('produces Now, Later and one bucket per following day', () => {
        const buckets = buildReviewForecast([], undefined, NOW);
        expect(buckets.map(b => b.label).slice(0, 3)).toEqual(['Now', 'Later', 'Tomorrow']);
        expect(buckets).toHaveLength(8);
    });

    it('places a production entry due tomorrow in tomorrow\'s production count', () => {
        const queue = [vocab({ production: entry({ dueDate: hoursFromNow(24) }) })];
        const buckets = buildReviewForecast(queue, undefined, NOW);
        expect(buckets[2]).toMatchObject({ reading: 0, meaning: 0, production: 1 });
    });

    it('buckets each direction into due now and later today', () => {
        const queue = [vocab({
            reading: entry({ dueDate: hoursFromNow(-1) }),
            meaning: entry({ dueDate: hoursFromNow(2) }),
            production: entry({ dueDate: hoursFromNow(-3) }),
        })];
        const [now, later] = buildReviewForecast(queue, undefined, NOW);
        expect(now).toMatchObject({ reading: 1, meaning: 0, production: 1 });
        expect(later).toMatchObject({ reading: 0, meaning: 1, production: 0 });
    });

    it('ignores a never-activated production entry', () => {
        const queue = [vocab({ production: entry({ dueDate: null }) })];
        expect(buildReviewForecast(queue, undefined, NOW).every(b => b.production === 0)).toBe(true);
    });

    it('ignores production when production quizzes are disabled', () => {
        const queue = [vocab({ production: entry({ dueDate: hoursFromNow(-1) }) })];
        const [now] = buildReviewForecast(queue, { enableMeaningQuiz: true, enableProductionQuiz: false }, NOW);
        expect(now.production).toBe(0);
    });

    it('ignores meaning when meaning quizzes are disabled', () => {
        const queue = [vocab({ meaning: entry({ dueDate: hoursFromNow(-1) }) })];
        const [now] = buildReviewForecast(queue, { enableMeaningQuiz: false }, NOW);
        expect(now.meaning).toBe(0);
    });

    it('ignores a mastered entry whatever its stored due date', () => {
        const max = CONSTANTS.srs.formula.mastery.maxMemoryStrength;
        const queue = [vocab({ reading: entry({ memoryStrength: max, dueDate: hoursFromNow(-1) }) })];
        expect(buildReviewForecast(queue, undefined, NOW)[0].reading).toBe(0);
    });

    it('ignores the reading entry of a word learned in kana', () => {
        const queue = [vocab({ usuallyKana: true, reading: entry({ dueDate: hoursFromNow(-1) }), meaning: entry({ dueDate: hoursFromNow(-1) }) })];
        expect(buildReviewForecast(queue, undefined, NOW)[0]).toMatchObject({ reading: 0, meaning: 1 });
    });

    it('ignores graduated words', () => {
        const queue = [vocab({ stage: 'graduated', reading: entry({ dueDate: hoursFromNow(-1) }) })];
        expect(buildReviewForecast(queue, undefined, NOW).every(b => total(b) === 0)).toBe(true);
    });
});
