import { describe, it, expect } from 'vitest';
import { clearStaleNeedsRetry, getNextVocabToStudy, isMeaningActionable, isReadingActionable, meaningContextThresholdOf, syncUsuallyKana } from './srs.utils';
import { DEFAULT_SRS_ENTRY } from '../models/vocabulary.model';
import type { VocabProgress } from '../models/vocabulary.model';
import type { MeaningContextThreshold } from '../models/user.model';
import { DEFAULT_SETTINGS } from '../models/user.model';
import { CONSTANTS } from '../commons/constants';
import { srsEntry, userSettings, vocabProgress } from '../test/fixtures';

const now = new Date('2026-06-10T00:00:00Z');
const past = new Date('2026-06-01T00:00:00Z');
const future = new Date('2026-07-01T00:00:00Z');

const makeVocabProgress = (overrides: Partial<VocabProgress> = {}): VocabProgress =>
    vocabProgress({ introductionAt: past, totalReviews: 1, production: undefined, ...overrides });

describe('clearStaleNeedsRetry', () => {
    // issue #36: a needsRetry flag inherited from a previous session, colliding
    // with that same quiz type's regular due review, should be cleared rather
    // than surfacing a second, redundant retry prompt for the same item.

    it('clears a stale reading needsRetry flag when the reading is also regularly due', () => {
        const v = makeVocabProgress({
            needsRetry: { reading: true },
            reading: { ...DEFAULT_SRS_ENTRY, dueDate: past },
        });
        const [result] = clearStaleNeedsRetry([v], userSettings(), now);
        expect(result.needsRetry?.reading).toBe(false);
    });

    it('clears a stale meaning needsRetry flag when the meaning is also regularly due', () => {
        const v = makeVocabProgress({
            needsRetry: { meaning: true },
            meaning: { ...DEFAULT_SRS_ENTRY, dueDate: past },
        });
        const [result] = clearStaleNeedsRetry([v], userSettings(), now);
        expect(result.needsRetry?.meaning).toBe(false);
    });

    it('clears reading and meaning independently in the same call', () => {
        const v = makeVocabProgress({
            needsRetry: { reading: true, meaning: true },
            reading: { ...DEFAULT_SRS_ENTRY, dueDate: past },
            meaning: { ...DEFAULT_SRS_ENTRY, dueDate: null }, // meaning not due - stays
        });
        const [result] = clearStaleNeedsRetry([v], userSettings(), now);
        expect(result.needsRetry?.reading).toBe(false);
        expect(result.needsRetry?.meaning).toBe(true);
    });

    it('leaves needsRetry untouched when the regular review is not yet due (same-session retry)', () => {
        const v = makeVocabProgress({
            needsRetry: { reading: true },
            reading: { ...DEFAULT_SRS_ENTRY, dueDate: future },
        });
        const [result] = clearStaleNeedsRetry([v], userSettings(), now);
        expect(result.needsRetry?.reading).toBe(true);
    });

    it('leaves needsRetry untouched when totalReviews is 0 (no regular review has happened yet)', () => {
        const v = makeVocabProgress({
            needsRetry: { reading: true },
            totalReviews: 0,
            reading: { ...DEFAULT_SRS_ENTRY, dueDate: past },
        });
        const [result] = clearStaleNeedsRetry([v], userSettings(), now);
        expect(result.needsRetry?.reading).toBe(true);
    });

    it('does not clear a stale meaning flag when meaning quizzes are disabled', () => {
        const v = makeVocabProgress({
            needsRetry: { meaning: true },
            meaning: { ...DEFAULT_SRS_ENTRY, dueDate: past },
        });
        const [result] = clearStaleNeedsRetry([v], userSettings({ enableMeaningQuiz: false }), now);
        expect(result.needsRetry?.meaning).toBe(true);
    });

    it('is a no-op for items without a needsRetry flag', () => {
        const v = makeVocabProgress({ reading: { ...DEFAULT_SRS_ENTRY, dueDate: past } });
        const [result] = clearStaleNeedsRetry([v], userSettings(), now);
        expect(result.needsRetry).toBeUndefined();
    });

    it('returns the exact same array reference when nothing changed (avoids spurious progress updates)', () => {
        const queue = [makeVocabProgress({
            needsRetry: { reading: true },
            reading: { ...DEFAULT_SRS_ENTRY, dueDate: future },
        })];
        expect(clearStaleNeedsRetry(queue, userSettings(), now)).toBe(queue);
    });

    it('handles an empty queue', () => {
        expect(clearStaleNeedsRetry([], userSettings(), now)).toEqual([]);
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

describe('words learned in kana', () => {
    const now = new Date('2026-10-07T10:00:00Z');
    const past = new Date('2026-10-01T00:00:00Z');

    it('never makes the reading quiz actionable, not even a pending retry', () => {
        const v = vocabProgress({ usuallyKana: true, totalReviews: 2, reading: srsEntry({ dueDate: past }), needsRetry: { reading: true } });
        expect(isReadingActionable(v, now)).toBe(false);
    });

    it('makes meaning their first review: due before any review is recorded', () => {
        const introduced = { introductionAt: past, nextReviewAt: past, meaning: srsEntry({ dueDate: past }) };
        expect(isMeaningActionable(vocabProgress({ ...introduced, usuallyKana: true }), undefined, now)).toBe(true);
        // A word with a reading quiz still waits for its first reading review.
        expect(isMeaningActionable(vocabProgress(introduced), undefined, now)).toBe(false);
    });
});

describe('syncUsuallyKana', () => {
    const now = new Date('2026-10-07T10:00:00Z');

    it('flags the words the dataset learns in kana and re-derives their schedule', () => {
        const queue = [
            vocabProgress({ vocabId: 'here', totalReviews: 3, reading: srsEntry({ dueDate: new Date('2026-10-01') }), meaning: srsEntry({ dueDate: new Date('2026-10-20') }) }),
            vocabProgress({ vocabId: 'mountain' }),
        ];
        const [here, mountain] = syncUsuallyKana(queue, new Set(['here']), undefined, now);
        expect(here.usuallyKana).toBe(true);
        // The overdue reading no longer counts; meaning decides.
        expect(here.nextReviewAt).toEqual(new Date('2026-10-20'));
        expect(mountain).toBe(queue[1]);
    });

    it('gives a word the dataset stops flagging its reading quiz back, due now', () => {
        const reviewed = vocabProgress({ vocabId: 'sude', usuallyKana: true, totalReviews: 4, meaning: srsEntry({ dueDate: new Date('2026-10-20') }) });
        const [synced] = syncUsuallyKana([reviewed], new Set(), undefined, now);
        expect(synced.usuallyKana).toBe(false);
        expect(synced.reading.dueDate).toEqual(now);
        expect(isReadingActionable(synced, now)).toBe(true);
    });

    it('graduates a word whose only unmastered direction was reading', () => {
        const mastered = srsEntry({ memoryStrength: CONSTANTS.srs.formula.mastery.maxMemoryStrength });
        const word = vocabProgress({ vocabId: 'kono', totalReviews: 9, meaning: mastered, production: mastered });
        const [synced] = syncUsuallyKana([word], new Set(['kono']), undefined, now);
        expect(synced.stage).toBe('graduated');
        expect(synced.nextReviewAt).toBeNull();
    });

    it('returns the same array when every flag already matches', () => {
        const queue = [vocabProgress({ vocabId: 'here', usuallyKana: true })];
        expect(syncUsuallyKana(queue, new Set(['here']), undefined, now)).toBe(queue);
    });
});

describe('meaningContextThresholdOf', () => {
    it("keeps an existing user's legacy preset when their settings are loaded over the defaults", () => {
        // storage.service and googleDriveSync load settings as { ...DEFAULT_SETTINGS, ...stored }:
        // a default for the new field would override the stored preset.
        for (const [preset, expected] of [['early', 30], ['normal', 50], ['late', 70]] as const) {
            const stored = { meaningContextThreshold: preset };
            expect(meaningContextThresholdOf({ ...DEFAULT_SETTINGS, ...stored })).toBe(expected);
        }
    });

    it('prefers meaningContextThresholdPoints over the legacy enum when both are set', () => {
        const settings = userSettings({ meaningContextThresholdPoints: 80, meaningContextThreshold: 'early' });
        expect(meaningContextThresholdOf(settings)).toBe(80);
    });

    it.each<[MeaningContextThreshold, number]>([
        ['early', 30],
        ['normal', 50],
        ['late', 70],
    ])('maps the legacy enum %s to %d when points is unset', (key, expected) => {
        const settings = userSettings({ meaningContextThreshold: key });
        expect(meaningContextThresholdOf(settings)).toBe(expected);
    });

    it('defaults to 50 when neither field is set', () => {
        expect(meaningContextThresholdOf(userSettings())).toBe(50);
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
        const settings = userSettings({ meaningContextThresholdPoints: input });
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
        const settings = userSettings({ meaningContextThresholdPoints: 50 });
        const item = getNextVocabToStudy([makeDueMeaningVocab(49)], settings, now);
        expect(item?.quizType).toBe('meaning');
        expect(item?.quizMode).toBe('base');
    });

    it('switches to context mode once the meaning ring reaches the threshold', () => {
        const settings = userSettings({ meaningContextThresholdPoints: 50 });
        const item = getNextVocabToStudy([makeDueMeaningVocab(50)], settings, now);
        expect(item?.quizType).toBe('meaning');
        expect(item?.quizMode).toBe('context');
    });

    it('a threshold of 0 always gives context mode', () => {
        const settings = userSettings({ meaningContextThresholdPoints: 0 });
        const item = getNextVocabToStudy([makeDueMeaningVocab(0)], settings, now);
        expect(item?.quizMode).toBe('context');
    });
});
