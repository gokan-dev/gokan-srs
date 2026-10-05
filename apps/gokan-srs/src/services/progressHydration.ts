import type { AdaptiveStats, Calibration, KanjiKnowledge, UserProgress, UserSettings } from "../models/user.model";
import type { WatchedEpisode } from "../models/media.model";
import type { NeedsRetryFlags, ReviewLog, SRSEntry, VocabProgress } from "../models/vocabulary.model";
import { DEFAULT_SRS_ENTRY, DEFAULT_VOCABULARY_PROGRESS } from "../models/vocabulary.model";
import { DEFAULT_PROGRESS } from "../models/user.model";
import type { GrammarProgress } from "../models/grammar.model";
import { DEFAULT_GRAMMAR_PROGRESS } from "../models/grammar.model";
import type { ProgressWithMetadata } from "./sync/types";

/**
 * The stored shape of progress, and its hydration into real objects.
 *
 * Stored data is NOT a UserProgress. After a JSON round trip every Date is an ISO
 * string and every Set an array, and a payload written by an older build can lack
 * any field added since. `Stored<T>` says exactly that, so nothing reads a stored
 * value as if it were already hydrated: the migration (migration.service.ts) and
 * the functions below are the only code that ever sees one.
 */

/** A stored date: an ISO string after a JSON round trip, or still a Date when the object never left memory. */
export type StoredDate = string | Date;

/** The shape of `T` as it comes back from storage: dates and sets serialized, every field possibly missing. */
export type Stored<T> =
    T extends Date ? StoredDate
        : T extends Set<infer U> ? readonly U[] | Set<U>
            : T extends readonly (infer U)[] ? Stored<U>[]
                : T extends object ? { [K in keyof T]?: Stored<T[K]> }
                    : T;

/** A stored vocab item, including the two shapes older builds wrote. */
export interface StoredVocabProgress extends Omit<Stored<VocabProgress>, 'needsRetry'> {
    /** Pre-v3 single mastery percentage (0-100), converted into the reading entry by the migration. */
    mastery?: number;
    /** Before the retry flag became per quiz type it was one boolean, always about reading. */
    needsRetry?: boolean | Stored<NeedsRetryFlags>;
}

/** A stored progress payload, from either localStorage or Google Drive. */
export interface StoredProgress extends Omit<Stored<ProgressWithMetadata>, 'learningQueue'> {
    learningQueue?: StoredVocabProgress[];
}

/**
 * The parsed JSON of a stored progress payload. Every field of StoredProgress is
 * optional, so any JSON object is one; the migration fills in what is missing.
 */
export function parseStoredProgress(json: string): StoredProgress {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Stored progress is not a JSON object');
    }
    return parsed;
}

/** The parsed JSON of stored settings, laid over the defaults so a field added since is always present. */
export function parseStoredSettings(json: string, defaults: UserSettings): UserSettings {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ...defaults };
    return { ...defaults, ...(parsed as Partial<UserSettings>) };
}

/**
 * Accepts a Date, an ISO date string, null, or undefined - always returns a real
 * Date or null. Unlike a plain truthy check, this never silently swallows a
 * value that is already a Date instance.
 */
export function hydrateDate(value: StoredDate | null | undefined): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    return new Date(value);
}

/**
 * A stored review log. Logs carry no Date (the date is epoch ms), but logs written
 * by early builds can lack the interval and latency fields, which every consumer
 * reads as numbers. A log without a date or a result cannot be placed or scored
 * anywhere; every build has always written both, so this only drops corrupt data.
 */
function hydrateReviewLog(log: Stored<ReviewLog>): ReviewLog | null {
    if (typeof log.date !== 'number' || log.result === undefined) return null;
    return {
        ...log,
        date: log.date,
        result: log.result,
        interval: log.interval ?? 0,
        latency: log.latency ?? 0,
    };
}

/**
 * Always builds a fresh entry, never returns DEFAULT_SRS_ENTRY itself: sharing one
 * entry object between items would let a mutation of one leak into every other.
 *
 * Omitting this hydration is silent and total rather than loud: an un-hydrated
 * dueDate stays a string, every `dueDate <= now` comparison against a Date
 * evaluates false, and the quiz simply never comes due. Nothing throws and no
 * test of the pure logic notices, because the strings only exist on the far side
 * of a storage round trip.
 */
export function hydrateSRSEntry(entry: Stored<SRSEntry> | undefined): SRSEntry {
    return {
        ...DEFAULT_SRS_ENTRY,
        ...entry,
        lastReviewedAt: hydrateDate(entry?.lastReviewedAt),
        dueDate: hydrateDate(entry?.dueDate),
        history: (entry?.history ?? []).map(hydrateReviewLog).filter((log): log is ReviewLog => log !== null),
    };
}

/** The three SRS entries of a vocab item, when the migration rebuilds them instead of reading them. */
export type VocabEntries = Pick<VocabProgress, 'reading' | 'meaning'> & { production: SRSEntry };

/**
 * Hydrates one stored vocab item whose legacy fields the migration has already
 * converted. The spread keeps every field this build does not know, so a payload
 * written by a newer build survives a round trip through an older one.
 */
export function hydrateVocabProgress(
    item: StoredVocabProgress,
    needsRetry: NeedsRetryFlags | undefined,
    entries: VocabEntries = {
        reading: hydrateSRSEntry(item.reading),
        meaning: hydrateSRSEntry(item.meaning),
        production: hydrateSRSEntry(item.production),
    },
): VocabProgress {
    return {
        ...DEFAULT_VOCABULARY_PROGRESS,
        ...item,
        vocabId: item.vocabId ?? '',
        nextReviewAt: hydrateDate(item.nextReviewAt),
        lastReviewedAt: hydrateDate(item.lastReviewedAt),
        introductionAt: hydrateDate(item.introductionAt),
        ...entries,
        needsRetry,
    };
}

export function hydrateGrammarProgress(item: Stored<GrammarProgress>): GrammarProgress {
    return {
        ...DEFAULT_GRAMMAR_PROGRESS,
        ...item,
        nextReviewAt: hydrateDate(item.nextReviewAt),
        lastReviewedAt: hydrateDate(item.lastReviewedAt),
        introductionAt: hydrateDate(item.introductionAt),
        entry: hydrateSRSEntry(item.entry),
    };
}

export function hydrateKanjiKnowledge(stored: Stored<KanjiKnowledge> | undefined): KanjiKnowledge {
    return {
        method: stored?.method ?? 'kklc',
        step: stored?.step ?? 0,
        kanjiSet: new Set(stored?.kanjiSet ?? []),
    };
}

export function hydrateStats(stored: Stored<UserProgress['stats']> | undefined): UserProgress['stats'] {
    return { ...DEFAULT_PROGRESS.stats, ...stored };
}

export function hydrateAdaptiveStats(stored: Stored<AdaptiveStats> | undefined): AdaptiveStats {
    return { level: stored?.level ?? 1.0, history: [...(stored?.history ?? [])] };
}

/** Absent stays absent: the calibration seeds itself from the review logs when there is none. */
export function hydrateCalibration(stored: Stored<Calibration> | undefined): Calibration | undefined {
    if (!stored) return undefined;
    return {
        reading: hydrateAdaptiveStats(stored.reading),
        meaning: hydrateAdaptiveStats(stored.meaning),
        production: hydrateAdaptiveStats(stored.production),
        grammar: hydrateAdaptiveStats(stored.grammar),
    };
}

/**
 * The listening library's marks. Absent stays absent (progress that never used the
 * library carries no field); a mark missing either field cannot be merged, so it is
 * dropped rather than guessed.
 */
export function hydrateWatchedEpisodes(
    stored: Stored<Record<string, WatchedEpisode>> | undefined,
): Record<string, WatchedEpisode> | undefined {
    if (!stored) return undefined;
    const episodes: Record<string, WatchedEpisode> = {};
    for (const [key, mark] of Object.entries(stored)) {
        if (typeof mark?.watched !== 'boolean' || typeof mark.updatedAt !== 'number') continue;
        episodes[key] = { ...mark, watched: mark.watched, updatedAt: mark.updatedAt };
    }
    return episodes;
}
