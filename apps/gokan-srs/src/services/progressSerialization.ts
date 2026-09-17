import type { UserProgress, UserSettings } from "../models/user.model";
import type { VocabProgress } from "../models/vocabulary.model";
import { DEFAULT_VOCABULARY_PROGRESS } from "../models/vocabulary.model";
import { DEFAULT_PROGRESS } from "../models/user.model";
import type { GrammarProgress } from "../models/grammar.model";
import { DEFAULT_GRAMMAR_PROGRESS } from "../models/grammar.model";
import { MigrationService } from "./migration.service";
import type {ProgressWithMetadata} from "./sync/types";

/**
 * Single source of truth for progress (de)serialization, shared by localStorage
 * persistence and Google Drive sync so a stored payload always hydrates into the
 * exact same in-memory shape regardless of which channel it came from.
 */

/** JSON-safe plain object: Sets become arrays, Dates become ISO strings (via JSON.stringify). */
export function toPlainProgressJSON(progress: UserProgress): any {
    return JSON.parse(JSON.stringify(progress, (_key, value) => (value instanceof Set ? [...value] : value)));
}

/** Hydrates a raw parsed-JSON progress object (already migrated) into a UserProgress with real Dates/Sets. */
export function hydrateProgress(migrated: any): UserProgress {
    const learningQueue: VocabProgress[] = (migrated.learningQueue ?? []).map((elem: any) => ({
        ...DEFAULT_VOCABULARY_PROGRESS,
        ...elem,
        nextReviewAt: hydrateDate(elem.nextReviewAt),
        lastReviewedAt: hydrateDate(elem.lastReviewedAt),
        introductionAt: hydrateDate(elem.introductionAt),
        reading: {
            ...elem.reading,
            lastReviewedAt: hydrateDate(elem.reading?.lastReviewedAt),
            dueDate: hydrateDate(elem.reading?.dueDate),
        },
        meaning: {
            ...elem.meaning,
            lastReviewedAt: hydrateDate(elem.meaning?.lastReviewedAt),
            dueDate: hydrateDate(elem.meaning?.dueDate),
        },
        // Always rebuilt, never left to the DEFAULT_VOCABULARY_PROGRESS spread above:
        // that would hand every item in the queue the same entry object to share.
        //
        // Omitting this hydration is silent and total rather than loud: an
        // un-hydrated dueDate stays a string, every `dueDate <= now` comparison
        // against a Date evaluates false, and the production quiz simply never comes
        // due. Nothing throws and no test of the pure logic notices, because the
        // strings only exist on the far side of a storage round trip.
        production: {
            ...DEFAULT_VOCABULARY_PROGRESS.production,
            ...elem.production,
            lastReviewedAt: hydrateDate(elem.production?.lastReviewedAt),
            dueDate: hydrateDate(elem.production?.dueDate),
        },
    }));

    const grammarQueue: GrammarProgress[] = (migrated.grammarQueue ?? []).map((elem: any) => ({
        ...DEFAULT_GRAMMAR_PROGRESS,
        ...elem,
        nextReviewAt: hydrateDate(elem.nextReviewAt),
        lastReviewedAt: hydrateDate(elem.lastReviewedAt),
        introductionAt: hydrateDate(elem.introductionAt),
        entry: {
            ...elem.entry,
            lastReviewedAt: hydrateDate(elem.entry?.lastReviewedAt),
            dueDate: hydrateDate(elem.entry?.dueDate),
        },
    }));

    return {
        ...DEFAULT_PROGRESS,
        ...migrated,
        kanjiKnowledge: {
            ...migrated.kanjiKnowledge,
            kanjiSet: new Set(migrated.kanjiKnowledge?.kanjiSet ?? []),
        },
        learningQueue,
        grammarQueue,
    };
}

/** Runs migration then hydration - the full raw-JSON -> UserProgress pipeline.
 *  Settings must be passed whenever they are known: the migration pass re-derives
 *  nextReviewAt, and doing so without settings assumes meaning quizzes are enabled,
 *  which diverges from the settings-aware derivation used everywhere else. */
export function migrateAndHydrateProgress(parsed: any, settings?: Pick<UserSettings, 'enableMeaningQuiz'>): UserProgress {
    const migrated = MigrationService.migrateUserProgress(parsed, settings);
    return hydrateProgress(migrated);
}

/**
 * Accepts a Date, an ISO date string, null, or undefined - always returns a real
 * Date or null. Unlike a plain truthy check, this never silently swallows a
 * value that is already a Date instance.
 */
function hydrateDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') return new Date(value);
    return null;
}

/**
 * Canonical JSON stringification: object keys are sorted recursively, Dates
 * become ISO strings, Sets become sorted arrays. Two structurally-equal values
 * always produce the same string, regardless of key insertion order - which
 * differs between hydrated-from-storage objects and merge-produced objects.
 */
export function stableStringify(value: unknown): string {
    return JSON.stringify(sortDeep(value));
}

function sortDeep(value: any): any {
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Set) return [...value].sort();
    if (Array.isArray(value)) return value.map(sortDeep);
    if (value && typeof value === 'object') {
        const sorted: Record<string, any> = {};
        for (const key of Object.keys(value).sort()) sorted[key] = sortDeep(value[key]);
        return sorted;
    }
    return value;
}

/**
 * Derive a stable content signature from the progress object, ignoring the
 * _sync metadata (which bumps on every merge even when nothing changed).
 */
export function progressUploadSignature(p: UserProgress | null): string | null {
    if (!p) return null;
    const { _sync, ...rest } = p as ProgressWithMetadata;
    void _sync;
    return stableStringify(rest);
}
