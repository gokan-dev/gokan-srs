import { describe, it, expect } from 'vitest';
import {
    KNOWLEDGE_POINTS_PER_ENTRY,
    buildKnowledgeCurve,
    entryKnowledgePoints,
    strengthFromLog,
} from './knowledge.utils';
import { CONSTANTS } from '../commons/constants';
import { calculateMasteryPercentage } from './srs.utils';
import type { ReviewLog, SRSEntry, VocabProgress } from '../models/vocabulary.model';

const F = CONSTANTS.srs.formula;
const DAY_MS = 24 * 60 * 60 * 1000;

function makeEntry(overrides: Partial<SRSEntry> = {}): SRSEntry {
    return {
        memoryStrength: F.minMemoryStrength,
        interval: 0,
        difficulty: 0.5,
        lastReviewedAt: null,
        dueDate: null,
        history: [],
        ...overrides,
    };
}

function makeVocab(overrides: Partial<VocabProgress> = {}): VocabProgress {
    return {
        vocabId: 'v1',
        stage: 'learning',
        introductionAt: null,
        nextReviewAt: null,
        lastReviewedAt: null,
        totalReviews: 0,
        consecutiveFailures: 0,
        reading: makeEntry(),
        meaning: makeEntry(),
        ...overrides,
    };
}

function log(date: number, interval: number, result: ReviewLog['result'] = 'correct'): ReviewLog {
    return { date, result, interval, latency: 5000 };
}

describe('entryKnowledgePoints', () => {
    it('awards zero points at the minimum memory strength', () => {
        expect(entryKnowledgePoints(F.minMemoryStrength)).toBe(0);
    });

    it('awards a full entry allotment at max memory strength', () => {
        expect(entryKnowledgePoints(F.mastery.maxMemoryStrength)).toBeCloseTo(
            KNOWLEDGE_POINTS_PER_ENTRY,
            5
        );
    });

    it('is monotonically increasing in memory strength', () => {
        const strengths = [1, 5, 20, 60, 208, 500, 1270];
        const points = strengths.map(entryKnowledgePoints);
        for (let i = 1; i < points.length; i++) {
            expect(points[i]).toBeGreaterThan(points[i - 1]);
        }
    });

    it('caps a fully mastered vocab (reading + meaning) at 400 points', () => {
        // 200 per entry, because one knowledge point IS one mastery point: the scale
        // matches calculateMasteryPercentage exactly so the MasteryRing, the session
        // ticker and the session total never need a conversion between them.
        const max = F.mastery.maxMemoryStrength;
        expect(entryKnowledgePoints(max)).toBeCloseTo(KNOWLEDGE_POINTS_PER_ENTRY, 5);
        expect(entryKnowledgePoints(max) + entryKnowledgePoints(max)).toBeCloseTo(400, 5);
    });

    it('reports exactly the mastery figure the ring shows, with no conversion', () => {
        for (const strength of [1, 5, 60, 208, 500, 1270]) {
            expect(entryKnowledgePoints(strength)).toBeCloseTo(calculateMasteryPercentage(strength), 10);
        }
    });
});

describe('strengthFromLog', () => {
    it('inverts the interval formula for a correct answer', () => {
        const strength = 100;
        const interval = strength * F.lnTarget;
        expect(strengthFromLog(log(0, interval), 1)).toBeCloseTo(strength, 5);
    });

    it('undoes the minor_error post-processing multiplier', () => {
        const strength = 100;
        const interval = strength * F.lnTarget * F.postProcessIntervalMultipliers.minor_error;
        expect(strengthFromLog(log(0, interval, 'minor_error'), 1)).toBeCloseTo(strength, 5);
    });

    it('undoes the wrong-answer post-processing multiplier', () => {
        const strength = 100;
        const interval = strength * F.lnTarget * F.postProcessIntervalMultipliers.wrong;
        expect(strengthFromLog(log(0, interval, 'wrong'), 1)).toBeCloseTo(strength, 5);
    });

    it('divides out the frequency modifier so a "low" frequency user is not over-credited', () => {
        const strength = 100;
        const interval = strength * F.lnTarget * 2.0; // 'low' frequency stretches intervals x2
        expect(strengthFromLog(log(0, interval), 2.0)).toBeCloseTo(strength, 5);
    });

    it('clamps into the valid strength range', () => {
        expect(strengthFromLog(log(0, 0), 1)).toBe(F.minMemoryStrength);
        expect(strengthFromLog(log(0, F.maxInterval), 1)).toBe(F.mastery.maxMemoryStrength);
    });
});

describe('buildKnowledgeCurve', () => {
    const now = new Date('2026-07-20T12:00:00Z');
    const today = new Date('2026-07-20T00:00:00Z').getTime();

    it('returns a flat zero curve for an empty queue', () => {
        const curve = buildKnowledgeCurve([], { range: 7, now });
        expect(curve.points).toHaveLength(7);
        expect(curve.currentTotal).toBe(0);
        expect(curve.gained).toBe(0);
        expect(curve.points.every(p => p.points === 0)).toBe(true);
    });

    it('produces one point per day of the requested window, ending today', () => {
        const curve = buildKnowledgeCurve([], { range: 30, now });
        expect(curve.points).toHaveLength(30);
        expect(curve.points[29].date.toDateString()).toBe(new Date(today).toDateString());
    });

    it('accumulates points as an entry grows, and never decreases for a clean learner', () => {
        const vocab = makeVocab({
            introductionAt: new Date(today - 5 * DAY_MS),
            reading: makeEntry({
                memoryStrength: 200,
                history: [
                    log(today - 4 * DAY_MS, 2),
                    log(today - 2 * DAY_MS, 10),
                    log(today, 60),
                ],
            }),
        });

        const curve = buildKnowledgeCurve([vocab], { range: 7, now });
        const totals = curve.points.map(p => p.points);

        for (let i = 1; i < totals.length; i++) {
            expect(totals[i]).toBeGreaterThanOrEqual(totals[i - 1]);
        }
        expect(curve.currentTotal).toBeGreaterThan(0);
        expect(curve.gained).toBeCloseTo(curve.currentTotal, 5);
    });

    it('credits a skipped ("already known") vocab in full at its introduction date', () => {
        const max = F.mastery.maxMemoryStrength;
        const vocab = makeVocab({
            stage: 'graduated',
            introductionAt: new Date(today - 3 * DAY_MS),
            reading: makeEntry({ memoryStrength: max, interval: F.maxInterval }),
            meaning: makeEntry({ memoryStrength: max, interval: F.maxInterval }),
        });

        const curve = buildKnowledgeCurve([vocab], { range: 7, now });

        expect(curve.currentTotal).toBeCloseTo(400, 5);
        // Nothing before the skip, everything from the skip onward.
        expect(curve.points[2].points).toBe(0);
        expect(curve.points[3].points).toBeCloseTo(400, 5);
        expect(curve.points[6].points).toBeCloseTo(400, 5);
    });

    it('collapses pre-window history into the starting baseline rather than dropping it', () => {
        const vocab = makeVocab({
            introductionAt: new Date(today - 100 * DAY_MS),
            reading: makeEntry({
                memoryStrength: 200,
                history: [log(today - 90 * DAY_MS, 20), log(today - 1 * DAY_MS, 60)],
            }),
        });

        const curve = buildKnowledgeCurve([vocab], { range: 7, now });

        // Day 0 already carries the knowledge earned 90 days ago...
        expect(curve.points[0].points).toBeGreaterThan(0);
        // ...but the window's reported gain counts only what was earned inside it.
        expect(curve.gained).toBeLessThan(curve.currentTotal);
        expect(curve.gained).toBeCloseTo(curve.currentTotal - curve.points[0].points, 5);
    });

    it('records a flat day when nothing was studied', () => {
        const vocab = makeVocab({
            introductionAt: new Date(today - 6 * DAY_MS),
            reading: makeEntry({ memoryStrength: 50, history: [log(today - 6 * DAY_MS, 10)] }),
        });

        const curve = buildKnowledgeCurve([vocab], { range: 7, now });

        expect(curve.points[0].gain).toBeGreaterThan(0);
        expect(curve.flatDays).toBe(6);
        expect(curve.bestDayGain).toBeCloseTo(curve.points[0].gain, 5);
    });

    it('reflects a drop in knowledge after a failed review', () => {
        const vocab = makeVocab({
            introductionAt: new Date(today - 4 * DAY_MS),
            reading: makeEntry({
                memoryStrength: 10,
                history: [
                    log(today - 3 * DAY_MS, 60),
                    log(today - 1 * DAY_MS, 3, 'wrong'),
                ],
            }),
        });

        const curve = buildKnowledgeCurve([vocab], { range: 5, now });
        const beforeFailure = curve.points[2].points;
        const afterFailure = curve.points[3].points;

        expect(afterFailure).toBeLessThan(beforeFailure);
        expect(curve.points[3].gain).toBeLessThan(0);
    });

    it("'all' starts the window at the earliest recorded event", () => {
        const vocab = makeVocab({
            introductionAt: new Date(today - 9 * DAY_MS),
            reading: makeEntry({ memoryStrength: 50, history: [log(today - 9 * DAY_MS, 10)] }),
        });

        const curve = buildKnowledgeCurve([vocab], { range: 'all', now });

        expect(curve.points).toHaveLength(10);
        expect(curve.points[0].date.toDateString()).toBe(
            new Date(today - 9 * DAY_MS).toDateString()
        );
    });

    it('ignores future-dated logs so a clock-skewed device cannot extend the curve', () => {
        const vocab = makeVocab({
            introductionAt: new Date(today - 2 * DAY_MS),
            reading: makeEntry({
                memoryStrength: 50,
                history: [log(today + 5 * DAY_MS, 300)],
            }),
        });

        const curve = buildKnowledgeCurve([vocab], { range: 5, now });
        expect(curve.currentTotal).toBe(0);
    });

    it('sums knowledge across many vocabulary items', () => {
        const max = F.mastery.maxMemoryStrength;
        const skipped = (id: string) =>
            makeVocab({
                vocabId: id,
                stage: 'graduated',
                introductionAt: new Date(today - 1 * DAY_MS),
                reading: makeEntry({ memoryStrength: max }),
                meaning: makeEntry({ memoryStrength: max }),
            });

        const curve = buildKnowledgeCurve([skipped('a'), skipped('b'), skipped('c')], {
            range: 5,
            now,
        });

        // 3 words x 2 entries x 200 points per mastered entry.
        expect(curve.currentTotal).toBeCloseTo(1200, 4);
    });
});
