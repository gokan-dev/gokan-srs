import { describe, it, expect } from 'vitest';
import { buildWorkloadForecast, highestDay, isEmptyForecast, seededRandom } from './workloadForecast.utils';
import { CONSTANTS } from '../commons/constants';
import { PACING_EPOCH } from '../models/user.model';
import type { SRSEntry, VocabProgress } from '../models/vocabulary.model';
import { commitIntervalModifier } from '../services/calibration';
import { collectActionableTaskKeys } from '../context/quiz/quizSelectors';
import { collectActionableGrammarIds } from '../context/quiz/grammarSelectors';
import { grammarProgress, srsEntry, userProgress, userSettings, vocabProgress } from '../test/fixtures';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-01T12:00:00Z');
const MAX = CONSTANTS.srs.formula.mastery.maxMemoryStrength;

/** An entry scheduled `interval` days before `dueInDays` from now, at strength `strength`. */
const scheduledEntry = (dueInDays: number, interval: number, strength = 30): SRSEntry =>
    srsEntry({ memoryStrength: strength, interval, dueDate: new Date(now.getTime() + dueInDays * DAY) });

const word = (id: string, overrides: Partial<VocabProgress> = {}): VocabProgress => vocabProgress({
    vocabId: id,
    totalReviews: 4,
    introductionAt: new Date('2026-08-01T00:00:00Z'),
    reading: scheduledEntry(2, 10),
    meaning: scheduledEntry(5, 12),
    production: undefined,
    ...overrides,
});

const queue = (n: number): VocabProgress[] => Array.from({ length: n }, (_, i) => word(`v${i}`, {
    reading: scheduledEntry((i % 20) - 3, 5 + (i % 15)),
    meaning: scheduledEntry((i % 25) - 2, 6 + (i % 18)),
}));

const pacing = (value: number) => userSettings({ intervalModifier: value, intervalModifierHistory: [{ from: PACING_EPOCH, value }] });

describe('buildWorkloadForecast', () => {
    const progress = userProgress({ learningQueue: queue(60), grammarQueue: [grammarProgress({ totalReviews: 3, entry: scheduledEntry(1, 4) })] });

    it('covers 30 days from today', () => {
        const forecast = buildWorkloadForecast(progress, pacing(1.5), now, seededRandom(1));
        expect(forecast.days).toHaveLength(30);
        expect(forecast.days[1].date.getTime() - forecast.days[0].date.getTime()).toBe(DAY);
    });

    it('is deterministic for a seed', () => {
        const a = buildWorkloadForecast(progress, pacing(1.5), now, seededRandom(42));
        const b = buildWorkloadForecast(progress, pacing(1.5), now, seededRandom(42));
        expect(a).toEqual(b);
    });

    it('is lower for a higher modifier', () => {
        const current = pacing(1.5);
        const higher = commitIntervalModifier(current, 3, now);
        const lower = commitIntervalModifier(current, 0.8, now);
        const at = (s: typeof current) => buildWorkloadForecast(progress, s, now, seededRandom(7)).averagePerDay;
        expect(at(higher)).toBeLessThan(at(current));
        expect(at(current)).toBeLessThan(at(lower));
    });

    it('scheduled reviews due now are what the queue serves at that value', () => {
        const current = pacing(1.5);
        const lowered = commitIntervalModifier(current, 0.6, now);
        for (const settings of [current, lowered]) {
            const forecast = buildWorkloadForecast(progress, settings, now, seededRandom(3));
            const served = collectActionableTaskKeys(progress.learningQueue, settings, now).length
                + collectActionableGrammarIds(progress.grammarQueue, settings, now).length;
            expect(forecast.dueNow).toBe(served);
        }
        expect(buildWorkloadForecast(progress, lowered, now, seededRandom(3)).dueNow)
            .toBeGreaterThan(buildWorkloadForecast(progress, current, now, seededRandom(3)).dueNow);
    });

    it('places a scheduled review on its effective day, overdue ones on the first', () => {
        const one = userProgress({ learningQueue: [word('a', { reading: scheduledEntry(-1, 5), meaning: scheduledEntry(4, 8) })] });
        const forecast = buildWorkloadForecast(one, pacing(1.5), now, seededRandom(1));
        expect(forecast.dueNow).toBe(1);
        expect(forecast.days[0].scheduled).toBe(1);
        expect(forecast.days[4].scheduled).toBe(1);
        expect(forecast.days.reduce((s, d) => s + d.scheduled, 0)).toBe(2);
    });

    it('counts no mastered, graduated or disabled-quiz entry', () => {
        const mastered = word('m', { reading: scheduledEntry(1, 10, MAX), meaning: scheduledEntry(1, 10, MAX) });
        const graduated = word('g', { stage: 'graduated' });
        const meaningOnly = word('x', { reading: srsEntry({ dueDate: null }) });
        const inertProduction = word('p', { reading: srsEntry({ dueDate: null }), meaning: srsEntry({ dueDate: null }), production: srsEntry({ dueDate: null }) });
        const kana = word('k', { usuallyKana: true, meaning: srsEntry({ dueDate: null }) });
        const p = userProgress({ learningQueue: [mastered, graduated, meaningOnly, inertProduction, kana] });
        const settings = { ...pacing(1.5), enableMeaningQuiz: false };
        const forecast = buildWorkloadForecast(p, settings, now, seededRandom(1));
        expect(forecast.days.reduce((s, d) => s + d.scheduled, 0)).toBe(0);
        expect(forecast.dueNow).toBe(0);
    });

    it('adds new words at the pace of the last 14 days', () => {
        const recent = Array.from({ length: 14 }, (_, i) => word(`n${i}`, {
            introductionAt: new Date(now.getTime() - (i + 1) * DAY / 2),
            reading: srsEntry({ dueDate: null }),
            meaning: srsEntry({ dueDate: null }),
        }));
        const forecast = buildWorkloadForecast(userProgress({ learningQueue: recent }), pacing(1.5), now, seededRandom(1));
        // One new word a day, asked its reading and meaning on its first day at least.
        expect(forecast.days[5].projected).toBeGreaterThanOrEqual(2);
        expect(forecast.days.every(d => d.scheduled === 0)).toBe(true);
    });

    it('stays fast on a few thousand entries', () => {
        const big = userProgress({ learningQueue: queue(4000) });
        const started = performance.now();
        buildWorkloadForecast(big, pacing(1.5), now, seededRandom(1));
        expect(performance.now() - started).toBeLessThan(1000);
    });
});

describe('highestDay and isEmptyForecast', () => {
    it('reads the busiest day, scheduled and projected together', () => {
        const forecast = buildWorkloadForecast(userProgress({ learningQueue: queue(40) }), pacing(1.5), now, seededRandom(3));
        const busiest = Math.max(...forecast.days.map(d => d.scheduled + d.projected));
        expect(highestDay(forecast)).toBe(busiest);
        expect(isEmptyForecast(forecast)).toBe(false);
    });

    it('is empty for a learner with nothing scheduled and no recent introductions', () => {
        const forecast = buildWorkloadForecast(userProgress(), pacing(1.5), now, seededRandom(3));
        expect(highestDay(forecast)).toBe(0);
        expect(isEmptyForecast(forecast)).toBe(true);
    });
});
