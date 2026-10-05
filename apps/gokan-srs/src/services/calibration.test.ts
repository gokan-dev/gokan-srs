import { describe, it, expect } from 'vitest';
import {
    calibrationFromHistory,
    defaultCalibration,
    growthLevelOf,
    seedCalibrationFromHistory,
    isCalibratedGrammarReview,
    isCalibratedVocabReview,
    mergeCalibration,
    rebaseEntryToSchedule,
    rebaseStrengthsToSchedule,
    recentWinRate,
    recordCalibratedAnswer,
    updateAdaptiveStats,
    withCalibrationDefaults,
} from './calibration';
import { SRSService } from './srs.service';
import { CONSTANTS } from '../commons/constants';
import type { SRSEntry, VocabProgress } from '../models/vocabulary.model';
import { DEFAULT_VOCABULARY_PROGRESS } from '../models/vocabulary.model';
import type { GrammarProgress } from '../models/grammar.model';
import { DEFAULT_GRAMMAR_PROGRESS } from '../models/grammar.model';

const F = CONSTANTS.srs.formula;
const now = new Date('2026-09-29T00:00:00Z');
const due = new Date('2026-12-07T00:00:00Z');

const entry = (overrides: Partial<SRSEntry> = {}): SRSEntry => ({
    memoryStrength: 50, interval: 10, difficulty: 0.5, lastReviewedAt: now, dueDate: due, history: [], ...overrides,
});

/** `n` copies of one review outcome, for building a calibration window. */
const repeat = (success: boolean, n: number): boolean[] => Array.from({ length: n }, () => success);

describe('updateAdaptiveStats', () => {
    const { levelStep, minLevel, maxLevel, historySize } = CONSTANTS.srs.adaptive;

    it('records the answer and keeps the level at first', () => {
        const result = updateAdaptiveStats({ level: 1.0, history: [] }, 'correct');
        expect(result).toEqual({ level: 1.0, history: [true] });
    });

    it('keeps a rolling window of historySize', () => {
        const result = updateAdaptiveStats({ level: 1.0, history: repeat(true, historySize) }, 'wrong');
        expect(result.history).toHaveLength(historySize);
        expect(result.history[historySize - 1]).toBe(false);
    });

    it('raises the level above the band, which is now centred on the 75% target (82% counts)', () => {
        // 41 of 50 = 82%: above 0.80. Under the old 0.85 threshold this sat uncorrected.
        const history = [...repeat(true, 40), ...repeat(false, 9)];
        expect(updateAdaptiveStats({ level: 1.0, history }, 'correct').level).toBeCloseTo(1.0 + levelStep);
    });

    it('lowers the level below the band', () => {
        const history = [...repeat(true, 10), ...repeat(false, 10)];
        expect(updateAdaptiveStats({ level: 1.0, history }, 'wrong').level).toBeCloseTo(1.0 - levelStep);
    });

    it('holds the level inside the band (75%)', () => {
        const history = [...repeat(true, 29), ...repeat(false, 10)]; // + 1 true = 30/40
        expect(updateAdaptiveStats({ level: 1.4, history }, 'correct').level).toBe(1.4);
    });

    it('clamps to the bounds', () => {
        expect(updateAdaptiveStats({ level: maxLevel, history: repeat(true, 20) }, 'correct').level).toBe(maxLevel);
        expect(updateAdaptiveStats({ level: minLevel, history: repeat(false, 20) }, 'wrong').level).toBe(minLevel);
    });

    it('does not adjust before minHistory reviews', () => {
        expect(updateAdaptiveStats({ level: 1.0, history: [true, true] }, 'correct').level).toBe(1.0);
    });
});

describe('per-quiz-type calibration', () => {
    it('records one quiz type without touching the others', () => {
        const next = recordCalibratedAnswer(defaultCalibration(), 'production', 'wrong');
        expect(next.production.history).toEqual([false]);
        expect(next.reading.history).toEqual([]);
        expect(next.grammar.history).toEqual([]);
    });

    it('fills in missing quiz types from older saves', () => {
        const partial = { reading: { level: 1.3, history: [true] } };
        const full = withCalibrationDefaults(partial);
        expect(full.reading.level).toBe(1.3);
        expect(full.grammar).toEqual({ level: 1.0, history: [] });
        expect(growthLevelOf(undefined, 'meaning')).toBe(1.0);
    });

    it('reports a recent win rate per quiz type, null while empty', () => {
        expect(recentWinRate({ level: 1, history: [true, false, true, true] })).toBe(0.75);
        expect(recentWinRate({ level: 1, history: [] })).toBeNull();
    });

    it('merges per quiz type, keeping the side with more recorded reviews (local on a tie)', () => {
        const local = { ...defaultCalibration(), reading: { level: 1.2, history: [true, true] }, grammar: { level: 1.1, history: [true] } };
        const remote = { ...defaultCalibration(), reading: { level: 1.5, history: [true, true, true] }, grammar: { level: 0.9, history: [false] } };
        const merged = mergeCalibration(local, remote);
        expect(merged.reading.level).toBe(1.5);
        expect(merged.grammar.level).toBe(1.1);
    });
});

describe('seeding from the review logs', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const intro = new Date('2026-01-01T00:00:00Z');
    const log = (daysAfterIntro: number, result: 'correct' | 'wrong' = 'correct', source?: 'reinforcement') =>
        ({ date: intro.getTime() + daysAfterIntro * DAY, result, interval: 1, latency: 1000, ...(source ? { source } : {}) });
    const word = (id: string, reading: ReturnType<typeof log>[], production: ReturnType<typeof log>[] = []): VocabProgress => ({
        ...DEFAULT_VOCABULARY_PROGRESS, vocabId: id, introductionAt: intro,
        reading: entry({ history: reading }), production: entry({ history: production }),
    });

    it('replays each quiz type in date order, so a sustained high win rate starts above x1', () => {
        // 30 words x 2 reading reviews after the intro day, all correct: 60 real reviews.
        const queue = Array.from({ length: 30 }, (_, i) => word(`v${i}`, [log(3 + i), log(40 + i)]));
        const seeded = calibrationFromHistory({ learningQueue: queue, grammarQueue: [] });
        expect(seeded.reading.history).toHaveLength(CONSTANTS.srs.adaptive.historySize);
        expect(seeded.reading.level).toBeGreaterThan(1.0);
        expect(seeded.meaning).toEqual({ level: 1.0, history: [] });
    });

    it("drops a word's first review within a day of its intro, and grammar reinforcement logs", () => {
        const queue = [word('v', [log(0.1), log(5, 'wrong')], [log(2, 'correct', 'reinforcement'), log(9)])];
        const seeded = calibrationFromHistory({ learningQueue: queue, grammarQueue: [] });
        expect(seeded.reading.history).toEqual([false]);
        expect(seeded.production.history).toEqual([true]);
    });

    it('seeds grammar from its own logs', () => {
        const grammar = [{ ...DEFAULT_GRAMMAR_PROGRESS, grammarId: 'g', introductionAt: intro, entry: entry({ history: [log(0.2), log(4), log(12, 'wrong')] }) }];
        expect(calibrationFromHistory({ learningQueue: [], grammarQueue: grammar }).grammar.history).toEqual([true, false]);
    });

    it('a full live window wins over the replay; a shorter one is replaced by it', () => {
        const queue = Array.from({ length: 30 }, (_, i) => word(`v${i}`, [log(3 + i), log(40 + i)]));
        const full = { level: 1.25, history: Array(CONSTANTS.srs.adaptive.historySize).fill(false) };
        const seeded = seedCalibrationFromHistory({ learningQueue: queue, grammarQueue: [], calibration: { ...defaultCalibration(), reading: full, meaning: { level: 1, history: [true] } } });
        expect(seeded.reading).toEqual(full);
        const short = seedCalibrationFromHistory({ learningQueue: queue, grammarQueue: [], calibration: { ...defaultCalibration(), reading: { level: 1, history: [true] } } });
        expect(short.reading.history).toHaveLength(CONSTANTS.srs.adaptive.historySize);
    });
});

describe('which answers count', () => {
    const vocab = (overrides: Partial<VocabProgress> = {}): VocabProgress => ({ ...DEFAULT_VOCABULARY_PROGRESS, vocabId: 'v', totalReviews: 5, ...overrides });

    it('counts a real vocab review', () => {
        expect(isCalibratedVocabReview(vocab(), 'meaning')).toBe(true);
    });
    it('excludes a retry of that quiz type (the answer was just shown)', () => {
        expect(isCalibratedVocabReview(vocab({ needsRetry: { reading: true } }), 'reading')).toBe(false);
        expect(isCalibratedVocabReview(vocab({ needsRetry: { reading: true } }), 'meaning')).toBe(true);
    });
    it("excludes a word's first review, right after its intro", () => {
        expect(isCalibratedVocabReview(vocab({ totalReviews: 0 }), 'reading')).toBe(false);
    });
    it('applies the same rules to grammar', () => {
        const gp = (overrides: Partial<GrammarProgress> = {}): GrammarProgress => ({ ...DEFAULT_GRAMMAR_PROGRESS, grammarId: 'g', totalReviews: 3, ...overrides });
        expect(isCalibratedGrammarReview(gp())).toBe(true);
        expect(isCalibratedGrammarReview(gp({ needsRetry: true }))).toBe(false);
        expect(isCalibratedGrammarReview(gp({ totalReviews: 0 }))).toBe(false);
    });
});

describe('the formula: the level grows strength, the interval reads straight off it', () => {
    const expected = CONSTANTS.srs.quizProperties.reading.expectedLatency;

    it('a higher level grows a successful answer faster', () => {
        const base = SRSService.calculateNextState(entry(), 'correct', expected, now, expected, 1.0, 1.0);
        const boosted = SRSService.calculateNextState(entry(), 'correct', expected, now, expected, 2.0, 1.0);
        expect(boosted.newEntry.memoryStrength).toBeGreaterThan(base.newEntry.memoryStrength);
    });

    it('never scales a failure', () => {
        const base = SRSService.calculateNextState(entry(), 'wrong', expected, now, expected, 1.0, 1.0);
        const boosted = SRSService.calculateNextState(entry(), 'wrong', expected, now, expected, 3.0, 1.0);
        expect(boosted.newEntry.memoryStrength).toBe(base.newEntry.memoryStrength);
    });

    it('the interval is strength x lnTarget x frequency, with no level in it', () => {
        const { newEntry, interval } = SRSService.calculateNextState(entry(), 'correct', expected, now, expected, 2.5, 1.5);
        expect(interval).toBeCloseTo(newEntry.memoryStrength * F.lnTarget * 1.5, 6);
    });
});

describe('rebase: strength catches up with the schedule', () => {
    it('recovers strength x the old adaptive level from an interval scheduled under the old formula, keeping the due date', () => {
        const S = 71.5, level = 2.75, freq = 1.5;
        const old = entry({ memoryStrength: S, interval: S * F.lnTarget * level * freq });
        const rebased = rebaseEntryToSchedule(old, freq);
        expect(rebased.memoryStrength).toBeCloseTo(S * level, 6);
        expect(rebased.dueDate).toBe(old.dueDate);
        expect(rebased.interval).toBe(old.interval);
    });

    it('is idempotent: running it twice changes nothing more', () => {
        const old = entry({ memoryStrength: 71.5, interval: 71.5 * F.lnTarget * 3 * 1.5 });
        const once = rebaseEntryToSchedule(old, 1.5);
        expect(rebaseEntryToSchedule(once, 1.5)).toBe(once);
    });

    it('is a no-op on an entry scheduled under the new formula', () => {
        const fresh = entry({ memoryStrength: 80, interval: 80 * F.lnTarget * 1.5 });
        expect(rebaseEntryToSchedule(fresh, 1.5)).toBe(fresh);
    });

    it('leaves alone: a wrong answer, the 1-day floor, an unscheduled entry, a mastered one', () => {
        const wrong = entry({ memoryStrength: 80, interval: 80 * F.lnTarget * 0.3 });
        expect(rebaseEntryToSchedule(wrong, 1)).toBe(wrong);
        const floored = entry({ memoryStrength: 1.25, interval: F.minIntervalAfterSuccess });
        expect(rebaseEntryToSchedule(floored, 1)).toBe(floored);
        const inert = entry({ dueDate: null, interval: 500 });
        expect(rebaseEntryToSchedule(inert, 1)).toBe(inert);
        const mastered = entry({ memoryStrength: F.mastery.maxMemoryStrength, interval: 3000 });
        expect(rebaseEntryToSchedule(mastered, 1)).toBe(mastered);
    });

    it('rebases vocab and grammar, and returns the same progress when nothing changes', () => {
        const progress = {
            learningQueue: [{ ...DEFAULT_VOCABULARY_PROGRESS, vocabId: 'v', reading: entry({ memoryStrength: 50, interval: 50 * F.lnTarget * 2 }) }],
            grammarQueue: [{ ...DEFAULT_GRAMMAR_PROGRESS, grammarId: 'g', entry: entry({ memoryStrength: 30, interval: 30 * F.lnTarget * 2 }) }],
        };
        const rebased = rebaseStrengthsToSchedule(progress, 1);
        expect(rebased.learningQueue[0].reading.memoryStrength).toBeCloseTo(100, 6);
        expect(rebased.grammarQueue[0].entry.memoryStrength).toBeCloseTo(60, 6);
        expect(rebaseStrengthsToSchedule(rebased, 1)).toBe(rebased);
    });
});

