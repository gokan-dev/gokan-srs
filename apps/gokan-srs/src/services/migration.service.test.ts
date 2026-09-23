import { describe, it, expect, vi, afterEach } from 'vitest';
import { MigrationService, CURRENT_FORMAT_VERSION } from './migration.service';
import { CONSTANTS } from '../commons/constants';
import type { VocabProgress } from '../models/vocabulary.model';
import { GrammarService } from './grammar.service';
import type { GrammarProgress } from '../models/grammar.model';

describe('MigrationService', () => {
    const maxMemoryStrength = CONSTANTS.srs.formula.mastery.maxMemoryStrength;

    describe('migrateVocabProgress', () => {
        it('should migrate old format (mastery only) to new format', () => {
            const oldFormat = {
                vocabId: 'test-123',
                stage: 'learning',
                mastery: 75,
                introductionAt: '2026-01-20T00:00:00Z',
                nextReviewAt: '2026-01-25T00:00:00Z',
                lastReviewedAt: '2026-01-24T00:00:00Z',
                totalReviews: 5,
                consecutiveFailures: 0
            };

            const migrated = MigrationService.migrateVocabProgress(oldFormat);

            // Should have reading SRSEntry with converted memoryStrength
            // NEW Cubic Formula: S = S_max * (mastery/100)^3
            // 75% -> 0.75^3 = 0.421875
            // 0.421875 * 1270 = ~535
            const expectedStrength = maxMemoryStrength * Math.pow(0.75, 3);

            expect(migrated.reading.memoryStrength).toBeCloseTo(expectedStrength, 1);
            expect(migrated.reading.interval).toBeGreaterThan(0);
            expect(migrated.reading.difficulty).toBe(0.3);

            // Should PRESERVE mastery field
            expect((migrated as any).mastery).toBe(75);

            // Should preserve other fields
            expect(migrated.vocabId).toBe('test-123');
            expect(migrated.totalReviews).toBe(5);
            expect(migrated.consecutiveFailures).toBe(0);
        });

        it('should handle mastery 0 (beginner)', () => {
            const oldFormat = {
                vocabId: 'test-123',
                mastery: 0,
                totalReviews: 0,
                consecutiveFailures: 0
            };

            const migrated = MigrationService.migrateVocabProgress(oldFormat);

            expect(migrated.reading.memoryStrength).toBe(CONSTANTS.srs.formula.minMemoryStrength);
            expect(migrated.reading.interval).toBeGreaterThanOrEqual(CONSTANTS.srs.formula.minInterval);
        });

        it('should handle mastery 100 (mastered)', () => {
            const oldFormat = {
                vocabId: 'test-123',
                mastery: 100,
                totalReviews: 10,
                consecutiveFailures: 0
            };

            const migrated = MigrationService.migrateVocabProgress(oldFormat);

            expect(migrated.reading.memoryStrength).toBeCloseTo(maxMemoryStrength, 1);
            expect(migrated.reading.interval).toBeGreaterThan(100); // Should have long interval
        });

        it('should not re-migrate already migrated data', () => {
            const alreadyMigrated: VocabProgress = {
                vocabId: 'test-123',
                stage: 'learning',
                introductionAt: null,
                nextReviewAt: null,
                lastReviewedAt: null,
                totalReviews: 5,
                consecutiveFailures: 0,
                reading: {
                    memoryStrength: 500,
                    interval: 50,
                    difficulty: 0.4,
                    lastReviewedAt: null,
                    dueDate: null,
                    history: []
                },
                meaning: {
                    memoryStrength: 0,
                    interval: 0,
                    difficulty: 0.3,
                    lastReviewedAt: null,
                    dueDate: null,
                    history: []
                }
            };

            const result = MigrationService.migrateVocabProgress(alreadyMigrated);

            // Should preserve existing values
            expect(result.reading.memoryStrength).toBe(500);
            expect(result.reading.interval).toBe(50);
            expect(result.reading.difficulty).toBe(0.4);
        });

        it('should set dueDate from nextReviewAt', () => {
            const oldFormat = {
                vocabId: 'test-123',
                mastery: 60,
                nextReviewAt: '2026-02-01T12:00:00Z',
                totalReviews: 3,
                consecutiveFailures: 0
            };

            const migrated = MigrationService.migrateVocabProgress(oldFormat);

            expect(migrated.reading.dueDate).toBe('2026-02-01T12:00:00Z');
        });

        it('should migrate data that has both mastery and reading/meaning fields with zero values', () => {
            // This is the bug case - old data that has both mastery and reading/meaning
            // with default/zero values should still be migrated
            const mixedFormat = {
                vocabId: 'test-123',
                stage: 'learning',
                mastery: 75,
                introductionAt: '2026-01-17T20:35:14.738Z',
                nextReviewAt: '2026-01-18T23:08:48.846Z',
                lastReviewedAt: '2026-01-17T20:35:23.055Z',
                totalReviews: 1,
                consecutiveFailures: 0,
                reading: {
                    memoryStrength: 0,
                    interval: 0,
                    difficulty: 0.3,
                    lastReviewedAt: null,
                    dueDate: null,
                    history: []
                },
                meaning: {
                    memoryStrength: 0,
                    interval: 0,
                    difficulty: 0.3,
                    lastReviewedAt: null,
                    dueDate: null,
                    history: []
                }
            };

            const migrated = MigrationService.migrateVocabProgress(mixedFormat);

            // Should have converted mastery to memoryStrength
            expect(migrated.reading.memoryStrength).toBeCloseTo(maxMemoryStrength * Math.pow(0.75, 3), 1);
            expect(migrated.reading.interval).toBeGreaterThan(0);

            // Should PRESERVE mastery field
            expect((migrated as any).mastery).toBe(75);

            // Should preserve other fields
            expect(migrated.totalReviews).toBe(1);
            expect(migrated.reading.dueDate).toBe('2026-01-18T23:08:48.846Z');
        });
    });

    describe('migrateUserProgress', () => {
        it('should migrate entire learning queue', () => {
            const oldProgress = {
                kanjiKnowledge: {
                    method: 'kklc',
                    step: 100,
                    kanjiSet: ['日', '月', '火']
                },
                learningQueue: [
                    {
                        vocabId: 'vocab-1',
                        mastery: 50,
                        totalReviews: 3,
                        consecutiveFailures: 0
                    },
                    {
                        vocabId: 'vocab-2',
                        mastery: 75,
                        totalReviews: 5,
                        consecutiveFailures: 0
                    }
                ],
                stats: {
                    newLearnedToday: 5,
                    totalLearned: 50,
                    totalReviews: 100
                },
                dailyOverride: false
            };

            const migrated = MigrationService.migrateUserProgress(oldProgress);

            // Should have format version
            expect(migrated._formatVersion).toBe(7);

            // Should migrate all items
            expect(migrated.learningQueue).toHaveLength(2);
            // 50% -> 0.5^3 = 0.125 * 1270 = ~158.75
            expect(migrated.learningQueue[0].reading.memoryStrength).toBeCloseTo(maxMemoryStrength * Math.pow(0.5, 3), 1);
            // 75% -> 0.75^3 = 0.421875 * 1270 = ~535.78
            expect(migrated.learningQueue[1].reading.memoryStrength).toBeCloseTo(maxMemoryStrength * Math.pow(0.75, 3), 1);

            // Should preserve other fields
            expect(migrated.stats.totalReviews).toBe(100);
            expect(migrated.kanjiKnowledge.step).toBe(100);
        });

        it('recomputes nextReviewAt respecting enableMeaningQuiz (regression: sync-loop oscillation)', () => {
            // Root cause of the infinite auto-upload loop: the migration pass
            // recomputed nextReviewAt WITHOUT settings (=> meaning treated as
            // enabled), while mergeVocabProgress recomputed WITH settings, so the
            // derived value flipped on every load->merge round trip.
            const progress = {
                _formatVersion: 7,
                kanjiKnowledge: { method: 'kklc', step: 1, kanjiSet: [] },
                learningQueue: [
                    {
                        vocabId: 'vocab-osc',
                        stage: 'learning',
                        introductionAt: '2026-01-01T00:00:00.000Z',
                        nextReviewAt: null,
                        totalReviews: 2,
                        consecutiveFailures: 0,
                        reading: { memoryStrength: 250, interval: 72, difficulty: 0.31, lastReviewedAt: '2026-01-31T00:00:00.000Z', dueDate: '2026-07-24T00:00:00.000Z', history: [] },
                        meaning: { memoryStrength: 1, interval: 0, difficulty: 0.3, lastReviewedAt: null, dueDate: '2026-07-19T00:00:00.000Z', history: [] },
                    },
                ],
                stats: { newLearnedToday: 0, totalLearned: 0, totalReviews: 0 },
                dailyOverride: false,
                adaptive: { level: 1.0, history: [] },
            };

            // Meaning quizzes disabled: only the reading due date is authoritative.
            const disabled = MigrationService.migrateUserProgress(structuredClone(progress) as any, { enableMeaningQuiz: false });
            expect(disabled.learningQueue[0].nextReviewAt).toBe('2026-07-24T00:00:00.000Z' as any);

            // Meaning quizzes enabled: the earlier meaning due date wins.
            const enabled = MigrationService.migrateUserProgress(structuredClone(progress) as any, { enableMeaningQuiz: true });
            expect(enabled.learningQueue[0].nextReviewAt).toBe('2026-07-19T00:00:00.000Z' as any);
        });

        it('should not re-migrate if already at current version or V3 sync cap', () => {
            const alreadyMigrated = {
                _formatVersion: 3,
                kanjiKnowledge: {
                    method: 'kklc', // Only partial check needed for types, casting if needed
                    step: 100,
                    kanjiSet: ['日']
                },
                learningQueue: [],
                stats: { newLearnedToday: 0, totalLearned: 0, totalReviews: 0 },
                dailyOverride: false,
                adaptive: { level: 1.0, history: [] }
            };

            // Cast to solve type issues in test
            const result = MigrationService.migrateUserProgress(alreadyMigrated as any);

            // Should return as-is (sync cap is 7)
            expect(result._formatVersion).toBe(7);
        });

        it('should migrate version 2 to version 3 (add adaptive stats AND init meaning)', () => {
            const v2Progress = {
                _formatVersion: 2,
                kanjiKnowledge: { method: 'kklc', step: 1, kanjiSet: [] },
                learningQueue: [
                    {
                        vocabId: 'existing-vocab',
                        stage: 'learning',
                        reading: { memoryStrength: 10, interval: 1, dueDate: '2026-02-01' },
                        meaning: { memoryStrength: 0, interval: 0, dueDate: null } // Fresh meaning
                    }
                ],
                stats: { newLearnedToday: 0, totalLearned: 0, totalReviews: 0 },
                dailyOverride: false
            };

            const result = MigrationService.migrateUserProgress(v2Progress);

            expect(result._formatVersion).toBe(7);

            // Adaptive check
            expect(result.adaptive).toBeDefined();
            expect(result.adaptive.level).toBe(1.0);

            // Meaning Init check
            const item = result.learningQueue[0];
            expect(item.meaning.dueDate).toBeTruthy(); // Should be set to date string
        });
    });

    describe('needsRetry normalization (boolean -> per-type object)', () => {
        it('converts a legacy true boolean to {reading: true}', () => {
            const item: any = { vocabId: 'v1', totalReviews: 1, consecutiveFailures: 0, needsRetry: true };
            const migrated = MigrationService.migrateVocabProgress(item);
            expect(migrated.needsRetry).toEqual({ reading: true });
        });

        it('converts a legacy false boolean to undefined', () => {
            const item: any = { vocabId: 'v1', totalReviews: 1, consecutiveFailures: 0, needsRetry: false };
            const migrated = MigrationService.migrateVocabProgress(item);
            expect(migrated.needsRetry).toBeUndefined();
        });

        it('leaves an already-migrated per-type object untouched', () => {
            const item: any = { vocabId: 'v1', totalReviews: 1, consecutiveFailures: 0, needsRetry: { meaning: true } };
            const migrated = MigrationService.migrateVocabProgress(item);
            expect(migrated.needsRetry).toEqual({ meaning: true });
        });

        it('normalizes needsRetry at the whole-progress level regardless of format version', () => {
            // Simulates an already-current-version user (V7) whose stored data still
            // has the legacy boolean shape - migrateVocabProgress's V1-V3 gate would
            // never touch this item, so migrateUserProgress must normalize unconditionally.
            const progress: any = {
                _formatVersion: 7,
                kanjiKnowledge: { method: 'kklc', step: 10, kanjiSet: [] },
                learningQueue: [
                    {
                        vocabId: 'already-current',
                        stage: 'learning',
                        totalReviews: 5,
                        consecutiveFailures: 0,
                        needsRetry: true,
                        reading: { memoryStrength: 50, interval: 10, difficulty: 0.3, lastReviewedAt: null, dueDate: null, history: [] },
                        meaning: { memoryStrength: 20, interval: 5, difficulty: 0.3, lastReviewedAt: null, dueDate: null, history: [] },
                    },
                ],
                stats: { newLearnedToday: 0, totalLearned: 0, totalReviews: 0 },
                dailyOverride: false,
            };

            const migrated = MigrationService.migrateUserProgress(progress);
            expect(migrated.learningQueue[0].needsRetry).toEqual({ reading: true });
        });
    });

    describe('needsMigration', () => {
        it('should return true for old format (no version)', () => {
            const oldProgress = {
                learningQueue: []
            };

            expect(MigrationService.needsMigration(oldProgress)).toBe(true);
        });

        it('should return true at the sync-pass ceiling (7) - only the async pass reaches the terminal version', () => {
            // Regression guard: version 7 is SYNC_MIGRATION_VERSION, not the terminal
            // version. Previously both were the same constant, so the sync pass could
            // stamp the terminal version on its own and pre-empt the async
            // homograph-merge pass. needsMigration() must keep reporting true until
            // migrateMergedVocabsAsync has actually run.
            const currentProgress = {
                _formatVersion: 7,
                learningQueue: []
            };

            expect(MigrationService.needsMigration(currentProgress)).toBe(true);
        });

        it('should return true at the vocab-merge version (8) - the grammar-alias pass has not run yet', () => {
            // Same shape of regression as version 7 above, one pass later: 8 is the
            // version migrateMergedVocabsAsync reaches, not the terminal one. The
            // grammar-alias pass (migrateGrammarAliasesAsync) also needs a fetch, so
            // needsMigration() must keep reporting true until it has run too.
            const currentProgress = {
                _formatVersion: 8,
                learningQueue: []
            };

            expect(MigrationService.needsMigration(currentProgress)).toBe(true);
        });

        it('should return false only at the true terminal version', () => {
            const currentProgress = {
                _formatVersion: CURRENT_FORMAT_VERSION,
                learningQueue: []
            };

            expect(MigrationService.needsMigration(currentProgress)).toBe(false);
        });

        it('migrateUserProgress alone (the sync pass) never reaches a version where needsMigration reports false', () => {
            // The core regression test: previously migrateUserProgress jumped straight
            // to CURRENT_FORMAT_VERSION, so a single synchronous load would silently
            // skip the async merge forever. It must now always leave needsMigration() true.
            const oldProgress: any = { learningQueue: [], stats: { newLearnedToday: 0, totalLearned: 0, totalReviews: 0 }, dailyOverride: false };
            const migratedSync = MigrationService.migrateUserProgress(oldProgress);

            expect(migratedSync._formatVersion).toBe(7);
            expect(MigrationService.needsMigration(migratedSync)).toBe(true);
        });

        it('should return true for V3 version needing V5', () => {
            const currentProgress = {
                _formatVersion: 3,
                learningQueue: []
            };

            expect(MigrationService.needsMigration(currentProgress)).toBe(true);
        });
    });

    describe('Real Production Data Sample', () => {
        it('should successfully migrate a sample from production data', () => {
            // Sample from actual kanji-progress.json
            const productionSample = {
                vocabId: '1375610',
                stage: 'learning',
                mastery: 75,
                introductionAt: '2026-01-17T16:05:40.828Z',
                nextReviewAt: '2026-02-09T13:25:07.640Z',
                lastReviewedAt: '2026-01-27T23:47:24.343Z',
                totalReviews: 5,
                consecutiveFailures: 0
            };

            const migrated = MigrationService.migrateVocabProgress(productionSample);

            // Should have valid SRS data
            expect(migrated.reading.memoryStrength).toBeGreaterThan(0);
            expect(migrated.reading.interval).toBeGreaterThan(0);
            expect(migrated.reading.dueDate).toBe('2026-02-09T13:25:07.640Z');

            // Should preserve review history
            expect(migrated.totalReviews).toBe(5);
            expect(migrated.lastReviewedAt).toBe('2026-01-27T23:47:24.343Z');

            // Should PRESERVE mastery
            expect((migrated as any).mastery).toBe(75);
        });
    });

    describe('migrateMergedVocabsAsync V6 Deduplication', () => {
        it('should correctly deduplicate histories and use max totalReviews', async () => {
            // Mock fetch to return a simple map
            globalThis.fetch = async () => ({
                ok: true,
                json: async () => ({
                    'old-id-1': 'new-base-id',
                    'old-id-2': 'new-base-id'
                })
            }) as any;

            const duplicateProgress: any = {
                _formatVersion: 5,
                learningQueue: [
                    {
                        vocabId: 'old-id-1',
                        stage: 'learning',
                        totalReviews: 10,
                        consecutiveFailures: 0,
                        reading: {
                            memoryStrength: 100,
                            interval: 5,
                            dueDate: '2026-03-01T00:00:00Z',
                            history: [
                                { date: 1000, result: 'correct' },
                                { date: 2000, result: 'correct' }
                            ]
                        },
                        meaning: {
                            memoryStrength: 0, // This should be rescued
                            interval: 0,
                            dueDate: null,
                            history: []
                        }
                    },
                    {
                        vocabId: 'old-id-2', // This simulates a duplicated sync clone
                        stage: 'learning',
                        totalReviews: 10, // Same reviews
                        consecutiveFailures: 0,
                        reading: {
                            memoryStrength: 100,
                            interval: 5,
                            dueDate: '2026-03-01T00:00:00Z', // Same due date
                            history: [
                                { date: 1000, result: 'correct' }, // Duplicated history
                                { date: 2000, result: 'correct' },
                                { date: 3000, result: 'correct' }  // One extra review
                            ]
                        },
                        meaning: {
                            memoryStrength: 0, // This should be rescued
                            interval: 0,
                            dueDate: null,
                            history: []
                        }
                    }
                ]
            };

            const migrated = await MigrationService.migrateMergedVocabsAsync(duplicateProgress);

            expect(migrated._formatVersion).toBe(8); // the vocab-merge pass's own version, not the terminal one
            expect(migrated.learningQueue).toHaveLength(1); // Properly merged

            const mergedItem = migrated.learningQueue[0];
            expect(mergedItem.vocabId).toBe('new-base-id');
            expect(mergedItem.totalReviews).toBe(10); // NOT 20

            // History should be deduplicated (only 3 items, not 5)
            expect(mergedItem.reading.history).toHaveLength(3);
            expect(mergedItem.reading.history[0].date).toBe(1000);
            expect(mergedItem.reading.history[1].date).toBe(2000);
            expect(mergedItem.reading.history[2].date).toBe(3000);

            // 0 memory strength rescue check
            expect(mergedItem.meaning.memoryStrength).toBe(CONSTANTS.srs.formula.minMemoryStrength);
        });
    });

    describe('grammarQueue (additive field, no version gate needed)', () => {
        it('defaults to an empty array when absent from stored data', () => {
            const progress: any = {
                kanjiKnowledge: { method: 'kklc', step: 10, kanjiSet: [] },
                learningQueue: [],
                stats: { newLearnedToday: 0, totalLearned: 0, totalReviews: 0 },
                dailyOverride: false,
            };

            const migrated = MigrationService.migrateUserProgress(progress);
            expect(migrated.grammarQueue).toEqual([]);
        });

        it('fills in defaults for a partial GrammarProgress item', () => {
            const progress: any = {
                kanjiKnowledge: { method: 'kklc', step: 10, kanjiSet: [] },
                learningQueue: [],
                grammarQueue: [{ grammarId: 'n5-001', stage: 'learning', entry: { memoryStrength: 5, interval: 2, dueDate: '2026-06-01T00:00:00.000Z' } }],
                stats: { newLearnedToday: 0, totalLearned: 0, totalReviews: 0 },
                dailyOverride: false,
            };

            const migrated = MigrationService.migrateUserProgress(progress);
            expect(migrated.grammarQueue).toHaveLength(1);
            expect(migrated.grammarQueue[0].entry.difficulty).toBeDefined();
            expect(migrated.grammarQueue[0].nextReviewAt).toEqual('2026-06-01T00:00:00.000Z');
        });

        it('leaves a graduated grammar item nextReviewAt null rather than re-deriving from a stale dueDate', () => {
            const progress: any = {
                kanjiKnowledge: { method: 'kklc', step: 10, kanjiSet: [] },
                learningQueue: [],
                grammarQueue: [{
                    grammarId: 'n5-001',
                    stage: 'graduated',
                    nextReviewAt: null,
                    entry: { memoryStrength: CONSTANTS.srs.formula.mastery.maxMemoryStrength, interval: 3650, dueDate: '2026-01-01T00:00:00.000Z' },
                }],
                stats: { newLearnedToday: 0, totalLearned: 0, totalReviews: 0 },
                dailyOverride: false,
            };

            const migrated = MigrationService.migrateUserProgress(progress);
            expect(migrated.grammarQueue[0].nextReviewAt).toBeNull();
        });
    });

    describe('completedChapters (additive field, no version gate needed)', () => {
        it('defaults to an empty array when absent from stored data', () => {
            const progress = {
                kanjiKnowledge: { method: 'kklc', step: 10, kanjiSet: [] },
                learningQueue: [],
                stats: { newLearnedToday: 0, totalLearned: 0, totalReviews: 0 },
                dailyOverride: false,
            };

            const migrated = MigrationService.migrateUserProgress(progress);
            expect(migrated.completedChapters).toEqual([]);
        });

        it('leaves an already-stored completedChapters list untouched', () => {
            const progress = {
                kanjiKnowledge: { method: 'kklc', step: 10, kanjiSet: [] },
                learningQueue: [],
                completedChapters: ['n5-c01', 'n5-c02'],
                stats: { newLearnedToday: 0, totalLearned: 0, totalReviews: 0 },
                dailyOverride: false,
            };

            const migrated = MigrationService.migrateUserProgress(progress);
            expect(migrated.completedChapters).toEqual(['n5-c01', 'n5-c02']);
        });
    });
});

describe('MigrationService.migrateGrammarAliasesAsync', () => {
    function makeGrammar(overrides: Partial<GrammarProgress> = {}): GrammarProgress {
        return {
            grammarId: 'n5-078',
            stage: 'learning',
            introductionAt: new Date('2026-06-01T00:00:00Z'),
            nextReviewAt: new Date('2026-07-01T00:00:00Z'),
            lastReviewedAt: new Date('2026-06-20T00:00:00Z'),
            totalReviews: 3,
            consecutiveFailures: 0,
            entry: {
                memoryStrength: 10,
                interval: 5,
                difficulty: 0.5,
                lastReviewedAt: null,
                dueDate: null,
                history: [{ date: 1000, result: 'correct' } as any],
            },
            ...overrides,
        };
    }

    function makeProgressWith(grammarQueue: GrammarProgress[], version = 8): any {
        return { _formatVersion: version, learningQueue: [], grammarQueue };
    }

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('rewrites a dropped id onto its canonical, keeping the SRS entry intact', async () => {
        vi.spyOn(GrammarService, 'loadAliases').mockResolvedValue({ 'n4-079': 'n5-078' });
        const progress = makeProgressWith([makeGrammar({ grammarId: 'n4-079' })]);

        const migrated = await MigrationService.migrateGrammarAliasesAsync(progress);

        expect(migrated.grammarQueue).toHaveLength(1);
        expect(migrated.grammarQueue[0].grammarId).toBe('n5-078');
        expect(migrated.grammarQueue[0].entry.memoryStrength).toBe(10);
        expect(migrated.grammarQueue[0].totalReviews).toBe(3);
        expect(migrated._formatVersion).toBe(CURRENT_FORMAT_VERSION);
    });

    it('merges onto the stronger entry when both the dropped and canonical id have progress', async () => {
        // The real hazard: the user was introduced to n5-078 and n4-079
        // independently, so two entries collapse into one and something has to win.
        vi.spyOn(GrammarService, 'loadAliases').mockResolvedValue({ 'n4-079': 'n5-078' });
        const progress = makeProgressWith([
            makeGrammar({
                grammarId: 'n5-078',
                totalReviews: 2,
                introductionAt: new Date('2026-06-10T00:00:00Z'),
                nextReviewAt: new Date('2026-07-20T00:00:00Z'),
                entry: { ...makeGrammar().entry, memoryStrength: 4, history: [{ date: 2000, result: 'wrong' } as any] },
            }),
            makeGrammar({
                grammarId: 'n4-079',
                totalReviews: 7,
                introductionAt: new Date('2026-06-01T00:00:00Z'),
                nextReviewAt: new Date('2026-07-05T00:00:00Z'),
                stage: 'graduated',
                entry: { ...makeGrammar().entry, memoryStrength: 30, history: [{ date: 1000, result: 'correct' } as any] },
            }),
        ]);

        const migrated = await MigrationService.migrateGrammarAliasesAsync(progress);
        const merged = migrated.grammarQueue[0];

        expect(migrated.grammarQueue).toHaveLength(1);
        expect(merged.grammarId).toBe('n5-078');
        expect(merged.entry.memoryStrength).toBe(30);           // stronger entry wins
        expect(merged.totalReviews).toBe(7);                    // max, not sum
        expect(merged.stage).toBe('graduated');                 // graduated if either was
        expect(merged.introductionAt).toEqual(new Date('2026-06-01T00:00:00Z')); // earliest
        expect(merged.nextReviewAt).toEqual(new Date('2026-07-05T00:00:00Z'));   // soonest due
        expect(merged.entry.history.map((h: any) => h.date)).toEqual([1000, 2000]); // union, sorted
    });

    it('leaves a queue with no aliased ids untouched but still stamps the version', async () => {
        vi.spyOn(GrammarService, 'loadAliases').mockResolvedValue({ 'n4-079': 'n5-078' });
        const queue = [makeGrammar({ grammarId: 'n5-001' })];

        const migrated = await MigrationService.migrateGrammarAliasesAsync(makeProgressWith(queue));

        expect(migrated.grammarQueue).toBe(queue); // same reference - no needless rebuild
        expect(migrated._formatVersion).toBe(CURRENT_FORMAT_VERSION);
    });

    it('does not touch progress when the alias index cannot be loaded', async () => {
        // A transient fetch failure must never be allowed to drop review history.
        // needsMigration stays true, so it simply retries next run.
        vi.spyOn(GrammarService, 'loadAliases').mockRejectedValue(new Error('offline'));
        const progress = makeProgressWith([makeGrammar({ grammarId: 'n4-079' })]);

        const migrated = await MigrationService.migrateGrammarAliasesAsync(progress);

        expect(migrated.grammarQueue[0].grammarId).toBe('n4-079');
        expect(migrated._formatVersion).toBe(8);
        expect(MigrationService.needsMigration(migrated)).toBe(true);
    });

    it('is a no-op once already at the terminal version', async () => {
        const loadAliases = vi.spyOn(GrammarService, 'loadAliases');
        const progress = makeProgressWith([makeGrammar({ grammarId: 'n4-079' })], CURRENT_FORMAT_VERSION);

        const migrated = await MigrationService.migrateGrammarAliasesAsync(progress);

        expect(migrated).toBe(progress);
        expect(loadAliases).not.toHaveBeenCalled();
    });

    it('re-runs for a user stamped at a PREVIOUS terminal version', async () => {
        // Why CURRENT_FORMAT_VERSION must be bumped every time aliases.json
        // gains entries: a user stopped at the old terminal version has progress
        // stored against ids that have since been dropped, and without a bump
        // this pass would skip them - leaving an item loadGrammarPoint 404s on
        // while the scheduler still counts it as due.
        vi.spyOn(GrammarService, 'loadAliases').mockResolvedValue({ 'n4-053': 'n4-025' });
        const progress = makeProgressWith(
            [makeGrammar({ grammarId: 'n4-053' })],
            CURRENT_FORMAT_VERSION - 1
        );

        const migrated = await MigrationService.migrateGrammarAliasesAsync(progress);

        expect(migrated.grammarQueue[0].grammarId).toBe('n4-025');
        expect(migrated._formatVersion).toBe(CURRENT_FORMAT_VERSION);
    });

    it('migrateAsync reaches the terminal version through both async passes', async () => {
        vi.spyOn(GrammarService, 'loadAliases').mockResolvedValue({});
        const progress = makeProgressWith([makeGrammar({ grammarId: 'n5-001' })], 8);

        const migrated = await MigrationService.migrateAsync(progress);

        expect(MigrationService.needsMigration(migrated)).toBe(false);
    });
});

describe('production entry backfill', () => {
    const maxMemoryStrength = CONSTANTS.srs.formula.mastery.maxMemoryStrength;

    const progressWith = (queue: unknown[]) => ({
        _formatVersion: 7,
        learningQueue: queue,
        grammarQueue: [],
        kanjiKnowledge: { method: 'kklc', step: 10, kanjiSet: new Set<string>() },
        stats: { newLearnedToday: 0, totalLearned: 0, totalReviews: 0 },
    });

    const learningItem = (overrides: Record<string, unknown> = {}) => ({
        vocabId: 'v1',
        stage: 'learning',
        introductionAt: new Date('2025-01-01T00:00:00Z'),
        nextReviewAt: null,
        lastReviewedAt: null,
        totalReviews: 3,
        consecutiveFailures: 0,
        reading: { memoryStrength: 50, interval: 2, difficulty: 0.3, lastReviewedAt: null, dueDate: null, history: [] },
        meaning: { memoryStrength: 80, interval: 3, difficulty: 0.3, lastReviewedAt: null, dueDate: null, history: [] },
        ...overrides,
    });

    it('gives a learning word an inert production entry, so nothing becomes due on release day', () => {
        const migrated = MigrationService.migrateUserProgress(progressWith([learningItem()]));
        const item = migrated.learningQueue[0];

        expect(item.production).toBeDefined();
        expect(item.production!.dueDate).toBeNull();
        expect(item.production!.history).toEqual([]);
    });

    it('does not make a previously-not-due word due just by adding the entry', () => {
        const migrated = MigrationService.migrateUserProgress(progressWith([learningItem()]));
        expect(migrated.learningQueue[0].nextReviewAt).toBeNull();
    });

    it('grandfathers an already-graduated word as production-mastered, so it stays graduated', () => {
        // Without this, every word the user ever skipped or finished would fail
        // isVocabFullyMastered and flood back in as production reviews.
        const graduated = learningItem({
            vocabId: 'v2',
            stage: 'graduated',
            reading: { memoryStrength: maxMemoryStrength, interval: 3650, difficulty: 0.3, lastReviewedAt: null, dueDate: null, history: [] },
            meaning: { memoryStrength: maxMemoryStrength, interval: 3650, difficulty: 0.3, lastReviewedAt: null, dueDate: null, history: [] },
        });

        const migrated = MigrationService.migrateUserProgress(progressWith([graduated]));
        const item = migrated.learningQueue[0];

        expect(item.stage).toBe('graduated');
        expect(item.production!.memoryStrength).toBe(maxMemoryStrength);
        expect(item.production!.dueDate).toBeNull();
    });

    it('leaves an already-active production entry untouched (idempotent across loads)', () => {
        const active = learningItem({
            production: {
                memoryStrength: 300,
                interval: 5,
                difficulty: 0.3,
                lastReviewedAt: new Date('2025-02-01T00:00:00Z'),
                dueDate: new Date('2025-03-01T00:00:00Z'),
                history: [],
            },
        });

        const once = MigrationService.migrateUserProgress(progressWith([active]));
        const twice = MigrationService.migrateUserProgress(progressWith([once.learningQueue[0]]));

        expect(twice.learningQueue[0].production!.memoryStrength).toBe(300);
        expect(twice.learningQueue[0].production!.dueDate).toEqual(new Date('2025-03-01T00:00:00Z'));
    });

    it('does not share one entry object between migrated items', () => {
        const migrated = MigrationService.migrateUserProgress(
            progressWith([learningItem({ vocabId: 'a' }), learningItem({ vocabId: 'b' })])
        );

        expect(migrated.learningQueue[0].production).not.toBe(migrated.learningQueue[1].production);
    });
});
