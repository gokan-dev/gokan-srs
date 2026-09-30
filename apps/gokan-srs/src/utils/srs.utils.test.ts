import { describe, it, expect } from 'vitest';
import { clearStaleNeedsRetry, getNextVocabToStudy, meaningContextThresholdOf } from './srs.utils';
import { DEFAULT_SRS_ENTRY } from '../models/vocabulary.model';
import type { VocabProgress } from '../models/vocabulary.model';
import type { MeaningContextThreshold, UserSettings } from '../models/user.model';
import { CONSTANTS } from '../commons/constants';

const now = new Date('2026-06-10T00:00:00Z');
const past = new Date('2026-06-01T00:00:00Z');
const future = new Date('2026-07-01T00:00:00Z');

function makeSettings(overrides: Partial<UserSettings> = {}): UserSettings {
    return {
        preferredLearningOrder: 'frequency',
        kanjiCoverageTarget: 1,
        enableMeaningQuiz: true,
        learningFrequency: 'medium',
        ...overrides,
    } as UserSettings;
}

// Fully self-contained (no shared nested objects) - see quizSelectors.test.ts's note
// on DEFAULT_VOCABULARY_PROGRESS's shared reading/meaning objects being a test-hygiene hazard.
function makeVocabProgress(overrides: Partial<VocabProgress> = {}): VocabProgress {
    return {
        vocabId: 'v1',
        stage: 'learning',
        introductionAt: past,
        nextReviewAt: null,
        lastReviewedAt: null,
        totalReviews: 1,
        consecutiveFailures: 0,
        reading: { ...DEFAULT_SRS_ENTRY },
        meaning: { ...DEFAULT_SRS_ENTRY },
        ...overrides,
    };
}

describe('clearStaleNeedsRetry', () => {
    // issue #36: a needsRetry flag inherited from a previous session, colliding
    // with that same quiz type's regular due review, should be cleared rather
    // than surfacing a second, redundant retry prompt for the same item.

    it('clears a stale reading needsRetry flag when the reading is also regularly due', () => {
        const v = makeVocabProgress({
            needsRetry: { reading: true },
            reading: { ...DEFAULT_SRS_ENTRY, dueDate: past },
        });
        const [result] = clearStaleNeedsRetry([v], makeSettings(), now);
        expect(result.needsRetry?.reading).toBe(false);
    });

    it('clears a stale meaning needsRetry flag when the meaning is also regularly due', () => {
        const v = makeVocabProgress({
            needsRetry: { meaning: true },
            meaning: { ...DEFAULT_SRS_ENTRY, dueDate: past },
        });
        const [result] = clearStaleNeedsRetry([v], makeSettings(), now);
        expect(result.needsRetry?.meaning).toBe(false);
    });

    it('clears reading and meaning independently in the same call', () => {
        const v = makeVocabProgress({
            needsRetry: { reading: true, meaning: true },
            reading: { ...DEFAULT_SRS_ENTRY, dueDate: past },
            meaning: { ...DEFAULT_SRS_ENTRY, dueDate: null }, // meaning not due - stays
        });
        const [result] = clearStaleNeedsRetry([v], makeSettings(), now);
        expect(result.needsRetry?.reading).toBe(false);
        expect(result.needsRetry?.meaning).toBe(true);
    });

    it('leaves needsRetry untouched when the regular review is not yet due (same-session retry)', () => {
        const v = makeVocabProgress({
            needsRetry: { reading: true },
            reading: { ...DEFAULT_SRS_ENTRY, dueDate: future },
        });
        const [result] = clearStaleNeedsRetry([v], makeSettings(), now);
        expect(result.needsRetry?.reading).toBe(true);
    });

    it('leaves needsRetry untouched when totalReviews is 0 (no regular review has happened yet)', () => {
        const v = makeVocabProgress({
            needsRetry: { reading: true },
            totalReviews: 0,
            reading: { ...DEFAULT_SRS_ENTRY, dueDate: past },
        });
        const [result] = clearStaleNeedsRetry([v], makeSettings(), now);
        expect(result.needsRetry?.reading).toBe(true);
    });

    it('does not clear a stale meaning flag when meaning quizzes are disabled', () => {
        const v = makeVocabProgress({
            needsRetry: { meaning: true },
            meaning: { ...DEFAULT_SRS_ENTRY, dueDate: past },
        });
        const [result] = clearStaleNeedsRetry([v], makeSettings({ enableMeaningQuiz: false }), now);
        expect(result.needsRetry?.meaning).toBe(true);
    });

    it('is a no-op for items without a needsRetry flag', () => {
        const v = makeVocabProgress({ reading: { ...DEFAULT_SRS_ENTRY, dueDate: past } });
        const [result] = clearStaleNeedsRetry([v], makeSettings(), now);
        expect(result.needsRetry).toBeUndefined();
    });

    it('returns the exact same array reference when nothing changed (avoids spurious progress updates)', () => {
        const queue = [makeVocabProgress({
            needsRetry: { reading: true },
            reading: { ...DEFAULT_SRS_ENTRY, dueDate: future },
        })];
        expect(clearStaleNeedsRetry(queue, makeSettings(), now)).toBe(queue);
    });

    it('handles an empty queue', () => {
        expect(clearStaleNeedsRetry([], makeSettings(), now)).toEqual([]);
    });
});

/** Inverse of calculateMasteryLoops/calculateMasteryPercentage - the memoryStrength that yields a given 0-200 mastery percentage exactly. */
function strengthForMastery(percentage: number): number {
    const sMin = CONSTANTS.srs.formula.minMemoryStrength;
    const sSoft = CONSTANTS.srs.formula.mastery.visualSoftCap;
    const sMax = CONSTANTS.srs.formula.mastery.maxMemoryStrength;
    if (percentage <= 0) return sMin;
    if (percentage <= 100) return sMin * Math.pow(sSoft / sMin, percentage / 100);
    return sSoft * Math.pow(sMax / sSoft, (percentage - 100) / 100);
}

describe('meaningContextThresholdOf', () => {
    it('prefers meaningContextThresholdPoints over the legacy enum when both are set', () => {
        const settings = makeSettings({ meaningContextThresholdPoints: 80, meaningContextThreshold: 'early' });
        expect(meaningContextThresholdOf(settings)).toBe(80);
    });

    it.each<[MeaningContextThreshold, number]>([
        ['early', 30],
        ['normal', 50],
        ['late', 70],
    ])('maps the legacy enum %s to %d when points is unset', (key, expected) => {
        const settings = makeSettings({ meaningContextThreshold: key });
        expect(meaningContextThresholdOf(settings)).toBe(expected);
    });

    it('defaults to 50 when neither field is set', () => {
        expect(meaningContextThresholdOf(makeSettings())).toBe(50);
    });

    it('defaults to 50 when settings is undefined', () => {
        expect(meaningContextThresholdOf(undefined)).toBe(50);
    });

    it.each([
        [-5, 0],
        [999, 200],
        [44, 40],
        [45, 50],
    ])('clamps and rounds %d to the nearest step of 10 (%d)', (input, expected) => {
        const settings = makeSettings({ meaningContextThresholdPoints: input });
        expect(meaningContextThresholdOf(settings)).toBe(expected);
    });
});

describe('getNextVocabToStudy meaning context mode', () => {
    function makeDueMeaningVocab(masteryPercentage: number): VocabProgress {
        return makeVocabProgress({
            totalReviews: 5,
            reading: { ...DEFAULT_SRS_ENTRY, dueDate: null },
            meaning: { ...DEFAULT_SRS_ENTRY, memoryStrength: strengthForMastery(masteryPercentage), dueDate: past },
        });
    }

    it('stays in base mode when the meaning ring is just below the threshold', () => {
        const settings = makeSettings({ meaningContextThresholdPoints: 50 });
        const item = getNextVocabToStudy([makeDueMeaningVocab(49)], settings, now);
        expect(item?.quizType).toBe('meaning');
        expect(item?.quizMode).toBe('base');
    });

    it('switches to context mode once the meaning ring reaches the threshold', () => {
        const settings = makeSettings({ meaningContextThresholdPoints: 50 });
        const item = getNextVocabToStudy([makeDueMeaningVocab(50)], settings, now);
        expect(item?.quizType).toBe('meaning');
        expect(item?.quizMode).toBe('context');
    });

    it('a threshold of 0 always gives context mode', () => {
        const settings = makeSettings({ meaningContextThresholdPoints: 0 });
        const item = getNextVocabToStudy([makeDueMeaningVocab(0)], settings, now);
        expect(item?.quizMode).toBe('context');
    });
});
