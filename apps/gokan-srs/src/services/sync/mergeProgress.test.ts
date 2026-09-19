import { describe, it, expect } from 'vitest';
import { mergeEntry, mergeVocabProgress, mergeLearningQueues, mergeGrammarProgress, mergeGrammarQueues, mergeProgress, mergeSettings } from './mergeProgress';
import type { ProgressWithMetadata } from './types';
import type { SRSEntry, VocabProgress } from '../../models/vocabulary.model';
import { DEFAULT_VOCABULARY_PROGRESS } from '../../models/vocabulary.model';
import type { GrammarProgress } from '../../models/grammar.model';
import { DEFAULT_GRAMMAR_PROGRESS } from '../../models/grammar.model';

function makeEntry(overrides: Partial<SRSEntry> = {}): SRSEntry {
    return {
        memoryStrength: 10,
        interval: 5,
        difficulty: 0.3,
        lastReviewedAt: null,
        dueDate: null,
        history: [],
        ...overrides,
    };
}

function makeVocabProgress(overrides: Partial<VocabProgress> = {}): VocabProgress {
    return { ...DEFAULT_VOCABULARY_PROGRESS, vocabId: 'v1', ...overrides };
}

function makeGrammarProgress(overrides: Partial<GrammarProgress> = {}): GrammarProgress {
    return { ...DEFAULT_GRAMMAR_PROGRESS, grammarId: 'g1', ...overrides };
}

function makeProgress(overrides: Partial<ProgressWithMetadata> = {}): ProgressWithMetadata {
    return {
        kanjiKnowledge: { method: 'kklc', step: 100, kanjiSet: new Set(['A']) },
        learningQueue: [],
        grammarQueue: [],
        stats: { totalReviews: 0, totalLearned: 0, newLearnedToday: 0 },
        dailyOverride: false,
        adaptive: { level: 1.0, history: [] },
        ...overrides,
    };
}

describe('mergeEntry', () => {
    it('takes scheduling fields from whichever side reviewed more recently', () => {
        const local = makeEntry({ lastReviewedAt: new Date('2026-01-01'), difficulty: 0.5, dueDate: new Date('2026-01-05') });
        const remote = makeEntry({ lastReviewedAt: new Date('2026-01-02'), difficulty: 0.8, dueDate: new Date('2026-01-06') });

        const merged = mergeEntry(local, remote);
        expect(merged.difficulty).toBe(0.8);
        expect(merged.dueDate).toEqual(new Date('2026-01-06'));
    });

    it('takes memoryStrength/interval as the max of both sides regardless of recency winner', () => {
        const local = makeEntry({ memoryStrength: 50, interval: 20, lastReviewedAt: new Date('2026-01-02') }); // more recent but lower strength
        const remote = makeEntry({ memoryStrength: 80, interval: 10, lastReviewedAt: new Date('2026-01-01') });

        const merged = mergeEntry(local, remote);
        expect(merged.memoryStrength).toBe(80); // max, even though local "won" recency
        expect(merged.interval).toBe(20); // max
    });

    it('unions history from both sides, deduped by date', () => {
        const local = makeEntry({ history: [{ date: 100, result: 'correct', interval: 1, latency: 500 }, { date: 200, result: 'wrong', interval: 1, latency: 500 }] });
        const remote = makeEntry({ history: [{ date: 200, result: 'wrong', interval: 1, latency: 500 }, { date: 300, result: 'correct', interval: 2, latency: 400 }] });

        const merged = mergeEntry(local, remote);
        expect(merged.history.map(h => h.date)).toEqual([100, 200, 300]);
    });

    it('caps merged history at 20 entries', () => {
        const local = makeEntry({ history: Array.from({ length: 15 }, (_, i) => ({ date: i, result: 'correct' as const, interval: 1, latency: 100 })) });
        const remote = makeEntry({ history: Array.from({ length: 15 }, (_, i) => ({ date: 100 + i, result: 'correct' as const, interval: 1, latency: 100 })) });

        const merged = mergeEntry(local, remote);
        expect(merged.history).toHaveLength(20);
    });
});

describe('mergeVocabProgress (per-entry merge - the core fix)', () => {
    it('never lets a reading-only review on one device clobber a meaning review on another', () => {
        // Device A reviewed READING only (meaning untouched, still at defaults).
        const deviceA = makeVocabProgress({
            reading: makeEntry({ memoryStrength: 200, lastReviewedAt: new Date('2026-02-01') }),
            meaning: makeEntry({ memoryStrength: 1, lastReviewedAt: null }),
        });
        // Device B reviewed MEANING only (reading untouched, still at defaults).
        const deviceB = makeVocabProgress({
            reading: makeEntry({ memoryStrength: 1, lastReviewedAt: null }),
            meaning: makeEntry({ memoryStrength: 150, lastReviewedAt: new Date('2026-02-02') }),
        });

        const merged = mergeVocabProgress(deviceA, deviceB);

        // Both devices' progress must survive - neither clobbers the other.
        expect(merged.reading.memoryStrength).toBe(200);
        expect(merged.meaning.memoryStrength).toBe(150);
    });

    it('re-derives stage/nextReviewAt rather than merging them directly', () => {
        const local = makeVocabProgress({
            reading: makeEntry({ memoryStrength: 1270, dueDate: null }), // mastered
            meaning: makeEntry({ memoryStrength: 1, dueDate: new Date('2026-03-01') }),
        });
        const remote = makeVocabProgress({
            reading: makeEntry({ memoryStrength: 1270, dueDate: null }),
            meaning: makeEntry({ memoryStrength: 1, dueDate: new Date('2026-03-02') }),
        });

        const merged = mergeVocabProgress(local, remote, { enableMeaningQuiz: true });
        expect(merged.stage).toBe('learning'); // not graduated - meaning still unmastered
        expect(merged.nextReviewAt).toEqual(new Date('2026-03-01')); // earlier of the two meaning due dates
    });

    it('graduates when meaning quizzes are disabled and only reading is mastered, regardless of stale meaning fields', () => {
        const local = makeVocabProgress({
            reading: makeEntry({ memoryStrength: 1270, dueDate: null }),
            meaning: makeEntry({ memoryStrength: 1, dueDate: new Date('2026-03-01') }),
        });
        const remote = makeVocabProgress({
            reading: makeEntry({ memoryStrength: 1270, dueDate: null }),
            meaning: makeEntry({ memoryStrength: 1, dueDate: new Date('2026-03-02') }),
        });

        const merged = mergeVocabProgress(local, remote, { enableMeaningQuiz: false });
        expect(merged.stage).toBe('graduated');
        expect(merged.nextReviewAt).toBeNull();
    });

    it('graduates if either side already graduated', () => {
        const local = makeVocabProgress({ stage: 'graduated' });
        const remote = makeVocabProgress({ stage: 'learning' });
        expect(mergeVocabProgress(local, remote).stage).toBe('graduated');
    });

    it('merges needsRetry per-type via OR when neither side can be ordered (a tie), never silently dropping a pending retry', () => {
        const local = makeVocabProgress({ needsRetry: { reading: true } });
        const remote = makeVocabProgress({ needsRetry: { meaning: true } });

        const merged = mergeVocabProgress(local, remote);
        expect(merged.needsRetry).toEqual({ reading: true, meaning: true, production: false });
    });

    it('does not resurrect a needsRetry flag the user already resolved more recently than a stale remote snapshot', () => {
        // Regression: a successful retry stamps lastReviewedAt on its entry (see
        // srs.service.ts) without touching scheduling fields. `remote` here models
        // a copy of progress uploaded BEFORE the retry was answered - if a background
        // sync merges this in afterwards, the flag must not come back.
        const local = makeVocabProgress({
            needsRetry: undefined, // just resolved locally
            reading: makeEntry({ lastReviewedAt: new Date('2026-04-01T12:00:05Z') }),
        });
        const remote = makeVocabProgress({
            needsRetry: { reading: true }, // stale - predates the retry resolution
            reading: makeEntry({ lastReviewedAt: new Date('2026-04-01T12:00:00Z') }),
        });

        const merged = mergeVocabProgress(local, remote);
        expect(merged.needsRetry?.reading).toBeFalsy();
    });

    it('mirrors the fix when remote is the side that resolved the retry more recently', () => {
        const local = makeVocabProgress({
            needsRetry: { reading: true }, // stale on this side
            reading: makeEntry({ lastReviewedAt: new Date('2026-04-01T12:00:00Z') }),
        });
        const remote = makeVocabProgress({
            needsRetry: undefined, // resolved on remote, more recently
            reading: makeEntry({ lastReviewedAt: new Date('2026-04-01T12:00:05Z') }),
        });

        const merged = mergeVocabProgress(local, remote);
        expect(merged.needsRetry?.reading).toBeFalsy();
    });

    it('keeps a needsRetry flag that is still true on the more recent side (genuinely pending, not stale)', () => {
        // Local's snapshot is older and never saw the retry at all; remote is more
        // recent and still needs it - this must NOT be cleared just because one
        // side lacks the flag.
        const local = makeVocabProgress({
            needsRetry: undefined,
            reading: makeEntry({ lastReviewedAt: new Date('2026-04-01T12:00:00Z') }),
        });
        const remote = makeVocabProgress({
            needsRetry: { reading: true },
            reading: makeEntry({ lastReviewedAt: new Date('2026-04-01T12:00:05Z') }),
        });

        const merged = mergeVocabProgress(local, remote);
        expect(merged.needsRetry?.reading).toBe(true);
    });

    it('leaves needsRetry undefined when neither side has a pending retry', () => {
        const merged = mergeVocabProgress(makeVocabProgress(), makeVocabProgress());
        expect(merged.needsRetry).toBeUndefined();
    });

    it('takes the earliest non-null introductionAt', () => {
        const local = makeVocabProgress({ introductionAt: new Date('2026-01-05') });
        const remote = makeVocabProgress({ introductionAt: new Date('2026-01-01') });
        expect(mergeVocabProgress(local, remote).introductionAt).toEqual(new Date('2026-01-01'));
    });

    it('takes totalReviews as the max of both sides', () => {
        const local = makeVocabProgress({ totalReviews: 3 });
        const remote = makeVocabProgress({ totalReviews: 7 });
        expect(mergeVocabProgress(local, remote).totalReviews).toBe(7);
    });
});

describe('mergeLearningQueues', () => {
    it('is a pure union - items present on only one side are preserved, never dropped', () => {
        const local = [makeVocabProgress({ vocabId: 'only-local' })];
        const remote = [makeVocabProgress({ vocabId: 'only-remote' })];

        const merged = mergeLearningQueues(local, remote);
        expect(merged.map(v => v.vocabId).sort()).toEqual(['only-local', 'only-remote']);
    });

    it('merges items present on both sides via mergeVocabProgress', () => {
        const local = [makeVocabProgress({ vocabId: 'shared', totalReviews: 2 })];
        const remote = [makeVocabProgress({ vocabId: 'shared', totalReviews: 9 })];

        const merged = mergeLearningQueues(local, remote);
        expect(merged).toHaveLength(1);
        expect(merged[0].totalReviews).toBe(9);
    });
});

describe('mergeGrammarProgress', () => {
    it('takes the max of memoryStrength/interval as a safety net, mirroring mergeEntry', () => {
        const local = makeGrammarProgress({ entry: makeEntry({ memoryStrength: 5, interval: 2 }) });
        const remote = makeGrammarProgress({ entry: makeEntry({ memoryStrength: 20, interval: 10 }) });

        const merged = mergeGrammarProgress(local, remote);
        expect(merged.entry.memoryStrength).toBe(20);
        expect(merged.entry.interval).toBe(10);
    });

    it('needsRetry is true if either side has a pending retry', () => {
        const local = makeGrammarProgress({ needsRetry: false });
        const remote = makeGrammarProgress({ needsRetry: true });
        expect(mergeGrammarProgress(local, remote).needsRetry).toBe(true);
    });

    it('stage/nextReviewAt are re-derived, not merged directly - graduated if either side already was', () => {
        const local = makeGrammarProgress({ stage: 'learning' });
        const remote = makeGrammarProgress({ stage: 'graduated' });

        const merged = mergeGrammarProgress(local, remote);
        expect(merged.stage).toBe('graduated');
        expect(merged.nextReviewAt).toBeNull();
    });

    it('totalReviews takes the max of both sides', () => {
        const local = makeGrammarProgress({ totalReviews: 2 });
        const remote = makeGrammarProgress({ totalReviews: 9 });
        expect(mergeGrammarProgress(local, remote).totalReviews).toBe(9);
    });
});

describe('mergeGrammarQueues', () => {
    it('is a pure union - items on only one side are preserved', () => {
        const local = [makeGrammarProgress({ grammarId: 'only-local' })];
        const remote = [makeGrammarProgress({ grammarId: 'only-remote' })];

        const merged = mergeGrammarQueues(local, remote);
        expect(merged.map(g => g.grammarId).sort()).toEqual(['only-local', 'only-remote']);
    });

    it('merges items present on both sides via mergeGrammarProgress', () => {
        const local = [makeGrammarProgress({ grammarId: 'shared', totalReviews: 2 })];
        const remote = [makeGrammarProgress({ grammarId: 'shared', totalReviews: 9 })];

        const merged = mergeGrammarQueues(local, remote);
        expect(merged).toHaveLength(1);
        expect(merged[0].totalReviews).toBe(9);
    });
});

describe('mergeProgress (top-level)', () => {
    it('returns null when both sides are null', () => {
        expect(mergeProgress(null, null)).toBeNull();
    });

    it('adds sync metadata when only one side exists', () => {
        const remote = makeProgress();
        const merged = mergeProgress(null, remote);
        expect(merged?._sync?.version).toBe(1);
    });

    it('stats are merged field-wise as the max of both sides', () => {
        const local = makeProgress({ stats: { totalReviews: 100, totalLearned: 5, newLearnedToday: 1 } });
        const remote = makeProgress({ stats: { totalReviews: 50, totalLearned: 20, newLearnedToday: 3 } });

        const merged = mergeProgress(local, remote)!;
        expect(merged.stats).toEqual({ totalReviews: 100, totalLearned: 20, newLearnedToday: 3 });
    });

    it('kanjiKnowledge: local wins on a version tie (preserves un-pushed local edits/deletions)', () => {
        const local = makeProgress({ kanjiKnowledge: { method: 'kklc', step: 100, kanjiSet: new Set(['A']) }, _sync: { lastModified: 0, version: 1 } });
        const remote = makeProgress({ kanjiKnowledge: { method: 'kklc', step: 100, kanjiSet: new Set(['A', 'B']) }, _sync: { lastModified: 0, version: 1 } });

        const merged = mergeProgress(local, remote)!;
        expect(merged.kanjiKnowledge.kanjiSet.has('B')).toBe(false); // local's deletion of B is preserved
    });

    it('kanjiKnowledge: remote wins when its version is strictly newer', () => {
        const local = makeProgress({ kanjiKnowledge: { method: 'kklc', step: 100, kanjiSet: new Set(['A']) }, _sync: { lastModified: 0, version: 1 } });
        const remote = makeProgress({ kanjiKnowledge: { method: 'kklc', step: 100, kanjiSet: new Set(['A', 'B']) }, _sync: { lastModified: 0, version: 2 } });

        const merged = mergeProgress(local, remote)!;
        expect(merged.kanjiKnowledge.kanjiSet.has('B')).toBe(true);
    });

    it('dailyOverride is combined via logical OR', () => {
        const local = makeProgress({ dailyOverride: false });
        const remote = makeProgress({ dailyOverride: true });
        expect(mergeProgress(local, remote)!.dailyOverride).toBe(true);
    });

    it('bumps the version counter to one past the higher of the two inputs', () => {
        const local = makeProgress({ _sync: { lastModified: 0, version: 3 } });
        const remote = makeProgress({ _sync: { lastModified: 0, version: 7 } });
        expect(mergeProgress(local, remote)!._sync?.version).toBe(8);
    });

    it('grammarQueue is merged as a pure union, mirroring learningQueue', () => {
        const local = makeProgress({ grammarQueue: [makeGrammarProgress({ grammarId: 'only-local' })] });
        const remote = makeProgress({ grammarQueue: [makeGrammarProgress({ grammarId: 'only-remote' })] });

        const merged = mergeProgress(local, remote)!;
        expect(merged.grammarQueue.map(g => g.grammarId).sort()).toEqual(['only-local', 'only-remote']);
    });
});

describe('mergeSettings', () => {
    it('returns local when remote is null', () => {
        const local = { preferredLearningOrder: 'frequency' } as any;
        expect(mergeSettings(local, null, 1, 0)).toBe(local);
    });

    it('returns remote only when its version is strictly greater', () => {
        const local = { preferredLearningOrder: 'frequency' } as any;
        const remote = { preferredLearningOrder: 'kklc' } as any;

        expect(mergeSettings(local, remote, 2, 1)).toBe(local);
        expect(mergeSettings(local, remote, 1, 1)).toBe(local); // tie -> local wins
        expect(mergeSettings(local, remote, 1, 2)).toBe(remote);
    });
});
