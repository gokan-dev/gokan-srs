import { describe, it, expect } from 'vitest';
import { toPlainProgressJSON, migrateAndHydrateProgress } from './progressSerialization';

/**
 * Golden round-trip test: a realistic snapshot of an active daily user's progress,
 * spanning old (mastery-only) items, mid-migration items, and current-format items,
 * pushed through the exact pipeline StorageService.loadProgress() uses. Verifies that
 * migrating pre-existing production data never drops a vocab item, a history log, or
 * a due date - the "zero data loss on first migration" guarantee.
 */
describe('Migration round-trip (zero data loss)', () => {
    const rawProductionSnapshot = {
        // No _formatVersion -> oldest possible starting point
        kanjiKnowledge: {
            method: 'kklc',
            step: 250,
            kanjiSet: ['日', '月', '火', '水', '木', '金', '土'],
        },
        learningQueue: [
            // 1. Pure old-format item (mastery only, no reading/meaning at all)
            {
                vocabId: 'old-mastery-only',
                stage: 'learning',
                mastery: 82,
                introductionAt: '2026-01-05T09:00:00.000Z',
                nextReviewAt: '2026-02-10T09:00:00.000Z',
                lastReviewedAt: '2026-02-01T09:00:00.000Z',
                totalReviews: 12,
                consecutiveFailures: 0,
            },
            // 2. Mixed-format item (has both mastery and zeroed reading/meaning stubs)
            {
                vocabId: 'mixed-format',
                stage: 'learning',
                mastery: 45,
                introductionAt: '2026-01-10T09:00:00.000Z',
                nextReviewAt: '2026-01-20T09:00:00.000Z',
                lastReviewedAt: '2026-01-19T09:00:00.000Z',
                totalReviews: 3,
                consecutiveFailures: 1,
                reading: { memoryStrength: 0, interval: 0, difficulty: 0.3, lastReviewedAt: null, dueDate: null, history: [] },
                meaning: { memoryStrength: 0, interval: 0, difficulty: 0.3, lastReviewedAt: null, dueDate: null, history: [] },
            },
            // 3. Fully current-format item with rich history that must survive untouched
            {
                vocabId: 'current-format-rich-history',
                stage: 'learning',
                introductionAt: '2025-12-01T09:00:00.000Z',
                nextReviewAt: '2026-03-01T09:00:00.000Z',
                lastReviewedAt: '2026-02-20T09:00:00.000Z',
                totalReviews: 8,
                consecutiveFailures: 0,
                needsRetry: false,
                reading: {
                    memoryStrength: 320.5,
                    interval: 90.2,
                    difficulty: 0.62,
                    lastReviewedAt: '2026-02-20T09:00:00.000Z',
                    dueDate: '2026-03-01T09:00:00.000Z',
                    history: [
                        { date: 1735000000000, result: 'correct', interval: 5, latency: 1200 },
                        { date: 1735600000000, result: 'minor_error', interval: 10, latency: 4300 },
                        { date: 1736200000000, result: 'correct', interval: 20, latency: 900 },
                    ],
                },
                meaning: {
                    memoryStrength: 210.0,
                    interval: 60.1,
                    difficulty: 0.55,
                    lastReviewedAt: '2026-02-18T09:00:00.000Z',
                    dueDate: '2026-02-28T21:00:00.000Z',
                    history: [
                        { date: 1735300000000, result: 'correct', interval: 8, latency: 3000 },
                    ],
                },
            },
            // 4. Graduated / mastered item (should stay graduated, dueDate null preserved)
            {
                vocabId: 'graduated-item',
                stage: 'graduated',
                introductionAt: '2025-06-01T09:00:00.000Z',
                nextReviewAt: null,
                lastReviewedAt: '2025-11-01T09:00:00.000Z',
                totalReviews: 40,
                consecutiveFailures: 0,
                reading: { memoryStrength: 1270, interval: 3650, difficulty: 0.9, lastReviewedAt: '2025-11-01T09:00:00.000Z', dueDate: null, history: [] },
                meaning: { memoryStrength: 1270, interval: 3650, difficulty: 0.9, lastReviewedAt: '2025-11-01T09:00:00.000Z', dueDate: null, history: [] },
            },
        ],
        stats: {
            newLearnedToday: 4,
            totalLearned: 312,
            totalReviews: 5821,
        },
        dailyOverride: false,
        // No _formatVersion field -> oldest possible starting point, exercises the
        // full historical migration chain (V1 mastery-conversion onward).
    };

    it('preserves every vocab item across the full migrate -> hydrate pipeline', () => {
        const hydrated = migrateAndHydrateProgress(structuredClone(rawProductionSnapshot));

        expect(hydrated.learningQueue).toHaveLength(4);
        const ids = hydrated.learningQueue.map(v => v.vocabId).sort();
        expect(ids).toEqual([
            'current-format-rich-history',
            'graduated-item',
            'mixed-format',
            'old-mastery-only',
        ].sort());
    });

    it('preserves review history entries exactly (no logs dropped)', () => {
        const hydrated = migrateAndHydrateProgress(structuredClone(rawProductionSnapshot));
        const rich = hydrated.learningQueue.find(v => v.vocabId === 'current-format-rich-history')!;

        expect(rich.reading.history).toHaveLength(3);
        expect(rich.meaning.history).toHaveLength(1);
        expect(rich.reading.history.map(h => h.date)).toEqual([1735000000000, 1735600000000, 1736200000000]);
    });

    it('preserves due dates and hydrates them as real Date instances', () => {
        const hydrated = migrateAndHydrateProgress(structuredClone(rawProductionSnapshot));
        const rich = hydrated.learningQueue.find(v => v.vocabId === 'current-format-rich-history')!;

        expect(rich.reading.dueDate).toBeInstanceOf(Date);
        expect(rich.reading.dueDate!.toISOString()).toBe('2026-03-01T09:00:00.000Z');
        expect(rich.meaning.dueDate!.toISOString()).toBe('2026-02-28T21:00:00.000Z');
    });

    it('preserves graduated stage and null due dates (does not resurrect mastered items)', () => {
        const hydrated = migrateAndHydrateProgress(structuredClone(rawProductionSnapshot));
        const graduated = hydrated.learningQueue.find(v => v.vocabId === 'graduated-item')!;

        expect(graduated.stage).toBe('graduated');
        expect(graduated.nextReviewAt).toBeNull();
        expect(graduated.reading.dueDate).toBeNull();
        expect(graduated.meaning.dueDate).toBeNull();
        expect(graduated.reading.memoryStrength).toBe(1270);
    });

    it('preserves the mastery field for backward reference on old-format items', () => {
        const hydrated = migrateAndHydrateProgress(structuredClone(rawProductionSnapshot));
        const old = hydrated.learningQueue.find(v => v.vocabId === 'old-mastery-only')! as any;

        expect(old.mastery).toBe(82);
        expect(old.reading.memoryStrength).toBeGreaterThan(0);
    });

    it('preserves kanjiKnowledge (as a real Set) and top-level stats', () => {
        const hydrated = migrateAndHydrateProgress(structuredClone(rawProductionSnapshot));

        expect(hydrated.kanjiKnowledge.kanjiSet).toBeInstanceOf(Set);
        expect(hydrated.kanjiKnowledge.kanjiSet.size).toBe(7);
        expect(hydrated.kanjiKnowledge.kanjiSet.has('日')).toBe(true);
        expect(hydrated.stats.totalReviews).toBe(5821);
        expect(hydrated.stats.totalLearned).toBe(312);
    });

    it('is idempotent: migrating an already-migrated snapshot a second time changes nothing observable', () => {
        const firstPass = migrateAndHydrateProgress(structuredClone(rawProductionSnapshot));
        const serialized = toPlainProgressJSON(firstPass);
        const secondPass = migrateAndHydrateProgress(structuredClone(serialized));

        expect(secondPass.learningQueue).toHaveLength(firstPass.learningQueue.length);
        for (const item of firstPass.learningQueue) {
            const again = secondPass.learningQueue.find(v => v.vocabId === item.vocabId)!;
            expect(again).toBeDefined();
            expect(again.reading.memoryStrength).toBeCloseTo(item.reading.memoryStrength, 4);
            expect(again.reading.history).toHaveLength(item.reading.history.length);
            expect(again.stage).toBe(item.stage);
        }
    });

    it('round-trips through serialize -> JSON.stringify -> parse -> hydrate without losing Sets or Dates', () => {
        const hydrated = migrateAndHydrateProgress(structuredClone(rawProductionSnapshot));
        const plain = toPlainProgressJSON(hydrated);
        const asString = JSON.stringify(plain);
        const reparsed = JSON.parse(asString);
        const rehydrated = migrateAndHydrateProgress(reparsed);

        expect(rehydrated.kanjiKnowledge.kanjiSet).toBeInstanceOf(Set);
        expect(rehydrated.kanjiKnowledge.kanjiSet.size).toBe(hydrated.kanjiKnowledge.kanjiSet.size);
        expect(rehydrated.learningQueue).toHaveLength(hydrated.learningQueue.length);

        const rich = rehydrated.learningQueue.find(v => v.vocabId === 'current-format-rich-history')!;
        expect(rich.reading.dueDate).toBeInstanceOf(Date);
        expect(rich.reading.history).toHaveLength(3);
    });
});

describe('production entry survives a storage round trip', () => {
    it('hydrates production dueDate into a real Date, not a string', () => {
        // Regression: hydrateProgress converted dates for reading and meaning only.
        // A string dueDate makes every `dueDate <= now` comparison against a Date
        // evaluate false, so the production quiz never came due - silently, with
        // nothing thrown and no pure-logic test able to see it, because the strings
        // only exist on the far side of a storage round trip.
        const due = new Date('2026-03-01T00:00:00Z');
        const raw = {
            _formatVersion: 7,
            kanjiKnowledge: { method: 'kklc', step: 10, kanjiSet: [] },
            grammarQueue: [],
            stats: { newLearnedToday: 0, totalLearned: 1, totalReviews: 4 },
            learningQueue: [{
                vocabId: 'v1',
                stage: 'learning',
                introductionAt: '2025-01-01T00:00:00.000Z',
                nextReviewAt: null,
                lastReviewedAt: null,
                totalReviews: 4,
                consecutiveFailures: 0,
                reading: { memoryStrength: 50, interval: 2, difficulty: 0.3, lastReviewedAt: null, dueDate: null, history: [] },
                meaning: { memoryStrength: 80, interval: 3, difficulty: 0.3, lastReviewedAt: null, dueDate: null, history: [] },
                production: { memoryStrength: 40, interval: 1, difficulty: 0.3, lastReviewedAt: null, dueDate: due.toISOString(), history: [] },
            }],
        };

        const hydrated = migrateAndHydrateProgress(raw);
        const item = hydrated.learningQueue[0];

        expect(item.production!.dueDate).toBeInstanceOf(Date);
        expect(item.production!.dueDate!.getTime()).toBe(due.getTime());
    });

    it('round-trips a production schedule through serialize -> reparse without loss', () => {
        const due = new Date('2026-03-01T00:00:00Z');
        const raw = {
            _formatVersion: 7,
            kanjiKnowledge: { method: 'kklc', step: 10, kanjiSet: [] },
            grammarQueue: [],
            stats: { newLearnedToday: 0, totalLearned: 1, totalReviews: 4 },
            learningQueue: [{
                vocabId: 'v1',
                stage: 'learning',
                introductionAt: '2025-01-01T00:00:00.000Z',
                nextReviewAt: null,
                lastReviewedAt: null,
                totalReviews: 4,
                consecutiveFailures: 0,
                reading: { memoryStrength: 50, interval: 2, difficulty: 0.3, lastReviewedAt: null, dueDate: null, history: [] },
                meaning: { memoryStrength: 80, interval: 3, difficulty: 0.3, lastReviewedAt: null, dueDate: null, history: [] },
                production: { memoryStrength: 40, interval: 1, difficulty: 0.3, lastReviewedAt: null, dueDate: due.toISOString(), history: [] },
            }],
        };

        const once = migrateAndHydrateProgress(raw);
        const reparsed = migrateAndHydrateProgress(JSON.parse(JSON.stringify(toPlainProgressJSON(once))));
        const item = reparsed.learningQueue[0];

        expect(item.production!.dueDate).toBeInstanceOf(Date);
        expect(item.production!.dueDate!.getTime()).toBe(due.getTime());
        expect(item.production!.memoryStrength).toBe(40);
    });

    it('does not share one production entry object across queue items', () => {
        const mk = (vocabId: string) => ({
            vocabId, stage: 'learning', introductionAt: '2025-01-01T00:00:00.000Z',
            nextReviewAt: null, lastReviewedAt: null, totalReviews: 1, consecutiveFailures: 0,
            reading: { memoryStrength: 50, interval: 2, difficulty: 0.3, lastReviewedAt: null, dueDate: null, history: [] },
            meaning: { memoryStrength: 80, interval: 3, difficulty: 0.3, lastReviewedAt: null, dueDate: null, history: [] },
        });
        const hydrated = migrateAndHydrateProgress({
            _formatVersion: 7,
            kanjiKnowledge: { method: 'kklc', step: 10, kanjiSet: [] },
            grammarQueue: [],
            stats: { newLearnedToday: 0, totalLearned: 0, totalReviews: 0 },
            learningQueue: [mk('a'), mk('b')],
        });

        expect(hydrated.learningQueue[0].production).not.toBe(hydrated.learningQueue[1].production);
    });
});
