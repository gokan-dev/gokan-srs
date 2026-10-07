import { describe, expect, it } from 'vitest';
import { compactProgress, expandProgress, isCompactProgress } from './progressCompaction';
import { migrateAndHydrateProgress, toPlainProgressJSON } from './progressSerialization';
import { toStoredProgress, type StoredProgress } from './progressHydration';
import { grammarProgress, reviewLog, srsEntry, userProgress, userSettings, vocabProgress } from '../test/fixtures';
import type { UserProgress } from '../models/user.model';
import type { ReviewLog } from '../models/vocabulary.model';

const DAY = 86_400_000;
const T0 = Date.UTC(2025, 9, 1, 8, 30, 12, 345);

/** Logs one to a few days apart, with the long floats real intervals have. */
function logs(count: number, start: number): ReviewLog[] {
    const results: ReviewLog['result'][] = ['correct', 'minor_error', 'wrong', 'pass'];
    return Array.from({ length: count }, (_, i) => reviewLog({
        date: start + i * DAY * 1.7 + i * 1234,
        result: results[i % 4],
        interval: 0.2877 * (i + 1) * 1.0000001234567,
        latency: 1200 + i * 37,
    }));
}

/** A progress shaped like real data: every stage, a reinforcement log, retries, an inert production entry. */
function realisticProgress(vocabCount = 40): UserProgress {
    const learningQueue = Array.from({ length: vocabCount }, (_, i) => {
        const graduated = i % 7 === 0;
        return vocabProgress({
            vocabId: String(1_000_000 + i),
            stage: graduated ? 'graduated' : 'learning',
            introductionAt: new Date(T0 + i * DAY),
            lastReviewedAt: new Date(T0 + i * DAY + 5000),
            nextReviewAt: graduated ? null : new Date(T0 + (i + 3) * DAY),
            totalReviews: i % 5,
            consecutiveFailures: i % 3,
            needsRetry: i % 4 === 0 ? { reading: true } : undefined,
            usuallyKana: i % 6 === 1,
            reading: srsEntry({ memoryStrength: 3.141592653589793 * (i + 1), interval: 0.9038 * (i + 1), difficulty: 0.31, dueDate: new Date(T0 + (i + 2) * DAY), lastReviewedAt: new Date(T0 + i * DAY), history: logs(i % 9, T0) }),
            meaning: srsEntry({ memoryStrength: 1.5 + i, interval: 2.25, dueDate: graduated ? null : new Date(T0 + (i + 4) * DAY), history: logs(i % 4, T0 + DAY) }),
            production: i % 2 === 0
                ? srsEntry()
                : srsEntry({ memoryStrength: 2.2, history: [...logs(2, T0 + 2 * DAY), reviewLog({ date: T0 + 9 * DAY, source: 'reinforcement' })] }),
        });
    });
    return userProgress({
        kanjiKnowledge: { method: 'kklc', step: 312, kanjiSet: new Set(['日', '本', '語', '𠮷']) },
        learningQueue,
        grammarQueue: [
            grammarProgress({ grammarId: 'n5-001', introductionAt: new Date(T0), entry: srsEntry({ memoryStrength: 7.5, dueDate: new Date(T0 + DAY), history: logs(3, T0) }) }),
            grammarProgress({ grammarId: 'n4-020', stage: 'graduated', introductionAt: new Date(T0 + DAY), needsRetry: true }),
        ],
        completedChapters: ['n5-c01'],
        retiredVocabIds: ['999'],
        watchedEpisodes: { '16685:1': { watched: true, updatedAt: T0, coverageAtWatch: 0.71234 }, '16685:2': { watched: false, updatedAt: T0 + 1 } },
        stats: { newLearnedToday: 3, totalLearned: 0, totalReviews: 120 },
        dailyOverride: true,
        calibration: {
            reading: { level: 1.15, history: [true, false, true, true] },
            meaning: { level: 1, history: [] },
            production: { level: 0.95, history: [false] },
            grammar: { level: 1, history: [true] },
        },
        _sync: { lastModified: T0, version: 42 },
        _formatVersion: 12,
    });
}

const settings = userSettings();

/** Through localStorage and back: compact, stringify, parse, expand. */
function storageRoundTrip(stored: StoredProgress): StoredProgress {
    const parsed: unknown = JSON.parse(JSON.stringify(compactProgress(stored)));
    return toStoredProgress(expandProgress(parsed));
}

describe('progress compaction', () => {
    it('hydrates to exactly the progress the readable form hydrates to', () => {
        const stored = toPlainProgressJSON(realisticProgress());
        const viaCompact = migrateAndHydrateProgress(storageRoundTrip(stored), settings);
        const viaReadable = migrateAndHydrateProgress(stored, settings);
        expect(viaCompact).toEqual(viaReadable);
    });

    it('stores the usuallyKana flag only when set, and restores it either way', () => {
        const stored = toPlainProgressJSON(userProgress({ learningQueue: [vocabProgress({ vocabId: 'here', usuallyKana: true }), vocabProgress({ vocabId: 'mountain' })] }));
        const compactQueue = JSON.stringify(compactProgress(stored));
        expect(compactQueue.match(/"uk"/g)).toHaveLength(1);
        const hydrated = migrateAndHydrateProgress(storageRoundTrip(stored), settings);
        expect(hydrated.learningQueue.map(v => v.usuallyKana)).toEqual([true, false]);
    });

    it('is stable: compacting an expanded payload gives the same compact payload', () => {
        const stored = toPlainProgressJSON(realisticProgress());
        const once = compactProgress(stored);
        expect(compactProgress(storageRoundTrip(stored))).toEqual(once);
    });

    it('keeps review logs, including their order, source and full float precision', () => {
        const progress = realisticProgress();
        const restored = migrateAndHydrateProgress(storageRoundTrip(toPlainProgressJSON(progress)), settings);
        for (const [i, item] of progress.learningQueue.entries()) {
            expect(restored.learningQueue[i].reading.history).toEqual(item.reading.history);
            expect(restored.learningQueue[i].production?.history).toEqual(item.production?.history);
            expect(restored.learningQueue[i].reading.memoryStrength).toBe(item.reading.memoryStrength);
        }
    });

    it('marks a compact payload and leaves a readable one (saved before compaction) untouched', () => {
        const stored = toPlainProgressJSON(realisticProgress(3));
        expect(isCompactProgress(compactProgress(stored))).toBe(true);
        expect(isCompactProgress(stored)).toBe(false);
        expect(expandProgress(stored)).toBe(stored);
    });

    it('keeps fields it does not know, even one named like a code', () => {
        const stored: StoredProgress = { ...toPlainProgressJSON(realisticProgress(2)), ...{ i: 'unknown field', '!x': 1, futureField: { nested: [1, 2] } } };
        const restored = storageRoundTrip(stored);
        expect(restored).toMatchObject({ i: 'unknown field', '!x': 1, futureField: { nested: [1, 2] } });
    });

    it('keeps a review log it cannot turn into a tuple', () => {
        const stored = toPlainProgressJSON(userProgress({
            learningQueue: [vocabProgress({ reading: srsEntry({ history: [reviewLog({ date: T0 })] }) })],
        }));
        const item = stored.learningQueue?.[0];
        const withExtraField = { ...stored, learningQueue: [{ ...item, reading: { ...item?.reading, history: [{ date: T0, result: 'correct', interval: 1, latency: 900, note: 'from a newer build' }] } }] };
        // Through JSON, as stored data always is: a field this build does not know has no static type.
        const restored = storageRoundTrip(toStoredProgress(JSON.parse(JSON.stringify(withExtraField))));
        expect(restored.learningQueue?.[0]?.reading?.history).toEqual([{ date: T0, result: 'correct', interval: 1, latency: 900, note: 'from a newer build' }]);
    });

    it('takes well under half the space of the readable form', () => {
        const stored = toPlainProgressJSON(realisticProgress(400));
        const readable = JSON.stringify(stored).length;
        const compact = JSON.stringify(compactProgress(stored)).length;
        expect(compact / readable).toBeLessThan(0.45);
    });
});
