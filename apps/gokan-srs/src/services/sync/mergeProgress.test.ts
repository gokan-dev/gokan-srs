import { describe, it, expect } from 'vitest';
import { mergeEntry, mergeVocabProgress, mergeLearningQueues, mergeGrammarProgress, mergeGrammarQueues, mergeProgress, mergeSettings } from './mergeProgress';
import type { ProgressWithMetadata } from './types';
import type { SRSEntry } from '../../models/vocabulary.model';
import type { GrammarProgress } from '../../models/grammar.model';
import { DEFAULT_SETTINGS, type UserSettings } from '../../models/user.model';
import { grammarProgress, srsEntry, userProgress, vocabProgress } from '../../test/fixtures';

const makeEntry = (overrides: Partial<SRSEntry> = {}): SRSEntry => srsEntry({ memoryStrength: 10, interval: 5, ...overrides });

const makeGrammarProgress = (overrides: Partial<GrammarProgress> = {}): GrammarProgress => grammarProgress({ grammarId: 'g1', ...overrides });

const makeProgress = (overrides: Partial<ProgressWithMetadata> = {}): ProgressWithMetadata =>
    userProgress({ kanjiKnowledge: { method: 'kklc', step: 100, kanjiSet: new Set(['A']) }, ...overrides });

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
        const deviceA = vocabProgress({
            reading: makeEntry({ memoryStrength: 200, lastReviewedAt: new Date('2026-02-01') }),
            meaning: makeEntry({ memoryStrength: 1, lastReviewedAt: null }),
        });
        // Device B reviewed MEANING only (reading untouched, still at defaults).
        const deviceB = vocabProgress({
            reading: makeEntry({ memoryStrength: 1, lastReviewedAt: null }),
            meaning: makeEntry({ memoryStrength: 150, lastReviewedAt: new Date('2026-02-02') }),
        });

        const merged = mergeVocabProgress(deviceA, deviceB);

        // Both devices' progress must survive - neither clobbers the other.
        expect(merged.reading.memoryStrength).toBe(200);
        expect(merged.meaning.memoryStrength).toBe(150);
    });

    it('re-derives stage/nextReviewAt rather than merging them directly', () => {
        const local = vocabProgress({
            reading: makeEntry({ memoryStrength: 1270, dueDate: null }), // mastered
            meaning: makeEntry({ memoryStrength: 1, dueDate: new Date('2026-03-01') }),
        });
        const remote = vocabProgress({
            reading: makeEntry({ memoryStrength: 1270, dueDate: null }),
            meaning: makeEntry({ memoryStrength: 1, dueDate: new Date('2026-03-02') }),
        });

        const merged = mergeVocabProgress(local, remote, { enableMeaningQuiz: true });
        expect(merged.stage).toBe('learning'); // not graduated - meaning still unmastered
        expect(merged.nextReviewAt).toEqual(new Date('2026-03-01')); // earlier of the two meaning due dates
    });

    it('graduates when meaning quizzes are disabled and only reading is mastered, regardless of stale meaning fields', () => {
        const local = vocabProgress({
            reading: makeEntry({ memoryStrength: 1270, dueDate: null }),
            meaning: makeEntry({ memoryStrength: 1, dueDate: new Date('2026-03-01') }),
        });
        const remote = vocabProgress({
            reading: makeEntry({ memoryStrength: 1270, dueDate: null }),
            meaning: makeEntry({ memoryStrength: 1, dueDate: new Date('2026-03-02') }),
        });

        const merged = mergeVocabProgress(local, remote, { enableMeaningQuiz: false });
        expect(merged.stage).toBe('graduated');
        expect(merged.nextReviewAt).toBeNull();
    });

    it('graduates if either side already graduated', () => {
        const local = vocabProgress({ stage: 'graduated' });
        const remote = vocabProgress({ stage: 'learning' });
        expect(mergeVocabProgress(local, remote).stage).toBe('graduated');
    });

    it('merges needsRetry per-type via OR when neither side can be ordered (a tie), never silently dropping a pending retry', () => {
        const local = vocabProgress({ needsRetry: { reading: true } });
        const remote = vocabProgress({ needsRetry: { meaning: true } });

        const merged = mergeVocabProgress(local, remote);
        expect(merged.needsRetry).toEqual({ reading: true, meaning: true, production: false });
    });

    it('does not resurrect a needsRetry flag the user already resolved more recently than a stale remote snapshot', () => {
        // Regression: a successful retry stamps lastReviewedAt on its entry (see
        // srs.service.ts) without touching scheduling fields. `remote` here models
        // a copy of progress uploaded BEFORE the retry was answered - if a background
        // sync merges this in afterwards, the flag must not come back.
        const local = vocabProgress({
            needsRetry: undefined, // just resolved locally
            reading: makeEntry({ lastReviewedAt: new Date('2026-04-01T12:00:05Z') }),
        });
        const remote = vocabProgress({
            needsRetry: { reading: true }, // stale - predates the retry resolution
            reading: makeEntry({ lastReviewedAt: new Date('2026-04-01T12:00:00Z') }),
        });

        const merged = mergeVocabProgress(local, remote);
        expect(merged.needsRetry?.reading).toBeFalsy();
    });

    it('mirrors the fix when remote is the side that resolved the retry more recently', () => {
        const local = vocabProgress({
            needsRetry: { reading: true }, // stale on this side
            reading: makeEntry({ lastReviewedAt: new Date('2026-04-01T12:00:00Z') }),
        });
        const remote = vocabProgress({
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
        const local = vocabProgress({
            needsRetry: undefined,
            reading: makeEntry({ lastReviewedAt: new Date('2026-04-01T12:00:00Z') }),
        });
        const remote = vocabProgress({
            needsRetry: { reading: true },
            reading: makeEntry({ lastReviewedAt: new Date('2026-04-01T12:00:05Z') }),
        });

        const merged = mergeVocabProgress(local, remote);
        expect(merged.needsRetry?.reading).toBe(true);
    });

    it('leaves needsRetry undefined when neither side has a pending retry', () => {
        const merged = mergeVocabProgress(vocabProgress(), vocabProgress());
        expect(merged.needsRetry).toBeUndefined();
    });

    it('takes the earliest non-null introductionAt', () => {
        const local = vocabProgress({ introductionAt: new Date('2026-01-05') });
        const remote = vocabProgress({ introductionAt: new Date('2026-01-01') });
        expect(mergeVocabProgress(local, remote).introductionAt).toEqual(new Date('2026-01-01'));
    });

    it('takes totalReviews as the max of both sides', () => {
        const local = vocabProgress({ totalReviews: 3 });
        const remote = vocabProgress({ totalReviews: 7 });
        expect(mergeVocabProgress(local, remote).totalReviews).toBe(7);
    });

    it('counts production reviews toward recency: a production-only device still wins', () => {
        const older = new Date('2026-01-01');
        const newer = new Date('2026-01-03');
        const local = vocabProgress({
            reading: makeEntry({ lastReviewedAt: older }),
            meaning: makeEntry({ lastReviewedAt: older }),
            production: makeEntry({ lastReviewedAt: older }),
            lastReviewedAt: older,
            consecutiveFailures: 0,
        });
        const remote = vocabProgress({
            reading: makeEntry({ lastReviewedAt: older }),
            meaning: makeEntry({ lastReviewedAt: older }),
            production: makeEntry({ lastReviewedAt: newer }),
            lastReviewedAt: newer,
            consecutiveFailures: 2,
        });

        const merged = mergeVocabProgress(local, remote);
        expect(merged.lastReviewedAt).toEqual(newer);
        expect(merged.consecutiveFailures).toBe(2);
    });
});

describe('mergeLearningQueues', () => {
    it('is a pure union - items present on only one side are preserved, never dropped', () => {
        const local = [vocabProgress({ vocabId: 'only-local' })];
        const remote = [vocabProgress({ vocabId: 'only-remote' })];

        const merged = mergeLearningQueues(local, remote);
        expect(merged.map(v => v.vocabId).sort()).toEqual(['only-local', 'only-remote']);
    });

    it('merges items present on both sides via mergeVocabProgress', () => {
        const local = [vocabProgress({ vocabId: 'shared', totalReviews: 2 })];
        const remote = [vocabProgress({ vocabId: 'shared', totalReviews: 9 })];

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

    it('completedChapters is merged as a pure union, mirroring grammarQueue', () => {
        const local = makeProgress({ completedChapters: ['n5-c01'] });
        const remote = makeProgress({ completedChapters: ['n5-c02'] });

        const merged = mergeProgress(local, remote)!;
        expect(merged.completedChapters.sort()).toEqual(['n5-c01', 'n5-c02']);
    });

    it('completedChapters does not duplicate an id both sides already agree on', () => {
        const local = makeProgress({ completedChapters: ['n5-c01'] });
        const remote = makeProgress({ completedChapters: ['n5-c01'] });

        const merged = mergeProgress(local, remote)!;
        expect(merged.completedChapters).toEqual(['n5-c01']);
    });

    it('retiredVocabIds unions, and a retired id drops the other device queue entry (respawn prevention)', () => {
        // Device A retired 'dead'; device B never did and still carries it in its queue.
        const local = makeProgress({ retiredVocabIds: ['dead'], learningQueue: [] });
        const remote = makeProgress({ learningQueue: [makeVocabProgress({ vocabId: 'dead' })], retiredVocabIds: [] });

        const merged = mergeProgress(local, remote)!;
        expect(merged.retiredVocabIds).toEqual(['dead']);
        // The union would re-add 'dead' to the queue; the retired filter removes it.
        expect(merged.learningQueue.map(v => v.vocabId)).not.toContain('dead');
    });

    it('watchedEpisodes merges per episode, newest mark winning, so an un-mark propagates', () => {
        const local = makeProgress({ watchedEpisodes: {
            '16685:1': { watched: false, updatedAt: 200 },
            '16685:2': { watched: true, updatedAt: 100, coverageAtWatch: 0.6 },
        } });
        const remote = makeProgress({ watchedEpisodes: {
            '16685:1': { watched: true, updatedAt: 100 },
            '16685:3': { watched: true, updatedAt: 150 },
        } });

        const merged = mergeProgress(local, remote)!;
        expect(merged.watchedEpisodes).toEqual({
            '16685:1': { watched: false, updatedAt: 200 },
            '16685:2': { watched: true, updatedAt: 100, coverageAtWatch: 0.6 },
            '16685:3': { watched: true, updatedAt: 150 },
        });
    });

    it('watchedEpisodes stays absent when neither side has used the listening library', () => {
        const merged = mergeProgress(makeProgress(), makeProgress())!;
        expect(merged.watchedEpisodes).toBeUndefined();
    });

    it('keeps a remote-only calibration (the top-level ...local spread would otherwise drop it)', () => {
        const remoteCalibration = {
            reading: { level: 1.4, history: [true, true, true] },
            meaning: { level: 1.0, history: [] },
            production: { level: 1.0, history: [] },
            grammar: { level: 1.2, history: [true] },
        };
        const merged = mergeProgress(makeProgress(), makeProgress({ calibration: remoteCalibration }))!;
        expect(merged.calibration?.reading.level).toBe(1.4);
        expect(merged.calibration?.grammar.level).toBe(1.2);
    });
});

describe('mergeSettings', () => {
    it('returns local when remote is null', () => {
        const local: UserSettings = { ...DEFAULT_SETTINGS, preferredLearningOrder: 'frequency' };
        expect(mergeSettings(local, null, 1, 0)).toBe(local);
    });

    it('returns remote only when its version is strictly greater', () => {
        const local: UserSettings = { ...DEFAULT_SETTINGS, preferredLearningOrder: 'frequency' };
        const remote: UserSettings = { ...DEFAULT_SETTINGS, preferredLearningOrder: 'kklc' };

        expect(mergeSettings(local, remote, 2, 1)).toBe(local);
        expect(mergeSettings(local, remote, 1, 1)).toBe(local); // tie -> local wins
        expect(mergeSettings(local, remote, 1, 2)).toBe(remote);
    });
});
