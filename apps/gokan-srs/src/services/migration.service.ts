import { CONSTANTS } from '../commons/constants';
import type { NeedsRetryFlags, ReviewLog, SRSEntry, VocabProgress } from '../models/vocabulary.model';
import type { UserProgress, UserSettings } from '../models/user.model';
import { DEFAULT_PROGRESS } from '../models/user.model';
import { DEFAULT_SRS_ENTRY } from '../models/vocabulary.model';
import type { GrammarProgress } from '../models/grammar.model';
import { vocabNextReviewAt } from './scheduling';
import { grammarNextReviewAt } from './grammarScheduling';
import { GrammarService } from './grammar.service';
import { seedCalibrationFromHistory } from './calibration';
import { fetchJson } from './http';
import {
    hydrateAdaptiveStats,
    hydrateCalibration,
    hydrateDate,
    hydrateGrammarProgress,
    hydrateWatchedEpisodes,
    hydrateKanjiKnowledge,
    hydrateSRSEntry,
    hydrateStats,
    hydrateVocabProgress,
    type StoredProgress,
    type StoredVocabProgress,
} from './progressHydration';

/**
 * Two-tier version scheme:
 * - SYNC_MIGRATION_VERSION is the ceiling the synchronous pass (migrateUserProgress)
 *   can ever stamp on its own.
 * - CURRENT_FORMAT_VERSION is the true terminal version, reachable ONLY after the
 *   async homograph-merge pass (migrateMergedVocabsAsync) has actually run.
 *
 * Previously both were the same constant, so the cheap synchronous pass could
 * stamp the terminal version on its own and pre-empt the async pass entirely -
 * needsMigration() would report false immediately after the sync pass, and the
 * homograph-merge migration (which needs a network fetch) would never run.
 */
const SYNC_MIGRATION_VERSION = 7;
/** Version the async homograph-merge pass (migrateMergedVocabsAsync) reaches. */
const MERGED_VOCAB_VERSION = 8;
/**
 * Terminal version, reached only after the async grammar queue-id pass
 * (migrateGrammarQueueIdsAsync) has also run. Both async passes need a network
 * fetch, so both sit behind needsMigration() rather than the synchronous pass.
 *
 * BUMP THIS whenever `index/aliases.json` OR `index/variant-groups.json` gains
 * entries. The pass is gated on `currentVersion >= CURRENT_FORMAT_VERSION`, so
 * a user already at the terminal version never re-runs it - and progress stored
 * against a newly retired id then becomes exactly the stranded entry this pass
 * exists to prevent. The pass is idempotent (`remap[id] ?? id`), so re-running
 * it costs nothing.
 *
 * 9  -> 10: gokan-dev/gokan-dataset#14 raised aliases from 40 to 73.
 * 10 -> 11: realization variants now feed the same remap. Every variant group
 *           ever published is in scope, not just the それでは group added with
 *           the curriculum re-cut: variants were NEVER transferred before this,
 *           so a user who met どこにも as six separate cards has been drilling
 *           five orphans against the canonical ever since they were collapsed.
 * 11 -> 12: the family-coverage pass retired 14 more duplicates (aliases 74 -> 88,
 *           e.g. n4-093 で onto n5-030, n3-088 ばかりか onto n2-137) and added 5
 *           realizations (n4-008 / n4-009 / n4-090 plain forms, n1-194, n1-135).
 */
export const CURRENT_FORMAT_VERSION = 12;

/**
 * Migration service to handle data format upgrades
 * Ensures backward compatibility when upgrading the SRS system
 */
export class MigrationService {
    /**
     * Migrates and hydrates a single stored vocab item. Below format version 3 an
     * item can still carry the old single `mastery` percentage, which is converted
     * into the reading entry; every item gets the per-type retry flag.
     *
     * The `mastery` field itself is deliberately preserved on the item (the spread
     * in hydrateVocabProgress keeps it), which is exactly why the conversion must be
     * gated on the format version: from version 3 on it is a leftover, not a source.
     */
    static migrateVocabProgress(item: StoredVocabProgress, formatVersion = 0): VocabProgress {
        const needsRetry = this.normalizeNeedsRetry(item.needsRetry);
        if (formatVersion >= 3 || item.mastery === undefined) {
            return hydrateVocabProgress(item, needsRetry);
        }
        return hydrateVocabProgress(item, needsRetry, {
            reading: this.readingEntryFromMastery(item),
            meaning: hydrateSRSEntry(undefined), // Meaning starts fresh
            production: hydrateSRSEntry(undefined), // Inert until activated (see backfillProduction)
        });
    }

    /** Converts the pre-v3 mastery percentage into a reading SRS entry. */
    private static readingEntryFromMastery(item: StoredVocabProgress): SRSEntry {
        const mastery = item.mastery ?? 0;
        const maxMemoryStrength = CONSTANTS.srs.formula.mastery.maxMemoryStrength;

        // Convert mastery (0-100) to memoryStrength using CUBIC POWER FORMULA
        // Formula: S = S_max * (mastery / 100)^3
        // This maps 15% mastery -> ~4.3 days (instead of linear ~190 days)
        // This maps 100% mastery -> 1270 days (full mastery)
        const normalizedMastery = Math.max(0, Math.min(mastery, 100)) / 100;
        const memoryStrength = Math.max(CONSTANTS.srs.formula.minMemoryStrength, maxMemoryStrength * Math.pow(normalizedMastery, 3));

        // Calculate interval based on memory strength
        // Using the same formula as in SRS service: interval = S * ln(targetRecall) / ln(0.5)
        const targetRecall = CONSTANTS.srs.formula.targetRecall;
        const interval = memoryStrength * Math.log(targetRecall) / Math.log(0.5);

        // Clamp interval to valid range
        const clampedInterval = Math.max(
            CONSTANTS.srs.formula.minInterval,
            Math.min(interval, CONSTANTS.srs.formula.maxInterval)
        );

        return {
            memoryStrength,
            interval: clampedInterval,
            difficulty: 0.3, // Default difficulty
            lastReviewedAt: hydrateDate(item.lastReviewedAt),
            dueDate: hydrateDate(item.nextReviewAt),
            history: []
        };
    }

    /**
     * `needsRetry` used to be a single boolean applying to whichever quiz type was
     * active. It is now per-type ({reading?, meaning?}) so a wrong reading answer
     * never blocks a due meaning review (and vice versa). Historically the flag
     * was only ever set for reading quizzes, so an old `true` maps to {reading: true}.
     */
    private static normalizeNeedsRetry(raw: StoredVocabProgress['needsRetry']): NeedsRetryFlags | undefined {
        if (typeof raw === 'boolean') return raw ? { reading: true } : undefined;
        return raw;
    }

    /**
     * Fills in the `production` SRS entry for progress saved before that quiz type
     * existed. Two rules, and both matter more than they look:
     *
     * 1. A learning word gets an **inert** entry (dueDate null). No due-check matches
     *    a null dueDate, so nothing becomes due here. Each word activates later, on
     *    its own next reading/meaning review, via SRSService.seedProductionEntry. A
     *    backfill that set real due dates instead would make a long-time user's whole
     *    queue due the day this shipped, which is the wave this design exists to avoid.
     *
     * 2. An already-**graduated** word gets a mastered entry. Graduation is derived
     *    (isVocabFullyMastered), not just stored, so an un-mastered production entry
     *    would silently un-graduate every word the user ever skipped or finished and
     *    hand the whole pile back as production reviews. Grandfathering them is the
     *    single most important line here: 'skip' is how users say "I already know
     *    this word", and that pile is typically large.
     */
    private static backfillProduction(item: VocabProgress): VocabProgress {
        const existing = item.production;
        const alreadyActive = !!existing
            && (existing.dueDate !== null || existing.lastReviewedAt !== null || (existing.history?.length ?? 0) > 0);
        if (alreadyActive) return item;

        if (item.stage === 'graduated') {
            return {
                ...item,
                production: {
                    ...DEFAULT_SRS_ENTRY,
                    ...existing,
                    memoryStrength: CONSTANTS.srs.formula.mastery.maxMemoryStrength,
                    interval: CONSTANTS.srs.formula.maxInterval,
                    dueDate: null,
                },
            };
        }

        return existing ? item : { ...item, production: { ...DEFAULT_SRS_ENTRY } };
    }

    /**
     * Migrates entire user progress from old format to new format
     * Adds format version tracking
     */
    /**
     * Migrates base progress
     */
    /**
     * Migrates a stored payload and hydrates it into a UserProgress, in that order:
     * legacy shapes are converted while still in stored form (they only exist
     * there), then every pass below runs on real Dates. Before this ordering the
     * passes ran on un-hydrated JSON typed as if it were hydrated, so due dates
     * were compared as strings.
     */
    static migrateUserProgress(progress: StoredProgress, settings?: Pick<UserSettings, 'enableMeaningQuiz'>): UserProgress {
        const currentVersion = progress._formatVersion ?? 0;

        // V1 to V3 Migrations
        let migratedQueue = (progress.learningQueue ?? []).map(item => this.migrateVocabProgress(item, currentVersion));
        if (currentVersion < 3) {
            migratedQueue = migratedQueue.map((item: VocabProgress) => {
                if (item.stage === 'learning' && !item.meaning.dueDate && item.meaning.interval === 0) {
                    return {
                        ...item,
                        meaning: {
                            ...item.meaning,
                            dueDate: new Date()
                        }
                    };
                }
                return item;
            });
        }

        // V7 Migration: Fix skipped vocabularies that have high reading strength but stuck meaning schedules
        if (currentVersion < 7) {
            migratedQueue = migratedQueue.map((item: VocabProgress): VocabProgress => {
                // Identify items skipped before Meaning Quiz was fully integrated
                // Characteristic: High reading memory, but meaning is 0/1, and stage is learning but no nextReviewAt
                if (
                    item.stage === 'learning' &&
                    item.nextReviewAt === null &&
                    item.introductionAt !== null &&
                    item.reading.memoryStrength >= CONSTANTS.srs.formula.mastery.maxMemoryStrength &&
                    item.meaning.memoryStrength <= 1
                ) {
                    return {
                        ...item,
                        stage: 'graduated',
                        meaning: {
                            ...item.meaning,
                            memoryStrength: CONSTANTS.srs.formula.mastery.maxMemoryStrength,
                            interval: CONSTANTS.srs.formula.maxInterval,
                            dueDate: null
                        }
                    };
                }
                return item;
            });
        }

        // Production entry backfill, unconditional (additive field, no version gate).
        migratedQueue = migratedQueue.map((item: VocabProgress) => this.backfillProduction(item));

        // Recompute nextReviewAt unconditionally via scheduling.ts (the single source
        // of truth introduced to stop it being hand-synced independently). This
        // retroactively corrects any stale value written before that fix existed.
        // Settings MUST be threaded through here: recomputing without them treats
        // meaning quizzes as enabled, which disagrees with the settings-aware
        // derivation in mergeVocabProgress and makes nextReviewAt flip on every
        // load->merge round trip (the infinite auto-upload loop).
        migratedQueue = migratedQueue.map((item: VocabProgress) =>
            item.stage === 'graduated' ? item : { ...item, nextReviewAt: vocabNextReviewAt(item, settings) }
        );

        // Enforce the invariant "learningQueue holds no retired id" on every load
        // (additive, no version gate). A word whose data the dataset dropped is
        // tombstoned in retiredVocabIds (RETIRE_VOCAB); dropping it here means a
        // Drive merge that unioned it back in is re-cleaned next load, so a retired
        // word can never respawn into active learning. See UserProgress.retiredVocabIds.
        const retiredVocabIds = progress.retiredVocabIds ?? [];
        if (retiredVocabIds.length > 0) {
            const retiredSet = new Set(retiredVocabIds);
            migratedQueue = migratedQueue.filter((item: VocabProgress) => !retiredSet.has(item.vocabId));
        }

        // grammarQueue is a purely additive field (issue #17), so it needs no
        // version-gated migration pass - just defaults filled in and nextReviewAt
        // derived the same way vocab's is (unconditionally, on every load).
        const migratedGrammarQueue: GrammarProgress[] = (progress.grammarQueue ?? []).map(item => {
            const withDefaults = hydrateGrammarProgress(item);
            return withDefaults.stage === 'graduated'
                ? withDefaults
                : { ...withDefaults, nextReviewAt: grammarNextReviewAt(withDefaults) };
        });

        // Cap at SYNC_MIGRATION_VERSION (never CURRENT_FORMAT_VERSION) so
        // needsMigration() keeps reporting true until the async pass has run.
        // The spread keeps fields this build does not know (and the _sync metadata).
        return {
            ...progress,
            kanjiKnowledge: hydrateKanjiKnowledge(progress.kanjiKnowledge),
            stats: hydrateStats(progress.stats),
            dailyOverride: progress.dailyOverride ?? DEFAULT_PROGRESS.dailyOverride,
            watchedEpisodes: hydrateWatchedEpisodes(progress.watchedEpisodes),
            learningQueue: migratedQueue,
            grammarQueue: migratedGrammarQueue,
            // Purely additive, like grammarQueue itself - just default to [] on
            // every load, unconditionally, no version gate needed.
            completedChapters: progress.completedChapters ?? [],
            // Tombstones for vocab the dataset dropped; the queue above is already
            // filtered by this set. Additive, carried through every load.
            retiredVocabIds,
            adaptive: hydrateAdaptiveStats(progress.adaptive),
            // Additive too. A quiz type starts where its own review logs put it
            // (replayed through the live update rule), not at x1 with an empty
            // window; a full live window always wins. The old single `adaptive`
            // level is NOT carried over: its effect (a stretched interval) is folded
            // into strength by the post-sync rebase instead (services/calibration.ts).
            calibration: seedCalibrationFromHistory({
                learningQueue: migratedQueue,
                grammarQueue: migratedGrammarQueue,
                calibration: hydrateCalibration(progress.calibration),
            }),
            _formatVersion: currentVersion < SYNC_MIGRATION_VERSION ? SYNC_MIGRATION_VERSION : currentVersion
        };
    }

    /**
     * V4/V5 Migration (Async) - Merges homograph vocabularies
     * Upgraded to V5 to re-trigger for users who loaded when the map was empty due to a build bug.
     */
    static async migrateMergedVocabsAsync(progress: UserProgress): Promise<UserProgress> {
        const currentVersion = progress._formatVersion ?? 0;
        if (currentVersion >= MERGED_VOCAB_VERSION) return progress;

        try {
            // Fetch the map generated by the build script (with cache-busting)
            const mergedMap = await fetchJson<Record<string, string>>(`/data/compiled/index/merged-map.json?t=${Date.now()}`);

            // Group by the target (new) ID
            const queueMap = new Map<string, VocabProgress[]>();

            for (const item of progress.learningQueue) {
                const targetId = mergedMap[item.vocabId] || item.vocabId;
                if (!queueMap.has(targetId)) queueMap.set(targetId, []);
                queueMap.get(targetId)!.push(item);
            }

            const updatedQueue: VocabProgress[] = [];

            for (const [targetId, items] of queueMap.entries()) {
                if (items.length === 1) {
                    // Update ID if it changed
                    updatedQueue.push({ ...items[0], vocabId: targetId });
                } else {
                    // We have duplicates to merge!
                    const baseItem = { ...items[0], vocabId: targetId };

                    // Merge properties
                    let totalReviews = 0;
                    let consecutiveFailures = 0;
                    let maxReadingStrength = 0;
                    let maxReadingInterval = 0;
                    let maxMeaningStrength = 0;
                    let maxMeaningInterval = 0;
                    const uniqueReadingHistory = new Map<number, ReviewLog>();
                    const uniqueMeaningHistory = new Map<number, ReviewLog>();

                    let earliestIntro = items[0].introductionAt;

                    for (const item of items) {
                        totalReviews = Math.max(totalReviews, item.totalReviews);
                        consecutiveFailures = Math.max(consecutiveFailures, item.consecutiveFailures);

                        maxReadingStrength = Math.max(maxReadingStrength, item.reading.memoryStrength);
                        maxReadingInterval = Math.max(maxReadingInterval, item.reading.interval);

                        maxMeaningStrength = Math.max(maxMeaningStrength, item.meaning.memoryStrength);
                        maxMeaningInterval = Math.max(maxMeaningInterval, item.meaning.interval);

                        item.reading.history.forEach(log => uniqueReadingHistory.set(log.date, log));
                        item.meaning.history.forEach(log => uniqueMeaningHistory.set(log.date, log));

                        if (item.introductionAt && (!earliestIntro || item.introductionAt < earliestIntro)) {
                            earliestIntro = item.introductionAt;
                        }
                    }

                    // Sort histories
                    const allReadingHistory = Array.from(uniqueReadingHistory.values()).sort((a, b) => a.date - b.date);
                    const allMeaningHistory = Array.from(uniqueMeaningHistory.values()).sort((a, b) => a.date - b.date);

                    // Determine stage (if any graduated, it's graduated)
                    const isGraduated = items.some(i => i.stage === 'graduated');

                    // Determine due date (closest due date)
                    const closestReadingDue = earliestDate(items.map(i => i.reading.dueDate));
                    const closestMeaningDue = earliestDate(items.map(i => i.meaning.dueDate));

                    baseItem.totalReviews = totalReviews;
                    baseItem.consecutiveFailures = consecutiveFailures;
                    baseItem.introductionAt = earliestIntro;
                    baseItem.stage = isGraduated ? 'graduated' : 'learning';

                    baseItem.reading = {
                        ...baseItem.reading,
                        memoryStrength: maxReadingStrength,
                        interval: maxReadingInterval,
                        dueDate: closestReadingDue,
                        history: allReadingHistory
                    };

                    baseItem.meaning = {
                        ...baseItem.meaning,
                        memoryStrength: maxMeaningStrength,
                        interval: maxMeaningInterval,
                        dueDate: closestMeaningDue,
                        history: allMeaningHistory
                    };

                    updatedQueue.push(baseItem);
                }
            }

            // [FIX] Rescue existing 0-memory strength items from infinite loop
            updatedQueue.forEach(item => {
                if (item.reading.memoryStrength === 0) {
                    item.reading.memoryStrength = CONSTANTS.srs.formula.minMemoryStrength;
                }
                if (item.meaning.memoryStrength === 0) {
                    item.meaning.memoryStrength = CONSTANTS.srs.formula.minMemoryStrength;
                }
            });

            return {
                ...progress,
                learningQueue: updatedQueue,
                _formatVersion: MERGED_VOCAB_VERSION
            };

        } catch (e) {
            console.error("Failed to migrate to merged vocabs:", e);
            return progress; // Fallback without migration if fetch fails
        }
    }

    /**
     * Async migration - transfers grammar progress off any id that is no longer
     * introduced on its own, onto the id that replaced it.
     *
     * TWO sources feed the same remap, because they strand a stored entry in
     * exactly the same way:
     *
     *  - `index/aliases.json`: points the dataset DROPPED as duplicates ingested
     *    twice from the upstream files (`～ても` was both n3-052 and n4-097).
     *    These 404 on `loadGrammarPoint`.
     *  - `index/variant-groups.json`: points demoted to REALIZATION VARIANTS of
     *    a canonical (それじゃ and じゃ are それでは contracted; どこにも was six
     *    entries for one rule). These still load, which is worse in one way: the
     *    learner keeps drilling them as separate cards alongside the canonical,
     *    which is the exact duplication collapsing them was meant to remove.
     *
     * A dropped id is the sharper edge - `loadGrammarPoint` 404s while
     * `collectActionableGrammarIds`/`selectGrammarSessionStats` still count it
     * as due, so the session can never complete - but both cost the user review
     * history if left alone, and the fix is one remap either way.
     *
     * Merge policy when BOTH ids have progress (the user was introduced to each
     * independently): keep the STRONGER entry - higher memoryStrength, ties
     * broken by more reviews - then take the earliest introduction, the soonest
     * due date, the union of history, and graduated if either had graduated.
     * That mirrors migrateMergedVocabsAsync's own max-based policy, so the two
     * merges don't disagree. It does discard the weaker entry's strength, which
     * is unavoidable: two entries become one.
     */
    static async migrateGrammarQueueIdsAsync(progress: UserProgress): Promise<UserProgress> {
        const currentVersion = progress._formatVersion ?? 0;
        if (currentVersion >= CURRENT_FORMAT_VERSION) return progress;

        const stamp = (queue: GrammarProgress[]): UserProgress =>
            ({ ...progress, grammarQueue: queue, _formatVersion: CURRENT_FORMAT_VERSION });

        try {
            const [aliases, variantGroups] = await Promise.all([
                GrammarService.loadAliases(),
                GrammarService.loadVariantGroups(),
            ]);
            const queue = progress.grammarQueue;

            // One remap from both sources. Aliases win a collision: a dropped id
            // cannot be loaded at all, so its target is the only reachable one.
            const remap: Record<string, string> = {};
            for (const [canonicalId, members] of Object.entries(variantGroups)) {
                for (const member of members) {
                    if (member.id !== canonicalId) remap[member.id] = canonicalId;
                }
            }
            Object.assign(remap, aliases);

            // Nothing stored against a retired id - stamp and move on rather
            // than rebuilding an identical queue.
            if (Object.keys(remap).length === 0 || !queue.some(g => remap[g.grammarId])) {
                return stamp(queue);
            }

            const byCanonicalId = new Map<string, GrammarProgress[]>();
            for (const item of queue) {
                const canonicalId = remap[item.grammarId] ?? item.grammarId;
                const bucket = byCanonicalId.get(canonicalId) ?? [];
                bucket.push(item);
                byCanonicalId.set(canonicalId, bucket);
            }

            const merged: GrammarProgress[] = [];
            for (const [canonicalId, items] of byCanonicalId) {
                if (items.length === 1) {
                    merged.push({ ...items[0], grammarId: canonicalId });
                    continue;
                }

                const strongest = items.reduce((best, item) =>
                    item.entry.memoryStrength > best.entry.memoryStrength ? item
                        : item.entry.memoryStrength < best.entry.memoryStrength ? best
                            : item.totalReviews > best.totalReviews ? item : best
                );

                const dates = (values: (Date | null)[]) =>
                    values.filter((v): v is Date => v !== null)
                        .sort((a, b) => a.getTime() - b.getTime());

                const introductions = dates(items.map(i => i.introductionAt));
                const dueDates = dates(items.map(i => i.nextReviewAt));
                const lastReviews = dates(items.map(i => i.lastReviewedAt));

                const history = new Map<number, ReviewLog>();
                for (const item of items) {
                    for (const log of item.entry.history) history.set(log.date, log);
                }

                merged.push({
                    ...strongest,
                    grammarId: canonicalId,
                    stage: items.some(i => i.stage === 'graduated') ? 'graduated' : 'learning',
                    introductionAt: introductions[0] ?? null,
                    nextReviewAt: dueDates[0] ?? null,
                    lastReviewedAt: lastReviews[lastReviews.length - 1] ?? null,
                    totalReviews: Math.max(...items.map(i => i.totalReviews)),
                    consecutiveFailures: Math.max(...items.map(i => i.consecutiveFailures)),
                    needsRetry: items.some(i => i.needsRetry === true) ? true : undefined,
                    entry: {
                        ...strongest.entry,
                        history: Array.from(history.values()).sort((a, b) => a.date - b.date),
                    },
                });
            }

            return stamp(merged);

        } catch (e) {
            // Leave the queue untouched rather than risk destroying progress on a
            // transient failure. needsMigration() keeps returning true, so this
            // simply retries next time.
            console.error('Failed to migrate grammar queue ids:', e);
            return progress;
        }
    }

    /**
     * Runs every async migration pass in order. Call sites use this rather than
     * an individual pass, so adding a pass doesn't mean touching all of them.
     */
    static async migrateAsync(progress: UserProgress): Promise<UserProgress> {
        const afterVocab = await this.migrateMergedVocabsAsync(progress);
        return this.migrateGrammarQueueIdsAsync(afterVocab);
    }

    /**
     * Check if data needs migration
     */
    static needsMigration(progress: StoredProgress): boolean {
        const currentVersion = progress._formatVersion ?? 0;
        return currentVersion < CURRENT_FORMAT_VERSION;
    }
}

/** The earliest of some optional dates, compared as instants (a default sort would compare their strings). */
function earliestDate(values: (Date | null)[]): Date | null {
    return values.reduce<Date | null>((earliest, d) => (d && (!earliest || d < earliest) ? d : earliest), null);
}